alter table public.records
add column if not exists exp_gain_percent numeric not null default 0;
