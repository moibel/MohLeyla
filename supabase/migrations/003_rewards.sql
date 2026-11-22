-- MohLeyla admin rewards: stars, bonus XP and named badges that only an admin can give, to any email address.
-- Run once in Supabase: SQL Editor -> New query -> paste -> Run. Needs 002_roles_classes.sql first. Additive: nothing existing changes.
--
-- Security model
--   * Rewards live only in this table and the table has no direct access at all (row level security on, no policies, no grants):
--     everything goes through the functions below, so nobody can give themselves a reward.
--   * Only an admin can grant, list or revoke (checked inside each function by is_admin()).
--   * A learner reads only their OWN rewards through my_rewards(), matched on the e-mail of their signed-in account.
--     Rewards given to an address that has not signed up yet simply wait there and appear at first sign-in.
--   * Every grant records who gave it and when; a revoke keeps the row (revoked_at / revoked_by) so there is a history.

create table if not exists public.rewards (
  id         uuid primary key default gen_random_uuid(),
  email      text not null check (email = lower(email) and char_length(email) between 3 and 254),
  kind       text not null check (kind in ('xp', 'star', 'badge')),
  amount     int  not null check (amount between 1 and 100000),
  label      text check (label is null or char_length(label) between 1 and 40),
  reason     text check (reason is null or char_length(reason) <= 140),
  granted_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  revoked_by uuid references auth.users (id) on delete set null,
  check (kind <> 'badge' or (label is not null and amount = 1))
);
alter table public.rewards enable row level security;
revoke all on public.rewards from anon, authenticated;
create index if not exists rewards_email_idx on public.rewards (email) where revoked_at is null;

create or replace function public.my_email() returns text
language sql stable security definer set search_path = public, auth as $$
  select lower(u.email) from auth.users u where u.id = auth.uid()
$$;

-- Admin: give a reward. xp 1..10000, star 1..1000, badge needs a label (amount is always 1).
create or replace function public.admin_grant_reward(p_email text, p_kind text, p_amount int, p_label text, p_reason text)
returns uuid
language plpgsql security definer set search_path = public as $$
declare v_email text := lower(btrim(coalesce(p_email, ''))); v_id uuid; v_amount int := p_amount; v_label text := nullif(btrim(coalesce(p_label, '')), ''); v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  if not public.is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or char_length(v_email) > 254 then raise exception 'invalid email' using errcode = '22023'; end if;
  if p_kind not in ('xp', 'star', 'badge') then raise exception 'unknown reward kind' using errcode = '22023'; end if;
  if p_kind = 'badge' then
    v_amount := 1;
    if v_label is null or char_length(v_label) > 40 then raise exception 'a badge needs a name of 1-40 characters' using errcode = '22023'; end if;
  else
    if v_amount is null or v_amount < 1 or v_amount > (case when p_kind = 'xp' then 10000 else 1000 end) then raise exception 'amount out of range' using errcode = '22023'; end if;
    v_label := null;
  end if;
  if v_reason is not null and char_length(v_reason) > 140 then raise exception 'reason too long' using errcode = '22023'; end if;
  insert into public.rewards (email, kind, amount, label, reason, granted_by) values (v_email, p_kind, v_amount, v_label, v_reason, auth.uid()) returning id into v_id;
  return v_id;
end $$;

-- Admin: history (newest first), optionally for one address. Shows the learner's name when that address has an account.
create or replace function public.admin_list_rewards(p_email text default null)
returns table (id uuid, email text, display_name text, kind text, amount int, label text, reason text, created_at timestamptz, granted_by_email text, revoked_at timestamptz)
language plpgsql stable security definer set search_path = public, auth as $$
begin
  if not public.is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  return query
    select r.id, r.email, coalesce(u.raw_user_meta_data->>'display_name', u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', ''),
           r.kind, r.amount, r.label, r.reason, r.created_at, g.email::text, r.revoked_at
    from public.rewards r
    left join auth.users u on lower(u.email) = r.email
    left join auth.users g on g.id = r.granted_by
    where p_email is null or r.email = lower(btrim(p_email))
    order by r.created_at desc
    limit 500;
end $$;

-- Admin: take a reward back (kept in the history, no longer counted).
create or replace function public.admin_revoke_reward(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  update public.rewards set revoked_at = now(), revoked_by = auth.uid() where id = p_id and revoked_at is null;
  if not found then raise exception 'reward not found' using errcode = 'P0002'; end if;
end $$;

-- Learner: my own current rewards.
create or replace function public.my_rewards()
returns table (id uuid, kind text, amount int, label text, reason text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select r.id, r.kind, r.amount, r.label, r.reason, r.created_at
  from public.rewards r
  where auth.uid() is not null and r.revoked_at is null and r.email = public.my_email()
  order by r.created_at desc
$$;

revoke all on function public.my_email(), public.admin_grant_reward(text, text, int, text, text), public.admin_list_rewards(text),
  public.admin_revoke_reward(uuid), public.my_rewards() from public, anon;
grant execute on function public.my_email(), public.admin_grant_reward(text, text, int, text, text), public.admin_list_rewards(text),
  public.admin_revoke_reward(uuid), public.my_rewards() to authenticated;
