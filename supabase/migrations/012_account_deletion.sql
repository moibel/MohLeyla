-- MohLeyla account deletion: lets a person delete their own account and personal data from inside the app (required by the App Store
-- and Google Play). Run once in Supabase after 011_push.sql. Additive.
--
-- How it works: the app calls the Edge Function "delete-account" with the person's own sign-in. The function (service role) 1) asks the
-- database for the list of chat files that will disappear (account_delete_prepare, which also refuses to delete the LAST admin),
-- 2) deletes the sign-in (auth.admin.deleteUser) - every table that points at the user cascades from that, 3) removes data that is
-- stored by e-mail address instead (account_delete_cleanup: rewards given to that address and announcements sent to it) and 4) removes the
-- chat files from storage. For Apple sign-ins the function also revokes the Apple token.
--
-- What is deleted with the account (all through the existing "on delete cascade" rules, tested in tests/account_deletion.test.sql):
--   progress, profile and role, class memberships, classes they teach (with their members and class announcements), phone notification
--   tokens, and EVERY chat they were in (both people lose that chat, with its voice notes, photos and call lines), plus rewards and
--   announcements addressed to their e-mail. Things they created for others (announcements, content switches, rewards they granted) stay,
--   with the author left empty.
--
-- Security: both functions are callable ONLY by the service role (the Edge Function). Signed-in users and visitors cannot call them,
-- so nobody can delete someone else's account or learn which files exist.

create or replace function public.account_delete_prepare(p_user uuid) returns text[]
language plpgsql security definer set search_path = public, auth as $$
declare v_paths text[];
begin
  if p_user is null or not exists (select 1 from auth.users where id = p_user) then raise exception 'unknown person' using errcode = '22023'; end if;
  -- never leave the app without an administrator
  if exists (select 1 from public.profiles where user_id = p_user and role = 'admin')
     and not exists (select 1 from public.profiles where role = 'admin' and user_id <> p_user) then
    raise exception 'you are the only admin' using errcode = '55000';
  end if;
  -- every file in every chat this person is in (those chats disappear for both people)
  select coalesce(array_agg(distinct m.file_path), '{}') into v_paths
  from public.chat_messages m join public.conversations c on c.id = m.conversation_id
  where p_user in (c.user_a, c.user_b) and m.file_path is not null;
  return v_paths;
end $$;

-- Things stored by e-mail address instead of by user id.
create or replace function public.account_delete_cleanup(p_email text) returns void
language plpgsql security definer set search_path = public as $$
declare v_email text := lower(btrim(coalesce(p_email, '')));
begin
  if v_email = '' then return; end if;
  delete from public.rewards where email = v_email;
  delete from public.announcements where user_email = v_email;
end $$;

revoke all on function public.account_delete_prepare(uuid), public.account_delete_cleanup(text) from public, anon, authenticated;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.account_delete_prepare(uuid), public.account_delete_cleanup(text) to service_role;
  end if;
end $$;
