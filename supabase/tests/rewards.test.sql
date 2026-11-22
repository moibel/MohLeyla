-- Permission tests for 003_rewards.sql. Run the combined script from `sh supabase/tests/run-dry.sh rewards` in the Supabase SQL editor.
-- It ends by RAISING AN EXCEPTION on purpose, so everything (migrations, fake users, rewards) is rolled back. The error text is the report.

create schema zz_test;
grant usage on schema zz_test to authenticated, anon;
create table zz_test.results (n serial primary key, name text, ok boolean, detail text);
grant all on zz_test.results to authenticated, anon;
grant all on sequence zz_test.results_n_seq to authenticated, anon;

create function zz_test.chk(p_name text, p_ok boolean, p_detail text default '') returns void language sql as $$
  insert into zz_test.results (name, ok, detail) values (p_name, coalesce(p_ok, false), p_detail) $$;
create function zz_test.try(p_sql text) returns text language plpgsql as $$
  begin execute p_sql; return 'ok'; exception when others then return 'err:' || sqlstate; end $$;
create function zz_test.cnt(p_sql text) returns int language plpgsql as $$
  declare n int; begin execute 'select count(*) from (' || p_sql || ') q' into n; return n; exception when others then return -1; end $$;
create function zz_test.as_user(u uuid) returns void language plpgsql as $$
  begin
    perform set_config('request.jwt.claim.sub', u::text, true);
    perform set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';
  end $$;
grant execute on all functions in schema zz_test to authenticated, anon;

insert into auth.users (id, aud, role, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000a1', 'authenticated', 'authenticated', 'admin@test.local',   '{"display_name":"Ada Admin"}'),
  ('00000000-0000-0000-0000-0000000000b1', 'authenticated', 'authenticated', 'teacher1@test.local','{}'),
  ('00000000-0000-0000-0000-0000000000c1', 'authenticated', 'authenticated', 'Student1@Test.local','{"display_name":"Sara Student"}'),
  ('00000000-0000-0000-0000-0000000000c2', 'authenticated', 'authenticated', 'student2@test.local','{}');

do $t$
declare
  a  constant uuid := '00000000-0000-0000-0000-0000000000a1';
  t1 constant uuid := '00000000-0000-0000-0000-0000000000b1';
  s1 constant uuid := '00000000-0000-0000-0000-0000000000c1';
  s2 constant uuid := '00000000-0000-0000-0000-0000000000c2';
  res text; v_id uuid; n int; r record;
begin
  update public.profiles set role = 'admin' where user_id = a;
  update public.profiles set role = 'teacher' where user_id = t1;

  -- ---------------------------------------------------------------- nobody but an admin can grant, list or revoke
  execute 'reset role'; perform zz_test.as_user(s1);
  res := zz_test.try($q$select public.admin_grant_reward('student1@test.local', 'star', 5, null, 'self')$q$);
  perform zz_test.chk('student cannot grant themselves a reward', res = 'err:42501', res);
  res := zz_test.try($q$select * from public.admin_list_rewards()$q$);
  perform zz_test.chk('student cannot list the reward history', res = 'err:42501', res);
  res := zz_test.try($q$select public.admin_revoke_reward(gen_random_uuid())$q$);
  perform zz_test.chk('student cannot revoke', res = 'err:42501', res);
  res := zz_test.try($q$insert into public.rewards (email, kind, amount, granted_by) values ('student1@test.local', 'xp', 100, '00000000-0000-0000-0000-0000000000c1')$q$);
  perform zz_test.chk('student cannot insert into the rewards table directly', res like 'err:%', res);
  res := zz_test.try($q$select * from public.rewards$q$);
  perform zz_test.chk('student cannot read the rewards table directly', res like 'err:%', res);

  execute 'reset role'; perform zz_test.as_user(t1);
  res := zz_test.try($q$select public.admin_grant_reward('student1@test.local', 'xp', 50, null, null)$q$);
  perform zz_test.chk('teacher cannot grant rewards (admin only)', res = 'err:42501', res);

  execute 'reset role'; set local role anon;
  res := zz_test.try($q$select * from public.my_rewards()$q$);
  perform zz_test.chk('anonymous visitors cannot call my_rewards', res like 'err:%', res);
  res := zz_test.try($q$select public.admin_grant_reward('x@y.zz', 'star', 1, null, null)$q$);
  perform zz_test.chk('anonymous visitors cannot grant', res like 'err:%', res);

  -- ---------------------------------------------------------------- an admin grants
  execute 'reset role'; perform zz_test.as_user(a);
  perform public.admin_grant_reward('  STUDENT1@test.local ', 'star', 5, null, 'Ramadan challenge');
  perform public.admin_grant_reward('student1@test.local', 'xp', 250, null, null);
  perform public.admin_grant_reward('student1@test.local', 'badge', 99, 'Challenge winner', 'First place');
  perform zz_test.chk('an admin can grant stars, xp and a badge (the address is trimmed and lower-cased)', (select count(*) from public.admin_list_rewards('student1@test.local')) = 3);
  perform zz_test.chk('a badge is always amount 1', (select amount from public.admin_list_rewards() where kind = 'badge') = 1);

  res := zz_test.try($q$select public.admin_grant_reward('not-an-email', 'star', 1, null, null)$q$);
  perform zz_test.chk('an invalid email is rejected', res = 'err:22023', res);
  res := zz_test.try($q$select public.admin_grant_reward('a@b.cc', 'gold', 1, null, null)$q$);
  perform zz_test.chk('an unknown kind is rejected', res = 'err:22023', res);
  res := zz_test.try($q$select public.admin_grant_reward('a@b.cc', 'star', 0, null, null)$q$);
  perform zz_test.chk('zero is rejected', res = 'err:22023', res);
  res := zz_test.try($q$select public.admin_grant_reward('a@b.cc', 'star', -5, null, null)$q$);
  perform zz_test.chk('negative amounts are rejected', res = 'err:22023', res);
  res := zz_test.try($q$select public.admin_grant_reward('a@b.cc', 'star', 1001, null, null)$q$);
  perform zz_test.chk('more than 1000 stars is rejected', res = 'err:22023', res);
  res := zz_test.try($q$select public.admin_grant_reward('a@b.cc', 'xp', 10001, null, null)$q$);
  perform zz_test.chk('more than 10000 xp is rejected', res = 'err:22023', res);
  res := zz_test.try($q$select public.admin_grant_reward('a@b.cc', 'badge', 1, '', null)$q$);
  perform zz_test.chk('a badge without a name is rejected', res = 'err:22023', res);
  res := zz_test.try($q$select public.admin_grant_reward('a@b.cc', 'badge', 1, repeat('x', 41), null)$q$);
  perform zz_test.chk('a badge name over 40 characters is rejected', res = 'err:22023', res);
  res := zz_test.try($q$select public.admin_grant_reward('a@b.cc', 'star', 1, null, repeat('x', 141))$q$);
  perform zz_test.chk('a reason over 140 characters is rejected', res = 'err:22023', res);

  -- a reward for an address that has not signed up yet is allowed and waits
  perform public.admin_grant_reward('newcomer@test.local', 'star', 3, null, 'Welcome gift');
  perform zz_test.chk('a reward can be given to an address with no account yet', (select count(*) from public.admin_list_rewards('newcomer@test.local')) = 1);
  perform zz_test.chk('the history shows the learner name when the account exists', (select display_name from public.admin_list_rewards('student1@test.local') limit 1) = 'Sara Student');
  perform zz_test.chk('the history records who granted it', (select count(*) from public.admin_list_rewards() where granted_by_email = 'admin@test.local') = 4);

  -- ---------------------------------------------------------------- the learner sees only their own
  execute 'reset role'; perform zz_test.as_user(s1);
  perform zz_test.chk('a learner sees their own rewards (account e-mail matched without regard to case)', (select count(*) from public.my_rewards()) = 3);
  perform zz_test.chk('the totals are right', (select coalesce(sum(amount), 0) from public.my_rewards() where kind = 'star') = 5 and (select coalesce(sum(amount), 0) from public.my_rewards() where kind = 'xp') = 250);
  execute 'reset role'; perform zz_test.as_user(s2);
  perform zz_test.chk('another learner sees none of them', (select count(*) from public.my_rewards()) = 0);

  -- the waiting reward appears at first sign-in
  execute 'reset role';
  insert into auth.users (id, aud, role, email, raw_user_meta_data) values ('00000000-0000-0000-0000-0000000000d1', 'authenticated', 'authenticated', 'Newcomer@test.local', '{}');
  perform zz_test.as_user('00000000-0000-0000-0000-0000000000d1');
  perform zz_test.chk('a reward given before sign-up appears once the person signs up with that address', (select count(*) from public.my_rewards()) = 1);

  -- ---------------------------------------------------------------- revoke
  execute 'reset role'; perform zz_test.as_user(a);
  select id into v_id from public.admin_list_rewards('student1@test.local') where kind = 'xp';
  perform public.admin_revoke_reward(v_id);
  res := zz_test.try(format('select public.admin_revoke_reward(%L)', v_id));
  perform zz_test.chk('revoking twice is an error', res = 'err:P0002', res);
  perform zz_test.chk('a revoked reward stays in the history, marked revoked', (select revoked_at is not null from public.admin_list_rewards('student1@test.local') where id = v_id));
  execute 'reset role'; perform zz_test.as_user(s1);
  perform zz_test.chk('a revoked reward is no longer counted for the learner', (select count(*) from public.my_rewards()) = 2 and (select coalesce(sum(amount), 0) from public.my_rewards() where kind = 'xp') = 0);

  execute 'reset role';
end
$t$;

do $report$
declare passed int; failed int; lines text;
begin
  select count(*) filter (where ok), count(*) filter (where not ok), string_agg(case when ok then 'PASS ' else 'FAIL ' end || name || case when ok then '' else '  [' || detail || ']' end, E'\n' order by n)
    into passed, failed, lines from zz_test.results;
  raise exception E'TEST REPORT (everything is rolled back): % passed, % failed\n%', passed, failed, lines;
end
$report$;
