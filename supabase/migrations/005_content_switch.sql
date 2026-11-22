-- MohLeyla content switches: an admin can hide a whole learning path, or single lessons, from learners (and show them again).
-- Run once in Supabase: SQL Editor -> New query -> paste -> Run. Needs 002_roles_classes.sql first. Additive: nothing existing changes.
--
-- Security model
--   * A row in content_switches means "hidden". The table has no direct access (row level security on, every privilege revoked).
--   * Anyone (even signed out) may read WHICH items are hidden through content_disabled(): it is public configuration, not personal data.
--   * Only an admin can hide or show anything (checked inside admin_set_content_enabled by is_admin()).
--   * Hiding never deletes anything: learners keep their progress, and the lesson files are unchanged.

create table if not exists public.content_switches (
  kind        text not null check (kind in ('track', 'lesson')),
  key         text not null,
  disabled_at timestamptz not null default now(),
  disabled_by uuid references auth.users (id) on delete set null,
  primary key (kind, key),
  check ((kind = 'track' and key ~ '^(ar|sa|en|id)$') or (kind = 'lesson' and key ~ '^(ar|sa|en|id)-[0-9]{2}$'))
);
alter table public.content_switches enable row level security;
revoke all on public.content_switches from anon, authenticated;

create or replace function public.content_disabled() returns table (kind text, key text)
language sql stable security definer set search_path = public as $$
  select s.kind, s.key from public.content_switches s order by s.kind, s.key
$$;

create or replace function public.admin_set_content_enabled(p_kind text, p_key text, p_enabled boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  if p_enabled is null then raise exception 'enabled must be true or false' using errcode = '22023'; end if;
  if p_kind not in ('track', 'lesson') or p_key is null
     or not ((p_kind = 'track' and p_key ~ '^(ar|sa|en|id)$') or (p_kind = 'lesson' and p_key ~ '^(ar|sa|en|id)-[0-9]{2}$')) then
    raise exception 'unknown content item' using errcode = '22023';
  end if;
  if p_enabled then
    delete from public.content_switches where kind = p_kind and key = p_key;
  else
    insert into public.content_switches (kind, key, disabled_by) values (p_kind, p_key, auth.uid()) on conflict (kind, key) do nothing;
  end if;
end $$;

revoke all on function public.content_disabled(), public.admin_set_content_enabled(text, text, boolean) from public, anon;
grant execute on function public.content_disabled() to anon, authenticated;
grant execute on function public.admin_set_content_enabled(text, text, boolean) to authenticated;
