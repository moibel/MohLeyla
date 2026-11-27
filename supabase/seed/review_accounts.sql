-- Prepares the two TEST accounts the app stores' reviewers use: a teacher and a student in one class, with a chat between them.
-- Run it in the Supabase SQL editor AFTER you created both users there (Authentication -> Users -> Add user -> Create new user,
-- with "Auto Confirm User" on and a long password you choose). It needs migrations 001-015.
--
-- 1. Put the two addresses below. Each must contain the word "review", so a real learner can never be changed by a typing mistake.
-- 2. Run the whole script. It is safe to run again before every store submission: it also unblocks and un-suspends the two
--    accounts and restores the role, class, membership and chat if a reviewer removed them.
-- No password is written here, and none belongs in this file or in git.

do $seed$
declare
  teacher_email constant text := 'REPLACE-teacher-review@example.com';
  student_email constant text := 'REPLACE-student-review@example.com';
  v_teacher uuid; v_student uuid; v_class uuid; v_conv uuid;
begin
  if position('review' in lower(teacher_email)) = 0 or position('review' in lower(student_email)) = 0 then
    raise exception 'both addresses must contain the word "review"';
  end if;
  select id into v_teacher from auth.users where lower(email) = lower(teacher_email) and email_confirmed_at is not null;
  select id into v_student from auth.users where lower(email) = lower(student_email) and email_confirmed_at is not null;
  if v_teacher is null or v_student is null then raise exception 'create both users first, with Auto Confirm on (teacher found: %, student found: %)', v_teacher is not null, v_student is not null; end if;
  if v_teacher = v_student then raise exception 'use two different accounts'; end if;
  if exists (select 1 from public.profiles where user_id in (v_teacher, v_student) and role = 'admin') then raise exception 'an admin account must never be a review account'; end if;

  insert into public.profiles (user_id, role) values (v_teacher, 'teacher') on conflict (user_id) do update set role = 'teacher';
  insert into public.profiles (user_id, role) values (v_student, 'student') on conflict (user_id) do update set role = 'student';
  delete from public.suspensions where user_id in (v_teacher, v_student);

  select id into v_class from public.classes where teacher_id = v_teacher order by created_at limit 1;
  if v_class is null then
    insert into public.classes (name, code, teacher_id) values ('App Review Class', upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12)), v_teacher) returning id into v_class;
  end if;
  delete from public.class_bans where class_id = v_class and student_id = v_student;
  insert into public.class_members (class_id, student_id) values (v_class, v_student) on conflict do nothing;

  select id into v_conv from public.conversations where least(user_a, user_b) = least(v_teacher, v_student) and greatest(user_a, user_b) = greatest(v_teacher, v_student);
  if v_conv is null then
    insert into public.conversations (user_a, user_b, created_by) values (v_teacher, v_student, v_teacher) returning id into v_conv;
  end if;
  delete from public.chat_blocks where conversation_id = v_conv;
  if not exists (select 1 from public.chat_messages where conversation_id = v_conv and sender_id = v_teacher and removed_at is null and kind <> 'call') then
    insert into public.chat_messages (conversation_id, sender_id, body) values (v_conv, v_teacher, 'Welcome to MohLeyla! This is a test chat for app review. You can reply, report this message or block me.');
    update public.conversations set last_message_at = now() where id = v_conv;
  end if;
  raise notice 'review accounts are ready';
end
$seed$;

select 'review accounts are ready' as result;
