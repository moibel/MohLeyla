-- Tests for 014_security_hardening.sql. Run via `sh supabase/tests/run-dry.sh hardening` or `run-local.sh hardening`.
-- Needs the storage and net stand-ins (tests/local-stub.sql) locally. Ends with a deliberate exception so everything is rolled back.

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

insert into auth.users (id, aud, role, email, raw_user_meta_data, email_confirmed_at) values
  ('00000000-0000-0000-0000-0000000000a1', 'authenticated', 'authenticated', 'admin@test.local',   '{"display_name":"Ada Admin"}', now()),
  ('00000000-0000-0000-0000-0000000000b1', 'authenticated', 'authenticated', 'teacher1@test.local','{"display_name":"Tariq Teacher"}', now()),
  ('00000000-0000-0000-0000-0000000000b2', 'authenticated', 'authenticated', 'teacher2@test.local','{}', now()),
  ('00000000-0000-0000-0000-0000000000c1', 'authenticated', 'authenticated', 'student1@test.local','{"display_name":"Sara Student"}', now()),
  ('00000000-0000-0000-0000-0000000000c2', 'authenticated', 'authenticated', 'student2@test.local', jsonb_build_object('display_name', E'  Evil‮\n\tName ' || repeat('x', 200)), now()),
  ('00000000-0000-0000-0000-0000000000c3', 'authenticated', 'authenticated', 'student3@test.local','{}', now()),
  ('00000000-0000-0000-0000-0000000000c4', 'authenticated', 'authenticated', 'victim@test.local',  '{}', null);

do $t$
declare
  a  constant uuid := '00000000-0000-0000-0000-0000000000a1';
  t1 constant uuid := '00000000-0000-0000-0000-0000000000b1';
  t2 constant uuid := '00000000-0000-0000-0000-0000000000b2';
  s1 constant uuid := '00000000-0000-0000-0000-0000000000c1';
  s2 constant uuid := '00000000-0000-0000-0000-0000000000c2';
  s3 constant uuid := '00000000-0000-0000-0000-0000000000c3';
  u4 constant uuid := '00000000-0000-0000-0000-0000000000c4';
  c1 public.classes; c2 public.classes; v_ts uuid; v_as uuid; v_as2 uuid; v_t2 uuid; v_msg uuid; v_img_msg uuid; v_call uuid; v_rep uuid;
  v_code text; v_new text; v_file text; v_orphan text; v_old text; v_fresh text; res text; r record; n int; i int; v_paths text[];
begin
  update public.profiles set role = 'admin' where user_id = a;
  update public.profiles set role = 'teacher' where user_id in (t1, t2);
  perform zz_test.as_user(t1);
  c1 := public.create_class('Class One');
  c2 := public.create_class('Class Two');

  -- ---------------------------------------------------------------- M1 / M2: codes, bans, limits
  perform zz_test.chk('new class codes are 12 upper-case hex characters', c1.code ~ '^[0-9A-F]{12}$' and c1.code <> c2.code, c1.code);
  execute 'reset role'; update public.classes set code = 'AB12CD34' where id = c2.id; -- a code made before 014
  perform zz_test.as_user(s1);
  perform zz_test.chk('an old 8-character code still works', (select count(*) from public.join_class('ab12cd34')) = 1);
  perform public.join_class(c1.code);
  perform zz_test.chk('a student cannot select the class code', zz_test.try('select code from public.classes') = 'err:42501');
  perform zz_test.chk('nor with select *', zz_test.try('select * from public.classes') = 'err:42501');
  perform zz_test.chk('id and name can still be read', zz_test.cnt('select id, name from public.classes order by name') = 2);
  perform zz_test.chk('a student cannot rotate a code', zz_test.try(format('select public.rotate_class_code(%L)', c1.id)) = 'err:42501');
  perform zz_test.chk('the ban table has no direct access', zz_test.cnt('select * from public.class_bans') = -1);
  execute 'reset role'; perform zz_test.as_user(a);
  perform zz_test.chk('the admin cannot select codes directly either, and cannot rotate another teacher''s code', zz_test.try('select code from public.classes') = 'err:42501' and zz_test.try(format('select public.rotate_class_code(%L)', c1.id)) = 'err:42501');
  execute 'reset role'; perform zz_test.as_user(s2); perform public.join_class(c1.code);
  delete from public.class_members where student_id = s2 and class_id = c1.id; -- leaves by choice
  perform zz_test.chk('someone who left by choice can join again', (select count(*) from public.join_class(c1.code)) = 1);
  execute 'reset role'; perform zz_test.as_user(t1);
  delete from public.class_members where student_id = s2 and class_id = c1.id; -- removed by the teacher
  perform zz_test.chk('the teacher sees who is removed', (select count(*) from public.teacher_class_bans(c1.id) where student_id = s2) = 1);
  execute 'reset role'; perform zz_test.as_user(s2);
  perform zz_test.chk('a removed student cannot rejoin with the same code', (select count(*) from public.join_class(c1.code)) = 0);
  perform zz_test.chk('a student cannot unban themselves', zz_test.try(format('select public.teacher_unban(%L, %L)', c1.id, s2)) = 'err:42501');
  execute 'reset role'; perform zz_test.as_user(t1);
  v_code := c1.code; v_new := public.rotate_class_code(c1.id);
  perform zz_test.chk('the teacher can rotate the code', v_new ~ '^[0-9A-F]{12}$' and v_new <> v_code and (select code from public.teacher_classes() where class_id = c1.id) = v_new);
  execute 'reset role'; perform zz_test.as_user(s2);
  perform zz_test.chk('nor with the new code', (select count(*) from public.join_class(v_new)) = 0);
  execute 'reset role'; perform zz_test.as_user(s3);
  perform zz_test.chk('the old code stops working after rotation', (select count(*) from public.join_class(v_code)) = 0);
  for i in 1..9 loop perform public.join_class('WRONG' || i); end loop;
  res := zz_test.try(format('select * from public.join_class(%L)', v_new));
  perform zz_test.chk('the 11th attempt in an hour is refused, even with the right code', res = 'err:54000', res);
  execute 'reset role';
  perform zz_test.chk('wrong attempts are recorded', (select count(*) from public.join_attempts where user_id = s3) = 10);
  update public.join_attempts set at = at - interval '61 minutes' where user_id = s3;
  perform zz_test.as_user(s3);
  perform zz_test.chk('after an hour the student can try again', (select count(*) from public.join_class(v_new)) = 1);
  delete from public.class_members where student_id = s3;
  execute 'reset role'; perform zz_test.as_user(t1);
  perform public.teacher_unban(c1.id, s2);
  perform zz_test.chk('unbanning twice is an error', zz_test.try(format('select public.teacher_unban(%L, %L)', c1.id, s2)) = 'err:P0002');
  execute 'reset role'; perform zz_test.as_user(s2);
  perform zz_test.chk('an unbanned student can join again', (select count(*) from public.join_class(v_new)) = 1);
  execute 'reset role'; perform zz_test.as_user(t1);
  delete from public.class_members where student_id = s2 and class_id = c2.id;
  perform public.delete_class(c2.id);
  perform zz_test.chk('deleting a class (with members) still works and leaves no bans', zz_test.cnt('select 1 from public.teacher_classes()') = 1);
  execute 'reset role';
  perform zz_test.chk('...no ban rows for the deleted class', not exists (select 1 from public.class_bans where class_id = c2.id));

  -- ---------------------------------------------------------------- H1: any progress document
  insert into public.progress (user_id, state) values
    (s1, '{"xp":"boom","completed":[1,2],"streak":"x","stats":{"answered":10,"correct":1e30},"days":{"zzzz":1,"2026-02-30":1,"2026-02-28":1,"9999-99-99":1}}'),
    (s2, '"just a string"'),
    (s3, '{"xp":1e300,"completed":"no","streak":{"current":-5,"best":"9","last":"<script>"},"stats":{"answered":"1","correct":{}},"days":[]}');
  perform zz_test.as_user(a);
  res := zz_test.try('select * from public.admin_list_users()');
  perform zz_test.chk('poisoned progress does not break the admin list', res = 'ok', res);
  select * into r from public.admin_list_users() u where u.user_id = s1;
  perform zz_test.chk('bad values become safe ones, accuracy is capped, only real dates count', r.xp = 0 and r.lessons_done = 0 and r.last_active = '2026-02-28', r::text);
  perform zz_test.chk('huge numbers are clamped', (select xp from public.admin_list_users() u where u.user_id = s3) = 1000000000);
  execute 'reset role'; perform zz_test.as_user(t1);
  res := zz_test.try(format('select * from public.class_roster(%L)', c1.id));
  perform zz_test.chk('nor the class roster', res = 'ok', res);
  select * into r from public.class_roster(c1.id) x where x.student_id = s1;
  perform zz_test.chk('roster accuracy stays within 0-100', r.accuracy = 100, r::text);
  execute 'reset role';
  update public.progress set state = '{"streak":{"current":1,"last":"not-a-date"}}' where user_id = s1;
  perform zz_test.as_user(t1);
  perform zz_test.chk('streak_last is only ever a real date', (select streak_last is null from public.class_roster(c1.id) x where x.student_id = s1));
  perform zz_test.chk('is_day knows leap years', public.is_day('2028-02-29') and not public.is_day('2026-02-29') and not public.is_day('2026-04-31') and not public.is_day('0000-01-01') and not public.is_day(null));

  -- names
  perform zz_test.chk('names are cut to 60 characters with control and direction characters removed',
    (select char_length(display_name) <= 60 and display_name like 'Evil Name x%' and display_name !~ E'[\n\t‮]' from public.class_roster(c1.id) x where x.student_id = s2),
    (select display_name from public.class_roster(c1.id) x where x.student_id = s2));

  -- ---------------------------------------------------------------- terms
  v_ts := public.start_chat(s1);
  perform zz_test.chk('no terms accepted yet', (select count(*) from public.my_terms()) = 0);
  perform zz_test.chk('sending needs accepted terms', zz_test.try(format('select public.send_message(%L, %L)', v_ts, 'hi')) = 'err:ML001');
  perform zz_test.chk('so do attachments', zz_test.try(format('select public.send_attachment(%L, %L, %L, %L, 1)', v_ts, 'image', 'x', 'image/jpeg')) = 'err:ML001');
  perform zz_test.chk('and calls', zz_test.try(format('select public.start_call(%L, %L)', v_ts, 'audio')) = 'err:ML001');
  perform zz_test.chk('an empty version is refused', zz_test.try($q$select public.accept_terms(' ')$q$) = 'err:22023');
  perform public.accept_terms('2026-11');
  perform public.accept_terms('2026-12');
  perform zz_test.chk('the latest accepted version and time are stored', (select accepted_version = '2026-12' and accepted_at is not null from public.my_terms()));
  v_msg := public.send_message(v_ts, 'hello from teacher');
  perform zz_test.chk('after accepting, sending works', v_msg is not null);
  perform zz_test.chk('the acceptance table has no direct access', zz_test.cnt('select * from public.terms_acceptances') = -1);
  execute 'reset role'; perform zz_test.as_user(s1); perform public.accept_terms('2026-12');
  execute 'reset role'; perform zz_test.as_user(a); perform public.accept_terms('2026-12'); v_as := public.start_chat(s1); v_as2 := public.start_chat(s2);
  execute 'reset role'; perform zz_test.as_user(s2); perform public.accept_terms('2026-12');
  execute 'reset role';
  insert into public.push_config (url, secret) values ('https://example.supabase.co/functions/v1/push', 'a-long-shared-secret-0123456789') on conflict (id) do nothing;

  -- ---------------------------------------------------------------- M4: uploads
  v_file := v_ts::text || '/' || gen_random_uuid()::text || '.jpg';
  perform zz_test.as_user(s1);
  perform zz_test.chk('the name the app uses is accepted', zz_test.try(format('insert into storage.objects (bucket_id, name) values (%L, %L)', 'chat-files', v_file)) = 'ok');
  foreach res in array array[v_ts::text || '/orphan/deep/x.jpg', v_ts::text || '/photo.jpg', v_ts::text || '/' || gen_random_uuid()::text || '.exe',
      v_ts::text || '/' || gen_random_uuid()::text || '.jpg.html', v_ts::text || '/' || gen_random_uuid()::text, v_ts::text || '/x/' || gen_random_uuid()::text || '.jpg',
      v_ts::text || '/' || upper(gen_random_uuid()::text) || '.jpg', '------------------------------------/' || gen_random_uuid()::text || '.jpg'] loop
    perform zz_test.chk('refused upload name: ' || regexp_replace(res, '[0-9a-fA-F-]{36}', '<id>', 'g'), zz_test.try(format('insert into storage.objects (bucket_id, name) values (%L, %L)', 'chat-files', res)) like 'err:%');
  end loop;
  -- hourly quota (one exists already)
  res := zz_test.try(format($q$do $d$ begin for i in 1..59 loop insert into storage.objects (bucket_id, name) values ('chat-files', %L || '/' || gen_random_uuid()::text || '.jpg'); end loop; end $d$$q$, v_ts));
  perform zz_test.chk('60 uploads in an hour are fine', res = 'ok', res);
  perform zz_test.chk('the 61st is refused', zz_test.try(format('insert into storage.objects (bucket_id, name) values (%L, %L)', 'chat-files', v_ts::text || '/' || gen_random_uuid()::text || '.jpg')) like 'err:%');
  execute 'reset role';
  update storage.objects set created_at = now() - interval '2 hours' where owner = s1;
  update storage.objects set metadata = '{"size":209715200}' where name = v_file;
  perform zz_test.as_user(s1);
  perform zz_test.chk('200 MB stored: no more uploads', zz_test.try(format('insert into storage.objects (bucket_id, name) values (%L, %L)', 'chat-files', v_ts::text || '/' || gen_random_uuid()::text || '.jpg')) like 'err:%');
  execute 'reset role';
  update storage.objects set metadata = '{"size":1000}' where name = v_file;
  delete from storage.objects where owner = s1 and name <> v_file;
  perform zz_test.as_user(s1);
  perform zz_test.chk('under both limits it works again', zz_test.try(format('insert into storage.objects (bucket_id, name) values (%L, %L)', 'chat-files', v_ts::text || '/' || gen_random_uuid()::text || '.jpg')) = 'ok');

  -- ---------------------------------------------------------------- M3: removed files
  v_img_msg := public.send_attachment(v_ts, 'image', v_file, 'image/jpeg', 100, null, 'rude caption');
  execute 'reset role'; perform zz_test.as_user(t1);
  perform zz_test.chk('the other person can read the file', zz_test.cnt(format('select 1 from storage.objects where name = %L', v_file)) = 1);
  v_rep := public.report_chat(v_ts, v_img_msg, 'harassment', '  please look  ');
  execute 'reset role'; perform zz_test.as_user(a); perform public.admin_remove_message(v_img_msg);
  perform zz_test.chk('the admin can still read a removed file', zz_test.cnt(format('select 1 from storage.objects where name = %L', v_file)) = 1);
  execute 'reset role'; perform zz_test.as_user(t1);
  perform zz_test.chk('members cannot read a removed file', zz_test.cnt(format('select 1 from storage.objects where name = %L', v_file)) = 0);
  execute 'reset role'; perform zz_test.as_user(s1);
  perform zz_test.chk('not even the person who uploaded it', zz_test.cnt(format('select 1 from storage.objects where name = %L', v_file)) = 0);

  -- ---------------------------------------------------------------- reports
  perform zz_test.chk('a person cannot report their own message', zz_test.try(format('select public.report_chat(%L, %L, %L)', v_ts, v_img_msg, 'spam')) = 'err:22023');
  perform zz_test.chk('a message from another chat is refused', zz_test.try(format('select public.report_chat(%L, %L, %L)', v_as, v_msg, 'spam')) = 'err:22023');
  perform zz_test.chk('an unknown reason is refused', zz_test.try(format('select public.report_chat(%L, null, %L)', v_ts, 'boring')) = 'err:22023');
  perform zz_test.chk('a missing reason is refused', zz_test.try(format('select public.report_chat(%L)', v_ts)) = 'err:22023');
  perform zz_test.chk('details over 500 characters are refused', zz_test.try(format('select public.report_chat(%L, null, %L, %L)', v_ts, 'other', repeat('x', 501))) = 'err:22023');
  perform zz_test.chk('students cannot list or resolve reports', zz_test.try('select * from public.admin_list_reports()') = 'err:42501' and zz_test.try(format('select public.admin_resolve_report(%L, %L)', v_rep, 'resolved')) = 'err:42501');
  perform zz_test.chk('the report table has no direct access', zz_test.cnt('select * from public.chat_reports') = -1);
  for i in 1..10 loop perform public.report_chat(v_ts, null, 'spam'); end loop;
  perform zz_test.chk('more than 10 reports an hour are refused', zz_test.try(format('select public.report_chat(%L, null, %L)', v_ts, 'spam')) = 'err:54000');
  execute 'reset role'; perform zz_test.as_user(s3);
  perform zz_test.chk('an outsider cannot report, block or unblock a chat', zz_test.try(format('select public.report_chat(%L, null, %L)', v_ts, 'spam')) = 'err:42501' and zz_test.try(format('select public.block_chat(%L)', v_ts)) = 'err:42501' and zz_test.try(format('select public.unblock_chat(%L)', v_ts)) = 'err:42501');
  execute 'reset role'; perform zz_test.as_user(a);
  select * into r from public.admin_list_reports() x where x.id = v_rep;
  perform zz_test.chk('the admin sees who, whom, what and the message snapshot', r.reporter_name = 'Tariq Teacher' and r.reporter_email = 'teacher1@test.local' and r.reported_id = s1 and r.reported_name = 'Sara Student' and r.reported_email = 'student1@test.local' and r.conversation_id = v_ts and r.message_id = v_img_msg and r.message_body = '[image] rude caption' and r.reason = 'harassment' and r.details = 'please look' and r.status = 'open', r::text);
  perform zz_test.chk('an unknown status is refused', zz_test.try(format('select public.admin_resolve_report(%L, %L)', v_rep, 'open')) = 'err:22023');
  perform public.admin_resolve_report(v_rep, 'resolved');
  perform zz_test.chk('a report is resolved once', (select status from public.admin_list_reports() x where x.id = v_rep) = 'resolved' and zz_test.try(format('select public.admin_resolve_report(%L, %L)', v_rep, 'dismissed')) = 'err:P0002');

  -- ---------------------------------------------------------------- block
  execute 'reset role'; perform zz_test.as_user(t1); v_call := public.start_call(v_ts, 'video');
  perform public.call_signal_send(v_call, 'offer', '{"sdp":"x"}');
  execute 'reset role';
  perform zz_test.chk('signals are stored while the call is live', exists (select 1 from public.call_signals where call_id = v_call));
  perform zz_test.chk('the database refuses a second live call in the same chat', zz_test.try(format('insert into public.calls (conversation_id, caller_id, media) values (%L, %L, %L)', v_ts, t1, 'audio')) = 'err:23505');
  perform zz_test.as_user(s1);
  perform public.block_chat(v_ts);
  perform public.block_chat(v_ts);
  perform zz_test.chk('a student can block a teacher; my_chats shows it', (select blocked and blocked_by_me from public.my_chats() where conversation_id = v_ts));
  perform zz_test.chk('blocking ends a ringing call', (select status from public.call_poll(v_call) limit 1) = 'declined');
  execute 'reset role';
  perform zz_test.chk('ending a call removes its signals', not exists (select 1 from public.call_signals where call_id = v_call and kind <> 'bye'));
  perform zz_test.as_user(t1);
  perform zz_test.chk('the other side sees blocked, but not by them', (select blocked and not blocked_by_me from public.my_chats() where conversation_id = v_ts));
  perform zz_test.chk('no messages across a block', zz_test.try(format('select public.send_message(%L, %L)', v_ts, 'hi')) = 'err:ML002');
  perform zz_test.chk('no attachments', zz_test.try(format('select public.send_attachment(%L, %L, %L, %L, 1)', v_ts, 'image', 'x', 'image/jpeg')) = 'err:ML002');
  perform zz_test.chk('no calls', zz_test.try(format('select public.start_call(%L, %L)', v_ts, 'audio')) = 'err:ML002');
  perform zz_test.chk('start_chat is refused', zz_test.try(format('select public.start_chat(%L)', s1)) = 'err:ML002');
  perform zz_test.chk('no uploads', zz_test.try(format('insert into storage.objects (bucket_id, name) values (%L, %L)', 'chat-files', v_ts::text || '/' || gen_random_uuid()::text || '.jpg')) like 'err:%');
  perform zz_test.chk('old messages can still be read', (select count(*) from public.chat_messages_of(v_ts)) >= 2);
  perform public.unblock_chat(v_ts);
  perform zz_test.chk('the blocked person cannot lift the other''s block', (select blocked from public.my_chats() where conversation_id = v_ts));
  execute 'reset role';
  execute 'select count(*) from net._calls' into n;
  insert into public.chat_messages (conversation_id, sender_id, body) values (v_ts, t1, 'direct insert while blocked');
  execute 'select count(*) - $1 from net._calls' into i using n;
  perform zz_test.chk('no push notification crosses a block', i = 0);
  perform zz_test.as_user(a);
  perform zz_test.chk('a block does not stop moderation: the admin reads the chat', (select count(*) from public.admin_chat_messages(v_ts)) >= 3);
  perform public.admin_remove_message(v_msg);
  perform zz_test.chk('...and removes messages', (select removed from public.admin_chat_messages(v_ts) x where x.id = v_msg));
  execute 'reset role'; perform zz_test.as_user(s1);
  perform public.block_chat(v_as);
  execute 'reset role'; perform zz_test.as_user(a);
  perform zz_test.chk('a student can block the admin''s chat too', zz_test.try(format('select public.send_message(%L, %L)', v_as, 'hi')) = 'err:ML002');
  perform zz_test.chk('...the admin can still send that person an announcement', zz_test.try($q$select public.admin_create_announcement('{"en":"Safety"}', '{"en":"Note"}', null, null, 'student1@test.local')$q$) = 'ok');
  execute 'reset role'; perform zz_test.as_user(s1); perform public.unblock_chat(v_as); perform public.unblock_chat(v_ts);
  execute 'reset role'; perform zz_test.as_user(t1);
  perform zz_test.chk('after unblocking, messages flow again', zz_test.try(format('select public.send_message(%L, %L)', v_ts, 'back')) = 'ok');

  -- ---------------------------------------------------------------- suspend
  perform zz_test.chk('only an admin can suspend', zz_test.try(format('select public.admin_set_suspended(%L, true)', s1)) = 'err:42501');
  perform zz_test.chk('not suspended by default', (select not suspended from public.my_account_status()));
  v_call := public.start_call(v_ts, 'audio');
  execute 'reset role'; perform zz_test.as_user(a);
  perform zz_test.chk('an admin cannot be suspended', zz_test.try(format('select public.admin_set_suspended(%L, true)', a)) = 'err:42501');
  perform zz_test.chk('an unknown person is refused', zz_test.try($q$select public.admin_set_suspended(gen_random_uuid(), true)$q$) = 'err:22023');
  perform public.admin_set_suspended(t1, true, 'abuse');
  perform zz_test.chk('admin_list_users shows who is suspended', (select suspended from public.admin_list_users() where user_id = t1) and not (select suspended from public.admin_list_users() where user_id = s1));
  execute 'reset role';
  perform zz_test.chk('suspending ends their live calls', (select status from public.calls where id = v_call) = 'missed');
  perform zz_test.as_user(t1);
  perform zz_test.chk('my_account_status says suspended', (select suspended from public.my_account_status()));
  perform zz_test.chk('suspended: no messages', zz_test.try(format('select public.send_message(%L, %L)', v_ts, 'hi')) = 'err:ML003');
  perform zz_test.chk('suspended: no attachments', zz_test.try(format('select public.send_attachment(%L, %L, %L, %L, 1)', v_ts, 'image', 'x', 'image/jpeg')) = 'err:ML003');
  perform zz_test.chk('suspended: no calls', zz_test.try(format('select public.start_call(%L, %L)', v_ts, 'audio')) = 'err:ML003');
  perform zz_test.chk('suspended: no new chats', zz_test.try(format('select public.start_chat(%L)', s2)) = 'err:ML003');
  perform zz_test.chk('suspended: no uploads', zz_test.try(format('insert into storage.objects (bucket_id, name) values (%L, %L)', 'chat-files', v_ts::text || '/' || gen_random_uuid()::text || '.jpg')) like 'err:%');
  perform zz_test.chk('suspended: no new classes or codes', zz_test.try($q$select * from public.create_class('x')$q$) = 'err:ML003' and zz_test.try(format('select public.rotate_class_code(%L)', c1.id)) = 'err:ML003');
  execute 'reset role'; perform zz_test.as_user(s3);
  perform zz_test.chk('a suspended teacher''s code does not work', (select count(*) from public.join_class(v_new)) = 0);
  execute 'reset role'; perform zz_test.as_user(a); perform public.admin_set_suspended(s3, true);
  execute 'reset role'; perform zz_test.as_user(s3);
  perform zz_test.chk('suspended: cannot join classes', zz_test.try(format('select * from public.join_class(%L)', v_new)) = 'err:ML003');
  execute 'reset role'; perform zz_test.as_user(a); perform public.admin_set_suspended(t1, false); perform public.admin_set_suspended(s3, false);
  execute 'reset role'; perform zz_test.as_user(t1);
  perform zz_test.chk('lifting a suspension restores sending', zz_test.try(format('select public.send_message(%L, %L)', v_ts, 'again')) = 'ok');
  v_call := public.start_call(v_ts, 'audio');

  -- ---------------------------------------------------------------- H2: demotion
  execute 'reset role'; perform zz_test.as_user(a); perform public.admin_set_role(t1, 'student');
  execute 'reset role'; perform zz_test.as_user(s1);
  perform zz_test.chk('a demoted teacher''s ringing call is no longer shown', (select count(*) from public.my_incoming_calls()) = 0);
  perform zz_test.chk('...nor answerable', zz_test.try(format('select public.answer_call(%L)', v_call)) = 'err:42501');
  perform zz_test.chk('the student cannot write into that chat any more either', zz_test.try(format('select public.send_message(%L, %L)', v_ts, 'hi')) = 'err:42501');
  perform zz_test.chk('the student''s chat with the admin still works', zz_test.try(format('select public.send_message(%L, %L)', v_as, 'hi')) = 'ok');
  execute 'reset role'; perform zz_test.as_user(t1);
  perform zz_test.chk('a demoted teacher loses the roster', zz_test.try(format('select * from public.class_roster(%L)', c1.id)) = 'err:42501');
  perform zz_test.chk('...and the member rows, and the ban list', zz_test.cnt('select 1 from public.class_members where student_id <> auth.uid()') = 0 and zz_test.try(format('select * from public.teacher_class_bans(%L)', c1.id)) = 'err:42501');
  perform zz_test.chk('...cannot start chats', zz_test.try(format('select public.start_chat(%L)', s2)) = 'err:42501');
  perform zz_test.chk('...cannot message existing student chats', zz_test.try(format('select public.send_message(%L, %L)', v_ts, 'hi')) = 'err:42501');
  perform zz_test.chk('...nor send files', zz_test.try(format('select public.send_attachment(%L, %L, %L, %L, 1)', v_ts, 'image', 'x', 'image/jpeg')) = 'err:42501' and zz_test.try(format('insert into storage.objects (bucket_id, name) values (%L, %L)', 'chat-files', v_ts::text || '/' || gen_random_uuid()::text || '.jpg')) like 'err:%');
  perform zz_test.chk('...cannot call', zz_test.try(format('select public.start_call(%L, %L)', v_ts, 'audio')) = 'err:42501');
  perform zz_test.chk('...cannot read or rotate the class code', (select count(*) from public.teacher_classes()) = 0 and zz_test.try('select code from public.classes') = 'err:42501' and zz_test.try(format('select public.rotate_class_code(%L)', c1.id)) = 'err:42501');
  execute 'reset role'; perform zz_test.as_user(s3);
  perform zz_test.chk('a demoted teacher''s class code stops working', (select count(*) from public.join_class(v_new)) = 0);

  -- ---------------------------------------------------------------- H4: confirmed e-mail only
  execute 'reset role'; perform zz_test.as_user(a);
  perform public.admin_grant_reward('victim@test.local', 'star', 3, null, null);
  perform public.admin_create_announcement('{"en":"Private"}', '{"en":"For the real owner"}', null, null, 'victim@test.local');
  execute 'reset role';
  execute 'select count(*) from net._calls where body->''users'' @> to_jsonb(array[$1])' into n using u4;
  perform zz_test.chk('no push for an unconfirmed address', n = 0);
  perform zz_test.as_user(u4);
  perform zz_test.chk('an unconfirmed address sees no rewards and no personal announcements', (select count(*) from public.my_rewards()) = 0 and not exists (select 1 from public.my_announcements() where audience = 'user'));
  execute 'reset role'; perform public.account_delete_cleanup('victim@test.local');
  delete from auth.users where id = u4;
  perform zz_test.chk('deleting an unconfirmed account (and the clean-up call) removes nothing', exists (select 1 from public.rewards where email = 'victim@test.local') and exists (select 1 from public.announcements where user_email = 'victim@test.local'));
  perform public.account_delete_cleanup('victim@test.local');
  perform zz_test.chk('...also when called after the account is gone', exists (select 1 from public.rewards where email = 'victim@test.local'));
  insert into auth.users (id, aud, role, email, email_confirmed_at) values (u4, 'authenticated', 'authenticated', 'Victim@test.local', now());
  perform zz_test.as_user(u4);
  perform zz_test.chk('the real owner, confirmed, gets them', (select count(*) from public.my_rewards()) = 1 and exists (select 1 from public.my_announcements() where audience = 'user'));
  execute 'reset role'; delete from auth.users where id = u4;
  perform zz_test.chk('deleting a confirmed account removes data kept by e-mail', not exists (select 1 from public.rewards where email = 'victim@test.local') and not exists (select 1 from public.announcements where user_email = 'victim@test.local'));

  -- ---------------------------------------------------------------- account deletion lists every file; H3 purge list
  v_orphan := v_ts::text || '/orphan/deep/x.jpg';
  v_old := v_as::text || '/' || gen_random_uuid()::text || '.jpg';
  v_fresh := v_as::text || '/' || gen_random_uuid()::text || '.jpg';
  delete from storage.objects where bucket_id = 'chat-files' and name <> v_file;
  insert into storage.objects (bucket_id, name, created_at) values ('chat-files', v_orphan, now() - interval '25 hours'), ('chat-files', v_old, now() - interval '91 days'), ('chat-files', v_fresh, now());
  insert into public.chat_messages (conversation_id, sender_id, body, kind, file_path, file_size) values (v_as, a, '', 'image', v_old, 1);
  v_paths := public.account_delete_prepare(s1);
  perform zz_test.chk('account deletion lists every stored file in the person''s chats, also unsent and odd ones', v_paths @> array[v_file, v_orphan, v_old, v_fresh], v_paths::text);
  perform zz_test.chk('the purge list has expired, removed and day-old unused files, not fresh uploads', (select array_agg(path) from public.expired_chat_files(100)) @> array[v_file, v_orphan, v_old] and not exists (select 1 from public.expired_chat_files(100) where path = v_fresh));
  perform zz_test.chk('the purge list respects its limit', (select count(*) from public.expired_chat_files(1)) = 1);
  v_msg := gen_random_uuid(); v_fresh := v_as::text || '/' || gen_random_uuid()::text || '.jpg';
  insert into storage.objects (bucket_id, name, created_at) values ('chat-files', v_fresh, now() - interval '30 days');
  insert into public.chat_messages (conversation_id, sender_id, body, kind, file_path, file_size) values (v_as, a, '', 'image', v_fresh, 1);
  perform zz_test.chk('a file a live message uses is kept', not exists (select 1 from public.expired_chat_files(100) where path = v_fresh));
  insert into public.calls (conversation_id, caller_id, media, status) values (v_as, a, 'audio', 'ended') returning id into v_call;
  insert into public.call_signals (call_id, sender_id, kind, payload, created_at) values (v_call, a, 'ice', '{}', now() - interval '25 hours'), (v_call, a, 'ice', '{}', now());
  n := public.purge_call_signals();
  perform zz_test.chk('signals older than a day are purged, newer kept', n >= 1 and (select count(*) from public.call_signals where call_id = v_call) = 1);

  -- ---------------------------------------------------------------- privileges
  perform zz_test.chk('only the service role may run the purge and deletion helpers',
    not has_function_privilege('authenticated', 'public.expired_chat_files(int)', 'execute') and not has_function_privilege('anon', 'public.expired_chat_files(int)', 'execute')
    and not has_function_privilege('authenticated', 'public.purge_call_signals()', 'execute') and not has_function_privilege('authenticated', 'public.account_delete_prepare(uuid)', 'execute')
    and (not exists (select 1 from pg_roles where rolname = 'service_role') or has_function_privilege('service_role', 'public.expired_chat_files(int)', 'execute')));
  perform zz_test.chk('internal helpers are not callable from the browser',
    not exists (select 1 from unnest(array['public.lock_me()', 'public.role_of(uuid)', 'public.is_suspended(uuid)', 'public.teaches_student(uuid,uuid)', 'public.chat_is_blocked(uuid)', 'public.chat_is_open(uuid)', 'public.require_can_contact(uuid)', 'public.new_class_code()', 'public.finish_call(uuid,text)', 'public.display_name_of(uuid)', 'public.push_send(uuid[],text,jsonb)']) f
                where has_function_privilege('authenticated', f, 'execute') or has_function_privilege('anon', f, 'execute')));
  perform zz_test.chk('signed-out visitors cannot call the new functions',
    not exists (select 1 from unnest(array['public.rotate_class_code(uuid)', 'public.block_chat(uuid)', 'public.report_chat(uuid,uuid,text,text)', 'public.admin_list_reports()', 'public.accept_terms(text)', 'public.my_terms()', 'public.my_account_status()', 'public.admin_set_suspended(uuid,boolean,text)', 'public.my_chats()', 'public.admin_list_users()', 'public.teacher_unban(uuid,uuid)', 'public.can_upload_chat_file(text)']) f
                where has_function_privilege('anon', f, 'execute')));
  perform zz_test.chk('progress: signed-in people have the four row operations and nothing else',
    has_table_privilege('authenticated', 'public.progress', 'select') and has_table_privilege('authenticated', 'public.progress', 'insert') and has_table_privilege('authenticated', 'public.progress', 'update') and has_table_privilege('authenticated', 'public.progress', 'delete')
    and not has_table_privilege('authenticated', 'public.progress', 'truncate') and not has_table_privilege('authenticated', 'public.progress', 'references') and not has_table_privilege('authenticated', 'public.progress', 'trigger') and not has_table_privilege('anon', 'public.progress', 'select'));

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
