-- Allow the two newest beta learning paths (German de, Tagalog tl) in the admin lesson/path switches.
-- Run once in Supabase after 012_account_deletion.sql. Additive: existing switches keep working.
alter table public.content_switches drop constraint if exists content_switches_check;
alter table public.content_switches drop constraint if exists content_switches_key_check;
alter table public.content_switches add constraint content_switches_key_check check (
  (kind = 'track' and key ~ '^(ar|sa|eg|en|id|fr|es|zh|de|tl)$') or (kind = 'lesson' and key ~ '^(ar|sa|eg|en|id|fr|es|zh|de|tl)-[0-9]{2}$')
);

create or replace function public.admin_set_content_enabled(p_kind text, p_key text, p_enabled boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  if p_enabled is null then raise exception 'enabled must be true or false' using errcode = '22023'; end if;
  if p_kind not in ('track', 'lesson') or p_key is null
     or not ((p_kind = 'track' and p_key ~ '^(ar|sa|eg|en|id|fr|es|zh|de|tl)$') or (p_kind = 'lesson' and p_key ~ '^(ar|sa|eg|en|id|fr|es|zh|de|tl)-[0-9]{2}$')) then
    raise exception 'unknown content item' using errcode = '22023';
  end if;
  if p_enabled then
    delete from public.content_switches where kind = p_kind and key = p_key;
  else
    insert into public.content_switches (kind, key, disabled_by) values (p_kind, p_key, auth.uid()) on conflict (kind, key) do nothing;
  end if;
end $$;

revoke all on function public.admin_set_content_enabled(text, text, boolean) from public, anon;
grant execute on function public.admin_set_content_enabled(text, text, boolean) to authenticated;
