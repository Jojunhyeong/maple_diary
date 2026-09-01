-- One account-wide in-game meso balance per user.

create table if not exists public.account_meso (
  user_id uuid primary key,
  amount bigint not null default 0 check (amount >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.account_meso enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'account_meso' and policyname = 'account_meso_select_own'
  ) then
    create policy account_meso_select_own on public.account_meso
      for select using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'account_meso' and policyname = 'account_meso_insert_own'
  ) then
    create policy account_meso_insert_own on public.account_meso
      for insert with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'account_meso' and policyname = 'account_meso_update_own'
  ) then
    create policy account_meso_update_own on public.account_meso
      for update using (auth.uid() = user_id);
  end if;
end $$;

notify pgrst, 'reload schema';
