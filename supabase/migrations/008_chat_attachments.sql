-- MohLeyla chat attachments: voice notes and photos in private chats. Run once in Supabase after 007_chat.sql.
--
-- Decisions (owner): students may send photos and voice notes; attachments are kept 90 days; no PDFs or other file types.
--
-- Security model
--   * Files live in a PRIVATE storage bucket, "chat-files", one folder per conversation: <conversation id>/<random id>.<ext>.
--   * Only the two people in the conversation can upload to its folder or read from it, and the admin can read (to keep everyone safe)
--     and delete. Nobody else. This is enforced by storage policies that use the same membership check as the chat itself.
--   * The bucket itself refuses anything but small images (JPEG/PNG/WebP) and audio, at most 5 MB.
--   * A message can only point at a file the sender really uploaded into that conversation (checked in send_attachment).
--   * After 90 days a file can no longer be read (the policy checks its age) and the admin's clean-up removes it for good.
--   * Plain text messages work exactly as before.

-- ---------------------------------------------------------------- the bucket
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('chat-files', 'chat-files', false, 5242880,
        array['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/aac', 'audio/x-m4a', 'image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = 5242880,
  allowed_mime_types = array['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/aac', 'audio/x-m4a', 'image/jpeg', 'image/png', 'image/webp'];

-- storage policies call this check as the signed-in user, so it must be callable (it only answers "am I in this conversation?")
grant execute on function public.is_chat_member(uuid) to authenticated;

drop policy if exists "chat files: members upload" on storage.objects;
create policy "chat files: members upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'chat-files' and (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$' and public.is_chat_member(((storage.foldername(name))[1])::uuid));

drop policy if exists "chat files: members and admins read" on storage.objects;
create policy "chat files: members and admins read" on storage.objects for select to authenticated
  using (bucket_id = 'chat-files' and created_at > now() - interval '90 days'
         and (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
         and (public.is_chat_member(((storage.foldername(name))[1])::uuid) or public.is_admin()));

drop policy if exists "chat files: admins delete" on storage.objects;
create policy "chat files: admins delete" on storage.objects for delete to authenticated
  using (bucket_id = 'chat-files' and public.is_admin());

-- ---------------------------------------------------------------- messages can carry a file
alter table public.chat_messages add column if not exists kind text not null default 'text';
alter table public.chat_messages add column if not exists file_path text;
alter table public.chat_messages add column if not exists file_mime text;
alter table public.chat_messages add column if not exists file_size int;
alter table public.chat_messages add column if not exists duration_ms int;
alter table public.chat_messages drop constraint if exists chat_messages_body_check;
alter table public.chat_messages drop constraint if exists chat_messages_kind_check;
alter table public.chat_messages drop constraint if exists chat_messages_content_check;
alter table public.chat_messages add constraint chat_messages_kind_check check (kind in ('text', 'voice', 'image'));
alter table public.chat_messages add constraint chat_messages_content_check check (
  (kind = 'text'  and char_length(body) between 1 and 1000 and file_path is null) or
  (kind <> 'text' and char_length(body) <= 200 and file_path is not null and file_size between 1 and 5242880)
);

create or replace function public.send_attachment(p_conv uuid, p_kind text, p_path text, p_mime text, p_size int, p_duration_ms int default null, p_caption text default null)
returns uuid
language plpgsql security definer set search_path = public, storage as $$
declare v_caption text := btrim(coalesce(p_caption, '')); v_id uuid;
begin
  if not public.is_chat_member(p_conv) then raise exception 'not allowed' using errcode = '42501'; end if;
  if p_kind not in ('voice', 'image') then raise exception 'unknown attachment kind' using errcode = '22023'; end if;
  if p_path is null or p_path not like p_conv::text || '/%' or p_path !~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(webm|ogg|m4a|mp4|mp3|aac|jpg|jpeg|png|webp)$' then
    raise exception 'bad file path' using errcode = '22023';
  end if;
  if p_kind = 'voice' and (p_mime is null or p_mime not in ('audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/aac', 'audio/x-m4a')) then raise exception 'unsupported audio type' using errcode = '22023'; end if;
  if p_kind = 'image' and (p_mime is null or p_mime not in ('image/jpeg', 'image/png', 'image/webp')) then raise exception 'unsupported image type' using errcode = '22023'; end if;
  if p_size is null or p_size < 1 or p_size > 5242880 then raise exception 'file too large' using errcode = '22023'; end if;
  if p_kind = 'voice' and (p_duration_ms is null or p_duration_ms < 300 or p_duration_ms > 125000) then raise exception 'voice notes are up to 2 minutes' using errcode = '22023'; end if;
  if char_length(v_caption) > 200 then raise exception 'caption too long' using errcode = '22023'; end if;
  -- the file must really be in storage, uploaded by this person
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

-- ---------------------------------------------------------------- readers return the extra fields
drop function if exists public.chat_unread_total();
drop function if exists public.my_chats();
create or replace function public.my_chats()
returns table (conversation_id uuid, other_id uuid, other_name text, other_role text, last_body text, last_kind text, last_at timestamptz, last_is_mine boolean, unread int)
language sql stable security definer set search_path = public as $$
  select c.id,
         o.oid, public.display_name_of(o.oid), coalesce((select p.role from public.profiles p where p.user_id = o.oid), 'student'),
         (select case when m.removed_at is not null then '' else left(m.body, 120) end from public.chat_messages m where m.conversation_id = c.id order by m.created_at desc limit 1),
         (select case when m.removed_at is not null then 'text' else m.kind end from public.chat_messages m where m.conversation_id = c.id order by m.created_at desc limit 1),
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
create or replace function public.chat_unread_total() returns int
language sql stable security definer set search_path = public as $$
  select coalesce((select sum(u.unread)::int from public.my_chats() u), 0)
$$;

drop function if exists public.chat_messages_of(uuid);
create or replace function public.chat_messages_of(p_conv uuid)
returns table (id uuid, mine boolean, body text, created_at timestamptz, removed boolean, kind text, file_path text, file_mime text, duration_ms int, expired boolean)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_chat_member(p_conv) then raise exception 'not allowed' using errcode = '42501'; end if;
  return query
    select m.id, m.sender_id = auth.uid(), case when m.removed_at is not null then '' else m.body end, m.created_at, m.removed_at is not null,
           m.kind, case when m.removed_at is not null or m.created_at <= now() - interval '90 days' then null else m.file_path end, m.file_mime, m.duration_ms,
           m.kind <> 'text' and m.created_at <= now() - interval '90 days'
    from (select * from public.chat_messages x where x.conversation_id = p_conv order by x.created_at desc limit 200) m
    order by m.created_at asc;
end $$;

drop function if exists public.admin_chat_messages(uuid);
create or replace function public.admin_chat_messages(p_conv uuid)
returns table (id uuid, sender_id uuid, sender_name text, body text, created_at timestamptz, removed boolean, kind text, file_path text, file_mime text, duration_ms int, expired boolean)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  return query
    select m.id, m.sender_id, public.display_name_of(m.sender_id), m.body, m.created_at, m.removed_at is not null,
           m.kind, case when m.created_at <= now() - interval '90 days' then null else m.file_path end, m.file_mime, m.duration_ms,
           m.kind <> 'text' and m.created_at <= now() - interval '90 days'
    from (select * from public.chat_messages x where x.conversation_id = p_conv order by x.created_at desc limit 500) m
    order by m.created_at asc;
end $$;

-- Admin clean-up: the names of files older than 90 days (including files whose message is gone). The admin's browser deletes them
-- through the storage API; this list is just the to-do list.
create or replace function public.admin_expired_files() returns table (name text)
language plpgsql stable security definer set search_path = public, storage as $$
begin
  if not public.is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  return query select o.name from storage.objects o where o.bucket_id = 'chat-files' and o.created_at <= now() - interval '90 days' order by o.created_at limit 200;
end $$;

revoke all on function public.send_attachment(uuid, text, text, text, int, int, text), public.my_chats(), public.chat_unread_total(), public.chat_messages_of(uuid),
  public.admin_chat_messages(uuid), public.admin_expired_files() from public, anon, authenticated;
grant execute on function public.send_attachment(uuid, text, text, text, int, int, text), public.my_chats(), public.chat_unread_total(), public.chat_messages_of(uuid),
  public.admin_chat_messages(uuid), public.admin_expired_files() to authenticated;
