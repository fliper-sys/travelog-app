-- TRADELOG: first version of the trades table.
-- Run once in the Supabase SQL Editor for the TRADELOG project.
-- If it errors, read the error before running it again.

-- 1. Create the trades table
create table public.trades (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null
    default auth.uid()
    references auth.users(id) on delete cascade,
  pair text not null,
  direction text not null
    check (direction in ('Buy', 'Sell')),
  status text not null default 'closed'
    check (status in ('open', 'closed')),
  entry_price numeric(18, 8) not null
    check (entry_price > 0),
  exit_price numeric(18, 8)
    check (exit_price is null or exit_price > 0),
  stop_loss numeric(18, 8),
  take_profit numeric(18, 8),
  lot_size numeric(12, 4)
    check (lot_size is null or lot_size > 0),
  pnl numeric(14, 2),
  risk_amount numeric(14, 2)
    check (risk_amount is null or risk_amount >= 0),
  strategy text,
  notes text,
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. Enable Row Level Security
alter table public.trades enable row level security;

-- 3. Remove default client permissions, then grant authenticated CRUD
revoke all on table public.trades from anon, authenticated;
grant select, insert, update, delete
  on public.trades to authenticated;

-- 4. Users can read only their own trades
create policy "Users can read their own trades"
  on public.trades
  for select to authenticated
  using ((select auth.uid()) = user_id);

-- 5. Users can insert trades only for themselves
create policy "Users can insert their own trades"
  on public.trades
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

-- 6. Users can update only their own trades
create policy "Users can update their own trades"
  on public.trades
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- 7. Users can delete only their own trades
create policy "Users can delete their own trades"
  on public.trades
  for delete to authenticated
  using ((select auth.uid()) = user_id);

-- 8. Index for user-specific queries
create index trades_user_created_idx
  on public.trades (user_id, created_at desc);

-- 9. Optional addition: keep updated_at current on every update.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trades_set_updated_at
  before update on public.trades
  for each row execute function public.set_updated_at();
