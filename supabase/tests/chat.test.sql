-- Permission tests for 007_chat.sql. Run via `sh supabase/tests/run-dry.sh chat` (Supabase editor) or `run-local.sh chat`.
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
  ('00000000-0000-0000-0000-0000000000c2', 'authenticated', 'authenticated', 'student2@test.local','{}'),
  ('00000000-0000-0000-0000-0000000000c3', 'authenticated', 'authenticated', 'student3@test.local','{"display_name":"Omar Outsider"}');

-- 014: e-mail keyed features need a confirmed address, and writing in chat needs accepted terms
update auth.users set email_confirmed_at = now() where email ilike '%@test.local';
insert into public.terms_acceptances (user_id, version) select id, 'test' from auth.users where email ilike '%@test.local';

do $t$
declare
  a  constant uuid := '00000000-0000-0000-0000-0000000000a1';
  t1 constant uuid := '00000000-0000-0000-0000-0000000000b1';
  s1 constant uuid := '00000000-0000-0000-0000-0000000000c1';
  s2 constant uuid := '00000000-0000-0000-0000-0000000000c2';
  s3 constant uuid := '00000000-0000-0000-0000-0000000000c3';
  v_class public.classes; v_ts uuid; v_as uuid; v_msg uuid; res text; r record; i int;
begin
  update public.profiles set role = 'admin' where user_id = a;
  update public.profiles set role = 'teacher' where user_id = t1;
  execute 'reset role'; perform zz_test.as_user(t1);
  v_class := public.create_class('Class One');
  execute 'reset role'; perform zz_test.as_user(s1);
  perform public.join_class(v_class.code);

  -- ---------------------------------------------------------------- who may start a chat
  res := zz_test.try($q$select public.start_chat('00000000-0000-0000-0000-0000000000a1')$q$);
  perform zz_test.chk('a student cannot start a chat (even with the admin)', res = 'err:42501', res);
  execute 'reset role'; perform zz_test.as_user(s2);
  res := zz_test.try($q$select public.start_chat('00000000-0000-0000-0000-0000000000c1')$q$);
  perform zz_test.chk('a student cannot start a chat with another student', res = 'err:42501', res);
  execute 'reset role'; set local role anon;
  res := zz_test.try($q$select public.start_chat('00000000-0000-0000-0000-0000000000c1')$q$);
  perform zz_test.chk('anonymous visitors cannot start a chat', res like 'err:%', res);
  res := zz_test.try($q$select * from public.my_chats()$q$);
  perform zz_test.chk('anonymous visitors cannot list chats', res like 'err:%', res);

  execute 'reset role'; perform zz_test.as_user(t1);
  v_ts := public.start_chat(s1);
  perform zz_test.chk('a teacher can start a chat with a student of their own class', v_ts is not null);
  res := zz_test.try($q$select public.start_chat('00000000-0000-0000-0000-0000000000c3')$q$);
  perform zz_test.chk('a teacher cannot start a chat with someone outside their classes', res = 'err:42501', res);
  res := zz_test.try($q$select public.start_chat('00000000-0000-0000-0000-0000000000b1')$q$);
  perform zz_test.chk('nobody can chat with themselves', res = 'err:22023', res);
  res := zz_test.try($q$select public.start_chat('00000000-0000-0000-0000-00000000dead')$q$);
  perform zz_test.chk('an unknown person is rejected', res = 'err:22023', res);
  perform zz_test.chk('starting the same chat again returns the same conversation', public.start_chat(s1) = v_ts);

  execute 'reset role'; perform zz_test.as_user(a);
  v_as := public.start_chat(s1);
  perform zz_test.chk('an admin can start a chat with anyone', v_as is not null and v_as <> v_ts);
  perform zz_test.chk('the pair is one conversation whichever side starts it', (select count(*) from public.admin_list_chats()) = 2);

  -- ---------------------------------------------------------------- writing and reading
  execute 'reset role'; perform zz_test.as_user(t1);
  v_msg := public.send_message(v_ts, '  Hello Sara, welcome!  ');
  res := zz_test.try(format('select public.send_message(%L, %L)', v_ts, '   '));
  perform zz_test.chk('an empty message is rejected', res = 'err:22023', res);
  res := zz_test.try(format('select public.send_message(%L, %L)', v_ts, repeat('x', 1001)));
  perform zz_test.chk('a message over 1000 characters is rejected', res = 'err:22023', res);
  perform zz_test.chk('the sender sees their message (trimmed)', (select body from public.chat_messages_of(v_ts) limit 1) = 'Hello Sara, welcome!');

  execute 'reset role'; perform zz_test.as_user(s1);
  perform zz_test.chk('the student has 1 unread message from the teacher', (select unread from public.my_chats() where conversation_id = v_ts) = 1 and public.chat_unread_total() = 1);
  perform zz_test.chk('the student sees the teacher name, not an e-mail address', (select other_name from public.my_chats() where conversation_id = v_ts) = 'Tariq Teacher');
  perform zz_test.chk('a student can read the messages', (select count(*) from public.chat_messages_of(v_ts)) = 1 and (select mine from public.chat_messages_of(v_ts)) = false);
  perform public.mark_chat_read(v_ts);
  perform zz_test.chk('marking as read clears the unread count', public.chat_unread_total() = 0);
  perform public.send_message(v_ts, 'Thank you!');
  perform zz_test.chk('a student can reply in a chat that exists', (select count(*) from public.chat_messages_of(v_ts)) = 2);
  execute 'reset role'; perform zz_test.as_user(t1);
  perform zz_test.chk('the teacher sees the reply as unread', (select unread from public.my_chats() where conversation_id = v_ts) = 1);

  -- ---------------------------------------------------------------- nobody else gets in
  execute 'reset role'; perform zz_test.as_user(s3);
  res := zz_test.try(format('select * from public.chat_messages_of(%L)', v_ts));
  perform zz_test.chk('an outsider cannot read a conversation', res = 'err:42501', res);
  res := zz_test.try(format('select public.send_message(%L, %L)', v_ts, 'hi'));
  perform zz_test.chk('an outsider cannot write into a conversation', res = 'err:42501', res);
  res := zz_test.try(format('select public.mark_chat_read(%L)', v_ts));
  perform zz_test.chk('an outsider cannot mark a conversation read', res = 'err:42501', res);
  perform zz_test.chk('an outsider sees no chats of their own', (select count(*) from public.my_chats()) = 0);
  res := zz_test.try($q$select * from public.chat_messages$q$);
  perform zz_test.chk('nobody can read the messages table directly', res like 'err:%', res);
  res := zz_test.try($q$select * from public.conversations$q$);
  perform zz_test.chk('nobody can read the conversations table directly', res like 'err:%', res);
  res := zz_test.try($q$insert into public.chat_messages (conversation_id, sender_id, body) select id, '00000000-0000-0000-0000-0000000000c3', 'sneaky' from public.conversations limit 1$q$);
  perform zz_test.chk('nobody can insert messages directly', res like 'err:%', res);
  res := zz_test.try($q$select * from public.admin_list_chats()$q$);
  perform zz_test.chk('a student cannot list all chats', res = 'err:42501', res);
  res := zz_test.try(format('select * from public.admin_chat_messages(%L)', v_ts));
  perform zz_test.chk('a student cannot use the admin reader', res = 'err:42501', res);
  execute 'reset role'; perform zz_test.as_user(t1);
  res := zz_test.try(format('select * from public.admin_chat_messages(%L)', v_ts));
  perform zz_test.chk('a teacher cannot use the admin reader either', res = 'err:42501', res);
  res := zz_test.try(format('select * from public.chat_messages_of(%L)', v_as));
  perform zz_test.chk('a teacher cannot read the admin''s chat with the student', res = 'err:42501', res);
  res := zz_test.try(format('select public.admin_remove_message(%L)', v_msg));
  perform zz_test.chk('only an admin can remove a message', res = 'err:42501', res);

  -- ---------------------------------------------------------------- the admin
  execute 'reset role'; perform zz_test.as_user(a);
  perform zz_test.chk('the admin can read every conversation', (select count(*) from public.admin_chat_messages(v_ts)) = 2 and (select count(*) from public.admin_list_chats()) = 2);
  res := zz_test.try(format('select public.send_message(%L, %L)', v_ts, 'butting in'));
  perform zz_test.chk('the admin cannot write inside other people''s chats', res = 'err:42501', res);
  res := zz_test.try(format('select * from public.chat_messages_of(%L)', v_ts));
  perform zz_test.chk('the admin has no member access to other people''s chats (reads only through the admin reader)', res = 'err:42501', res);
  perform public.send_message(v_as, 'Hi from the admin');
  perform public.admin_remove_message(v_msg);
  res := zz_test.try(format('select public.admin_remove_message(%L)', v_msg));
  perform zz_test.chk('removing twice is an error', res = 'err:P0002', res);
  perform zz_test.chk('the admin still sees a removed message, marked removed', (select removed from public.admin_chat_messages(v_ts) where id = v_msg));
  execute 'reset role'; perform zz_test.as_user(s1);
  perform zz_test.chk('a removed message shows to the participants as removed, without its text', (select removed and body = '' from public.chat_messages_of(v_ts) where id = v_msg));
  perform zz_test.chk('the student has the admin message unread and sees two chats', (select count(*) from public.my_chats()) = 2 and public.chat_unread_total() = 1);

  -- ---------------------------------------------------------------- rate limit
  execute 'reset role'; perform zz_test.as_user(t1);
  for i in 1..25 loop
    res := zz_test.try(format('select public.send_message(%L, %L)', v_ts, 'spam ' || i));
    exit when res <> 'ok';
  end loop;
  perform zz_test.chk('more than 20 messages a minute is refused', res = 'err:54000', res);

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
