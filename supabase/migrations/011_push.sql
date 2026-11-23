-- MohLeyla push notifications: device tokens, and a "tell the phone" hook on new messages, incoming calls, announcements and rewards.
-- Run once in Supabase after 010_calls.sql (needs 002-010). Additive. Safe to run before anything else is set up: until a push address is
-- stored in public.push_config (see docs/PUSH_NOTIFICATIONS.md) nothing is sent and nothing slows down.
--
-- How it works
--   * The app asks the phone for a notification token and stores it with register_push_token(). A token belongs to ONE person: if the same
--     phone signs in as someone else, the token moves to them. Signing out removes it (unregister_push_token).
--   * When something happens (a chat message, a ringing call, an announcement, a reward) a trigger passes "who" and "what" to the
--     Edge Function named in push_config via pg_net, together with a shared secret. The function looks up the tokens and talks to Apple
--     (APNs) and Google (FCM). The notification only names the sender ("Sara sent you a message"): the text of a chat message is never
--     put in a notification, so it cannot be read on a lock screen or by the push services.
--   * A failure in the push path never blocks the original action: every trigger swallows its own errors.
--
-- Security model
--   * push_tokens and push_config have no direct access (row level security on, every privilege revoked). The Edge Function uses the
--     service role; the app can only register and remove ITS OWN tokens through the two functions below.
--   * push_config holds the shared secret: only the database owner (SQL editor) can read or change it.

create table if not exists public.push_tokens (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  token        text not null unique check (char_length(token) between 32 and 4096 and token ~ '^[A-Za-z0-9:_.-]+$'),
  platform     text not null check (platform in ('ios', 'android')),
  lang         text not null default 'en' check (lang in ('ar', 'en', 'id')),
  created_at   timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);
create index if not exists push_tokens_user_idx on public.push_tokens (user_id);
alter table public.push_tokens enable row level security;
revoke all on public.push_tokens from anon, authenticated;

create table if not exists public.push_config (
  id     boolean primary key default true check (id),
  url    text not null check (url ~ '^https://[A-Za-z0-9.-]+/'),
  secret text not null check (char_length(secret) >= 24)
);
alter table public.push_config enable row level security;
revoke all on public.push_config from anon, authenticated;

create or replace function public.register_push_token(p_token text, p_platform text, p_lang text default 'en') returns void
language plpgsql security definer set search_path = public as $$
declare v_me uuid := auth.uid(); v_lang text := case when p_lang in ('ar', 'en', 'id') then p_lang else 'en' end;
begin
  if v_me is null then raise exception 'sign in first' using errcode = '42501'; end if;
  if p_platform not in ('ios', 'android') then raise exception 'unknown platform' using errcode = '22023'; end if;
  if p_token is null or char_length(p_token) not between 32 and 4096 or p_token !~ '^[A-Za-z0-9:_.-]+$' then raise exception 'bad token' using errcode = '22023'; end if;
  insert into public.push_tokens (user_id, token, platform, lang) values (v_me, p_token, p_platform, v_lang)
    on conflict (token) do update set user_id = excluded.user_id, platform = excluded.platform, lang = excluded.lang, last_seen_at = now();
  -- at most 10 phones per person: keep the newest
  delete from public.push_tokens where user_id = v_me and id not in (select id from public.push_tokens where user_id = v_me order by last_seen_at desc, created_at desc limit 10);
end $$;

create or replace function public.unregister_push_token(p_token text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'sign in first' using errcode = '42501'; end if;
  delete from public.push_tokens where token = p_token and user_id = auth.uid();
end $$;

-- Hand one event to the Edge Function. Never raises.
create or replace function public.push_send(p_users uuid[], p_kind text, p_payload jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare cfg public.push_config;
begin
  select * into cfg from public.push_config limit 1;
  if cfg.url is null or p_users is null or cardinality(p_users) = 0 then return; end if;
  begin
    perform net.http_post(url := cfg.url,
                          headers := jsonb_build_object('Content-Type', 'application/json', 'x-push-secret', cfg.secret),
                          body := jsonb_build_object('kind', p_kind, 'users', to_jsonb(p_users), 'payload', p_payload),
                          timeout_milliseconds := 3000);
  exception when others then null;
  end;
end $$;

-- A new chat message (text, voice note or photo) -> the other person. Only the sender's name goes out, never the message.
create or replace function public.push_on_chat_message() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  begin
    if new.kind in ('text', 'voice', 'image') and new.sender_id is not null then
      perform public.push_send(
        (select array_agg(u) from (select case when c.user_a = new.sender_id then c.user_b else c.user_a end as u from public.conversations c where c.id = new.conversation_id) x),
        'chat', jsonb_build_object('name', public.display_name_of(new.sender_id), 'conversation', new.conversation_id, 'media', new.kind));
    end if;
  exception when others then null;
  end;
  return new;
end $$;
drop trigger if exists push_chat_message on public.chat_messages;
create trigger push_chat_message after insert on public.chat_messages for each row execute function public.push_on_chat_message();

-- A call that starts ringing -> the other person.
create or replace function public.push_on_call() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  begin
    if new.status = 'ringing' then
      perform public.push_send(
        (select array_agg(u) from (select case when c.user_a = new.caller_id then c.user_b else c.user_a end as u from public.conversations c where c.id = new.conversation_id) x),
        'call', jsonb_build_object('name', public.display_name_of(new.caller_id), 'conversation', new.conversation_id, 'media', new.media));
    end if;
  exception when others then null;
  end;
  return new;
end $$;
drop trigger if exists push_call on public.calls;
create trigger push_call after insert on public.calls for each row execute function public.push_on_call();

-- A new announcement -> everyone with a registered phone / the class / the one person. Not the admin who sent it.
create or replace function public.push_on_announcement() returns trigger
language plpgsql security definer set search_path = public, auth as $$
declare v_users uuid[];
begin
  begin
    if new.archived_at is null and (new.expires_at is null or new.expires_at > now()) then
      if new.audience = 'all' then
        select array_agg(distinct t.user_id) into v_users from public.push_tokens t where t.user_id is distinct from new.created_by;
      elsif new.audience = 'class' then
        select array_agg(m.student_id) into v_users from public.class_members m where m.class_id = new.class_id and m.student_id is distinct from new.created_by;
      else
        select array_agg(u.id) into v_users from auth.users u where lower(u.email) = new.user_email and u.id is distinct from new.created_by;
      end if;
      perform public.push_send(v_users, 'announcement', jsonb_build_object('title', new.title, 'style', new.style));
    end if;
  exception when others then null;
  end;
  return new;
end $$;
drop trigger if exists push_announcement on public.announcements;
create trigger push_announcement after insert on public.announcements for each row execute function public.push_on_announcement();

-- A reward from an admin -> the person with that email address (if they have an account).
create or replace function public.push_on_reward() returns trigger
language plpgsql security definer set search_path = public, auth as $$
begin
  begin
    perform public.push_send((select array_agg(u.id) from auth.users u where lower(u.email) = new.email), 'reward', jsonb_build_object('kind', new.kind, 'amount', new.amount));
  exception when others then null;
  end;
  return new;
end $$;
drop trigger if exists push_reward on public.rewards;
create trigger push_reward after insert on public.rewards for each row execute function public.push_on_reward();

revoke all on function public.register_push_token(text, text, text), public.unregister_push_token(text), public.push_send(uuid[], text, jsonb),
  public.push_on_chat_message(), public.push_on_call(), public.push_on_announcement(), public.push_on_reward() from public, anon, authenticated;
grant execute on function public.register_push_token(text, text, text), public.unregister_push_token(text) to authenticated;
