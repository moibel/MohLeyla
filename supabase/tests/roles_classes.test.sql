-- Permission tests for 002_roles_classes.sql. Run in the Supabase SQL editor AFTER the migration text, as one script:
--     <contents of migrations/002_roles_classes.sql>
--     <contents of this file>
-- (supabase/tests/run-dry.sh builds that combined script.) The script ends by RAISING AN EXCEPTION on purpose, so Postgres
-- rolls the whole thing back: nothing (not even the migration or the fake users) is kept. The error text is the report.
-- To apply the migration for real, run migrations/002_roles_classes.sql on its own.

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
  ('00000000-0000-0000-0000-0000000000b1', 'authenticated', 'authenticated', 'teacher1@test.local','{"full_name":"Tariq Teacher"}'),
  ('00000000-0000-0000-0000-0000000000b2', 'authenticated', 'authenticated', 'teacher2@test.local','{}'),
  ('00000000-0000-0000-0000-0000000000c1', 'authenticated', 'authenticated', 'student1@test.local','{"display_name":"Sara Student"}'),
  ('00000000-0000-0000-0000-0000000000c2', 'authenticated', 'authenticated', 'student2@test.local','{}');

insert into public.progress (user_id, state) values
  ('00000000-0000-0000-0000-0000000000c1', '{"xp":120,"completed":{"ar-01":{},"en-01":{}},"streak":{"current":3,"best":4,"last":"2026-11-20"},"stats":{"answered":10,"correct":8},"days":{"2026-11-19":{"xp":50},"2026-11-20":{"xp":70}},"secretNote":"raw document"}'),
  ('00000000-0000-0000-0000-0000000000c2', '{"xp":5}');

do $t$
declare
  a  constant uuid := '00000000-0000-0000-0000-0000000000a1';
  t1 constant uuid := '00000000-0000-0000-0000-0000000000b1';
  t2 constant uuid := '00000000-0000-0000-0000-0000000000b2';
  s1 constant uuid := '00000000-0000-0000-0000-0000000000c1';
  s2 constant uuid := '00000000-0000-0000-0000-0000000000c2';
  v_class public.classes; v_code text; r record; n int; res text;
begin
  -- the trigger gave every fake user a student profile
  perform zz_test.chk('new users automatically get a student profile', (select count(*) from public.profiles where user_id in (a, t1, t2, s1, s2) and role = 'student') = 5);

  -- bootstrap: the project owner is made admin with SQL (as postgres); everything else goes through the functions
  update public.profiles set role = 'admin' where user_id = a;

  -- ---------------------------------------------------------------- students cannot escalate
  execute 'reset role'; perform zz_test.as_user(s1);
  res := zz_test.try($q$update public.profiles set role = 'admin' where user_id = '00000000-0000-0000-0000-0000000000c1'$q$);
  perform zz_test.chk('student cannot update their own role', res like 'err:%', res);
  res := zz_test.try($q$insert into public.profiles (user_id, role) values ('00000000-0000-0000-0000-0000000000c1', 'admin') on conflict (user_id) do update set role = 'admin'$q$);
  perform zz_test.chk('student cannot insert/upsert a profile', res like 'err:%', res);
  res := zz_test.try($q$select public.admin_set_role('00000000-0000-0000-0000-0000000000c1', 'admin')$q$);
  perform zz_test.chk('student cannot call admin_set_role', res = 'err:42501', res);
  res := zz_test.try($q$select * from public.admin_list_users()$q$);
  perform zz_test.chk('student cannot call admin_list_users', res = 'err:42501', res);
  res := zz_test.try($q$select * from public.create_class('Hacked')$q$);
  perform zz_test.chk('student cannot create a class', res = 'err:42501', res);
  perform zz_test.chk('student sees only their own profile row', zz_test.cnt('select 1 from public.profiles') = 1);
  perform zz_test.chk('my_role() is student', (select public.my_role()) = 'student');

  -- ---------------------------------------------------------------- admin promotes a teacher
  execute 'reset role'; perform zz_test.as_user(a);
  perform public.admin_set_role(t1, 'teacher');
  perform public.admin_set_role(t2, 'teacher');
  perform zz_test.chk('admin can promote a teacher', (select role from public.profiles where user_id = t1) = 'teacher');
  perform zz_test.chk('admin sees every profile', zz_test.cnt('select 1 from public.profiles') >= 5);
  res := zz_test.try($q$select public.admin_set_role('00000000-0000-0000-0000-0000000000c2', 'superuser')$q$);
  perform zz_test.chk('unknown roles are rejected', res = 'err:22023', res);
  res := zz_test.try($q$select public.admin_set_role('00000000-0000-0000-0000-0000000000a1', 'student')$q$);
  perform zz_test.chk('the last admin cannot be demoted', res = 'err:55000', res);
  select count(*) into n from public.admin_list_users();
  perform zz_test.chk('admin_list_users lists everyone with summaries', n >= 5, 'rows=' || n);
  select u.xp, u.lessons_done into r from public.admin_list_users() u where u.user_id = s1;
  perform zz_test.chk('admin list shows progress summary (xp 120, 2 lessons)', r.xp = 120 and r.lessons_done = 2, r::text);

  -- ---------------------------------------------------------------- teacher creates a class, students join
  execute 'reset role'; perform zz_test.as_user(t1);
  select * into v_class from public.create_class('  Arabic 101  ');
  v_code := v_class.code;
  perform zz_test.chk('teacher creates a class with a trimmed name and an 8-character code', v_class.name = 'Arabic 101' and char_length(v_code) = 8, v_class::text);
  res := zz_test.try($q$select * from public.create_class('')$q$);
  perform zz_test.chk('empty class names are rejected', res = 'err:22023', res);
  perform zz_test.chk('teacher_classes lists the class', (select count(*) from public.teacher_classes()) = 1);

  execute 'reset role'; perform zz_test.as_user(s1);
  perform public.join_class(lower(v_code)); -- lowercase / spaces tolerated
  perform public.join_class(' ' || v_code || ' '); -- idempotent
  perform zz_test.chk('student joins with the code (case-insensitive, idempotent)', (select count(*) from public.my_memberships()) = 1);
  res := zz_test.try($q$select * from public.join_class('NOPE1234')$q$);
  perform zz_test.chk('an invalid code is rejected', res = 'err:P0002', res);
  perform zz_test.chk('student sees the class they joined', zz_test.cnt('select 1 from public.classes') = 1);
  perform zz_test.chk('student cannot see other members of the class', zz_test.cnt('select 1 from public.class_members') = 1);
  perform zz_test.chk('student can read their own progress', zz_test.cnt('select 1 from public.progress') = 1);

  -- ---------------------------------------------------------------- the teacher's view
  execute 'reset role'; perform zz_test.as_user(t1);
  select * into r from public.class_roster(v_class.id);
  perform zz_test.chk('teacher sees the roster with a progress SUMMARY (name, xp, lessons, streak, accuracy, last active)',
    r.student_id = s1 and r.display_name = 'Sara Student' and r.email = 'student1@test.local' and r.xp = 120 and r.lessons_done = 2
    and r.streak = 3 and r.best_streak = 4 and r.accuracy = 80 and r.last_active = '2026-11-20' and r.streak_last = '2026-11-20', r::text);
  perform zz_test.chk('teacher cannot read the raw progress documents', zz_test.cnt('select 1 from public.progress') = 0);
  perform zz_test.chk('teacher sees the members of their own class', zz_test.cnt('select 1 from public.class_members') = 1);
  perform zz_test.chk('teacher cannot read profiles of students', zz_test.cnt('select 1 from public.profiles') = 1);

  -- ---------------------------------------------------------------- everyone else is locked out
  execute 'reset role'; perform zz_test.as_user(t2);
  res := zz_test.try(format('select * from public.class_roster(%L)', v_class.id));
  perform zz_test.chk('another teacher cannot read this roster', res = 'err:42501', res);
  perform zz_test.chk('another teacher sees no foreign classes or members', zz_test.cnt('select 1 from public.classes') = 0 and zz_test.cnt('select 1 from public.class_members') = 0);
  res := zz_test.try(format('select public.delete_class(%L)', v_class.id));
  perform zz_test.chk('another teacher cannot delete this class', res = 'err:42501', res);

  execute 'reset role'; perform zz_test.as_user(s2);
  res := zz_test.try(format('select * from public.class_roster(%L)', v_class.id));
  perform zz_test.chk('a student outside the class cannot read the roster', res = 'err:42501', res);
  perform zz_test.chk('a student outside the class sees no classes or foreign progress', zz_test.cnt('select 1 from public.classes') = 0 and zz_test.cnt('select 1 from public.progress where user_id <> auth.uid()') = 0);

  -- ---------------------------------------------------------------- not signed in
  execute 'reset role'; execute 'set local role anon';
  res := zz_test.try($q$select public.my_role()$q$);
  perform zz_test.chk('anonymous visitors cannot call my_role', res like 'err:%', res);
  res := zz_test.try($q$select * from public.class_roster('00000000-0000-0000-0000-000000000000')$q$);
  perform zz_test.chk('anonymous visitors cannot call class_roster', res like 'err:%', res);
  res := zz_test.try($q$select * from public.profiles$q$);
  perform zz_test.chk('anonymous visitors cannot read profiles', res like 'err:%', res);
  res := zz_test.try($q$select * from public.classes$q$);
  perform zz_test.chk('anonymous visitors cannot read classes', res like 'err:%', res);

  -- ---------------------------------------------------------------- leaving / removing / deleting
  execute 'reset role'; perform zz_test.as_user(s2);
  perform public.join_class(v_code);
  delete from public.class_members where student_id = s2;
  perform zz_test.chk('a student can leave a class', zz_test.cnt('select 1 from public.my_memberships()') = 0);
  perform public.join_class(v_code);
  execute 'reset role'; perform zz_test.as_user(t1);
  delete from public.class_members where student_id = s2;
  perform zz_test.chk('a teacher can remove a student from their class', (select count(*) from public.class_roster(v_class.id)) = 1);
  perform public.delete_class(v_class.id);
  perform zz_test.chk('a teacher can delete their class (members cascade)', zz_test.cnt('select 1 from public.classes') = 0 and (select count(*) from public.class_members) = 0);

  execute 'reset role'; perform zz_test.as_user(a);
  perform public.admin_set_role(t2, 'admin');
  perform public.admin_set_role(a, 'student'); -- allowed now that another admin exists
  perform zz_test.chk('an admin can step down once another admin exists', (select role from public.profiles where user_id = a) = 'student');

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
