-- Server-only candidate index refreshed weekly.
create table if not exists public.equipment_guide_characters (
  source_date date not null,
  ocid text not null,
  job text not null,
  power bigint not null check (power > 0),
  created_at timestamptz not null default now(),
  primary key (source_date, ocid)
);

create index if not exists idx_equipment_guide_characters_lookup
  on public.equipment_guide_characters (source_date, job, power);

alter table public.equipment_guide_characters enable row level security;
revoke all on public.equipment_guide_characters from anon, authenticated;
grant all on public.equipment_guide_characters to service_role;

-- Shared seven-day cache for on-demand equipment guide cohorts.
create table if not exists public.equipment_guide_cache (
  cache_key text primary key,
  job text not null,
  target_power bigint not null check (target_power > 0),
  source_date date not null,
  status text not null check (status in ('collecting', 'ready', 'failed')),
  dataset jsonb,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_equipment_guide_cache_expires_at
  on public.equipment_guide_cache (expires_at);

alter table public.equipment_guide_cache enable row level security;
revoke all on public.equipment_guide_cache from anon, authenticated;
grant all on public.equipment_guide_cache to service_role;

create or replace function public.claim_equipment_guide_cache(
  p_cache_key text,
  p_job text,
  p_target_power bigint,
  p_source_date date
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  affected integer;
begin
  insert into public.equipment_guide_cache (
    cache_key, job, target_power, source_date, status, dataset, expires_at, updated_at
  ) values (
    p_cache_key, p_job, p_target_power, p_source_date, 'collecting', null,
    now() + interval '7 days', now()
  )
  on conflict (cache_key) do update set
    job = excluded.job,
    target_power = excluded.target_power,
    source_date = excluded.source_date,
    status = 'collecting',
    dataset = null,
    expires_at = excluded.expires_at,
    updated_at = now()
  where equipment_guide_cache.expires_at <= now()
     or equipment_guide_cache.source_date <> excluded.source_date
     or equipment_guide_cache.status = 'failed'
     or (equipment_guide_cache.status = 'collecting' and equipment_guide_cache.updated_at < now() - interval '2 minutes');
  get diagnostics affected = row_count;
  return affected = 1;
end;
$$;

revoke all on function public.claim_equipment_guide_cache(text, text, bigint, date) from public, anon, authenticated;
grant execute on function public.claim_equipment_guide_cache(text, text, bigint, date) to service_role;
