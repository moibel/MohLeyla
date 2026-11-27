-- Tests for 012_account_deletion.sql. Run via `sh supabase/tests/run-dry.sh deletion` or `run-local.sh deletion`.
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
  ('00000000-0000-0000-0000-0000000000a1', 'authenticated', 'authenticated', 'admin@test.local',   '{"display_name":"Ada Admin"}'),
  ('00000000-0000-0000-0000-0000000000b1', 'authenticated', 'authenticated', 'teacher1@test.local','{"display_name":"Tariq Teacher"}'),
  ('00000000-0000-0000-0000-0000000000c1', 'authenticated', 'authenticated', 'student1@test.local','{"display_name":"Sara Student"}'),
  ('00000000-0000-0000-0000-0000000000a2', 'authenticated', 'authenticated', 'admin2@test.local',  '{"display_name":"Ben Admin"}'),
  ('00000000-0000-0000-0000-0000000000c2', 'authenticated', 'authenticated', 'student2@test.local','{"display_name":"Sami Student"}'),
  ('00000000-0000-0000-0000-0000000000c3', 'authenticated', 'authenticated', 'student3@test.local','{"display_name":"Omar Outsider"}');

-- 014: e-mail keyed features need a confirmed address, and writing in chat needs accepted terms
update auth.users set email_confirmed_at = now() where email ilike '%@test.local';
insert into public.terms_acceptances (user_id, version) select id, 'test' from auth.users where email ilike '%@test.local';

do $t$
declare
  a  constant uuid := '00000000-0000-0000-0000-0000000000a1';
  a2 constant uuid := '00000000-0000-0000-0000-0000000000a2';
  t1 constant uuid := '00000000-0000-0000-0000-0000000000b1';
  s1 constant uuid := '00000000-0000-0000-0000-0000000000c1';
  s2 constant uuid := '00000000-0000-0000-0000-0000000000c2';
  tok1 constant text := 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
  v_class public.classes; v_c1 uuid; v_c2 uuid; v_paths text[]; v_ann uuid; res text;
begin
  update public.profiles set role = 'admin' where user_id = a;
  update public.profiles set role = 'teacher' where user_id = t1;
  execute 'reset role'; perform zz_test.as_user(t1); v_class := public.create_class('Class One');
  execute 'reset role'; perform zz_test.as_user(s1); perform public.join_class(v_class.code);
  execute 'reset role'; perform zz_test.as_user(s2); perform public.join_class(v_class.code);
  execute 'reset role'; perform zz_test.as_user(t1); v_c1 := public.start_chat(s1);
  execute 'reset role'; perform zz_test.as_user(a);  v_c2 := public.start_chat(s2);
  execute 'reset role';

  -- data that belongs to s1 in several places
  insert into public.progress (user_id, state) values (s1, '{"xp":5}'), (s2, '{"xp":9}');
  insert into public.push_tokens (user_id, token, platform) values (s1, tok1, 'ios');
  insert into public.chat_messages (conversation_id, sender_id, body, kind, file_path, file_size) values
    (v_c1, t1, 'hi', 'text', null, null),
    (v_c1, s1, '', 'image', v_c1 || '/one.jpg', 100),
    (v_c1, t1, '', 'voice', v_c1 || '/two.webm', 200),
    (v_c2, a, '', 'image', v_c2 || '/other.jpg', 100);
  insert into public.rewards (email, kind, amount, label) values ('student1@test.local', 'star', 2, null), ('student2@test.local', 'star', 1, null);
  insert into public.announcements (title, body, audience, created_by) values ('{"en":"For all"}', '{"en":"x"}', 'all', a2);
  insert into public.announcements (title, body, audience, user_email, created_by) values ('{"en":"For s1"}', '{"en":"x"}', 'user', 'student1@test.local', a), ('{"en":"For s2"}', '{"en":"x"}', 'user', 'student2@test.local', a);

  -- ---------------------------------------------------------------- who may call the functions
  perform zz_test.as_user(s1);
  perform zz_test.chk('a signed-in person cannot prepare a deletion (not even their own)', zz_test.try(format('select public.account_delete_prepare(%L)', s1)) = 'err:42501');
  perform zz_test.chk('nor clean up by e-mail', zz_test.try($q$select public.account_delete_cleanup('student2@test.local')$q$) = 'err:42501');
  perform zz_test.chk('nor delete someone else''s data', zz_test.try(format('select public.account_delete_prepare(%L)', s2)) = 'err:42501');
  execute 'reset role'; perform zz_test.as_user(a);
  perform zz_test.chk('an admin cannot call them either (only the service function can)', zz_test.try(format('select public.account_delete_prepare(%L)', s2)) = 'err:42501');
  execute 'reset role'; set local role anon;
  perform zz_test.chk('a visitor cannot', zz_test.try(format('select public.account_delete_prepare(%L)', s1)) like 'err:%');
  execute 'reset role';

  -- ---------------------------------------------------------------- guards
  perform zz_test.chk('an unknown person is refused', zz_test.try($q$select public.account_delete_prepare('00000000-0000-0000-0000-00000000dead')$q$) = 'err:22023');
  perform zz_test.chk('the only admin cannot be deleted', zz_test.try(format('select public.account_delete_prepare(%L)', a)) = 'err:55000');
  update public.profiles set role = 'admin' where user_id = a2;
  perform zz_test.chk('with a second admin, an admin can be deleted', zz_test.try(format('select public.account_delete_prepare(%L)', a)) = 'ok');
  update public.profiles set role = 'student' where user_id = a2;
  perform zz_test.chk('teachers and students can always be deleted', zz_test.try(format('select public.account_delete_prepare(%L)', t1)) = 'ok' and zz_test.try(format('select public.account_delete_prepare(%L)', s1)) = 'ok');

  -- ---------------------------------------------------------------- the file list
  v_paths := public.account_delete_prepare(s1);
  perform zz_test.chk('the list holds every file in the chats that will disappear, from both people', v_paths @> array[v_c1 || '/one.jpg', v_c1 || '/two.webm'] and cardinality(v_paths) = 2);
  perform zz_test.chk('files of other people''s chats are not on the list', not (v_paths @> array[v_c2 || '/other.jpg']));
  perform zz_test.chk('a person with no chats gets an empty list', cardinality(public.account_delete_prepare(a2)) = 0);

  -- ---------------------------------------------------------------- the deletion itself (what the Edge Function does with the admin API)
  perform public.account_delete_cleanup(' Student1@Test.local ');
  perform zz_test.chk('rewards given to that e-mail are removed', not exists (select 1 from public.rewards where email = 'student1@test.local'));
  perform zz_test.chk('announcements sent to that e-mail are removed', not exists (select 1 from public.announcements where user_email = 'student1@test.local'));
  perform zz_test.chk('other people''s rewards and announcements stay', exists (select 1 from public.rewards where email = 'student2@test.local') and exists (select 1 from public.announcements where user_email = 'student2@test.local') and exists (select 1 from public.announcements where audience = 'all'));
  perform zz_test.chk('an empty e-mail removes nothing', zz_test.try($q$select public.account_delete_cleanup('')$q$) = 'ok' and (select count(*) from public.rewards) = 1);

  delete from auth.users where id = s1;
  perform zz_test.chk('their progress is gone', not exists (select 1 from public.progress where user_id = s1));
  perform zz_test.chk('their profile and role are gone', not exists (select 1 from public.profiles where user_id = s1));
  perform zz_test.chk('their class membership is gone', not exists (select 1 from public.class_members where student_id = s1));
  perform zz_test.chk('their phone tokens are gone', not exists (select 1 from public.push_tokens where user_id = s1));
  perform zz_test.chk('every chat they were in is gone, with its messages', not exists (select 1 from public.conversations where v_c1 = id) and not exists (select 1 from public.chat_messages where conversation_id = v_c1));
  perform zz_test.chk('other people''s data is untouched (progress, their own chat, their membership)', exists (select 1 from public.progress where user_id = s2) and exists (select 1 from public.conversations where id = v_c2) and exists (select 1 from public.chat_messages where conversation_id = v_c2) and exists (select 1 from public.class_members where student_id = s2));
  perform zz_test.chk('the teacher and the class are untouched when a student leaves', exists (select 1 from public.classes where id = v_class.id));

  delete from auth.users where id = t1;
  perform zz_test.chk('deleting a teacher removes the classes they teach and their members', not exists (select 1 from public.classes where id = v_class.id) and not exists (select 1 from public.class_members where class_id = v_class.id));
  delete from auth.users where id = a2;
  perform zz_test.chk('things a deleted admin created for others stay, with the author left empty', exists (select 1 from public.announcements where audience = 'all' and created_by is null));
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
