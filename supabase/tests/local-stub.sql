-- Minimal stand-in for the parts of Supabase the migrations rely on, so the permission tests can also run on a plain local Postgres.
-- (The real Supabase project is the source of truth; this only lets the tests run offline.)
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
end $$;
create schema if not exists auth;
create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(), aud text, role text, email text,
  raw_user_meta_data jsonb default '{}'::jsonb, created_at timestamptz default now(), last_sign_in_at timestamptz
);
create table if not exists auth.identities (id uuid primary key default gen_random_uuid(), user_id uuid references auth.users (id) on delete cascade, provider text);
create or replace function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth to anon, authenticated;
grant usage on schema public to anon, authenticated;

-- storage stand-in: just enough of Supabase Storage (buckets, objects with an owner and a creation time, foldername()) to test the policies
create schema if not exists storage;
create table if not exists storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
create table if not exists storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text, owner uuid default auth.uid(), created_at timestamptz default now());
alter table storage.objects enable row level security;
create or replace function storage.foldername(name text) returns text[] language sql immutable as $$ select (string_to_array(name, '/'))[1:greatest(array_length(string_to_array(name, '/'), 1) - 1, 0)] $$;
grant usage on schema storage to anon, authenticated;
grant select, insert, update, delete on storage.objects to authenticated;

-- pg_net stand-in: remember every call so the push tests can look at them. Set net.fail = '1' to make it raise.
create schema if not exists net;
create table if not exists net._calls (id serial primary key, url text, headers jsonb, body jsonb);
create or replace function net.http_post(url text, headers jsonb default '{}'::jsonb, body jsonb default '{}'::jsonb, timeout_milliseconds int default 5000) returns bigint
language plpgsql as $$ begin
  if current_setting('net.fail', true) = '1' then raise exception 'network down'; end if;
  insert into net._calls (url, headers, body) values (url, headers, body); return 1; end $$;
