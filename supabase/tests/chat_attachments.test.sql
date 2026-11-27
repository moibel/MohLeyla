-- Permission tests for 008_chat_attachments.sql (voice notes and photos). Run via `sh supabase/tests/run-dry.sh attachments` or `run-local.sh attachments`.
-- Needs the storage stand-in (tests/local-stub.sql) locally; on Supabase itself the real Storage is used.
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
  ('00000000-0000-0000-0000-0000000000c3', 'authenticated', 'authenticated', 'student3@test.local','{}');

-- 014: e-mail keyed features need a confirmed address, and writing in chat needs accepted terms
update auth.users set email_confirmed_at = now() where email ilike '%@test.local';
insert into public.terms_acceptances (user_id, version) select id, 'test' from auth.users where email ilike '%@test.local';

do $t$
declare
  a  constant uuid := '00000000-0000-0000-0000-0000000000a1';
  t1 constant uuid := '00000000-0000-0000-0000-0000000000b1';
  s1 constant uuid := '00000000-0000-0000-0000-0000000000c1';
  s3 constant uuid := '00000000-0000-0000-0000-0000000000c3';
  v_class public.classes; v_ts uuid; v_other uuid; v_file text; v_img text; v_id uuid; res text; n int; r record;
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
  v_other := public.start_chat(s3);
  v_file := v_ts::text || '/' || gen_random_uuid()::text || '.webm';
  v_img  := v_ts::text || '/' || gen_random_uuid()::text || '.jpg';

  -- ---------------------------------------------------------------- uploading (storage policies)
  execute 'reset role'; perform zz_test.as_user(s1);
  res := zz_test.try(format('insert into storage.objects (bucket_id, name) values (%L, %L)', 'chat-files', v_file));
  perform zz_test.chk('a student can upload into their own conversation folder', res = 'ok', res);
  res := zz_test.try(format('insert into storage.objects (bucket_id, name) values (%L, %L)', 'chat-files', v_img));
  perform zz_test.chk('a student can upload a photo too', res = 'ok', res);
  res := zz_test.try(format('insert into storage.objects (bucket_id, name) values (%L, %L)', 'chat-files', v_other::text || '/' || gen_random_uuid()::text || '.jpg'));
  perform zz_test.chk('a student cannot upload into someone else''s conversation folder', res like 'err:%', res);
  res := zz_test.try(format('insert into storage.objects (bucket_id, name) values (%L, %L)', 'chat-files', 'public/' || gen_random_uuid()::text || '.jpg'));
  perform zz_test.chk('a folder that is not a conversation is refused', res like 'err:%', res);
  res := zz_test.try(format('insert into storage.objects (bucket_id, name) values (%L, %L)', 'chat-files', 'loose-file.jpg'));
  perform zz_test.chk('a file with no folder is refused', res like 'err:%', res);
  execute 'reset role'; perform zz_test.as_user(s3);
  res := zz_test.try(format('insert into storage.objects (bucket_id, name) values (%L, %L)', 'chat-files', v_ts::text || '/' || gen_random_uuid()::text || '.jpg'));
  perform zz_test.chk('an outsider cannot upload into the conversation', res like 'err:%', res);
  execute 'reset role'; perform zz_test.as_user(a);
  res := zz_test.try(format('insert into storage.objects (bucket_id, name) values (%L, %L)', 'chat-files', v_ts::text || '/' || gen_random_uuid()::text || '.jpg'));
  perform zz_test.chk('the admin cannot upload into other people''s conversations (read-only there)', res like 'err:%', res);
  execute 'reset role'; set local role anon;
  res := zz_test.try(format('insert into storage.objects (bucket_id, name) values (%L, %L)', 'chat-files', v_ts::text || '/' || gen_random_uuid()::text || '.jpg'));
  perform zz_test.chk('anonymous visitors cannot upload', res like 'err:%', res);

  -- ---------------------------------------------------------------- reading
  execute 'reset role'; perform zz_test.as_user(t1);
  perform zz_test.chk('the other person in the chat can read the files', (select count(*) from storage.objects where bucket_id = 'chat-files') = 2);
  execute 'reset role'; perform zz_test.as_user(s3);
  perform zz_test.chk('an outsider sees no files', (select count(*) from storage.objects where bucket_id = 'chat-files') = 0);
  execute 'reset role'; perform zz_test.as_user(a);
  perform zz_test.chk('the admin can read every file (to keep everyone safe)', (select count(*) from storage.objects where bucket_id = 'chat-files') = 2);
  execute 'reset role'; set local role anon;
  perform zz_test.chk('anonymous visitors see no files', zz_test.cnt('select 1 from storage.objects where bucket_id = ''chat-files''') <= 0);

  -- ---------------------------------------------------------------- send_attachment
  execute 'reset role'; perform zz_test.as_user(s1);
  v_id := public.send_attachment(v_ts, 'voice', v_file, 'audio/webm', 40000, 8000, null);
  perform zz_test.chk('a student can send a voice note', v_id is not null);
  perform public.send_attachment(v_ts, 'image', v_img, 'image/jpeg', 200000, null, '  My homework  ');
  execute 'reset role';
  perform zz_test.chk('a student can send a photo with a caption (trimmed)', (select body from public.chat_messages where kind = 'image') = 'My homework');
  perform zz_test.as_user(s1);
  res := zz_test.try(format('select public.send_attachment(%L, %L, %L, %L, 100, null, null)', v_ts, 'image', v_img, 'image/jpeg'));
  perform zz_test.chk('the same file cannot be used twice', res = 'err:22023', res);
  res := zz_test.try(format('select public.send_attachment(%L, %L, %L, %L, 1000, null, null)', v_ts, 'image', v_ts::text || '/' || gen_random_uuid()::text || '.jpg', 'image/jpeg'));
  perform zz_test.chk('a message cannot point at a file that was never uploaded', res = 'err:P0002', res);
  execute 'reset role'; perform zz_test.as_user(s3);
  res := zz_test.try(format('select public.send_attachment(%L, %L, %L, %L, 1000, null, null)', v_ts, 'image', v_ts::text || '/' || gen_random_uuid()::text || '.jpg', 'image/jpeg'));
  perform zz_test.chk('an outsider cannot send an attachment into the conversation', res = 'err:42501', res);

  execute 'reset role'; perform zz_test.as_user(s1);
  v_file := v_ts::text || '/' || gen_random_uuid()::text || '.webm';
  execute format('insert into storage.objects (bucket_id, name) values (%L, %L)', 'chat-files', v_file);
  res := zz_test.try(format('select public.send_attachment(%L, %L, %L, %L, 1000, 5000, null)', v_ts, 'pdf', v_file, 'application/pdf'));
  perform zz_test.chk('PDFs and other kinds are rejected', res = 'err:22023', res);
  res := zz_test.try(format('select public.send_attachment(%L, %L, %L, %L, 1000, 5000, null)', v_ts, 'voice', v_file, 'image/jpeg'));
  perform zz_test.chk('a voice note must be audio', res = 'err:22023', res);
  res := zz_test.try(format('select public.send_attachment(%L, %L, %L, %L, 1000, 5000, null)', v_ts, 'image', v_file, 'audio/webm'));
  perform zz_test.chk('a photo must be an image', res = 'err:22023', res);
  res := zz_test.try(format('select public.send_attachment(%L, %L, %L, %L, 6000000, 5000, null)', v_ts, 'voice', v_file, 'audio/webm'));
  perform zz_test.chk('a file over 5 MB is rejected', res = 'err:22023', res);
  res := zz_test.try(format('select public.send_attachment(%L, %L, %L, %L, 1000, 130000, null)', v_ts, 'voice', v_file, 'audio/webm'));
  perform zz_test.chk('a voice note over 2 minutes is rejected', res = 'err:22023', res);
  res := zz_test.try(format('select public.send_attachment(%L, %L, %L, %L, 1000, 100, null)', v_ts, 'voice', v_file, 'audio/webm'));
  perform zz_test.chk('a voice note that is too short is rejected', res = 'err:22023', res);
  res := zz_test.try(format('select public.send_attachment(%L, %L, %L, %L, 1000, 5000, %L)', v_ts, 'voice', v_file, 'audio/webm', repeat('x', 201)));
  perform zz_test.chk('a caption over 200 characters is rejected', res = 'err:22023', res);
  res := zz_test.try(format('select public.send_attachment(%L, %L, %L, %L, 1000, 5000, null)', v_ts, 'voice', v_other::text || '/' || gen_random_uuid()::text || '.webm', 'audio/webm'));
  perform zz_test.chk('a path in another conversation''s folder is rejected', res = 'err:22023', res);
  res := zz_test.try(format('select public.send_attachment(%L, %L, %L, %L, 1000, 5000, null)', v_ts, 'voice', v_ts::text || '/../' || gen_random_uuid()::text || '.webm', 'audio/webm'));
  perform zz_test.chk('a path that tries to climb out of the folder is rejected', res = 'err:22023', res);
  res := zz_test.try(format('select public.send_attachment(%L, %L, %L, %L, 1000, 5000, null)', v_ts, 'voice', v_ts::text || '/' || gen_random_uuid()::text || '.exe', 'audio/webm'));
  perform zz_test.chk('a file extension that is not allowed is rejected', res = 'err:22023', res);

  -- ---------------------------------------------------------------- reading messages
  execute 'reset role'; perform zz_test.as_user(t1);
  perform zz_test.chk('the other person sees the voice note and photo with their file paths', (select count(*) from public.chat_messages_of(v_ts) where kind in ('voice', 'image') and file_path is not null and not expired) = 2);
  perform zz_test.chk('an unread attachment counts as unread', public.chat_unread_total() = 2);
  perform zz_test.chk('my_chats says what the last message is', (select last_kind from public.my_chats() where conversation_id = v_ts) = 'image');
  execute 'reset role'; perform zz_test.as_user(s3);
  res := zz_test.try(format('select * from public.chat_messages_of(%L)', v_ts));
  perform zz_test.chk('an outsider cannot list the messages (or file paths)', res = 'err:42501', res);

  -- ---------------------------------------------------------------- removal and expiry
  execute 'reset role'; perform zz_test.as_user(a);
  perform zz_test.chk('the admin sees the attachments in the transcript', (select count(*) from public.admin_chat_messages(v_ts) where kind <> 'text' and file_path is not null) = 2);
  perform public.admin_remove_message(v_id);
  execute 'reset role'; perform zz_test.as_user(t1);
  perform zz_test.chk('a removed voice note no longer reveals its file path', (select file_path is null and removed from public.chat_messages_of(v_ts) where id = v_id));
  execute 'reset role'; perform zz_test.as_user(s1);
  delete from storage.objects where bucket_id = 'chat-files';
  perform zz_test.chk('a student cannot delete files', (select count(*) from storage.objects where bucket_id = 'chat-files') >= 2);
  execute 'reset role'; perform zz_test.as_user(a);
  res := zz_test.try($q$select * from public.admin_expired_files()$q$);
  perform zz_test.chk('the admin can ask which files are expired', res = 'ok', res);

  -- age everything past 90 days
  execute 'reset role';
  update storage.objects set created_at = now() - interval '91 days' where bucket_id = 'chat-files';
  update public.chat_messages set created_at = now() - interval '91 days' where kind <> 'text';
  perform zz_test.as_user(t1);
  perform zz_test.chk('after 90 days the files can no longer be read', (select count(*) from storage.objects where bucket_id = 'chat-files') = 0);
  perform zz_test.chk('after 90 days the message says expired and gives no path', (select count(*) from public.chat_messages_of(v_ts) where kind <> 'text' and expired and file_path is null) = 2);
  execute 'reset role'; perform zz_test.as_user(a);
  perform zz_test.chk('after 90 days even the admin cannot read the files', (select count(*) from storage.objects where bucket_id = 'chat-files') = 0);
  perform zz_test.chk('the admin clean-up lists the expired files', (select count(*) from public.admin_expired_files()) >= 3);
  delete from storage.objects where bucket_id = 'chat-files' and false;
  execute 'reset role'; perform zz_test.as_user(s1);
  res := zz_test.try($q$select * from public.admin_expired_files()$q$);
  perform zz_test.chk('a student cannot use the clean-up list', res = 'err:42501', res);

  -- text messages still work, and the table refuses a text row without text or a file row without a file
  execute 'reset role'; perform zz_test.as_user(s1);
  perform public.send_message(v_ts, 'plain text still works');
  res := zz_test.try($q$select public.send_message('00000000-0000-0000-0000-000000000000', 'x')$q$);
  perform zz_test.chk('sending to a conversation you are not in is still refused', res = 'err:42501', res);
  execute 'reset role';
  res := zz_test.try(format('insert into public.chat_messages (conversation_id, sender_id, body, kind) values (%L, %L, %L, %L)', v_ts, s1, '', 'voice'));
  perform zz_test.chk('the table refuses a voice message without a file', res like 'err:%', res);
  res := zz_test.try(format('insert into public.chat_messages (conversation_id, sender_id, body) values (%L, %L, %L)', v_ts, s1, ''));
  perform zz_test.chk('the table refuses an empty text message', res like 'err:%', res);

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
