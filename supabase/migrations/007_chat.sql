-- MohLeyla chat: private one-to-one conversations, and a notifications count.
-- Run once in Supabase: SQL Editor -> New query -> paste -> Run. Needs 002_roles_classes.sql first. Additive: nothing existing changes.
--
-- Who can chat (decided by the owner)
--   * An admin can start a chat with any user. A teacher can start a chat with a student of one of the teacher's own classes.
--     Students cannot start chats, but once a chat exists both people can write in it.
--   * A conversation is private to its two people. NOBODY else can read or write it, with one exception the owner asked for:
--     an admin can READ every conversation (to keep everyone safe) and remove a message. An admin cannot write inside other people's chats.
--   * The app tells every learner that admins can read chats.
--
-- Security model
--   * The three tables have no direct access (row level security on, no policies, every privilege revoked): everything goes through the
--     functions below, each of which checks who is calling.
--   * Messages are plain text, 1-1000 characters; at most 20 per minute per person.

create table if not exists public.conversations (
  id              uuid primary key default gen_random_uuid(),
  user_a          uuid not null references auth.users (id) on delete cascade,
  user_b          uuid not null references auth.users (id) on delete cascade,
  created_by      uuid references auth.users (id) on delete set null,
  created_at      timestamptz not null default now(),
  last_message_at timestamptz not null default now(),
  check (user_a <> user_b)
);
create unique index if not exists conversations_pair_idx on public.conversations (least(user_a, user_b), greatest(user_a, user_b));
create index if not exists conversations_a_idx on public.conversations (user_a);
create index if not exists conversations_b_idx on public.conversations (user_b);

create table if not exists public.chat_messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id       uuid references auth.users (id) on delete set null,
  body            text not null check (char_length(body) between 1 and 1000),
  created_at      timestamptz not null default now(),
  removed_at      timestamptz,
  removed_by      uuid references auth.users (id) on delete set null
);
create index if not exists chat_messages_conv_idx on public.chat_messages (conversation_id, created_at);

create table if not exists public.chat_reads (
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  user_id         uuid not null references auth.users (id) on delete cascade,
  last_read_at    timestamptz not null default 'epoch',
  primary key (conversation_id, user_id)
);

alter table public.conversations enable row level security;
alter table public.chat_messages enable row level security;
alter table public.chat_reads enable row level security;
revoke all on public.conversations, public.chat_messages, public.chat_reads from anon, authenticated;

create or replace function public.display_name_of(p_user uuid) returns text
language sql stable security definer set search_path = public, auth as $$
  select coalesce(nullif(u.raw_user_meta_data->>'display_name', ''), nullif(u.raw_user_meta_data->>'full_name', ''), nullif(u.raw_user_meta_data->>'name', ''), split_part(u.email, '@', 1))
  from auth.users u where u.id = p_user
$$;

create or replace function public.is_chat_member(p_conv uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and exists (select 1 from public.conversations c where c.id = p_conv and auth.uid() in (c.user_a, c.user_b))
$$;

-- Start (or find) the chat with another person. Admin: anyone. Teacher: a student of one of their classes.
create or replace function public.start_chat(p_other uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_me uuid := auth.uid(); v_id uuid;
begin
  if v_me is null then raise exception 'sign in first' using errcode = '42501'; end if;
  if p_other is null or p_other = v_me or not exists (select 1 from auth.users where id = p_other) then raise exception 'unknown person' using errcode = '22023'; end if;
  if not (public.is_admin() or exists (
        select 1 from public.classes c join public.class_members m on m.class_id = c.id
        where c.teacher_id = v_me and m.student_id = p_other)) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  select id into v_id from public.conversations where least(user_a, user_b) = least(v_me, p_other) and greatest(user_a, user_b) = greatest(v_me, p_other);
  if v_id is null then
    insert into public.conversations (user_a, user_b, created_by) values (v_me, p_other, v_me) returning id into v_id;
  end if;
  return v_id;
end $$;

create or replace function public.send_message(p_conv uuid, p_body text) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_body text := btrim(coalesce(p_body, '')); v_id uuid;
begin
  if not public.is_chat_member(p_conv) then raise exception 'not allowed' using errcode = '42501'; end if;
  if char_length(v_body) not between 1 and 1000 then raise exception 'a message is 1-1000 characters' using errcode = '22023'; end if;
  if (select count(*) from public.chat_messages where sender_id = auth.uid() and created_at > clock_timestamp() - interval '1 minute') >= 20 then
    raise exception 'slow down' using errcode = '54000';
  end if;
  insert into public.chat_messages (conversation_id, sender_id, body, created_at) values (p_conv, auth.uid(), v_body, clock_timestamp()) returning id into v_id;
  update public.conversations set last_message_at = clock_timestamp() where id = p_conv;
  insert into public.chat_reads (conversation_id, user_id, last_read_at) values (p_conv, auth.uid(), clock_timestamp())
    on conflict (conversation_id, user_id) do update set last_read_at = excluded.last_read_at;
  return v_id;
end $$;

create or replace function public.my_chats()
returns table (conversation_id uuid, other_id uuid, other_name text, other_role text, last_body text, last_at timestamptz, last_is_mine boolean, unread int)
language sql stable security definer set search_path = public as $$
  select c.id,
         o.oid, public.display_name_of(o.oid), coalesce((select p.role from public.profiles p where p.user_id = o.oid), 'student'),
         (select case when m.removed_at is not null then '' else left(m.body, 120) end from public.chat_messages m where m.conversation_id = c.id order by m.created_at desc limit 1),
         c.last_message_at,
         coalesce((select m.sender_id = auth.uid() from public.chat_messages m where m.conversation_id = c.id order by m.created_at desc limit 1), false),
         (select count(*)::int from public.chat_messages m
            where m.conversation_id = c.id and m.sender_id is distinct from auth.uid() and m.removed_at is null
              and m.created_at > coalesce((select r.last_read_at from public.chat_reads r where r.conversation_id = c.id and r.user_id = auth.uid()), 'epoch'))
  from public.conversations c
  cross join lateral (select case when c.user_a = auth.uid() then c.user_b else c.user_a end as oid) o
  where auth.uid() is not null and auth.uid() in (c.user_a, c.user_b)
  order by c.last_message_at desc
$$;

create or replace function public.chat_messages_of(p_conv uuid)
returns table (id uuid, mine boolean, body text, created_at timestamptz, removed boolean)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_chat_member(p_conv) then raise exception 'not allowed' using errcode = '42501'; end if;
  return query
    select m.id, m.sender_id = auth.uid(), case when m.removed_at is not null then '' else m.body end, m.created_at, m.removed_at is not null
    from (select * from public.chat_messages x where x.conversation_id = p_conv order by x.created_at desc limit 200) m
    order by m.created_at asc;
end $$;

create or replace function public.mark_chat_read(p_conv uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_chat_member(p_conv) then raise exception 'not allowed' using errcode = '42501'; end if;
  insert into public.chat_reads (conversation_id, user_id, last_read_at) values (p_conv, auth.uid(), clock_timestamp())
    on conflict (conversation_id, user_id) do update set last_read_at = excluded.last_read_at;
end $$;

create or replace function public.chat_unread_total() returns int
language sql stable security definer set search_path = public as $$
  select coalesce((select sum(u.unread)::int from public.my_chats() u), 0)
$$;

-- Admin: read every conversation (read-only) and remove a message.
create or replace function public.admin_list_chats()
returns table (conversation_id uuid, a_id uuid, a_name text, a_email text, b_id uuid, b_name text, b_email text, message_count bigint, last_at timestamptz)
language plpgsql stable security definer set search_path = public, auth as $$
begin
  if not public.is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  return query
    select c.id, c.user_a, public.display_name_of(c.user_a), ua.email::text, c.user_b, public.display_name_of(c.user_b), ub.email::text,
           (select count(*) from public.chat_messages m where m.conversation_id = c.id), c.last_message_at
    from public.conversations c
    join auth.users ua on ua.id = c.user_a
    join auth.users ub on ub.id = c.user_b
    order by c.last_message_at desc limit 300;
end $$;

create or replace function public.admin_chat_messages(p_conv uuid)
returns table (id uuid, sender_id uuid, sender_name text, body text, created_at timestamptz, removed boolean)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  return query
    select m.id, m.sender_id, public.display_name_of(m.sender_id), m.body, m.created_at, m.removed_at is not null
    from (select * from public.chat_messages x where x.conversation_id = p_conv order by x.created_at desc limit 500) m
    order by m.created_at asc;
end $$;

create or replace function public.admin_remove_message(p_msg uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  update public.chat_messages set removed_at = now(), removed_by = auth.uid() where id = p_msg and removed_at is null;
  if not found then raise exception 'message not found' using errcode = 'P0002'; end if;
end $$;

revoke all on function public.display_name_of(uuid), public.is_chat_member(uuid), public.start_chat(uuid), public.send_message(uuid, text), public.my_chats(),
  public.chat_messages_of(uuid), public.mark_chat_read(uuid), public.chat_unread_total(), public.admin_list_chats(), public.admin_chat_messages(uuid),
  public.admin_remove_message(uuid) from public, anon, authenticated;
grant execute on function public.start_chat(uuid), public.send_message(uuid, text), public.my_chats(), public.chat_messages_of(uuid), public.mark_chat_read(uuid),
  public.chat_unread_total(), public.admin_list_chats(), public.admin_chat_messages(uuid), public.admin_remove_message(uuid) to authenticated;
