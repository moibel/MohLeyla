-- Permission tests for 010_calls.sql. Run via `sh supabase/tests/run-dry.sh calls` or `run-local.sh calls`.
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
  ('00000000-0000-0000-0000-0000000000c3', 'authenticated', 'authenticated', 'student3@test.local','{"display_name":"Omar Outsider"}');

-- 014: e-mail keyed features need a confirmed address, and writing in chat needs accepted terms
update auth.users set email_confirmed_at = now() where email ilike '%@test.local';
insert into public.terms_acceptances (user_id, version) select id, 'test' from auth.users where email ilike '%@test.local';

do $t$
declare
  a  constant uuid := '00000000-0000-0000-0000-0000000000a1';
  t1 constant uuid := '00000000-0000-0000-0000-0000000000b1';
  s1 constant uuid := '00000000-0000-0000-0000-0000000000c1';
  s3 constant uuid := '00000000-0000-0000-0000-0000000000c3';
  v_class public.classes; v_ts uuid; v_as3 uuid; v_as1 uuid; v_call uuid; v_call2 uuid; res text; n bigint; r record; i int;
begin
  update public.profiles set role = 'admin' where user_id = a;
  update public.profiles set role = 'teacher' where user_id = t1;
  execute 'reset role'; perform zz_test.as_user(t1);
  v_class := public.create_class('Class One');
  execute 'reset role'; perform zz_test.as_user(s1);
  perform public.join_class(v_class.code);
  execute 'reset role'; perform zz_test.as_user(t1);
  v_ts := public.start_chat(s1);
  execute 'reset role'; perform zz_test.as_user(a);
  v_as3 := public.start_chat(s3);
  v_as1 := public.start_chat(s1);

  -- ---------------------------------------------------------------- who may start
  execute 'reset role'; perform zz_test.as_user(s1);
  res := zz_test.try(format('select public.start_call(%L, %L)', v_ts, 'video'));
  perform zz_test.chk('a student cannot start a call', res = 'err:42501', res);
  execute 'reset role'; perform zz_test.as_user(s3);
  res := zz_test.try(format('select public.start_call(%L, %L)', v_as3, 'audio'));
  perform zz_test.chk('a student cannot start a call even in a chat the admin started', res = 'err:42501', res);
  res := zz_test.try(format('select public.start_call(%L, %L)', v_ts, 'audio'));
  perform zz_test.chk('an outsider cannot start a call in someone else''s conversation', res = 'err:42501', res);
  execute 'reset role'; set local role anon;
  res := zz_test.try(format('select public.start_call(%L, %L)', v_ts, 'audio'));
  perform zz_test.chk('anonymous visitors cannot start a call', res like 'err:%', res);
  res := zz_test.try($q$select * from public.my_incoming_calls()$q$);
  perform zz_test.chk('anonymous visitors cannot list calls', res like 'err:%', res);

  execute 'reset role'; perform zz_test.as_user(t1);
  res := zz_test.try(format('select public.start_call(%L, %L)', v_ts, 'hologram'));
  perform zz_test.chk('an unknown call type is rejected', res = 'err:22023', res);
  res := zz_test.try(format('select public.start_call(%L, %L)', v_as1, 'video'));
  perform zz_test.chk('a teacher cannot use the admin''s conversation', res = 'err:42501', res);
  v_call := public.start_call(v_ts, 'video');
  perform zz_test.chk('a teacher can call a student of their own class', v_call is not null);
  res := zz_test.try(format('select public.start_call(%L, %L)', v_ts, 'audio'));
  perform zz_test.chk('only one call at a time per conversation', res = 'err:55000', res);

  -- ---------------------------------------------------------------- ringing, answering, signalling
  execute 'reset role'; perform zz_test.as_user(s1);
  perform zz_test.chk('the student sees the call ringing, with the caller''s name', (select caller_name from public.my_incoming_calls() where call_id = v_call) = 'Tariq Teacher');
  execute 'reset role'; perform zz_test.as_user(t1);
  perform zz_test.chk('the caller does not see their own call as incoming', (select count(*) from public.my_incoming_calls()) = 0);
  perform public.call_signal_send(v_call, 'offer', '{"sdp":"v=0 ...","type":"offer"}');
  perform public.call_signal_send(v_call, 'ice', '{"candidate":"candidate:1 1 udp ..."}');
  res := zz_test.try(format('select public.call_signal_send(%L, %L, %L)', v_call, 'hack', '{}'));
  perform zz_test.chk('an unknown signal kind is rejected', res = 'err:22023', res);
  res := zz_test.try(format('select public.call_signal_send(%L, %L, %L)', v_call, 'offer', '"just a string"'));
  perform zz_test.chk('a signal payload must be an object', res = 'err:22023', res);
  res := zz_test.try(format('select public.call_signal_send(%L, %L, %L)', v_call, 'offer', json_build_object('x', repeat('y', 20000))::text));
  perform zz_test.chk('an oversized signal payload is rejected', res = 'err:22023', res);
  res := zz_test.try(format('select public.answer_call(%L)', v_call));
  perform zz_test.chk('the caller cannot answer their own call', res = 'err:22023', res);

  execute 'reset role'; perform zz_test.as_user(s3);
  res := zz_test.try(format('select * from public.call_poll(%L, 0)', v_call));
  perform zz_test.chk('an outsider cannot poll a call', res = 'err:42501', res);
  res := zz_test.try(format('select public.call_signal_send(%L, %L, %L)', v_call, 'ice', '{}'));
  perform zz_test.chk('an outsider cannot send signals into a call', res = 'err:42501', res);
  res := zz_test.try(format('select public.answer_call(%L)', v_call));
  perform zz_test.chk('an outsider cannot answer a call', res = 'err:42501', res);
  res := zz_test.try(format('select public.end_call(%L)', v_call));
  perform zz_test.chk('an outsider cannot end a call', res = 'err:42501', res);
  res := zz_test.try($q$select * from public.calls$q$);
  perform zz_test.chk('nobody can read the calls table directly', res like 'err:%', res);
  res := zz_test.try($q$select * from public.call_signals$q$);
  perform zz_test.chk('nobody can read the signals table directly', res like 'err:%', res);
  res := zz_test.try(format('insert into public.call_signals (call_id, sender_id, kind, payload) values (%L, %L, %L, %L)', v_call, s3, 'bye', '{}'));
  perform zz_test.chk('nobody can insert signals directly', res like 'err:%', res);
  perform zz_test.chk('an outsider sees no incoming calls', (select count(*) from public.my_incoming_calls()) = 0);

  execute 'reset role'; perform zz_test.as_user(a);
  res := zz_test.try(format('select * from public.call_poll(%L, 0)', v_call));
  perform zz_test.chk('even the admin cannot listen in on a call between two other people', res = 'err:42501', res);

  execute 'reset role'; perform zz_test.as_user(s1);
  select count(*) into n from public.call_poll(v_call, 0) where signal_id is not null;
  perform zz_test.chk('the student receives the caller''s offer and network candidates (and only those)', n = 2);
  perform zz_test.chk('the poll says the call is ringing, who the caller is and the call type', (select status = 'ringing' and not i_am_caller and media = 'video' from public.call_poll(v_call, 0) limit 1));
  perform public.call_signal_send(v_call, 'answer', '{"sdp":"v=0 ...","type":"answer"}');
  perform public.answer_call(v_call);
  perform zz_test.chk('answering makes the call active', (select status from public.call_poll(v_call, 0) limit 1) = 'active');
  execute 'reset role'; perform zz_test.as_user(t1);
  select count(*) into n from public.call_poll(v_call, 0) where signal_id is not null;
  perform zz_test.chk('the caller receives only the student''s answer, not their own messages', n = 1 and (select kind from public.call_poll(v_call, 0) where signal_id is not null) = 'answer');
  select max(signal_id) into n from public.call_poll(v_call, 0);
  perform zz_test.chk('polling after the last id returns no new messages', (select count(*) from public.call_poll(v_call, n) where signal_id is not null) = 0);
  execute 'reset role'; perform zz_test.as_user(s1);
  perform zz_test.chk('an answered call is no longer ringing', (select count(*) from public.my_incoming_calls()) = 0);
  res := zz_test.try(format('select public.answer_call(%L)', v_call));
  perform zz_test.chk('a call cannot be answered twice', res = 'err:55000', res);

  -- ---------------------------------------------------------------- hanging up leaves one line in the chat
  perform public.end_call(v_call);
  perform zz_test.chk('hanging up ends the call', (select status from public.call_poll(v_call, 0) limit 1) = 'ended');
  perform zz_test.chk('the chat gets a "video call, N min" line', exists (select 1 from public.chat_messages_of(v_ts) where kind = 'call' and body ~ '^video:ended:[0-9]+$'));
  perform public.end_call(v_call);
  perform zz_test.chk('ending twice is harmless (still one line)', (select count(*) from public.chat_messages_of(v_ts) where kind = 'call') = 1);
  res := zz_test.try(format('select public.call_signal_send(%L, %L, %L)', v_call, 'ice', '{}'));
  perform zz_test.chk('no signals after the call is over', res = 'err:55000', res);

  -- declined and missed
  execute 'reset role'; perform zz_test.as_user(t1);
  v_call2 := public.start_call(v_ts, 'audio');
  execute 'reset role'; perform zz_test.as_user(s1);
  perform public.end_call(v_call2);
  perform zz_test.chk('declining a ringing call is recorded as declined', exists (select 1 from public.chat_messages_of(v_ts) where kind = 'call' and body = 'audio:declined'));
  execute 'reset role'; perform zz_test.as_user(t1);
  v_call2 := public.start_call(v_ts, 'audio');
  perform public.end_call(v_call2);
  perform zz_test.chk('cancelling before it is answered is recorded as missed', exists (select 1 from public.chat_messages_of(v_ts) where kind = 'call' and body = 'audio:missed'));
  v_call2 := public.start_call(v_ts, 'audio');
  execute 'reset role';
  update public.calls set created_at = clock_timestamp() - interval '2 minutes' where id = v_call2;
  perform zz_test.as_user(s1);
  perform zz_test.chk('a call that rang more than a minute ago is no longer shown as incoming', (select count(*) from public.my_incoming_calls()) = 0);
  res := zz_test.try(format('select public.answer_call(%L)', v_call2));
  perform zz_test.chk('a call that rang too long ago cannot be answered', res = 'err:55000', res);
  execute 'reset role'; perform zz_test.as_user(t1);
  perform public.start_call(v_ts, 'video');
  perform zz_test.chk('starting a new call closes the stale one as missed', (select count(*) from public.chat_messages_of(v_ts) where body = 'audio:missed') = 2);

  -- ---------------------------------------------------------------- the admin
  execute 'reset role'; perform zz_test.as_user(a);
  v_call := public.start_call(v_as3, 'video');
  perform zz_test.chk('an admin can call anyone they have a chat with', v_call is not null);
  execute 'reset role'; perform zz_test.as_user(s3);
  perform zz_test.chk('the student sees the admin''s call ringing', (select count(*) from public.my_incoming_calls() where call_id = v_call) = 1);
  perform public.answer_call(v_call);
  perform public.end_call(v_call);
  perform zz_test.chk('the admin''s call also leaves a chat line', exists (select 1 from public.chat_messages_of(v_as3) where kind = 'call'));

  -- ---------------------------------------------------------------- rate limit
  execute 'reset role'; perform zz_test.as_user(a);
  for i in 1..12 loop
    res := zz_test.try(format('select public.start_call(%L, %L)', v_as1, 'audio'));
    exit when res <> 'ok';
    execute 'reset role';
    select id into v_call2 from public.calls where conversation_id = v_as1 and status = 'ringing' limit 1;
    perform zz_test.as_user(a);
    perform public.end_call(v_call2);
  end loop;
  perform zz_test.chk('too many calls in a short time are refused', res = 'err:54000', res);

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
