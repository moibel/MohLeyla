-- MohLeyla calls: private one-to-one voice and video calls, started from a chat. Run once in Supabase after 008_chat_attachments.sql.
--
-- Who can call (decided by the owner): an admin can call anyone they have a chat with; a teacher can call a student of one of the teacher's
-- own classes. Students cannot start calls, but they can answer and decline. A call belongs to one conversation and only its two people
-- can take part.
--
-- How it works: the call is peer-to-peer in the browsers (WebRTC). This database only (1) records that a call exists and its state, and
-- (2) passes the small connection messages (offer, answer, network candidates) between the two people. No audio or video ever touches
-- the database, and NOTHING is recorded: unlike chat text, a call cannot be read by an admin afterwards.
--
-- Security model
--   * The tables have no direct access (row level security on, every privilege revoked); everything goes through these checked functions.
--   * Only the two people in the conversation can see a call or its connection messages.
--   * A missed, declined or finished call leaves one small line in the chat ("Missed video call", "Voice call, 3 min").

create table if not exists public.calls (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  caller_id       uuid not null references auth.users (id) on delete cascade,
  media           text not null check (media in ('audio', 'video')),
  status          text not null default 'ringing' check (status in ('ringing', 'active', 'ended', 'declined', 'missed')),
  created_at      timestamptz not null default clock_timestamp(),
  answered_at     timestamptz,
  ended_at        timestamptz
);
create index if not exists calls_conv_idx on public.calls (conversation_id, created_at desc);

create table if not exists public.call_signals (
  id         bigint generated always as identity primary key,
  call_id    uuid not null references public.calls (id) on delete cascade,
  sender_id  uuid not null references auth.users (id) on delete cascade,
  kind       text not null check (kind in ('offer', 'answer', 'ice', 'bye')),
  payload    jsonb not null,
  created_at timestamptz not null default clock_timestamp(),
  check (pg_column_size(payload) <= 16384)
);
create index if not exists call_signals_call_idx on public.call_signals (call_id, id);

alter table public.calls enable row level security;
alter table public.call_signals enable row level security;
revoke all on public.calls, public.call_signals from anon, authenticated;

-- chat messages can now also be a small call record
alter table public.chat_messages drop constraint if exists chat_messages_kind_check;
alter table public.chat_messages drop constraint if exists chat_messages_content_check;
alter table public.chat_messages add constraint chat_messages_kind_check check (kind in ('text', 'voice', 'image', 'call'));
alter table public.chat_messages add constraint chat_messages_content_check check (
  (kind = 'text'  and char_length(body) between 1 and 1000 and file_path is null) or
  (kind = 'call'  and char_length(body) between 1 and 60 and file_path is null) or
  (kind in ('voice', 'image') and char_length(body) <= 200 and file_path is not null and file_size between 1 and 5242880)
);

create or replace function public.call_member(p_call uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and exists (
    select 1 from public.calls k join public.conversations c on c.id = k.conversation_id where k.id = p_call and auth.uid() in (c.user_a, c.user_b))
$$;

-- A call is closed: write its line into the chat.
create or replace function public.finish_call(p_call uuid, p_status text) returns void
language plpgsql security definer set search_path = public as $$
declare k public.calls;
begin
  select * into k from public.calls where id = p_call;
  update public.calls set status = p_status, ended_at = clock_timestamp() where id = p_call;
  insert into public.chat_messages (conversation_id, sender_id, body, kind, created_at)
    values (k.conversation_id, k.caller_id,
            k.media || ':' || p_status || case when p_status = 'ended' and k.answered_at is not null then ':' || greatest(1, round(extract(epoch from (clock_timestamp() - k.answered_at)) / 60)::int)::text else '' end,
            'call', clock_timestamp());
  update public.conversations set last_message_at = clock_timestamp() where id = k.conversation_id;
end $$;

-- Start a call (admin: anyone in a chat with them; teacher: a student of their classes).
create or replace function public.start_call(p_conv uuid, p_media text) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_me uuid := auth.uid(); c public.conversations; v_other uuid; v_id uuid; old record;
begin
  if not public.is_chat_member(p_conv) then raise exception 'not allowed' using errcode = '42501'; end if;
  if p_media not in ('audio', 'video') then raise exception 'unknown call type' using errcode = '22023'; end if;
  select * into c from public.conversations where id = p_conv;
  v_other := case when c.user_a = v_me then c.user_b else c.user_a end;
  if not (public.is_admin() or exists (
        select 1 from public.classes cl join public.class_members m on m.class_id = cl.id where cl.teacher_id = v_me and m.student_id = v_other)) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  -- stale calls (nobody answered within a minute, or active for hours) are closed first
  for old in select id, status from public.calls where conversation_id = p_conv and status in ('ringing', 'active')
             and ((status = 'ringing' and created_at < clock_timestamp() - interval '60 seconds') or created_at < clock_timestamp() - interval '6 hours') loop
    perform public.finish_call(old.id, case when old.status = 'ringing' then 'missed' else 'ended' end);
  end loop;
  if exists (select 1 from public.calls where conversation_id = p_conv and status in ('ringing', 'active')) then raise exception 'a call is already in progress' using errcode = '55000'; end if;
  if (select count(*) from public.calls where caller_id = v_me and created_at > clock_timestamp() - interval '10 minutes') >= 10 then raise exception 'slow down' using errcode = '54000'; end if;
  insert into public.calls (conversation_id, caller_id, media) values (p_conv, v_me, p_media) returning id into v_id;
  delete from public.call_signals where created_at < clock_timestamp() - interval '1 day';
  return v_id;
end $$;

create or replace function public.answer_call(p_call uuid) returns void
language plpgsql security definer set search_path = public as $$
declare k public.calls;
begin
  if not public.call_member(p_call) then raise exception 'not allowed' using errcode = '42501'; end if;
  select * into k from public.calls where id = p_call;
  if k.caller_id = auth.uid() then raise exception 'you started this call' using errcode = '22023'; end if;
  if k.status <> 'ringing' or k.created_at < clock_timestamp() - interval '90 seconds' then raise exception 'call is over' using errcode = '55000'; end if;
  update public.calls set status = 'active', answered_at = clock_timestamp() where id = p_call;
end $$;

-- Hang up, cancel, or decline. Whoever is in the call may do it.
create or replace function public.end_call(p_call uuid) returns void
language plpgsql security definer set search_path = public as $$
declare k public.calls;
begin
  if not public.call_member(p_call) then raise exception 'not allowed' using errcode = '42501'; end if;
  select * into k from public.calls where id = p_call;
  if k.status in ('ended', 'declined', 'missed') then return; end if;
  perform public.finish_call(p_call, case when k.status = 'active' then 'ended' when k.caller_id = auth.uid() then 'missed' else 'declined' end);
  insert into public.call_signals (call_id, sender_id, kind, payload) values (p_call, auth.uid(), 'bye', '{}'::jsonb);
end $$;

create or replace function public.call_signal_send(p_call uuid, p_kind text, p_payload jsonb) returns bigint
language plpgsql security definer set search_path = public as $$
declare k public.calls; v_id bigint;
begin
  if not public.call_member(p_call) then raise exception 'not allowed' using errcode = '42501'; end if;
  if p_kind not in ('offer', 'answer', 'ice') then raise exception 'unknown message' using errcode = '22023'; end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' or pg_column_size(p_payload) > 16384 then raise exception 'bad payload' using errcode = '22023'; end if;
  select * into k from public.calls where id = p_call;
  if k.status not in ('ringing', 'active') then raise exception 'call is over' using errcode = '55000'; end if;
  if (select count(*) from public.call_signals where sender_id = auth.uid() and created_at > clock_timestamp() - interval '1 minute') >= 300 then raise exception 'slow down' using errcode = '54000'; end if;
  insert into public.call_signals (call_id, sender_id, kind, payload) values (p_call, auth.uid(), p_kind, p_payload) returning id into v_id;
  return v_id;
end $$;

-- The call's state and the other person's connection messages after a given id.
create or replace function public.call_poll(p_call uuid, p_after bigint default 0)
returns table (status text, media text, i_am_caller boolean, signal_id bigint, kind text, payload jsonb)
language plpgsql stable security definer set search_path = public as $$
declare k public.calls;
begin
  if not public.call_member(p_call) then raise exception 'not allowed' using errcode = '42501'; end if;
  select * into k from public.calls where id = p_call;
  return query
    select k.status, k.media, k.caller_id = auth.uid(), null::bigint, null::text, null::jsonb
    union all
    (select k.status, k.media, k.caller_id = auth.uid(), s.id, s.kind, s.payload
       from public.call_signals s where s.call_id = p_call and s.sender_id <> auth.uid() and s.id > coalesce(p_after, 0) order by s.id limit 200);
end $$;

-- Calls ringing for me right now (started in the last 60 seconds by the other person).
create or replace function public.my_incoming_calls()
returns table (call_id uuid, conversation_id uuid, caller_id uuid, caller_name text, media text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select k.id, k.conversation_id, k.caller_id, public.display_name_of(k.caller_id), k.media, k.created_at
  from public.calls k join public.conversations c on c.id = k.conversation_id
  where auth.uid() is not null and auth.uid() in (c.user_a, c.user_b) and k.caller_id <> auth.uid()
    and k.status = 'ringing' and k.created_at > clock_timestamp() - interval '60 seconds'
  order by k.created_at desc
$$;

revoke all on function public.call_member(uuid), public.finish_call(uuid, text), public.start_call(uuid, text), public.answer_call(uuid), public.end_call(uuid),
  public.call_signal_send(uuid, text, jsonb), public.call_poll(uuid, bigint), public.my_incoming_calls() from public, anon, authenticated;
grant execute on function public.start_call(uuid, text), public.answer_call(uuid), public.end_call(uuid),
  public.call_signal_send(uuid, text, jsonb), public.call_poll(uuid, bigint), public.my_incoming_calls() to authenticated;
