-- Tests for 015_chat_word_filter.sql. Run via `sh supabase/tests/run-local.sh filter`. Ends with a deliberate exception so everything is rolled back.
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
  ('00000000-0000-0000-0000-0000000000a1', 'authenticated', 'authenticated', 'admin@test.local', '{}', now()),
  ('00000000-0000-0000-0000-0000000000c1', 'authenticated', 'authenticated', 'student@test.local', '{}', now());

do $t$
declare
  a constant uuid := '00000000-0000-0000-0000-0000000000a1';
  s constant uuid := '00000000-0000-0000-0000-0000000000c1';
  v_conv uuid; v_id uuid; res text; t text; n int;
begin
  update public.profiles set role = 'admin' where user_id = a;
  perform zz_test.chk('the starter list is loaded', (select count(*) from public.blocked_words) > 60);

  -- ---------------------------------------------------------------- what is blocked
  foreach t in array array[
    'fuck', 'FUCK you', 'what the Fuck!', 'fuuuuck', 'f u c k', 'f.u.c.k off', 'sh1t', 'b1tch', '@sshole', 'asssshole', U&'fu\200Bck', 'please kill   yourself', 'Kill-yourself', 'send nudes',
    'كسمك', 'يا شرموطة', 'شَرْمُوطَة', 'شـــرموطة', 'والقحبة', 'هَقْتُلَك', 'سأقتلك', 'اقتل نفسك', 'ابن الشرموطه',
    'dasar kontol', 'KONTOL!', 'putang ina mo', 'du Arschloch', 'fils de pute', 'Enculé', 'hijo de puta', 'ｆｕｃｋ'
  ] loop
    perform zz_test.chk('blocked: ' || t, public.text_is_blocked(t), public.filter_words(t));
  end loop;
  -- ---------------------------------------------------------------- what must stay allowed (no matching inside other words; normal vocabulary)
  foreach t in array array[
    'Hello, how are you?', 'I live in Scunthorpe', 'a classic assessment', 'shitake mushrooms', 'a cocktail', 'Dickens wrote it', 'der Mann ist dick', 'Je suis en retard', 'saya punya anjing dan babi',
    'The bus costs 15 or 3.50', 'I have 5 cats and 4 dogs at 13:45', 'a b', 'I am a student', 'خَوَّلَ المدير', 'شربت كأس ماء', 'أنا طالب', 'سأقابلك غدا', 'كيف حالك؟', 'مرحبا يا صديقي',
    'someone threatened me and said something about rape, please help', 'Ich komme aus Berlin', 'Kumusta ka?', 'قتلني الجوع', 'my email is amina@example.com', '', '😀👍'
  ] loop
    perform zz_test.chk('allowed: ' || t, not public.text_is_blocked(t), public.filter_words(t));
  end loop;

  -- ---------------------------------------------------------------- enforced when messages are saved
  perform zz_test.as_user(a); perform public.accept_terms('t'); v_conv := public.start_chat(s);
  execute 'reset role'; perform zz_test.as_user(s); perform public.accept_terms('t');
  perform public.send_message(v_conv, 'Hello teacher');
  res := zz_test.try(format('select public.send_message(%L, %L)', v_conv, 'you b1tch'));
  perform zz_test.chk('a blocked message is refused with ML004', res = 'err:ML004', res);
  execute 'reset role';
  perform zz_test.chk('and nothing of it is stored', (select count(*) from public.chat_messages where conversation_id = v_conv) = 1);
  perform zz_test.chk('a photo caption is checked too', zz_test.try(format($q$insert into public.chat_messages (conversation_id, sender_id, body, kind, file_path, file_mime) values (%L, %L, 'fuck', 'image', 'x/y.jpg', 'image/jpeg')$q$, v_conv, s)) = 'err:ML004');
  perform zz_test.chk('call lines written by the system are not checked', zz_test.try(format($q$insert into public.chat_messages (conversation_id, sender_id, body, kind) values (%L, %L, 'audio:missed', 'call')$q$, v_conv, s)) = 'ok');

  -- ---------------------------------------------------------------- who may see and change the list
  perform zz_test.as_user(s);
  perform zz_test.chk('a student cannot read the list', zz_test.try('select * from public.admin_list_blocked_words()') = 'err:42501');
  perform zz_test.chk('nor read the table', zz_test.try('select * from public.blocked_words') = 'err:42501');
  perform zz_test.chk('nor add', zz_test.try($q$select public.admin_add_blocked_word('hello')$q$) = 'err:42501');
  perform zz_test.chk('nor probe the filter directly', zz_test.try($q$select public.text_is_blocked('x')$q$) = 'err:42501');
  perform zz_test.chk('nor remove', zz_test.try(format('select public.admin_remove_blocked_word(%L)', gen_random_uuid())) = 'err:42501');
  execute 'reset role'; execute 'set local role anon';
  perform zz_test.chk('signed-out visitors can do none of it', zz_test.try('select * from public.admin_list_blocked_words()') = 'err:42501');
  execute 'reset role'; perform zz_test.as_user(a);
  perform zz_test.chk('the admin sees the list', (select count(*) from public.admin_list_blocked_words()) > 60);
  v_id := public.admin_add_blocked_word('  Bad Phrase ');
  perform zz_test.chk('an added phrase works at once', zz_test.try(format('select public.send_message(%L, %L)', v_conv, 'what a BAD   phrase')) = 'err:ML004');
  perform zz_test.chk('adding it again does not duplicate it', public.admin_add_blocked_word('bad phrase') = v_id);
  perform public.admin_remove_blocked_word(v_id);
  perform zz_test.chk('a removed phrase is allowed again', zz_test.try(format('select public.send_message(%L, %L)', v_conv, 'what a bad phrase')) = 'ok');
  foreach t in array array['', 'a', '!!!', repeat('x', 61)] loop
    res := zz_test.try(format('select public.admin_add_blocked_word(%L)', t));
    perform zz_test.chk('refused as a list entry: ' || left(t, 10), res = 'err:22023', res);
  end loop;
  perform zz_test.chk('removing something that is not there says so', zz_test.try(format('select public.admin_remove_blocked_word(%L)', gen_random_uuid())) = 'err:P0002');
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
