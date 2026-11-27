-- MohLeyla security hardening and user-generated-content safety (block, report, suspend, terms). Run once in Supabase after
-- 013 (needs 001-013), as ONE script in the SQL editor (it then runs as one transaction). Additive; safe to run again.
--
-- BEFORE running on the live project: after this migration send_message, send_attachment and start_call refuse people who have not
-- accepted the terms (error ML001), and join_class returns NO ROWS for a wrong code. Ship the app version that handles both first.
--
-- New error codes the app can receive:  ML001 terms not accepted · ML002 this chat is blocked · ML003 this account is suspended.
--
-- Blocking and moderation: either person in a chat may block the other, including a student blocking a teacher or an admin. A block
-- only stops the two PEOPLE from reaching each other (messages, files, calls, their notifications). It never limits moderation: admins
-- still read every chat, remove messages, resolve reports, suspend accounts, and can still send an announcement to one person.

-- ================================================================ helpers: safe reading of data the browser writes (H1)
create or replace function public.safe_int(p jsonb) returns int
language sql immutable set search_path = public as $$
  select case when jsonb_typeof(p) = 'number' then floor(least(greatest((p #>> '{}')::numeric, 0), 1000000000))::int else 0 end
$$;

-- A real calendar date written YYYY-MM-DD. (No casts that could fail.)
create or replace function public.is_day(p text) returns boolean
language sql immutable set search_path = public as $$
  select case when p ~ '^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$' and left(p, 4) <> '0000' then
    substr(p, 9, 2)::int <= case
      when substr(p, 6, 2) in ('04', '06', '09', '11') then 30
      when substr(p, 6, 2) = '02' then case when (left(p, 4)::int % 4 = 0 and left(p, 4)::int % 100 <> 0) or left(p, 4)::int % 400 = 0 then 29 else 28 end
      else 31 end
  else false end
$$;

create or replace function public.progress_summary(p_state jsonb)
returns table (xp int, lessons_done int, streak int, best_streak int, accuracy int, last_active text)
language sql immutable set search_path = public as $$
  select public.safe_int(p_state->'xp'),
         case when jsonb_typeof(p_state->'completed') = 'object' then (select count(*)::int from jsonb_object_keys(p_state->'completed')) else 0 end,
         public.safe_int(p_state->'streak'->'current'),
         public.safe_int(p_state->'streak'->'best'),
         case when public.safe_int(p_state->'stats'->'answered') > 0
              then least(100, round(100.0 * public.safe_int(p_state->'stats'->'correct') / public.safe_int(p_state->'stats'->'answered')))::int end,
         (select max(k collate "C") from jsonb_object_keys(case when jsonb_typeof(p_state->'days') = 'object' then p_state->'days' else '{}'::jsonb end) k
           where public.is_day(k))
$$;

-- Names come from account metadata the person can edit: no control or text-direction override characters, at most 60 characters.
create or replace function public.clean_name(p text) returns text
language sql immutable set search_path = public as $$
  select nullif(btrim(left(btrim(regexp_replace(regexp_replace(coalesce(p, ''),
    '[\u0001-\u001F\u007F-\u009F​‎‏ -‮⁠⁦-⁩﻿]', ' ', 'g'), '\s+', ' ', 'g')), 60)), '')
$$;
create or replace function public.meta_name(p_meta jsonb) returns text
language sql immutable set search_path = public as $$
  select coalesce(public.clean_name(p_meta->>'display_name'), public.clean_name(p_meta->>'full_name'), public.clean_name(p_meta->>'name'))
$$;
create or replace function public.display_name_of(p_user uuid) returns text
language sql stable security definer set search_path = public, auth as $$
  select coalesce(public.meta_name(u.raw_user_meta_data), public.clean_name(split_part(u.email, '@', 1))) from auth.users u where u.id = p_user
$$;

-- ================================================================ new tables (no direct access: functions only)
create table if not exists public.suspensions (
  user_id      uuid primary key references auth.users (id) on delete cascade,
  reason       text not null default '' check (char_length(reason) <= 500),
  suspended_at timestamptz not null default now(),
  suspended_by uuid references auth.users (id) on delete set null
);
create table if not exists public.terms_acceptances (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  version     text not null check (char_length(version) between 1 and 40),
  accepted_at timestamptz not null default now()
);
create table if not exists public.chat_blocks (
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  blocker_id      uuid not null references auth.users (id) on delete cascade,
  created_at      timestamptz not null default now(),
  primary key (conversation_id, blocker_id)
);
-- A report is a safety record: it outlives the chat, and deleting an account only empties the link to that person.
create table if not exists public.chat_reports (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default clock_timestamp(),
  reporter_id     uuid references auth.users (id) on delete set null,
  reported_id     uuid references auth.users (id) on delete set null,
  conversation_id uuid not null,
  message_id      uuid,
  message_body    text,
  reason          text not null check (reason in ('harassment', 'sexual', 'hate', 'violence', 'spam', 'other')),
  details         text not null default '' check (char_length(details) <= 500),
  status          text not null default 'open' check (status in ('open', 'resolved', 'dismissed')),
  resolved_at     timestamptz,
  resolved_by     uuid references auth.users (id) on delete set null
);
create index if not exists chat_reports_reporter_idx on public.chat_reports (reporter_id, created_at);
create table if not exists public.class_bans (
  class_id   uuid not null references public.classes (id) on delete cascade,
  student_id uuid not null references auth.users (id) on delete cascade,
  banned_by  uuid references auth.users (id) on delete set null,
  banned_at  timestamptz not null default now(),
  primary key (class_id, student_id)
);
create table if not exists public.join_attempts (
  id      bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  at      timestamptz not null default clock_timestamp()
);
create index if not exists join_attempts_user_idx on public.join_attempts (user_id, at);

alter table public.suspensions enable row level security;
alter table public.terms_acceptances enable row level security;
alter table public.chat_blocks enable row level security;
alter table public.chat_reports enable row level security;
alter table public.class_bans enable row level security;
alter table public.join_attempts enable row level security;
revoke all on public.suspensions, public.terms_acceptances, public.chat_blocks, public.chat_reports, public.class_bans, public.join_attempts from anon, authenticated;

create index if not exists chat_messages_file_idx on public.chat_messages (file_path) where file_path is not null;

-- ================================================================ internal checks (not callable from the browser)
-- One at a time per person, so parallel requests cannot slip past a rate limit. Held until the transaction ends.
create or replace function public.lock_me() returns void
language plpgsql security definer set search_path = public as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('mohleyla:' || coalesce(auth.uid()::text, ''), 0));
end $$;

create or replace function public.role_of(p_user uuid) returns text
language sql stable security definer set search_path = public as $$
  select coalesce((select role from public.profiles where user_id = p_user), 'student')
$$;

create or replace function public.is_suspended(p_user uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.suspensions where user_id = p_user) and public.role_of(p_user) <> 'admin'
$$;

create or replace function public.teaches_student(p_teacher uuid, p_student uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.role_of(p_teacher) in ('teacher', 'admin') and exists (
    select 1 from public.classes c join public.class_members m on m.class_id = c.id where c.teacher_id = p_teacher and m.student_id = p_student)
$$;

create or replace function public.chat_is_blocked(p_conv uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.chat_blocks where conversation_id = p_conv)
$$;

-- May the two people still write to each other? One of them must be an admin, or someone who is a teacher TODAY and either
-- started this chat or teaches the other. A demoted teacher's chats with students are therefore read-only.
create or replace function public.chat_is_open(p_conv uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.conversations c
    cross join lateral (values (c.user_a, c.user_b), (c.user_b, c.user_a)) v(me, other)
    where c.id = p_conv and (
      public.role_of(v.me) = 'admin'
      or (public.role_of(v.me) = 'teacher' and (c.created_by = v.me or public.teaches_student(v.me, v.other)))))
$$;

-- The checks every "reach the other person" action shares. The caller must already be known to be a member of the chat.
create or replace function public.require_can_contact(p_conv uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if public.is_suspended(auth.uid()) then raise exception 'this account is suspended' using errcode = 'ML003'; end if;
  if not exists (select 1 from public.terms_acceptances where user_id = auth.uid()) then raise exception 'accept the terms first' using errcode = 'ML001'; end if;
  if public.chat_is_blocked(p_conv) then raise exception 'this chat is blocked' using errcode = 'ML002'; end if;
  if not public.chat_is_open(p_conv) then raise exception 'not allowed' using errcode = '42501'; end if;
end $$;

-- ================================================================ H2: a teacher is only a teacher while they have the role
create or replace function public.teaches_class(p_class uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.my_role() in ('teacher', 'admin') and exists (select 1 from public.classes c where c.id = p_class and c.teacher_id = auth.uid())
$$;

-- ================================================================ M1 / M2: class codes
-- Students (and everyone else) cannot read the code column. The teacher gets it from teacher_classes() / create_class().
revoke all on public.classes from anon, authenticated;
grant select (id, name, teacher_id, created_at) on public.classes to authenticated;

-- 12 random hex characters. Existing 8-character codes keep working.
create or replace function public.new_class_code() returns text
language plpgsql volatile security definer set search_path = public as $$
declare v_code text;
begin
  loop
    v_code := upper(left(replace(gen_random_uuid()::text, '-', ''), 12));
    exit when not exists (select 1 from public.classes where code = v_code);
  end loop;
  return v_code;
end $$;

create or replace function public.create_class(p_name text) returns public.classes
language plpgsql security definer set search_path = public as $$
declare v_class public.classes;
begin
  if auth.uid() is null or public.my_role() not in ('teacher', 'admin') then
    raise exception 'only teachers and admins can create classes' using errcode = '42501';
  end if;
  if public.is_suspended(auth.uid()) then raise exception 'this account is suspended' using errcode = 'ML003'; end if;
  if char_length(btrim(coalesce(p_name, ''))) not between 1 and 60 then
    raise exception 'class name must be 1-60 characters' using errcode = '22023';
  end if;
  insert into public.classes (name, code, teacher_id) values (btrim(p_name), public.new_class_code(), auth.uid()) returning * into v_class;
  return v_class;
end $$;

create or replace function public.rotate_class_code(p_class uuid) returns text
language plpgsql security definer set search_path = public as $$
declare v_code text;
begin
  if not public.teaches_class(p_class) then raise exception 'not allowed' using errcode = '42501'; end if;
  if public.is_suspended(auth.uid()) then raise exception 'this account is suspended' using errcode = 'ML003'; end if;
  v_code := public.new_class_code();
  update public.classes set code = v_code where id = p_class;
  return v_code;
end $$;

-- At most 10 attempts an hour. A code that does not work returns NO ROWS (raising would also undo the record of the attempt).
-- "Does not work" is the same answer for: wrong code, removed from this class, teacher no longer a teacher or suspended.
create or replace function public.join_class(p_code text) returns table (class_id uuid, class_name text)
language plpgsql security definer set search_path = public as $$
declare v_class public.classes;
begin
  if auth.uid() is null then raise exception 'sign in first' using errcode = '42501'; end if;
  if public.is_suspended(auth.uid()) then raise exception 'this account is suspended' using errcode = 'ML003'; end if;
  perform public.lock_me();
  delete from public.join_attempts j where j.user_id = auth.uid() and j.at <= clock_timestamp() - interval '1 hour';
  if (select count(*) from public.join_attempts j where j.user_id = auth.uid()) >= 10 then raise exception 'slow down' using errcode = '54000'; end if;
  insert into public.join_attempts (user_id) values (auth.uid());
  select * into v_class from public.classes c where c.code = upper(btrim(coalesce(p_code, '')));
  if not found or public.role_of(v_class.teacher_id) not in ('teacher', 'admin') or public.is_suspended(v_class.teacher_id) then return; end if;
  if v_class.teacher_id = auth.uid() then raise exception 'you teach this class' using errcode = '22023'; end if;
  if exists (select 1 from public.class_bans b where b.class_id = v_class.id and b.student_id = auth.uid()) then return; end if;
  insert into public.class_members (class_id, student_id) values (v_class.id, auth.uid()) on conflict do nothing;
  return query select v_class.id, v_class.name;
end $$;

-- The app removes a member by deleting the row. When SOMEONE ELSE (the teacher or an admin) does that, the student is banned
-- from the class. Leaving by yourself, deleting the class and deleting an account do not ban.
create or replace function public.ban_on_removal() returns trigger
language plpgsql security definer set search_path = public, auth as $$
begin
  if auth.uid() is not null and auth.uid() <> old.student_id
     and exists (select 1 from public.classes where id = old.class_id)
     and exists (select 1 from auth.users where id = old.student_id) then
    insert into public.class_bans (class_id, student_id, banned_by) values (old.class_id, old.student_id, auth.uid())
      on conflict (class_id, student_id) do update set banned_by = excluded.banned_by, banned_at = now();
  end if;
  return old;
end $$;
drop trigger if exists ban_removed_student on public.class_members;
create trigger ban_removed_student after delete on public.class_members for each row execute function public.ban_on_removal();

create or replace function public.teacher_class_bans(p_class uuid)
returns table (student_id uuid, display_name text, email text, banned_at timestamptz)
language plpgsql stable security definer set search_path = public, auth as $$
begin
  if not (public.teaches_class(p_class) or public.is_admin()) then raise exception 'not allowed' using errcode = '42501'; end if;
  return query
    select b.student_id, public.display_name_of(b.student_id), u.email::text, b.banned_at
    from public.class_bans b join auth.users u on u.id = b.student_id
    where b.class_id = p_class order by b.banned_at desc;
end $$;

-- Lifts the ban. The student still has to join again with the current code.
create or replace function public.teacher_unban(p_class uuid, p_student uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not (public.teaches_class(p_class) or public.is_admin()) then raise exception 'not allowed' using errcode = '42501'; end if;
  delete from public.class_bans b where b.class_id = p_class and b.student_id = p_student;
  if not found then raise exception 'ban not found' using errcode = 'P0002'; end if;
end $$;

-- ================================================================ names in the other readers
create or replace function public.my_memberships() returns table (class_id uuid, class_name text, teacher_name text, joined_at timestamptz)
language sql stable security definer set search_path = public as $$
  select c.id, c.name, public.display_name_of(c.teacher_id), m.joined_at
  from public.class_members m
  join public.classes c on c.id = m.class_id
  where m.student_id = auth.uid()
  order by m.joined_at desc
$$;

create or replace function public.class_roster(p_class uuid)
returns table (student_id uuid, display_name text, email text, joined_at timestamptz, xp int, lessons_done int, streak int, best_streak int, accuracy int, last_active text, streak_last text)
language plpgsql stable security definer set search_path = public, auth as $$
begin
  if not (public.teaches_class(p_class) or public.is_admin()) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  return query
    select m.student_id,
           coalesce(public.meta_name(u.raw_user_meta_data), ''),
           u.email::text, m.joined_at,
           s.xp, s.lessons_done, s.streak, s.best_streak, s.accuracy, s.last_active,
           case when public.is_day(p.state->'streak'->>'last') then p.state->'streak'->>'last' end
    from public.class_members m
    join auth.users u on u.id = m.student_id
    left join public.progress p on p.user_id = m.student_id
    left join lateral public.progress_summary(coalesce(p.state, '{}'::jsonb)) s on true
    where m.class_id = p_class
    order by u.email;
end $$;

-- one new column at the end: suspended
drop function if exists public.admin_list_users();
create function public.admin_list_users()
returns table (user_id uuid, email text, display_name text, role text, providers text, created_at timestamptz, last_sign_in_at timestamptz, xp int, lessons_done int, last_active text, suspended boolean)
language plpgsql stable security definer set search_path = public, auth as $$
begin
  if not public.is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  return query
    select u.id, u.email::text,
           coalesce(public.meta_name(u.raw_user_meta_data), ''),
           coalesce(pr.role, 'student'),
           coalesce((select string_agg(i.provider, ',' order by i.provider) from auth.identities i where i.user_id = u.id), ''),
           u.created_at, u.last_sign_in_at,
           s.xp, s.lessons_done, s.last_active,
           public.is_suspended(u.id)
    from auth.users u
    left join public.profiles pr on pr.user_id = u.id
    left join public.progress p on p.user_id = u.id
    left join lateral public.progress_summary(coalesce(p.state, '{}'::jsonb)) s on true
    order by u.created_at;
end $$;

-- ================================================================ H4: anything keyed by e-mail needs a CONFIRMED e-mail
-- (my_rewards() and my_announcements() both match through my_email().)
create or replace function public.my_email() returns text
language sql stable security definer set search_path = public, auth as $$
  select lower(u.email) from auth.users u where u.id = auth.uid() and u.email_confirmed_at is not null
$$;

create or replace function public.admin_list_rewards(p_email text default null)
returns table (id uuid, email text, display_name text, kind text, amount int, label text, reason text, created_at timestamptz, granted_by_email text, revoked_at timestamptz)
language plpgsql stable security definer set search_path = public, auth as $$
begin
  if not public.is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  return query
    select r.id, r.email, coalesce(public.meta_name(u.raw_user_meta_data), ''),
           r.kind, r.amount, r.label, r.reason, r.created_at, g.email::text, r.revoked_at
    from public.rewards r
    left join lateral (select x.raw_user_meta_data from auth.users x where lower(x.email) = r.email and x.email_confirmed_at is not null order by x.created_at limit 1) u on true
    left join auth.users g on g.id = r.granted_by
    where p_email is null or r.email = lower(btrim(p_email))
    order by r.created_at desc
    limit 500;
end $$;

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
        select array_agg(u.id) into v_users from auth.users u where lower(u.email) = new.user_email and u.email_confirmed_at is not null and u.id is distinct from new.created_by;
      end if;
      perform public.push_send(v_users, 'announcement', jsonb_build_object('title', new.title, 'style', new.style));
    end if;
  exception when others then null;
  end;
  return new;
end $$;

create or replace function public.push_on_reward() returns trigger
language plpgsql security definer set search_path = public, auth as $$
begin
  begin
    perform public.push_send((select array_agg(u.id) from auth.users u where lower(u.email) = new.email and u.email_confirmed_at is not null),
                             'reward', jsonb_build_object('kind', new.kind, 'amount', new.amount));
  exception when others then null;
  end;
  return new;
end $$;

-- Account deletion. The Edge Function calls account_delete_cleanup() AFTER the user row is gone, when it can no longer be known
-- whether the address was ever confirmed. So the real clean-up now happens here, as the user row is deleted.
create or replace function public.cleanup_email_data() returns trigger
language plpgsql security definer set search_path = public, auth as $$
declare v_email text := lower(btrim(coalesce(old.email, '')));
begin
  if v_email <> '' and old.email_confirmed_at is not null
     and not exists (select 1 from auth.users u where u.id <> old.id and lower(u.email) = v_email and u.email_confirmed_at is not null) then
    delete from public.rewards where email = v_email;
    delete from public.announcements where user_email = v_email;
  end if;
  return old;
end $$;
drop trigger if exists on_auth_user_deleted_cleanup on auth.users;
create trigger on_auth_user_deleted_cleanup before delete on auth.users for each row execute function public.cleanup_email_data();

create or replace function public.account_delete_cleanup(p_email text) returns void
language plpgsql security definer set search_path = public, auth as $$
declare v_email text := lower(btrim(coalesce(p_email, '')));
begin
  if v_email = '' or not exists (select 1 from auth.users u where lower(u.email) = v_email and u.email_confirmed_at is not null) then return; end if;
  delete from public.rewards where email = v_email;
  delete from public.announcements where user_email = v_email;
end $$;

-- Every file in the folders of the chats that will disappear, including uploads that never became a message.
create or replace function public.account_delete_prepare(p_user uuid) returns text[]
language plpgsql security definer set search_path = public, auth as $$
declare v_paths text[];
begin
  if p_user is null or not exists (select 1 from auth.users where id = p_user) then raise exception 'unknown person' using errcode = '22023'; end if;
  if exists (select 1 from public.profiles where user_id = p_user and role = 'admin')
     and not exists (select 1 from public.profiles where role = 'admin' and user_id <> p_user) then
    raise exception 'you are the only admin' using errcode = '55000';
  end if;
  select coalesce(array_agg(f.path), '{}') into v_paths from (
    select m.file_path as path
      from public.chat_messages m join public.conversations c on c.id = m.conversation_id
      where p_user in (c.user_a, c.user_b) and m.file_path is not null
    union
    select o.name
      from storage.objects o join public.conversations c on split_part(o.name, '/', 1) = c.id::text
      where o.bucket_id = 'chat-files' and p_user in (c.user_a, c.user_b)
  ) f;
  return v_paths;
end $$;

-- ================================================================ terms, suspension, own status
create or replace function public.accept_terms(p_version text) returns void
language plpgsql security definer set search_path = public as $$
declare v text := btrim(coalesce(p_version, ''));
begin
  if auth.uid() is null then raise exception 'sign in first' using errcode = '42501'; end if;
  if char_length(v) not between 1 and 40 then raise exception 'bad version' using errcode = '22023'; end if;
  insert into public.terms_acceptances (user_id, version, accepted_at) values (auth.uid(), v, now())
    on conflict (user_id) do update set version = excluded.version, accepted_at = excluded.accepted_at;
end $$;

create or replace function public.my_terms() returns table (accepted_version text, accepted_at timestamptz)
language sql stable security definer set search_path = public as $$
  select t.version, t.accepted_at from public.terms_acceptances t where t.user_id = auth.uid()
$$;

create or replace function public.my_account_status() returns table (suspended boolean)
language sql stable security definer set search_path = public as $$
  select public.is_suspended(auth.uid()) where auth.uid() is not null
$$;

-- ================================================================ calls: one live call per chat, signals removed when it ends
-- close stale and duplicate live calls first (quietly: no chat lines for old rows), so the unique index can be built
update public.calls set status = case when status = 'ringing' then 'missed' else 'ended' end, ended_at = clock_timestamp()
  where status in ('ringing', 'active')
    and ((status = 'ringing' and created_at < clock_timestamp() - interval '60 seconds') or created_at < clock_timestamp() - interval '6 hours');
update public.calls set status = case when status = 'ringing' then 'missed' else 'ended' end, ended_at = clock_timestamp()
  where id in (select x.id from (select k.id, row_number() over (partition by k.conversation_id order by k.created_at desc, k.id) as n
                                 from public.calls k where k.status in ('ringing', 'active')) x where x.n > 1);
create unique index if not exists calls_one_live_idx on public.calls (conversation_id) where status in ('ringing', 'active');
delete from public.call_signals s using public.calls k
  where k.id = s.call_id and (s.created_at < clock_timestamp() - interval '1 day' or (k.status not in ('ringing', 'active') and s.kind <> 'bye'));

create or replace function public.finish_call(p_call uuid, p_status text) returns void
language plpgsql security definer set search_path = public as $$
declare k public.calls;
begin
  update public.calls set status = p_status, ended_at = clock_timestamp() where id = p_call and status in ('ringing', 'active') returning * into k;
  if not found then return; end if; -- already closed by someone else: one chat line only
  delete from public.call_signals where call_id = p_call;
  insert into public.chat_messages (conversation_id, sender_id, body, kind, created_at)
    values (k.conversation_id, k.caller_id,
            k.media || ':' || p_status || case when p_status = 'ended' and k.answered_at is not null then ':' || greatest(1, round(extract(epoch from (clock_timestamp() - k.answered_at)) / 60)::int)::text else '' end,
            'call', clock_timestamp());
  update public.conversations set last_message_at = clock_timestamp() where id = k.conversation_id;
end $$;

create or replace function public.start_call(p_conv uuid, p_media text) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_me uuid := auth.uid(); c public.conversations; v_other uuid; v_id uuid; old record;
begin
  if not public.is_chat_member(p_conv) then raise exception 'not allowed' using errcode = '42501'; end if;
  if p_media is null or p_media not in ('audio', 'video') then raise exception 'unknown call type' using errcode = '22023'; end if;
  select * into c from public.conversations where id = p_conv;
  v_other := case when c.user_a = v_me then c.user_b else c.user_a end;
  if not (public.is_admin() or public.teaches_student(v_me, v_other)) then raise exception 'not allowed' using errcode = '42501'; end if;
  perform public.require_can_contact(p_conv);
  perform public.lock_me();
  for old in select id, status from public.calls where conversation_id = p_conv and status in ('ringing', 'active')
             and ((status = 'ringing' and created_at < clock_timestamp() - interval '60 seconds') or created_at < clock_timestamp() - interval '6 hours') loop
    perform public.finish_call(old.id, case when old.status = 'ringing' then 'missed' else 'ended' end);
  end loop;
  if exists (select 1 from public.calls where conversation_id = p_conv and status in ('ringing', 'active')) then raise exception 'a call is already in progress' using errcode = '55000'; end if;
  if (select count(*) from public.calls where caller_id = v_me and created_at > clock_timestamp() - interval '10 minutes') >= 10 then raise exception 'slow down' using errcode = '54000'; end if;
  begin
    insert into public.calls (conversation_id, caller_id, media) values (p_conv, v_me, p_media) returning id into v_id;
  exception when unique_violation then raise exception 'a call is already in progress' using errcode = '55000';
  end;
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
  if public.chat_is_blocked(k.conversation_id) then raise exception 'this chat is blocked' using errcode = 'ML002'; end if;
  if not public.chat_is_open(k.conversation_id) then raise exception 'not allowed' using errcode = '42501'; end if;
  update public.calls set status = 'active', answered_at = clock_timestamp() where id = p_call and status = 'ringing';
  if not found then raise exception 'call is over' using errcode = '55000'; end if;
end $$;

create or replace function public.call_signal_send(p_call uuid, p_kind text, p_payload jsonb) returns bigint
language plpgsql security definer set search_path = public as $$
declare k public.calls; v_id bigint;
begin
  if not public.call_member(p_call) then raise exception 'not allowed' using errcode = '42501'; end if;
  if p_kind not in ('offer', 'answer', 'ice') then raise exception 'unknown message' using errcode = '22023'; end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' or pg_column_size(p_payload) > 16384 then raise exception 'bad payload' using errcode = '22023'; end if;
  perform public.lock_me();
  select * into k from public.calls where id = p_call for share; -- the call cannot end while this signal is being stored
  if k.status not in ('ringing', 'active') then raise exception 'call is over' using errcode = '55000'; end if;
  if (select count(*) from public.call_signals where sender_id = auth.uid() and created_at > clock_timestamp() - interval '1 minute') >= 300 then raise exception 'slow down' using errcode = '54000'; end if;
  insert into public.call_signals (call_id, sender_id, kind, payload) values (p_call, auth.uid(), p_kind, p_payload) returning id into v_id;
  return v_id;
end $$;

create or replace function public.my_incoming_calls()
returns table (call_id uuid, conversation_id uuid, caller_id uuid, caller_name text, media text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select k.id, k.conversation_id, k.caller_id, public.display_name_of(k.caller_id), k.media, k.created_at
  from public.calls k join public.conversations c on c.id = k.conversation_id
  where auth.uid() is not null and auth.uid() in (c.user_a, c.user_b) and k.caller_id <> auth.uid()
    and k.status = 'ringing' and k.created_at > clock_timestamp() - interval '60 seconds'
    and not public.chat_is_blocked(c.id) and public.chat_is_open(c.id) and not public.is_suspended(k.caller_id)
  order by k.created_at desc
$$;

create or replace function public.admin_set_suspended(p_user uuid, p_suspended boolean, p_reason text default '') returns void
language plpgsql security definer set search_path = public, auth as $$
declare v_reason text := btrim(coalesce(p_reason, '')); old record;
begin
  if not public.is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  if p_user is null or p_suspended is null or not exists (select 1 from auth.users where id = p_user) then raise exception 'unknown person' using errcode = '22023'; end if;
  if char_length(v_reason) > 500 then raise exception 'reason too long' using errcode = '22023'; end if;
  if not p_suspended then delete from public.suspensions where user_id = p_user; return; end if;
  if public.role_of(p_user) = 'admin' then raise exception 'an admin cannot be suspended' using errcode = '42501'; end if;
  insert into public.suspensions (user_id, reason, suspended_by) values (p_user, v_reason, auth.uid())
    on conflict (user_id) do update set reason = excluded.reason, suspended_by = excluded.suspended_by, suspended_at = now();
  for old in select k.id, k.status from public.calls k join public.conversations c on c.id = k.conversation_id
             where p_user in (c.user_a, c.user_b) and k.status in ('ringing', 'active') loop
    perform public.finish_call(old.id, case when old.status = 'ringing' then 'missed' else 'ended' end);
  end loop;
end $$;

-- ================================================================ chat: start, send
create or replace function public.start_chat(p_other uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_me uuid := auth.uid(); v_id uuid;
begin
  if v_me is null then raise exception 'sign in first' using errcode = '42501'; end if;
  if p_other is null or p_other = v_me or not exists (select 1 from auth.users where id = p_other) then raise exception 'unknown person' using errcode = '22023'; end if;
  if not (public.is_admin() or public.teaches_student(v_me, p_other)) then raise exception 'not allowed' using errcode = '42501'; end if;
  if public.is_suspended(v_me) then raise exception 'this account is suspended' using errcode = 'ML003'; end if;
  select id into v_id from public.conversations where least(user_a, user_b) = least(v_me, p_other) and greatest(user_a, user_b) = greatest(v_me, p_other);
  if v_id is null then
    insert into public.conversations (user_a, user_b, created_by) values (v_me, p_other, v_me) returning id into v_id;
  elsif public.chat_is_blocked(v_id) then
    raise exception 'this chat is blocked' using errcode = 'ML002';
  end if;
  return v_id;
end $$;

create or replace function public.send_message(p_conv uuid, p_body text) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_body text := btrim(coalesce(p_body, '')); v_id uuid;
begin
  if not public.is_chat_member(p_conv) then raise exception 'not allowed' using errcode = '42501'; end if;
  perform public.require_can_contact(p_conv);
  if char_length(v_body) not between 1 and 1000 then raise exception 'a message is 1-1000 characters' using errcode = '22023'; end if;
  perform public.lock_me();
  if (select count(*) from public.chat_messages where sender_id = auth.uid() and created_at > clock_timestamp() - interval '1 minute') >= 20 then
    raise exception 'slow down' using errcode = '54000';
  end if;
  insert into public.chat_messages (conversation_id, sender_id, body, created_at) values (p_conv, auth.uid(), v_body, clock_timestamp()) returning id into v_id;
  update public.conversations set last_message_at = clock_timestamp() where id = p_conv;
  insert into public.chat_reads (conversation_id, user_id, last_read_at) values (p_conv, auth.uid(), clock_timestamp())
    on conflict (conversation_id, user_id) do update set last_read_at = excluded.last_read_at;
  return v_id;
end $$;

create or replace function public.send_attachment(p_conv uuid, p_kind text, p_path text, p_mime text, p_size int, p_duration_ms int default null, p_caption text default null)
returns uuid
language plpgsql security definer set search_path = public, storage as $$
declare v_caption text := btrim(coalesce(p_caption, '')); v_id uuid;
begin
  if not public.is_chat_member(p_conv) then raise exception 'not allowed' using errcode = '42501'; end if;
  perform public.require_can_contact(p_conv);
  if p_kind is null or p_kind not in ('voice', 'image') then raise exception 'unknown attachment kind' using errcode = '22023'; end if;
  if p_path is null or p_path not like p_conv::text || '/%' or p_path !~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(webm|ogg|m4a|mp4|mp3|aac|jpg|jpeg|png|webp)$' then
    raise exception 'bad file path' using errcode = '22023';
  end if;
  if p_kind = 'voice' and (p_mime is null or p_mime not in ('audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/aac', 'audio/x-m4a')) then raise exception 'unsupported audio type' using errcode = '22023'; end if;
  if p_kind = 'image' and (p_mime is null or p_mime not in ('image/jpeg', 'image/png', 'image/webp')) then raise exception 'unsupported image type' using errcode = '22023'; end if;
  if p_size is null or p_size < 1 or p_size > 5242880 then raise exception 'file too large' using errcode = '22023'; end if;
  if p_kind = 'voice' and (p_duration_ms is null or p_duration_ms < 300 or p_duration_ms > 125000) then raise exception 'voice notes are up to 2 minutes' using errcode = '22023'; end if;
  if char_length(v_caption) > 200 then raise exception 'caption too long' using errcode = '22023'; end if;
  perform public.lock_me();
  if not exists (select 1 from storage.objects o where o.bucket_id = 'chat-files' and o.name = p_path and o.owner = auth.uid()) then
    raise exception 'file not found' using errcode = 'P0002';
  end if;
  if exists (select 1 from public.chat_messages where file_path = p_path) then raise exception 'file already used' using errcode = '22023'; end if;
  if (select count(*) from public.chat_messages where sender_id = auth.uid() and created_at > clock_timestamp() - interval '1 minute') >= 20 then
    raise exception 'slow down' using errcode = '54000';
  end if;
  insert into public.chat_messages (conversation_id, sender_id, body, kind, file_path, file_mime, file_size, duration_ms, created_at)
    values (p_conv, auth.uid(), v_caption, p_kind, p_path, p_mime, p_size, case when p_kind = 'voice' then p_duration_ms end, clock_timestamp())
    returning id into v_id;
  update public.conversations set last_message_at = clock_timestamp() where id = p_conv;
  insert into public.chat_reads (conversation_id, user_id, last_read_at) values (p_conv, auth.uid(), clock_timestamp())
    on conflict (conversation_id, user_id) do update set last_read_at = excluded.last_read_at;
  return v_id;
end $$;

-- two new columns at the end: blocked_by_me, blocked
drop function if exists public.my_chats();
create function public.my_chats()
returns table (conversation_id uuid, other_id uuid, other_name text, other_role text, last_body text, last_kind text, last_at timestamptz, last_is_mine boolean, unread int, blocked_by_me boolean, blocked boolean)
language sql stable security definer set search_path = public as $$
  select c.id,
         o.oid, public.display_name_of(o.oid), coalesce((select p.role from public.profiles p where p.user_id = o.oid), 'student'),
         (select case when m.removed_at is not null then '' else left(m.body, 120) end from public.chat_messages m where m.conversation_id = c.id order by m.created_at desc limit 1),
         (select case when m.removed_at is not null then 'text' else m.kind end from public.chat_messages m where m.conversation_id = c.id order by m.created_at desc limit 1),
         c.last_message_at,
         coalesce((select m.sender_id = auth.uid() from public.chat_messages m where m.conversation_id = c.id order by m.created_at desc limit 1), false),
         (select count(*)::int from public.chat_messages m
            where m.conversation_id = c.id and m.sender_id is distinct from auth.uid() and m.removed_at is null
              and m.created_at > coalesce((select r.last_read_at from public.chat_reads r where r.conversation_id = c.id and r.user_id = auth.uid()), 'epoch')),
         exists (select 1 from public.chat_blocks b where b.conversation_id = c.id and b.blocker_id = auth.uid()),
         public.chat_is_blocked(c.id)
  from public.conversations c
  cross join lateral (select case when c.user_a = auth.uid() then c.user_b else c.user_a end as oid) o
  where auth.uid() is not null and auth.uid() in (c.user_a, c.user_b)
  order by c.last_message_at desc
$$;

-- push triggers never notify across a block
create or replace function public.push_on_chat_message() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  begin
    if new.kind in ('text', 'voice', 'image') and new.sender_id is not null and not public.chat_is_blocked(new.conversation_id) then
      perform public.push_send(
        (select array_agg(u) from (select case when c.user_a = new.sender_id then c.user_b else c.user_a end as u from public.conversations c where c.id = new.conversation_id) x),
        'chat', jsonb_build_object('name', public.display_name_of(new.sender_id), 'conversation', new.conversation_id, 'media', new.kind));
    end if;
  exception when others then null;
  end;
  return new;
end $$;

create or replace function public.push_on_call() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  begin
    if new.status = 'ringing' and not public.chat_is_blocked(new.conversation_id) then
      perform public.push_send(
        (select array_agg(u) from (select case when c.user_a = new.caller_id then c.user_b else c.user_a end as u from public.conversations c where c.id = new.conversation_id) x),
        'call', jsonb_build_object('name', public.display_name_of(new.caller_id), 'conversation', new.conversation_id, 'media', new.media));
    end if;
  exception when others then null;
  end;
  return new;
end $$;

-- ================================================================ block and report
create or replace function public.block_chat(p_conversation uuid) returns void
language plpgsql security definer set search_path = public as $$
declare old record;
begin
  if not public.is_chat_member(p_conversation) then raise exception 'not allowed' using errcode = '42501'; end if;
  insert into public.chat_blocks (conversation_id, blocker_id) values (p_conversation, auth.uid()) on conflict do nothing;
  for old in select id, status, caller_id from public.calls where conversation_id = p_conversation and status in ('ringing', 'active') loop
    perform public.finish_call(old.id, case when old.status = 'active' then 'ended' when old.caller_id = auth.uid() then 'missed' else 'declined' end);
  end loop;
end $$;

-- Removes MY block only; if the other person also blocked, the chat stays blocked.
create or replace function public.unblock_chat(p_conversation uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_chat_member(p_conversation) then raise exception 'not allowed' using errcode = '42501'; end if;
  delete from public.chat_blocks where conversation_id = p_conversation and blocker_id = auth.uid();
end $$;

-- (Postgres requires a default on p_reason because it follows one; a missing reason is refused.)
create or replace function public.report_chat(p_conversation uuid, p_message uuid default null, p_reason text default null, p_details text default '')
returns uuid
language plpgsql security definer set search_path = public as $$
declare v_me uuid := auth.uid(); c public.conversations; m public.chat_messages; v_details text := btrim(coalesce(p_details, '')); v_id uuid; v_body text;
begin
  if not public.is_chat_member(p_conversation) then raise exception 'not allowed' using errcode = '42501'; end if;
  if p_reason is null or p_reason not in ('harassment', 'sexual', 'hate', 'violence', 'spam', 'other') then raise exception 'unknown reason' using errcode = '22023'; end if;
  if char_length(v_details) > 500 then raise exception 'details are at most 500 characters' using errcode = '22023'; end if;
  select * into c from public.conversations where id = p_conversation;
  if p_message is not null then
    select * into m from public.chat_messages x where x.id = p_message and x.conversation_id = p_conversation;
    if not found or m.sender_id is not distinct from v_me then raise exception 'unknown message' using errcode = '22023'; end if;
    v_body := case when m.kind = 'text' then m.body else btrim('[' || m.kind || '] ' || m.body) end;
  end if;
  perform public.lock_me();
  if (select count(*) from public.chat_reports where reporter_id = v_me and created_at > clock_timestamp() - interval '1 hour') >= 10 then
    raise exception 'slow down' using errcode = '54000';
  end if;
  insert into public.chat_reports (reporter_id, reported_id, conversation_id, message_id, message_body, reason, details)
    values (v_me, case when c.user_a = v_me then c.user_b else c.user_a end, p_conversation, p_message, v_body, p_reason, v_details)
    returning id into v_id;
  return v_id;
end $$;

-- Open reports first, then newest.
create or replace function public.admin_list_reports()
returns table (id uuid, created_at timestamptz, reporter_name text, reporter_email text, reported_id uuid, reported_name text, reported_email text,
               conversation_id uuid, message_id uuid, message_body text, reason text, details text, status text)
language plpgsql stable security definer set search_path = public, auth as $$
begin
  if not public.is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  return query
    select r.id, r.created_at, public.display_name_of(r.reporter_id), a.email::text, r.reported_id, public.display_name_of(r.reported_id), b.email::text,
           r.conversation_id, r.message_id, r.message_body, r.reason, r.details, r.status
    from public.chat_reports r
    left join auth.users a on a.id = r.reporter_id
    left join auth.users b on b.id = r.reported_id
    order by (r.status <> 'open'), r.created_at desc
    limit 500;
end $$;

create or replace function public.admin_resolve_report(p_id uuid, p_status text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  if p_status is null or p_status not in ('resolved', 'dismissed') then raise exception 'unknown status' using errcode = '22023'; end if;
  update public.chat_reports r set status = p_status, resolved_at = now(), resolved_by = auth.uid() where r.id = p_id and r.status = 'open';
  if not found then raise exception 'report not found' using errcode = 'P0002'; end if;
end $$;

-- ================================================================ M3 / M4: storage
-- Upload: exactly <conversation uuid>/<uuid>.<allowed ext> (what src/features/chat/files.js writes), into a chat the person can
-- write in, at most 60 files an hour and 200 MB stored per person. (Storage learns a file's size after this check, so the total
-- can pass 200 MB by the files in flight, each at most 5 MB.)
create or replace function public.can_upload_chat_file(p_name text) returns boolean
language plpgsql volatile security definer set search_path = public, storage as $$
declare v_conv uuid; v_recent bigint; v_bytes numeric;
begin
  if auth.uid() is null or p_name is null or p_name !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(webm|ogg|m4a|mp4|mp3|aac|jpg|jpeg|png|webp)$' then
    return false;
  end if;
  v_conv := split_part(p_name, '/', 1)::uuid;
  if not public.is_chat_member(v_conv) or public.is_suspended(auth.uid()) or public.chat_is_blocked(v_conv) or not public.chat_is_open(v_conv) then return false; end if;
  perform public.lock_me();
  select count(*) filter (where o.created_at > clock_timestamp() - interval '1 hour'),
         coalesce(sum(case when jsonb_typeof(o.metadata->'size') = 'number' then (o.metadata->>'size')::numeric else 0 end), 0)
    into v_recent, v_bytes
    from storage.objects o where o.bucket_id = 'chat-files' and o.owner = auth.uid();
  return v_recent < 60 and v_bytes < 209715200;
end $$;

-- Read: members, unless the message that carried the file was removed; admins (moderation) also see removed files. 90 days at most.
create or replace function public.can_read_chat_file(p_name text) returns boolean
language plpgsql stable security definer set search_path = public as $$
begin
  if p_name is null or split_part(p_name, '/', 1) !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then return false; end if;
  if public.is_admin() then return true; end if;
  return public.is_chat_member(split_part(p_name, '/', 1)::uuid)
    and not exists (select 1 from public.chat_messages m where m.file_path = p_name and m.removed_at is not null);
end $$;

drop policy if exists "chat files: members upload" on storage.objects;
create policy "chat files: members upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'chat-files' and public.can_upload_chat_file(name));
drop policy if exists "chat files: members and admins read" on storage.objects;
create policy "chat files: members and admins read" on storage.objects for select to authenticated
  using (bucket_id = 'chat-files' and created_at > now() - interval '90 days' and public.can_read_chat_file(name));

-- ================================================================ H3: clean-up that can really delete (service role only)
-- Row level security hides files older than 90 days from everyone signed in, including from DELETE. The Edge Function
-- "purge-files" uses the service role: it asks for this list and removes the files through the Storage API.
-- Listed: older than 90 days; belonging to a removed message; or not used by any message for more than 24 hours.
create or replace function public.expired_chat_files(p_limit int default 500) returns table (path text)
language sql stable security definer set search_path = public, storage as $$
  select o.name from storage.objects o
  where o.bucket_id = 'chat-files' and (
    o.created_at <= now() - interval '90 days'
    or exists (select 1 from public.chat_messages m where m.file_path = o.name and m.removed_at is not null)
    or (o.created_at <= now() - interval '24 hours' and not exists (select 1 from public.chat_messages m where m.file_path = o.name)))
  order by o.created_at
  limit least(greatest(coalesce(p_limit, 500), 1), 1000)
$$;

create or replace function public.purge_call_signals() returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  delete from public.call_signals where created_at < clock_timestamp() - interval '1 day';
  get diagnostics n = row_count;
  delete from public.join_attempts where at < clock_timestamp() - interval '1 day';
  return n;
end $$;

-- ================================================================ privileges
revoke all on public.progress from anon, authenticated;
grant select, insert, update, delete on public.progress to authenticated;

-- Supabase grants new functions to everyone by default, so take everything away first, then give back exactly what is needed.
revoke all on function
  public.lock_me(), public.role_of(uuid), public.is_suspended(uuid), public.teaches_student(uuid, uuid), public.chat_is_blocked(uuid),
  public.chat_is_open(uuid), public.require_can_contact(uuid), public.new_class_code(), public.ban_on_removal(), public.cleanup_email_data(),
  public.display_name_of(uuid), public.finish_call(uuid, text), public.push_on_chat_message(), public.push_on_call(),
  public.push_on_announcement(), public.push_on_reward(), public.account_delete_prepare(uuid), public.account_delete_cleanup(text),
  public.expired_chat_files(int), public.purge_call_signals()
  from public, anon, authenticated;

revoke all on function
  public.safe_int(jsonb), public.is_day(text), public.clean_name(text), public.meta_name(jsonb),
  public.rotate_class_code(uuid), public.teacher_class_bans(uuid), public.teacher_unban(uuid, uuid), public.admin_list_users(),
  public.accept_terms(text), public.my_terms(), public.my_account_status(), public.admin_set_suspended(uuid, boolean, text),
  public.my_chats(), public.block_chat(uuid), public.unblock_chat(uuid), public.report_chat(uuid, uuid, text, text),
  public.admin_list_reports(), public.admin_resolve_report(uuid, text), public.can_upload_chat_file(text), public.can_read_chat_file(text)
  from public, anon, authenticated;
grant execute on function
  public.safe_int(jsonb), public.is_day(text), public.clean_name(text), public.meta_name(jsonb),
  public.rotate_class_code(uuid), public.teacher_class_bans(uuid), public.teacher_unban(uuid, uuid), public.admin_list_users(),
  public.accept_terms(text), public.my_terms(), public.my_account_status(), public.admin_set_suspended(uuid, boolean, text),
  public.my_chats(), public.block_chat(uuid), public.unblock_chat(uuid), public.report_chat(uuid, uuid, text, text),
  public.admin_list_reports(), public.admin_resolve_report(uuid, text), public.can_upload_chat_file(text), public.can_read_chat_file(text)
  to authenticated;

do $$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.account_delete_prepare(uuid), public.account_delete_cleanup(text),
      public.expired_chat_files(int), public.purge_call_signals() to service_role;
  end if;
end $$;

-- ================================================================ daily purge (NOT run automatically)
-- After deploying the Edge Function "purge-files" and setting its secret PURGE_SECRET (24+ random characters), switch on the
-- pg_cron and pg_net extensions and run this ONCE in the SQL editor, with your project reference and the same secret:
--
--   select vault.create_secret('PASTE-THE-SAME-SECRET', 'purge_secret');
--   select cron.schedule('purge-chat-files', '17 3 * * *', $cron$
--     select net.http_post(
--       url := 'https://YOUR-PROJECT-REF.supabase.co/functions/v1/purge-files',
--       headers := jsonb_build_object('Content-Type', 'application/json',
--                    'x-purge-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'purge_secret')),
--       body := '{}'::jsonb,
--       timeout_milliseconds := 30000)
--   $cron$);
