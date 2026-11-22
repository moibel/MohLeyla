-- MohLeyla roles, classes and the teacher/admin views. Run once in Supabase: SQL Editor -> New query -> paste -> Run.
-- Additive: it does not change the existing public.progress table or its policies.
--
-- Security model
--   * Every permission is enforced HERE, in the database (row level security + security definer functions), never only in the web page.
--   * Nobody can change a role from the browser. Roles change only through admin_set_role(), which checks that the caller is an admin.
--   * A teacher never reads a student's raw progress document. class_roster() returns a small summary (name, email, XP, lessons,
--     streak, accuracy, last active) and only for students who joined that teacher's class with its code (joining is the consent).
--   * Anonymous (not signed in) visitors get nothing.

-- ---------------------------------------------------------------- profiles (roles)
create table if not exists public.profiles (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  role       text not null default 'student' check (role in ('student', 'teacher', 'admin')),
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

-- Everyone who already signed up becomes a student; new sign-ups get a profile automatically.
insert into public.profiles (user_id) select id from auth.users on conflict do nothing;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (user_id) values (new.id) on conflict do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create or replace function public.my_role() returns text
language sql stable security definer set search_path = public as $$
  select coalesce((select role from public.profiles where user_id = auth.uid()), 'student')
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select public.my_role() = 'admin'
$$;

drop policy if exists "profiles_select_own_or_admin" on public.profiles;
create policy "profiles_select_own_or_admin" on public.profiles for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
-- (no insert / update / delete policies: roles can only change through admin_set_role)

-- ---------------------------------------------------------------- classes
create table if not exists public.classes (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (char_length(name) between 1 and 60),
  code       text not null unique,
  teacher_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
create table if not exists public.class_members (
  class_id   uuid not null references public.classes (id) on delete cascade,
  student_id uuid not null references auth.users (id) on delete cascade,
  joined_at  timestamptz not null default now(),
  primary key (class_id, student_id)
);
alter table public.classes enable row level security;
alter table public.class_members enable row level security;

create or replace function public.teaches_class(p_class uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.classes c where c.id = p_class and c.teacher_id = auth.uid())
$$;

create or replace function public.in_class(p_class uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.class_members m where m.class_id = p_class and m.student_id = auth.uid())
$$;

drop policy if exists "classes_select" on public.classes;
create policy "classes_select" on public.classes for select to authenticated
  using (teacher_id = auth.uid() or public.is_admin() or public.in_class(id));

drop policy if exists "members_select" on public.class_members;
create policy "members_select" on public.class_members for select to authenticated
  using (student_id = auth.uid() or public.teaches_class(class_id) or public.is_admin());

drop policy if exists "members_delete" on public.class_members;
create policy "members_delete" on public.class_members for delete to authenticated
  using (student_id = auth.uid() or public.teaches_class(class_id) or public.is_admin()); -- leave a class / teacher removes a student

-- ---------------------------------------------------------------- functions the app calls
create or replace function public.create_class(p_name text) returns public.classes
language plpgsql security definer set search_path = public as $$
declare v_class public.classes; v_code text; v_try int := 0;
begin
  if auth.uid() is null or public.my_role() not in ('teacher', 'admin') then
    raise exception 'only teachers and admins can create classes' using errcode = '42501';
  end if;
  if char_length(btrim(coalesce(p_name, ''))) not between 1 and 60 then
    raise exception 'class name must be 1-60 characters' using errcode = '22023';
  end if;
  loop
    v_code := upper(substr(md5(random()::text || clock_timestamp()::text || auth.uid()::text), 1, 8));
    exit when not exists (select 1 from public.classes where code = v_code);
    v_try := v_try + 1;
    if v_try > 20 then raise exception 'could not generate a class code' using errcode = '55000'; end if;
  end loop;
  insert into public.classes (name, code, teacher_id) values (btrim(p_name), v_code, auth.uid()) returning * into v_class;
  return v_class;
end $$;

create or replace function public.join_class(p_code text) returns table (class_id uuid, class_name text)
language plpgsql security definer set search_path = public as $$
declare v_class public.classes;
begin
  if auth.uid() is null then raise exception 'sign in first' using errcode = '42501'; end if;
  select * into v_class from public.classes where code = upper(btrim(coalesce(p_code, '')));
  if not found then raise exception 'invalid class code' using errcode = 'P0002'; end if;
  if v_class.teacher_id = auth.uid() then raise exception 'you teach this class' using errcode = '22023'; end if;
  insert into public.class_members (class_id, student_id) values (v_class.id, auth.uid()) on conflict do nothing;
  return query select v_class.id, v_class.name;
end $$;

create or replace function public.my_memberships() returns table (class_id uuid, class_name text, teacher_name text, joined_at timestamptz)
language sql stable security definer set search_path = public, auth as $$
  select c.id, c.name,
         coalesce(u.raw_user_meta_data->>'display_name', u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', split_part(u.email, '@', 1)),
         m.joined_at
  from public.class_members m
  join public.classes c on c.id = m.class_id
  join auth.users u on u.id = c.teacher_id
  where m.student_id = auth.uid()
  order by m.joined_at desc
$$;

create or replace function public.teacher_classes() returns table (class_id uuid, class_name text, code text, member_count bigint, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select c.id, c.name, c.code, (select count(*) from public.class_members m where m.class_id = c.id), c.created_at
  from public.classes c
  where c.teacher_id = auth.uid() and public.my_role() in ('teacher', 'admin')
  order by c.created_at desc
$$;

-- Progress summary used by the roster and the admin list (extracted from the student's progress document; the raw document is never returned).
create or replace function public.progress_summary(p_state jsonb)
returns table (xp int, lessons_done int, streak int, best_streak int, accuracy int, last_active text)
language sql immutable set search_path = public as $$
  select coalesce((p_state->>'xp')::int, 0),
         coalesce((select count(*)::int from jsonb_object_keys(coalesce(p_state->'completed', '{}'::jsonb))), 0),
         coalesce((p_state->'streak'->>'current')::int, 0),
         coalesce((p_state->'streak'->>'best')::int, 0),
         case when coalesce((p_state->'stats'->>'answered')::int, 0) > 0
              then round(100.0 * coalesce((p_state->'stats'->>'correct')::int, 0) / (p_state->'stats'->>'answered')::int)::int end,
         (select max(k) from jsonb_object_keys(coalesce(p_state->'days', '{}'::jsonb)) k)
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
           coalesce(u.raw_user_meta_data->>'display_name', u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', ''),
           u.email::text, m.joined_at,
           s.xp, s.lessons_done, s.streak, s.best_streak, s.accuracy, s.last_active,
           p.state->'streak'->>'last'
    from public.class_members m
    join auth.users u on u.id = m.student_id
    left join public.progress p on p.user_id = m.student_id
    left join lateral public.progress_summary(coalesce(p.state, '{}'::jsonb)) s on true
    where m.class_id = p_class
    order by u.email;
end $$;

create or replace function public.delete_class(p_class uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not (public.teaches_class(p_class) or public.is_admin()) then raise exception 'not allowed' using errcode = '42501'; end if;
  delete from public.classes where id = p_class;
end $$;

create or replace function public.admin_list_users()
returns table (user_id uuid, email text, display_name text, role text, providers text, created_at timestamptz, last_sign_in_at timestamptz, xp int, lessons_done int, last_active text)
language plpgsql stable security definer set search_path = public, auth as $$
begin
  if not public.is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  return query
    select u.id, u.email::text,
           coalesce(u.raw_user_meta_data->>'display_name', u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', ''),
           coalesce(pr.role, 'student'),
           coalesce((select string_agg(i.provider, ',' order by i.provider) from auth.identities i where i.user_id = u.id), ''),
           u.created_at, u.last_sign_in_at,
           s.xp, s.lessons_done, s.last_active
    from auth.users u
    left join public.profiles pr on pr.user_id = u.id
    left join public.progress p on p.user_id = u.id
    left join lateral public.progress_summary(coalesce(p.state, '{}'::jsonb)) s on true
    order by u.created_at;
end $$;

create or replace function public.admin_set_role(p_user uuid, p_role text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  if p_role not in ('student', 'teacher', 'admin') then raise exception 'unknown role' using errcode = '22023'; end if;
  if (select role from public.profiles where user_id = p_user) = 'admin' and p_role <> 'admin'
     and (select count(*) from public.profiles where role = 'admin') <= 1 then
    raise exception 'cannot remove the last admin' using errcode = '55000';
  end if;
  insert into public.profiles (user_id, role) values (p_user, p_role)
    on conflict (user_id) do update set role = excluded.role;
end $$;

-- ---------------------------------------------------------------- grants: authenticated only
revoke all on public.profiles, public.classes, public.class_members from anon, authenticated;
grant select on public.profiles, public.classes to authenticated;
grant select, delete on public.class_members to authenticated;

revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.my_role(), public.is_admin(), public.teaches_class(uuid), public.in_class(uuid),
  public.create_class(text), public.join_class(text), public.my_memberships(), public.teacher_classes(),
  public.progress_summary(jsonb), public.class_roster(uuid), public.delete_class(uuid),
  public.admin_list_users(), public.admin_set_role(uuid, text) from public, anon;
grant execute on function public.my_role(), public.is_admin(), public.teaches_class(uuid), public.in_class(uuid),
  public.create_class(text), public.join_class(text), public.my_memberships(), public.teacher_classes(),
  public.progress_summary(jsonb), public.class_roster(uuid), public.delete_class(uuid),
  public.admin_list_users(), public.admin_set_role(uuid, text) to authenticated;
