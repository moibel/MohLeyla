-- MohLeyla cloud sync schema. Run once in Supabase: Dashboard -> SQL Editor -> New query -> paste -> Run.
-- One row per learner. Row Level Security guarantees a signed-in user can only ever read/write/delete THEIR OWN row,
-- even though the public "anon" key ships in the web app.

create table if not exists public.progress (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  state      jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.progress enable row level security;

drop policy if exists "progress_select_own" on public.progress;
drop policy if exists "progress_insert_own" on public.progress;
drop policy if exists "progress_update_own" on public.progress;
drop policy if exists "progress_delete_own" on public.progress;

create policy "progress_select_own" on public.progress for select to authenticated using (auth.uid() = user_id);
create policy "progress_insert_own" on public.progress for insert to authenticated with check (auth.uid() = user_id);
create policy "progress_update_own" on public.progress for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "progress_delete_own" on public.progress for delete to authenticated using (auth.uid() = user_id);

-- Anonymous (not signed in) visitors get no access at all.
revoke all on public.progress from anon;
grant select, insert, update, delete on public.progress to authenticated;

-- Basic abuse guard: progress documents are small (a few KB); refuse anything above ~256 KB.
alter table public.progress drop constraint if exists progress_state_size;
alter table public.progress add constraint progress_state_size check (pg_column_size(state) < 262144);
