-- Permission tests for 005_content_switch.sql + 009_content_switch_languages.sql. Run via `sh supabase/tests/run-dry.sh switch` (Supabase editor) or `run-local.sh switch`.
-- Ends with a deliberate exception so everything is rolled back; the error text is the report.

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
  ('00000000-0000-0000-0000-0000000000a1', 'authenticated', 'authenticated', 'admin@test.local',   '{}'),
  ('00000000-0000-0000-0000-0000000000b1', 'authenticated', 'authenticated', 'teacher1@test.local','{}'),
  ('00000000-0000-0000-0000-0000000000c1', 'authenticated', 'authenticated', 'student1@test.local','{}');

-- 014: e-mail keyed features need a confirmed address, and writing in chat needs accepted terms
update auth.users set email_confirmed_at = now() where email ilike '%@test.local';
insert into public.terms_acceptances (user_id, version) select id, 'test' from auth.users where email ilike '%@test.local';

do $t$
declare
  a  constant uuid := '00000000-0000-0000-0000-0000000000a1';
  t1 constant uuid := '00000000-0000-0000-0000-0000000000b1';
  s1 constant uuid := '00000000-0000-0000-0000-0000000000c1';
  res text;
begin
  update public.profiles set role = 'admin' where user_id = a;
  update public.profiles set role = 'teacher' where user_id = t1;

  execute 'reset role'; perform zz_test.as_user(s1);
  res := zz_test.try($q$select public.admin_set_content_enabled('lesson', 'ar-14', false)$q$);
  perform zz_test.chk('student cannot hide a lesson', res = 'err:42501', res);
  res := zz_test.try($q$select public.admin_set_content_enabled('track', 'en', false)$q$);
  perform zz_test.chk('student cannot hide a path', res = 'err:42501', res);
  res := zz_test.try($q$insert into public.content_switches (kind, key) values ('track', 'ar')$q$);
  perform zz_test.chk('student cannot insert directly', res like 'err:%', res);
  res := zz_test.try($q$delete from public.content_switches$q$);
  perform zz_test.chk('student cannot delete directly', res like 'err:%', res);
  res := zz_test.try($q$select * from public.content_switches$q$);
  perform zz_test.chk('student cannot read the table directly', res like 'err:%', res);
  execute 'reset role'; perform zz_test.as_user(t1);
  res := zz_test.try($q$select public.admin_set_content_enabled('lesson', 'ar-14', false)$q$);
  perform zz_test.chk('teacher cannot hide content (admin only)', res = 'err:42501', res);
  execute 'reset role'; set local role anon;
  res := zz_test.try($q$select public.admin_set_content_enabled('lesson', 'ar-14', false)$q$);
  perform zz_test.chk('anonymous visitors cannot hide content', res like 'err:%', res);
  res := zz_test.try($q$select * from public.content_disabled()$q$);
  perform zz_test.chk('anonymous visitors can read which items are hidden', res = 'ok', res);

  execute 'reset role'; perform zz_test.as_user(a);
  perform public.admin_set_content_enabled('lesson', 'ar-14', false);
  perform public.admin_set_content_enabled('lesson', 'sa-03', false);
  perform public.admin_set_content_enabled('track', 'id', false);
  perform zz_test.chk('an admin can hide lessons and a path', (select count(*) from public.content_disabled()) = 3);
  perform public.admin_set_content_enabled('lesson', 'ar-14', false);
  perform zz_test.chk('hiding twice is harmless', (select count(*) from public.content_disabled()) = 3);
  perform public.admin_set_content_enabled('lesson', 'sa-03', true);
  perform zz_test.chk('an admin can show a lesson again', (select count(*) from public.content_disabled()) = 2 and not exists (select 1 from public.content_disabled() where key = 'sa-03'));
  perform public.admin_set_content_enabled('lesson', 'en-30', true);
  perform zz_test.chk('showing something that was not hidden is harmless', (select count(*) from public.content_disabled()) = 2);

  res := zz_test.try($q$select public.admin_set_content_enabled('course', 'ar', false)$q$);
  perform zz_test.chk('an unknown kind is rejected', res = 'err:22023', res);
  res := zz_test.try($q$select public.admin_set_content_enabled('track', 'xx', false)$q$);
  perform zz_test.chk('an unknown path is rejected', res = 'err:22023', res);
  res := zz_test.try($q$select public.admin_set_content_enabled('lesson', 'ar-1', false)$q$);
  perform zz_test.chk('a malformed lesson id is rejected', res = 'err:22023', res);
  res := zz_test.try($q$select public.admin_set_content_enabled('lesson', 'ar-14; drop table x', false)$q$);
  perform zz_test.chk('an injection-shaped key is rejected', res = 'err:22023', res);
  res := zz_test.try($q$select public.admin_set_content_enabled('lesson', null, false)$q$);
  perform zz_test.chk('a missing key is rejected', res = 'err:22023', res);
  res := zz_test.try($q$select public.admin_set_content_enabled('lesson', 'ar-14', null)$q$);
  perform zz_test.chk('a missing on/off value is rejected', res = 'err:22023', res);
  res := zz_test.try($q$insert into public.content_switches (kind, key) values ('lesson', 'zz')$q$);
  perform zz_test.chk('even the admin cannot bypass validation by inserting directly', res like 'err:%', res);

  perform public.admin_set_content_enabled('track', 'zh', false);
  perform public.admin_set_content_enabled('lesson', 'fr-05', false);
  perform public.admin_set_content_enabled('lesson', 'eg-10', false);
  perform public.admin_set_content_enabled('track', 'es', false);
  perform zz_test.chk('the beta paths and their lessons can be hidden too', (select count(*) from public.content_disabled() where key in ('zh', 'fr-05', 'eg-10', 'es')) = 4);
  perform public.admin_set_content_enabled('track', 'zh', true);
  perform public.admin_set_content_enabled('lesson', 'fr-05', true);
  perform public.admin_set_content_enabled('lesson', 'eg-10', true);
  perform public.admin_set_content_enabled('track', 'es', true);
  perform public.admin_set_content_enabled('track', 'de', false);
  perform public.admin_set_content_enabled('lesson', 'tl-07', false);
  perform zz_test.chk('the German and Tagalog paths and lessons can be hidden', (select count(*) from public.content_disabled() where key in ('de', 'tl-07')) = 2);
  perform public.admin_set_content_enabled('track', 'de', true);
  perform public.admin_set_content_enabled('lesson', 'tl-07', true);
  perform zz_test.chk('and shown again', (select count(*) from public.content_disabled()) = 2);
  res := zz_test.try($q$select public.admin_set_content_enabled('track', 'xx', false)$q$);
  perform zz_test.chk('a path that does not exist is still rejected', res = 'err:22023', res);

  execute 'reset role'; perform zz_test.as_user(s1);
  perform zz_test.chk('a learner can read which items are hidden', (select count(*) from public.content_disabled()) = 2);
  perform zz_test.chk('the list contains the path and the lesson', exists (select 1 from public.content_disabled() where kind = 'track' and key = 'id') and exists (select 1 from public.content_disabled() where kind = 'lesson' and key = 'ar-14'));

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
