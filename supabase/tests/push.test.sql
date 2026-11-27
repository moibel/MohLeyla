-- Permission and behaviour tests for 011_push.sql. Run via `sh supabase/tests/run-dry.sh push` or `run-local.sh push`.
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
  ('00000000-0000-0000-0000-0000000000c2', 'authenticated', 'authenticated', 'student2@test.local','{"display_name":"Sami Student"}'),
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
  tok1 constant text := 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
  tok2 constant text := 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
  tok3 constant text := 'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc';
  tokA constant text := 'dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd';
  v_secret constant text := 'a-long-shared-secret-0123456789';
  v_class public.classes; v_conv uuid; v_msg uuid; v_call uuid; res text; i int; c record; v_before int;
begin
  update public.profiles set role = 'admin' where user_id = a;
  update public.profiles set role = 'teacher' where user_id = t1;
  execute 'reset role'; perform zz_test.as_user(t1);
  v_class := public.create_class('Class One');
  execute 'reset role'; perform zz_test.as_user(s1); perform public.join_class(v_class.code);
  execute 'reset role'; perform zz_test.as_user(s2); perform public.join_class(v_class.code);
  execute 'reset role'; perform zz_test.as_user(t1); v_conv := public.start_chat(s1);

  -- ---------------------------------------------------------------- registering tokens
  execute 'reset role'; perform zz_test.as_user(s1);
  perform zz_test.chk('a signed-in person can register a phone', zz_test.try(format('select public.register_push_token(%L, %L, %L)', tok1, 'ios', 'ar')) = 'ok');
  perform zz_test.chk('registering the same token again is fine (it just refreshes)', zz_test.try(format('select public.register_push_token(%L, %L, %L)', tok1, 'ios', 'ar')) = 'ok');
  perform zz_test.chk('an unknown platform is refused', zz_test.try(format('select public.register_push_token(%L, %L, %L)', tok2, 'windows', 'en')) = 'err:22023');
  perform zz_test.chk('a too-short token is refused', zz_test.try(format('select public.register_push_token(%L, %L, %L)', 'short', 'ios', 'en')) = 'err:22023');
  perform zz_test.chk('a token with odd characters is refused', zz_test.try(format('select public.register_push_token(%L, %L, %L)', repeat('a', 40) || ' ; drop table x', 'ios', 'en')) = 'err:22023');
  perform zz_test.chk('an unknown language is accepted (and stored as English)', zz_test.try(format('select public.register_push_token(%L, %L, %L)', tok3, 'android', 'xx')) = 'ok');
  execute 'reset role';
  perform zz_test.chk('the language falls back to en', (select lang from public.push_tokens where token = tok3) = 'en');
  perform zz_test.chk('the stored language is the one the app sent', (select lang from public.push_tokens where token = tok1) = 'ar');
  perform zz_test.as_user(s2);
  perform zz_test.chk('a signed-in person cannot read the token table directly', zz_test.cnt('select * from public.push_tokens') = -1);
  perform zz_test.chk('nor change it directly', zz_test.try(format('update public.push_tokens set user_id = %L', s2)) like 'err:%');
  perform zz_test.chk('nor read the push settings (which hold the secret)', zz_test.cnt('select * from public.push_config') = -1);
  execute 'reset role'; set local role anon;
  perform zz_test.chk('a signed-out visitor cannot register', zz_test.try(format('select public.register_push_token(%L, %L, %L)', tok2, 'ios', 'en')) like 'err:%');
  perform zz_test.chk('nor remove', zz_test.try(format('select public.unregister_push_token(%L)', tok1)) like 'err:%');
  execute 'reset role';

  -- a phone that signs in as someone else moves to them
  perform zz_test.as_user(s2);
  perform public.register_push_token(tok1, 'ios', 'en');
  execute 'reset role';
  perform zz_test.chk('the same phone signing in as another person moves the token to them', (select user_id from public.push_tokens where token = tok1) = s2);
  perform zz_test.as_user(s1);
  perform public.unregister_push_token(tok1);
  execute 'reset role';
  perform zz_test.chk('removing a token that is not yours does nothing', exists (select 1 from public.push_tokens where token = tok1));
  perform zz_test.as_user(s2);
  perform public.unregister_push_token(tok1);
  execute 'reset role';
  perform zz_test.chk('removing your own token works (sign-out)', not exists (select 1 from public.push_tokens where token = tok1));

  perform zz_test.as_user(s3);
  for i in 1..12 loop perform public.register_push_token(repeat(chr(96 + i), 40), 'android', 'en'); end loop;
  execute 'reset role';
  perform zz_test.chk('at most 10 phones are kept per person (the newest)', (select count(*) from public.push_tokens where user_id = s3) = 10);
  delete from public.push_tokens where user_id = s3;

  -- ---------------------------------------------------------------- nothing is sent until push is configured
  perform zz_test.as_user(s1); perform public.register_push_token(tok1, 'ios', 'en');
  execute 'reset role'; perform zz_test.as_user(a); perform public.register_push_token(tokA, 'ios', 'en');
  execute 'reset role'; perform zz_test.as_user(t1);
  v_msg := public.send_message(v_conv, 'before setup');
  execute 'reset role';
  perform zz_test.chk('with no push address stored, a message works and nothing is sent', v_msg is not null and (select count(*) from net._calls) = 0);

  insert into public.push_config (url, secret) values ('https://example.supabase.co/functions/v1/push', v_secret);
  perform zz_test.chk('the push address must be https', zz_test.try($q$insert into public.push_config (id, url, secret) values (false, 'http://x', 'a-long-shared-secret-0123456789')$q$) like 'err:%');
  perform zz_test.chk('the secret must be long enough', zz_test.try($q$update public.push_config set secret = 'short'$q$) like 'err:%');

  -- ---------------------------------------------------------------- chat message
  perform zz_test.as_user(t1);
  v_msg := public.send_message(v_conv, 'my private lesson note 4711');
  execute 'reset role';
  select * into c from net._calls order by id desc limit 1;
  perform zz_test.chk('a chat message tells the other person''s phone', c.body->>'kind' = 'chat' and c.body->'users' = to_jsonb(array[s1]));
  perform zz_test.chk('the sender is not notified about their own message', not (c.body->'users' @> to_jsonb(array[t1])));
  perform zz_test.chk('the notification names the sender', c.body->'payload'->>'name' = 'Tariq Teacher' and (c.body->'payload'->>'conversation')::uuid = v_conv);
  perform zz_test.chk('the TEXT of the message is never in the notification', c.body::text not like '%4711%' and c.body::text not like '%private lesson%');
  perform zz_test.chk('the call carries the shared secret and goes to the stored address', c.headers->>'x-push-secret' = v_secret and c.url = 'https://example.supabase.co/functions/v1/push');
  perform zz_test.as_user(s1);
  v_msg := public.send_message(v_conv, 'thanks');
  execute 'reset role';
  select * into c from net._calls order by id desc limit 1;
  perform zz_test.chk('a reply goes the other way', c.body->'users' = to_jsonb(array[t1]) and c.body->'payload'->>'name' = 'Sara Student');

  -- ---------------------------------------------------------------- calls
  perform zz_test.as_user(t1);
  v_call := public.start_call(v_conv, 'video');
  execute 'reset role';
  select * into c from net._calls order by id desc limit 1;
  perform zz_test.chk('a ringing call notifies the other person', c.body->>'kind' = 'call' and c.body->'users' = to_jsonb(array[s1]) and c.body->'payload'->>'media' = 'video' and c.body->'payload'->>'name' = 'Tariq Teacher');
  select count(*) into v_before from net._calls;
  perform zz_test.as_user(t1); perform public.end_call(v_call); execute 'reset role';
  perform zz_test.chk('the "missed call" line in the chat does not send a second notification', (select count(*) from net._calls) = v_before);

  -- ---------------------------------------------------------------- announcements
  perform zz_test.as_user(a);
  perform public.admin_create_announcement('{"en":"Hello all","ar":"مرحبا"}', '{"en":"Body","ar":"نص"}');
  execute 'reset role';
  select * into c from net._calls order by id desc limit 1;
  perform zz_test.chk('an announcement to everyone goes to people with a registered phone', c.body->>'kind' = 'announcement' and c.body->'users' @> to_jsonb(array[s1]));
  perform zz_test.chk('...but not to the admin who sent it', not (c.body->'users' @> to_jsonb(array[a])));
  perform zz_test.chk('...and not to people who have no phone registered', not (c.body->'users' @> to_jsonb(array[s3])));
  perform zz_test.chk('the announcement title is passed (in every language)', c.body->'payload'->'title'->>'en' = 'Hello all' and c.body->'payload'->'title'->>'ar' is not null);
  perform zz_test.as_user(a);
  perform public.admin_create_announcement('{"en":"Class news"}', '{"en":"Body"}', v_class.id);
  execute 'reset role';
  select * into c from net._calls order by id desc limit 1;
  perform zz_test.chk('a class announcement goes to the class members only', c.body->'users' @> to_jsonb(array[s1, s2]) and jsonb_array_length(c.body->'users') = 2);
  perform zz_test.as_user(a);
  perform public.admin_create_announcement('{"en":"Just you"}', '{"en":"Body"}', null, null, 'student3@test.local', 'celebrate');
  execute 'reset role';
  select * into c from net._calls order by id desc limit 1;
  perform zz_test.chk('an announcement to one person goes to that person', c.body->'users' = to_jsonb(array[s3]) and c.body->'payload'->>'style' = 'celebrate');
  select count(*) into v_before from net._calls;
  perform zz_test.as_user(a);
  perform public.admin_create_announcement('{"en":"Nobody"}', '{"en":"Body"}', null, null, 'nobody@test.local');
  execute 'reset role';
  perform zz_test.chk('an announcement to an address with no account sends nothing', (select count(*) from net._calls) = v_before);

  -- ---------------------------------------------------------------- rewards
  perform zz_test.as_user(a);
  perform public.admin_grant_reward('Student1@Test.local', 'star', 3, null, 'well done');
  execute 'reset role';
  select * into c from net._calls order by id desc limit 1;
  perform zz_test.chk('a reward notifies that person', c.body->>'kind' = 'reward' and c.body->'users' = to_jsonb(array[s1]) and c.body->'payload'->>'kind' = 'star' and (c.body->'payload'->>'amount')::int = 3);
  perform zz_test.chk('...without the reason text', c.body::text not like '%well done%');

  -- ---------------------------------------------------------------- the push path can never break the real action
  perform set_config('net.fail', '1', true);
  perform zz_test.as_user(t1);
  res := zz_test.try(format('select public.send_message(%L, %L)', v_conv, 'still works'));
  execute 'reset role';
  perform zz_test.chk('if the network call fails, the message is still sent', res = 'ok' and exists (select 1 from public.chat_messages where body = 'still works'));
  perform set_config('net.fail', '0', true);

  perform zz_test.as_user(a);
  res := zz_test.try($q$select public.admin_create_announcement('{"en":"Works"}', '{"en":"Body"}')$q$);
  execute 'reset role';
  perform zz_test.chk('an announcement still saves while push is working', res = 'ok');
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
