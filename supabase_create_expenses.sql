-- Expense ledger for bookkeeping-style spending records

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  local_owner_id text,
  user_id uuid,
  date text not null,
  title text not null,
  amount bigint not null default 0,
  category text,
  memo text,
  sync_status text not null default 'local',
  local_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_expenses_user_id on public.expenses (user_id);
create index if not exists idx_expenses_local_owner_id on public.expenses (local_owner_id);
create index if not exists idx_expenses_date on public.expenses (date);
create index if not exists idx_expenses_created_at on public.expenses (created_at);

notify pgrst, 'reload schema';
