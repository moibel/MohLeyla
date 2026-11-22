-- MohLeyla announcements, part 2: send an announcement to ONE person (matched by e-mail, like rewards) and give it a look
-- ("info", "celebrate", "alert") so important or happy news can stand out with graphics and a sound on the learner's side.
-- Run once in Supabase: SQL Editor -> New query -> paste -> Run. Needs 002, 003 (my_email) and 004 first. Additive for existing rows:
-- every existing announcement keeps working as "info".
--
-- Security model is unchanged: the table has no direct access; only an admin can post, list or archive; a learner reads only what is
-- meant for them: everyone, a class they joined, or their own e-mail address.

alter table public.announcements add column if not exists user_email text;
alter table public.announcements add column if not exists style text not null default 'info';
alter table public.announcements drop constraint if exists announcements_audience_check;
alter table public.announcements drop constraint if exists announcements_check;
alter table public.announcements drop constraint if exists announcements_style_check;
alter table public.announcements drop constraint if exists announcements_user_email_check;
alter table public.announcements drop constraint if exists announcements_target_check;
alter table public.announcements add constraint announcements_style_check check (style in ('info', 'celebrate', 'alert'));
alter table public.announcements add constraint announcements_user_email_check check (user_email is null or (user_email = lower(user_email) and char_length(user_email) between 3 and 254));
alter table public.announcements add constraint announcements_target_check check (
  (audience = 'all'   and class_id is null     and user_email is null) or
  (audience = 'class' and class_id is not null and user_email is null) or
  (audience = 'user'  and class_id is null     and user_email is not null)
);
alter table public.announcements add constraint announcements_audience_check check (audience in ('all', 'class', 'user'));

drop function if exists public.admin_create_announcement(jsonb, jsonb, uuid, timestamptz);
create or replace function public.admin_create_announcement(
  p_title jsonb, p_body jsonb, p_class uuid default null, p_expires timestamptz default null, p_user_email text default null, p_style text default 'info')
returns uuid
language plpgsql security definer set search_path = public as $$
declare v_title jsonb; v_body jsonb; v_id uuid; k text; v_email text := nullif(lower(btrim(coalesce(p_user_email, ''))), '');
begin
  if not public.is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  if p_style is null or p_style not in ('info', 'celebrate', 'alert') then raise exception 'unknown style' using errcode = '22023'; end if;
  if p_class is not null and v_email is not null then raise exception 'choose a class or a person, not both' using errcode = '22023'; end if;
  if v_email is not null and (v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or char_length(v_email) > 254) then raise exception 'invalid email' using errcode = '22023'; end if;
  v_title := public.clean_localized(p_title, 80);
  v_body := public.clean_localized(p_body, 600);
  if v_title is null or v_body is null then raise exception 'a title and a message are needed' using errcode = '22023'; end if;
  for k in select jsonb_object_keys(v_title) loop if not (v_body ? k) then raise exception 'title and message languages must match' using errcode = '22023'; end if; end loop;
  for k in select jsonb_object_keys(v_body) loop if not (v_title ? k) then raise exception 'title and message languages must match' using errcode = '22023'; end if; end loop;
  if p_class is not null and not exists (select 1 from public.classes where id = p_class) then raise exception 'class not found' using errcode = 'P0002'; end if;
  if p_expires is not null and p_expires <= now() then raise exception 'expiry must be in the future' using errcode = '22023'; end if;
  insert into public.announcements (title, body, audience, class_id, user_email, style, created_by, expires_at)
    values (v_title, v_body, case when v_email is not null then 'user' when p_class is null then 'all' else 'class' end, p_class, v_email, p_style, auth.uid(), p_expires)
    returning id into v_id;
  return v_id;
end $$;

drop function if exists public.admin_list_announcements();
create or replace function public.admin_list_announcements()
returns table (id uuid, title jsonb, body jsonb, audience text, class_id uuid, class_name text, user_email text, style text, created_at timestamptz, expires_at timestamptz, archived_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  return query
    select a.id, a.title, a.body, a.audience, a.class_id, c.name, a.user_email, a.style, a.created_at, a.expires_at, a.archived_at
    from public.announcements a left join public.classes c on c.id = a.class_id
    order by a.created_at desc limit 200;
end $$;

drop function if exists public.my_announcements();
create or replace function public.my_announcements()
returns table (id uuid, title jsonb, body jsonb, class_name text, audience text, style text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select a.id, a.title, a.body, c.name, a.audience, a.style, a.created_at
  from public.announcements a left join public.classes c on c.id = a.class_id
  where auth.uid() is not null
    and a.archived_at is null
    and (a.expires_at is null or a.expires_at > now())
    and (a.audience = 'all'
         or (a.audience = 'class' and exists (select 1 from public.class_members m where m.class_id = a.class_id and m.student_id = auth.uid()))
         or (a.audience = 'user' and a.user_email = public.my_email()))
  order by a.created_at desc
  limit 20
$$;

revoke all on function public.admin_create_announcement(jsonb, jsonb, uuid, timestamptz, text, text), public.admin_list_announcements(), public.my_announcements() from public, anon;
grant execute on function public.admin_create_announcement(jsonb, jsonb, uuid, timestamptz, text, text), public.admin_list_announcements(), public.my_announcements() to authenticated;
