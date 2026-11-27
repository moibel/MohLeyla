-- MohLeyla chat word filter (both app stores ask for a way to filter objectionable content). Run once in Supabase after 014.
-- Additive and safe to run again (words an admin removed are NOT added back: the starter list is only loaded into an empty table).
--
-- What it does: before a chat message or a photo / voice-note caption is saved, it is compared with a list of blocked words and
-- phrases. A match refuses the message (error ML004) and nothing of it is stored. Admins can see and change the list.
-- What it does NOT do: it cannot judge photos or voice recordings, understand context, or catch every spelling trick.
-- Reporting, blocking and admin review (014) remain the main protection.
--
-- Matching is by WHOLE words (never inside another word), after: lower case; Arabic vowel marks and stretch marks removed and
-- alef / ya / ta marbuta forms unified; invisible characters removed; stretched letters shortened ("fuuuck"); letters spaced
-- out one by one joined ("f u c k"); and common number-for-letter swaps in Latin words ("sh1t").

create table if not exists public.blocked_words (
  id uuid primary key default gen_random_uuid(),
  term text not null,                    -- as the admin typed it
  norm text not null unique,             -- as it is compared
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null
);
alter table public.blocked_words enable row level security;
revoke all on public.blocked_words from anon, authenticated;

/** Text reduced to lower-case words separated by single spaces. Character ranges are explicit so the server's locale does not matter. */
create or replace function public.filter_words(p_text text) returns text
language plpgsql immutable set search_path = public as $$
declare t text; w text; out text[] := '{}'; run text := '';
begin
  t := lower(normalize(coalesce(p_text, ''), nfkc));
  -- invisible characters, Arabic tatweel, vowel and Quranic marks
  t := regexp_replace(t, '[­͏؜᠎​-‏‪-‮⁠-⁤﻿ـً-ٰٟۖ-ۭ]', '', 'g');
  t := translate(t, U&'\0623\0625\0622\0671\0649\0629\06CC\06A9', U&'\0627\0627\0627\0627\064A\0647\064A\0643');
  t := btrim(regexp_replace(t, '[^a-z0-9@$à-öø-ɏء-يٱ-ۓ]+', ' ', 'g'));
  if t = '' then return ''; end if;
  -- join letters written one by one: "f u c k" -> "fuck" (three or more single characters in a row)
  foreach w in array string_to_array(t, ' ') || array[''] loop
    if char_length(w) = 1 then run := run || w;
    else
      if char_length(run) >= 3 then out := out || run;
      elsif run <> '' then out := out || regexp_split_to_array(run, ''); end if;
      run := '';
      if w <> '' then out := out || w; end if;
    end if;
  end loop;
  return array_to_string(out, ' ');
end $$;

/** Does this text contain a blocked word or phrase? */
create or replace function public.text_is_blocked(p_text text) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare base text; leet text; hay text;
begin
  base := public.filter_words(p_text);
  if base = '' then return false; end if;
  -- number and symbol swaps, only inside words that also have Latin letters (so prices and dates are left alone)
  select string_agg(case when w ~ '[a-z]' then translate(w, '013457@$', 'oieastas') else w end, ' ' order by i)
    into leet from unnest(string_to_array(base, ' ')) with ordinality as u(w, i);
  -- stretched letters: three or more of the same character become one, or two ("asssshole" -> "asshole")
  hay := ' ' || base || ' | ' || leet
      || ' | ' || regexp_replace(base, '(.)\1{2,}', '\1', 'g') || ' | ' || regexp_replace(base, '(.)\1{2,}', '\1\1', 'g')
      || ' | ' || regexp_replace(leet, '(.)\1{2,}', '\1', 'g') || ' | ' || regexp_replace(leet, '(.)\1{2,}', '\1\1', 'g') || ' ';
  return exists (
    select 1 from public.blocked_words b
    where position(' ' || b.norm || ' ' in hay) > 0
       -- Arabic joins "and", "so" and "the" to the next word
       or (b.norm ~ '[ء-ي]' and (position(' و' || b.norm || ' ' in hay) > 0 or position(' ف' || b.norm || ' ' in hay) > 0
                                         or position(' ال' || b.norm || ' ' in hay) > 0 or position(' وال' || b.norm || ' ' in hay) > 0)));
end $$;

-- The check sits on the table, so every way of saving a message passes through it (send_message, send_attachment, and anything later).
create or replace function public.chat_word_filter() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(new.kind, 'text') <> 'call' and public.text_is_blocked(new.body) then
    raise exception 'message refused by the word filter' using errcode = 'ML004';
  end if;
  return new;
end $$;
drop trigger if exists chat_word_filter on public.chat_messages;
create trigger chat_word_filter before insert on public.chat_messages for each row execute function public.chat_word_filter();

-- ------------------------------------------------------------------ admins manage the list
create or replace function public.admin_list_blocked_words()
returns table (id uuid, term text, created_at timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  return query select b.id, b.term, b.created_at from public.blocked_words b order by b.created_at desc, b.term limit 2000;
end $$;

create or replace function public.admin_add_blocked_word(p_word text) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_term text := btrim(coalesce(p_word, '')); v_norm text; v_id uuid;
begin
  if not public.is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  v_norm := public.filter_words(v_term);
  -- a single character would block nearly everything
  if char_length(v_term) > 60 or char_length(v_norm) < 2 then raise exception 'a word or short phrase of 2 to 60 characters' using errcode = '22023'; end if;
  insert into public.blocked_words (term, norm, created_by) values (v_term, v_norm, auth.uid())
    on conflict (norm) do update set term = excluded.term returning blocked_words.id into v_id;
  return v_id;
end $$;

create or replace function public.admin_remove_blocked_word(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  delete from public.blocked_words where id = p_id;
  if not found then raise exception 'not found' using errcode = 'P0002'; end if;
end $$;

revoke all on function public.filter_words(text), public.text_is_blocked(text), public.chat_word_filter(),
  public.admin_list_blocked_words(), public.admin_add_blocked_word(text), public.admin_remove_blocked_word(uuid) from public, anon, authenticated;
grant execute on function public.admin_list_blocked_words(), public.admin_add_blocked_word(text), public.admin_remove_blocked_word(uuid) to authenticated;

-- ------------------------------------------------------------------ starter list (only into an empty table)
-- Deliberately short and unambiguous: strong profanity, sexual insults, slurs and direct threats in English, Arabic, Indonesian,
-- Tagalog, German, French and Spanish. Left out on purpose: words that are also normal vocabulary in a language course (animal
-- names; French "retard" = late; German "dick" = fat; Arabic "خول"), and single words a learner needs to REPORT abuse.
insert into public.blocked_words (term, norm)
select w, public.filter_words(w) from unnest(array[
  'fuck','fucking','fucker','fucked','motherfucker','shit','bullshit','bitch','asshole','bastard','cunt','dickhead','pussy','whore','slut','wanker',
  'nigger','nigga','faggot','retarded','porn','send nudes','kill yourself','kys','go die','i will kill you','i will rape you',
  'شرموطة','شرموط','قحبة','عاهرة','متناك','متناكة','منيوك','معرص','طيزك','كسمك','كس امك','كس اختك','انيك امك','ابن الشرموطة','ابن القحبة','ابن العاهرة',
  'هقتلك','سأقتلك','راح اقتلك','اقتل نفسك','موت نفسك',
  'kontol','memek','ngentot','ngewe','jancok','jancuk','bangsat','bajingan','pepek','lonte','kubunuh kamu','aku akan membunuhmu','mati aja lo',
  'putangina','putang ina','tangina','gago','tarantado','kantot',
  'arschloch','hurensohn','fotze','wichser',
  'connard','connasse','salope','enculé','fils de pute',
  'puta','hijo de puta','pendejo','cabrón','maricón'
]) as w
where not exists (select 1 from public.blocked_words)
on conflict (norm) do nothing;
