-- Permission tests for 004_announcements.sql. Run via `sh supabase/tests/run-dry.sh announcements` (Supabase editor) or `run-local.sh announcements`.
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
  ('00000000-0000-0000-0000-0000000000c1', 'authenticated', 'authenticated', 'student1@test.local','{}'),
  ('00000000-0000-0000-0000-0000000000c2', 'authenticated', 'authenticated', 'student2@test.local','{}');

do $t$
declare
  a  constant uuid := '00000000-0000-0000-0000-0000000000a1';
  t1 constant uuid := '00000000-0000-0000-0000-0000000000b1';
  s1 constant uuid := '00000000-0000-0000-0000-0000000000c1';
  s2 constant uuid := '00000000-0000-0000-0000-0000000000c2';
  res text; v_class public.classes; v_all uuid; v_cls uuid; v_exp uuid;
begin
  update public.profiles set role = 'admin' where user_id = a;
  update public.profiles set role = 'teacher' where user_id = t1;

  execute 'reset role'; perform zz_test.as_user(t1);
  v_class := public.create_class('Class One');
  execute 'reset role'; perform zz_test.as_user(s1);
  perform public.join_class(v_class.code);

  -- nobody but an admin can post, list everything or archive
  res := zz_test.try($q$select public.admin_create_announcement('{"en":"Hi"}', '{"en":"Hello"}')$q$);
  perform zz_test.chk('student cannot post', res = 'err:42501', res);
  res := zz_test.try($q$select * from public.admin_list_announcements()$q$);
  perform zz_test.chk('student cannot list all announcements', res = 'err:42501', res);
  res := zz_test.try($q$select public.admin_archive_announcement(gen_random_uuid())$q$);
  perform zz_test.chk('student cannot archive', res = 'err:42501', res);
  res := zz_test.try($q$insert into public.announcements (title, body, audience) values ('{"en":"x"}', '{"en":"y"}', 'all')$q$);
  perform zz_test.chk('student cannot insert directly', res like 'err:%', res);
  res := zz_test.try($q$select * from public.announcements$q$);
  perform zz_test.chk('student cannot read the table directly', res like 'err:%', res);
  execute 'reset role'; perform zz_test.as_user(t1);
  res := zz_test.try($q$select public.admin_create_announcement('{"en":"Hi"}', '{"en":"Hello"}')$q$);
  perform zz_test.chk('teacher cannot post (admin only)', res = 'err:42501', res);
  execute 'reset role'; set local role anon;
  res := zz_test.try($q$select * from public.my_announcements()$q$);
  perform zz_test.chk('anonymous visitors cannot read announcements', res like 'err:%', res);
  res := zz_test.try($q$select public.admin_create_announcement('{"en":"Hi"}', '{"en":"Hello"}')$q$);
  perform zz_test.chk('anonymous visitors cannot post', res like 'err:%', res);

  -- the admin posts
  execute 'reset role'; perform zz_test.as_user(a);
  v_all := public.admin_create_announcement('{"en":"Welcome","ar":"أهلاً"}', '{"en":"Hello everyone","ar":"مرحبا بالجميع"}');
  v_cls := public.admin_create_announcement('{"en":"Class news"}', '{"en":"Only for Class One"}', v_class.id);
  v_exp := public.admin_create_announcement('{"id":"Singkat"}', '{"id":"Akan kedaluwarsa"}', null, now() + interval '1 hour');
  perform zz_test.chk('an admin can post to everyone, to a class and with an expiry', (select count(*) from public.admin_list_announcements()) = 3);
  perform zz_test.chk('text is trimmed and kept per language', (select title->>'en' from public.admin_list_announcements() where id = v_all) = 'Welcome');

  res := zz_test.try($q$select public.admin_create_announcement('{"en":"Hi"}', '{"ar":"x"}')$q$);
  perform zz_test.chk('title and message languages must match', res = 'err:22023', res);
  res := zz_test.try($q$select public.admin_create_announcement('{"fr":"Hi"}', '{"fr":"x"}')$q$);
  perform zz_test.chk('unknown languages are rejected', res = 'err:22023', res);
  res := zz_test.try($q$select public.admin_create_announcement('{"en":" "}', '{"en":" "}')$q$);
  perform zz_test.chk('empty text is rejected', res = 'err:22023', res);
  res := zz_test.try($q$select public.admin_create_announcement('"just a string"', '{"en":"x"}')$q$);
  perform zz_test.chk('non-object text is rejected', res = 'err:22023', res);
  res := zz_test.try($q$select public.admin_create_announcement('{"en":"x"}', '{"en":1}')$q$);
  perform zz_test.chk('non-string text is rejected', res = 'err:22023', res);
  res := zz_test.try(format('select public.admin_create_announcement(%L, %L)', json_build_object('en', repeat('x', 81))::text, '{"en":"ok"}'));
  perform zz_test.chk('a title over 80 characters is rejected', res = 'err:22023', res);
  res := zz_test.try(format('select public.admin_create_announcement(%L, %L)', '{"en":"ok"}', json_build_object('en', repeat('x', 601))::text));
  perform zz_test.chk('a message over 600 characters is rejected', res = 'err:22023', res);
  res := zz_test.try($q$select public.admin_create_announcement('{"en":"x"}', '{"en":"y"}', gen_random_uuid())$q$);
  perform zz_test.chk('an unknown class is rejected', res = 'err:P0002', res);
  res := zz_test.try($q$select public.admin_create_announcement('{"en":"x"}', '{"en":"y"}', null, now() - interval '1 day')$q$);
  perform zz_test.chk('an expiry in the past is rejected', res = 'err:22023', res);

  -- who sees what
  execute 'reset role'; perform zz_test.as_user(s1);
  perform zz_test.chk('a class member sees the everyone, class and expiring announcements', (select count(*) from public.my_announcements()) = 3);
  execute 'reset role'; perform zz_test.as_user(s2);
  perform zz_test.chk('a learner outside the class does not see the class announcement', (select count(*) from public.my_announcements()) = 2 and not exists (select 1 from public.my_announcements() where id = v_cls));

  -- expiry and archive
  execute 'reset role';
  update public.announcements set expires_at = now() - interval '1 minute' where id = v_exp;
  perform zz_test.as_user(s2);
  perform zz_test.chk('an expired announcement disappears', (select count(*) from public.my_announcements()) = 1);
  execute 'reset role'; perform zz_test.as_user(a);
  perform public.admin_archive_announcement(v_all);
  res := zz_test.try(format('select public.admin_archive_announcement(%L)', v_all));
  perform zz_test.chk('archiving twice is an error', res = 'err:P0002', res);
  perform zz_test.chk('an archived announcement stays in the admin list, marked archived', (select archived_at is not null from public.admin_list_announcements() where id = v_all));
  execute 'reset role'; perform zz_test.as_user(s2);
  perform zz_test.chk('an archived announcement is no longer shown to learners', (select count(*) from public.my_announcements()) = 0);

  -- leaving the class removes access; deleting the class removes its announcements
  execute 'reset role'; perform zz_test.as_user(s1);
  delete from public.class_members where student_id = s1;
  perform zz_test.chk('leaving the class stops its announcements', (select count(*) from public.my_announcements()) = 0);
  execute 'reset role'; perform zz_test.as_user(t1);
  perform public.delete_class(v_class.id);
  execute 'reset role';
  perform zz_test.chk('deleting the class deletes its announcements', (select count(*) from public.announcements where class_id is not null) = 0);
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
