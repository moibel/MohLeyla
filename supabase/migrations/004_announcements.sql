-- MohLeyla announcements: messages an admin posts to everyone, or to the students of one class.
-- Run once in Supabase: SQL Editor -> New query -> paste -> Run. Needs 002_roles_classes.sql first. Additive: nothing existing changes.
--
-- Security model
--   * The table has no direct access (row level security on, no policies, every privilege revoked). Everything goes through the functions.
--   * Only an admin can post, list everything or archive (checked inside each function by is_admin()).
--   * A signed-in learner reads only announcements meant for everyone, or for a class they have joined, that are not archived or expired.
--   * Text is stored per interface language ({"ar":..., "en":..., "id":...}); at least one language is required. The app shows plain text only.

create table if not exists public.announcements (
  id         uuid primary key default gen_random_uuid(),
  title      jsonb not null,
  body       jsonb not null,
  audience   text not null check (audience in ('all', 'class')),
  class_id   uuid references public.classes (id) on delete cascade,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  archived_at timestamptz,
  check ((audience = 'all' and class_id is null) or (audience = 'class' and class_id is not null))
);
alter table public.announcements enable row level security;
revoke all on public.announcements from anon, authenticated;
create index if not exists announcements_live_idx on public.announcements (created_at desc) where archived_at is null;

-- Validates {"ar":..,"en":..,"id":..}: only those keys, strings, each at most p_max characters; returns the cleaned object or null when empty.
create or replace function public.clean_localized(p_val jsonb, p_max int) returns jsonb
language plpgsql immutable set search_path = public as $$
declare k text; v text; out jsonb := '{}'::jsonb;
begin
  if p_val is null or jsonb_typeof(p_val) <> 'object' then raise exception 'text must be an object' using errcode = '22023'; end if;
  for k in select jsonb_object_keys(p_val) loop
    if k not in ('ar', 'en', 'id') then raise exception 'unknown language %', k using errcode = '22023'; end if;
    if jsonb_typeof(p_val -> k) <> 'string' then raise exception 'text must be a string' using errcode = '22023'; end if;
    v := btrim(p_val ->> k);
    if char_length(v) > p_max then raise exception 'text too long' using errcode = '22023'; end if;
    if v <> '' then out := out || jsonb_build_object(k, v); end if;
  end loop;
  return case when out = '{}'::jsonb then null else out end;
end $$;

create or replace function public.admin_create_announcement(p_title jsonb, p_body jsonb, p_class uuid default null, p_expires timestamptz default null)
returns uuid
language plpgsql security definer set search_path = public as $$
declare v_title jsonb; v_body jsonb; v_id uuid; k text;
begin
  if not public.is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  v_title := public.clean_localized(p_title, 80);
  v_body := public.clean_localized(p_body, 600);
  if v_title is null or v_body is null then raise exception 'a title and a message are needed' using errcode = '22023'; end if;
  -- every language that has a title must also have a message, and the other way round
  for k in select jsonb_object_keys(v_title) loop if not (v_body ? k) then raise exception 'title and message languages must match' using errcode = '22023'; end if; end loop;
  for k in select jsonb_object_keys(v_body) loop if not (v_title ? k) then raise exception 'title and message languages must match' using errcode = '22023'; end if; end loop;
  if p_class is not null and not exists (select 1 from public.classes where id = p_class) then raise exception 'class not found' using errcode = 'P0002'; end if;
  if p_expires is not null and p_expires <= now() then raise exception 'expiry must be in the future' using errcode = '22023'; end if;
  insert into public.announcements (title, body, audience, class_id, created_by, expires_at)
    values (v_title, v_body, case when p_class is null then 'all' else 'class' end, p_class, auth.uid(), p_expires)
    returning id into v_id;
  return v_id;
end $$;

create or replace function public.admin_list_announcements()
returns table (id uuid, title jsonb, body jsonb, audience text, class_id uuid, class_name text, created_at timestamptz, expires_at timestamptz, archived_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  return query
    select a.id, a.title, a.body, a.audience, a.class_id, c.name, a.created_at, a.expires_at, a.archived_at
    from public.announcements a left join public.classes c on c.id = a.class_id
    order by a.created_at desc limit 200;
end $$;

create or replace function public.admin_archive_announcement(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  update public.announcements set archived_at = now() where id = p_id and archived_at is null;
  if not found then raise exception 'announcement not found' using errcode = 'P0002'; end if;
end $$;

create or replace function public.my_announcements()
returns table (id uuid, title jsonb, body jsonb, class_name text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select a.id, a.title, a.body, c.name, a.created_at
  from public.announcements a left join public.classes c on c.id = a.class_id
  where auth.uid() is not null
    and a.archived_at is null
    and (a.expires_at is null or a.expires_at > now())
    and (a.audience = 'all' or exists (select 1 from public.class_members m where m.class_id = a.class_id and m.student_id = auth.uid()))
  order by a.created_at desc
  limit 20
$$;

revoke all on function public.clean_localized(jsonb, int), public.admin_create_announcement(jsonb, jsonb, uuid, timestamptz), public.admin_list_announcements(),
  public.admin_archive_announcement(uuid), public.my_announcements() from public, anon;
grant execute on function public.admin_create_announcement(jsonb, jsonb, uuid, timestamptz), public.admin_list_announcements(),
  public.admin_archive_announcement(uuid), public.my_announcements() to authenticated;
