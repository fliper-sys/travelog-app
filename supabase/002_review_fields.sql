-- TRADELOG update 2: review workflow, timeframe, R multiple and account settings.
-- Run once in the Supabase SQL Editor AFTER schema.sql.
-- Safe to run again: every step checks whether it already exists.

-- 1. New columns on trades
alter table public.trades
  add column if not exists timeframe text,
  add column if not exists r_multiple numeric(8, 2),
  add column if not exists review_status text not null default 'pending'
    check (review_status in ('pending', 'reviewed')),
  add column if not exists adherence text
    check (adherence is null or adherence in ('Yes', 'Partially', 'No')),
  add column if not exists emotion text
    check (emotion is null or emotion in
      ('Calm', 'Confident', 'Fearful', 'Greedy', 'Frustrated')),
  add column if not exists confidence smallint
    check (confidence is null or confidence between 1 and 5),
  add column if not exists mistake text,
  add column if not exists lesson text,
  add column if not exists reviewed_at timestamptz;

create index if not exists trades_user_review_idx
  on public.trades (user_id, review_status);

-- 2. Per-user settings (starting balance for return % on the equity curve)
create table if not exists public.user_settings (
  user_id uuid primary key
    default auth.uid()
    references auth.users(id) on delete cascade,
  starting_balance numeric(14, 2) not null default 10000
    check (starting_balance > 0),
  updated_at timestamptz not null default now()
);

alter table public.user_settings enable row level security;

revoke all on table public.user_settings from anon, authenticated;
grant select, insert, update on public.user_settings to authenticated;

drop policy if exists "Users can read their own settings" on public.user_settings;
create policy "Users can read their own settings"
  on public.user_settings
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert their own settings" on public.user_settings;
create policy "Users can insert their own settings"
  on public.user_settings
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own settings" on public.user_settings;
create policy "Users can update their own settings"
  on public.user_settings
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- 3. Keep updated_at current (function is created in schema.sql)
drop trigger if exists user_settings_set_updated_at on public.user_settings;
create trigger user_settings_set_updated_at
  before update on public.user_settings
  for each row execute function public.set_updated_at();
