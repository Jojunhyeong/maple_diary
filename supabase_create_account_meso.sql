-- One account-wide in-game meso balance per user.
-- Run this migration after the records, expenses, gathering_revenues, and
-- boss_revenues tables exist so every ledger trigger is installed.

create table if not exists public.account_meso (
  user_id uuid primary key,
  amount bigint not null default 0 check (amount >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- The balance is a Maple Diary ledger value. It may temporarily become negative
-- when recorded spending exceeds the manually supplied starting balance.
alter table public.account_meso
  drop constraint if exists account_meso_amount_check;

create extension if not exists pgcrypto;

create table if not exists public.account_meso_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  amount_before bigint not null,
  amount_after bigint not null,
  delta bigint not null,
  entry_type text not null,
  source_id text,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists idx_account_meso_history_user_created_at
  on public.account_meso_history (user_id, created_at desc);

alter table public.account_meso_history enable row level security;

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

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'account_meso_history' and policyname = 'account_meso_history_select_own'
  ) then
    create policy account_meso_history_select_own on public.account_meso_history
      for select using (auth.uid() = user_id);
  end if;
end $$;

create or replace function public.set_account_meso_balance(
  p_user_id uuid,
  p_amount bigint,
  p_note text default null
)
returns table(amount bigint, updated_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  previous_amount bigint;
  next_updated_at timestamptz := now();
  history_type text;
begin
  if p_amount < 0 then
    raise exception 'Balance must be zero or greater';
  end if;

  select am.amount into previous_amount
  from public.account_meso am
  where am.user_id = p_user_id
  for update;

  if not found then
    previous_amount := 0;
    history_type := 'initial_balance';
    insert into public.account_meso (user_id, amount, created_at, updated_at)
    values (p_user_id, p_amount, next_updated_at, next_updated_at);
  else
    history_type := 'manual_adjustment';
    update public.account_meso am
    set amount = p_amount, updated_at = next_updated_at
    where am.user_id = p_user_id;
  end if;

  if history_type = 'initial_balance' or p_amount <> previous_amount then
    insert into public.account_meso_history (
      user_id, amount_before, amount_after, delta, entry_type, note, created_at
    ) values (
      p_user_id,
      previous_amount,
      p_amount,
      p_amount - previous_amount,
      history_type,
      nullif(trim(p_note), ''),
      next_updated_at
    );
  end if;

  return query select p_amount, next_updated_at;
end;
$$;

revoke all on function public.set_account_meso_balance(uuid, bigint, text) from public, anon, authenticated;
grant execute on function public.set_account_meso_balance(uuid, bigint, text) to service_role;

create or replace function public.apply_account_meso_delta(
  p_user_id uuid,
  p_delta bigint,
  p_entry_type text,
  p_source_id text default null,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  previous_amount bigint;
  next_amount bigint;
  changed_at timestamptz := now();
begin
  if p_delta = 0 then return; end if;

  select am.amount into previous_amount
  from public.account_meso am
  where am.user_id = p_user_id
  for update;

  -- Records created before the user establishes an initial balance are not
  -- retroactively counted.
  if not found then return; end if;

  next_amount := previous_amount + p_delta;
  update public.account_meso am
  set amount = next_amount, updated_at = changed_at
  where am.user_id = p_user_id;

  insert into public.account_meso_history (
    user_id, amount_before, amount_after, delta, entry_type, source_id, note, created_at
  ) values (
    p_user_id, previous_amount, next_amount, p_delta,
    p_entry_type, p_source_id, p_note, changed_at
  );
end;
$$;

revoke all on function public.apply_account_meso_delta(uuid, bigint, text, text, text) from public, anon, authenticated;
grant execute on function public.apply_account_meso_delta(uuid, bigint, text, text, text) to service_role;

create or replace function public.track_record_meso_balance()
returns trigger language plpgsql security definer set search_path = public as $$
declare delta_amount bigint; owner_id uuid; source_key text;
begin
  delta_amount := case tg_op
    when 'INSERT' then coalesce(new.net_revenue, 0)
    when 'UPDATE' then coalesce(new.net_revenue, 0) - coalesce(old.net_revenue, 0)
    else -coalesce(old.net_revenue, 0)
  end;
  owner_id := case when tg_op = 'DELETE' then old.user_id else new.user_id end;
  source_key := case when tg_op = 'DELETE' then old.id::text else new.id::text end;
  perform public.apply_account_meso_delta(
    owner_id, delta_amount, 'hunting', source_key,
    case tg_op when 'DELETE' then '사냥 기록 삭제' when 'UPDATE' then '사냥 기록 수정' else '사냥 기록' end
  );
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create or replace function public.track_expense_meso_balance()
returns trigger language plpgsql security definer set search_path = public as $$
declare old_delta bigint := 0; new_delta bigint := 0; owner_id uuid; source_key text;
begin
  if tg_op <> 'INSERT' and coalesce(old.category, '') <> '메포' then old_delta := -coalesce(old.amount, 0); end if;
  if tg_op <> 'DELETE' and coalesce(new.category, '') <> '메포' then new_delta := -coalesce(new.amount, 0); end if;
  owner_id := case when tg_op = 'DELETE' then old.user_id else new.user_id end;
  source_key := case when tg_op = 'DELETE' then old.id::text else new.id::text end;
  perform public.apply_account_meso_delta(
    owner_id, new_delta - old_delta, 'expense', source_key,
    case tg_op when 'DELETE' then '지출 기록 삭제' when 'UPDATE' then '지출 기록 수정' else '지출 기록' end
  );
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create or replace function public.track_gathering_meso_balance()
returns trigger language plpgsql security definer set search_path = public as $$
declare delta_amount bigint; owner_id uuid; source_key text;
begin
  delta_amount := case tg_op
    when 'INSERT' then coalesce(new.total_amount, 0)
    when 'UPDATE' then coalesce(new.total_amount, 0) - coalesce(old.total_amount, 0)
    else -coalesce(old.total_amount, 0)
  end;
  owner_id := case when tg_op = 'DELETE' then old.user_id else new.user_id end;
  source_key := case when tg_op = 'DELETE' then old.id::text else new.id::text end;
  perform public.apply_account_meso_delta(
    owner_id, delta_amount, 'gathering', source_key,
    case tg_op when 'DELETE' then '채집 기록 삭제' when 'UPDATE' then '채집 기록 수정' else '채집 기록' end
  );
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create or replace function public.track_boss_meso_balance()
returns trigger language plpgsql security definer set search_path = public as $$
declare delta_amount bigint; owner_id uuid; source_key text;
begin
  delta_amount := case tg_op
    when 'INSERT' then coalesce(new.total_revenue, 0)
    when 'UPDATE' then coalesce(new.total_revenue, 0) - coalesce(old.total_revenue, 0)
    else -coalesce(old.total_revenue, 0)
  end;
  owner_id := case when tg_op = 'DELETE' then old.user_id else new.user_id end;
  source_key := case when tg_op = 'DELETE' then old.id::text else new.id::text end;
  perform public.apply_account_meso_delta(
    owner_id, delta_amount, 'boss', source_key,
    case tg_op when 'DELETE' then '보스 기록 삭제' when 'UPDATE' then '보스 기록 수정' else '보스 기록' end
  );
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

do $$
begin
  if to_regclass('public.records') is not null then
    execute 'drop trigger if exists track_record_meso_balance on public.records';
    execute 'create trigger track_record_meso_balance after insert or update or delete on public.records for each row execute function public.track_record_meso_balance()';
  end if;
  if to_regclass('public.expenses') is not null then
    execute 'drop trigger if exists track_expense_meso_balance on public.expenses';
    execute 'create trigger track_expense_meso_balance after insert or update or delete on public.expenses for each row execute function public.track_expense_meso_balance()';
  end if;
  if to_regclass('public.gathering_revenues') is not null then
    execute 'drop trigger if exists track_gathering_meso_balance on public.gathering_revenues';
    execute 'create trigger track_gathering_meso_balance after insert or update or delete on public.gathering_revenues for each row execute function public.track_gathering_meso_balance()';
  end if;
  if to_regclass('public.boss_revenues') is not null then
    execute 'drop trigger if exists track_boss_meso_balance on public.boss_revenues';
    execute 'create trigger track_boss_meso_balance after insert or update or delete on public.boss_revenues for each row execute function public.track_boss_meso_balance()';
  end if;
end $$;

notify pgrst, 'reload schema';
