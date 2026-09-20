-- Correct the Korean Pirate equipment label without changing stable slugs or job_group values.
-- This migration is safe to run more than once.

begin;

update public.equipment_catalog
set
  name = replace(name, '파이럿', '파이렛'),
  updated_at = now()
where name like '%파이럿%';

-- Keep equipment goals created before the catalog correction consistent as well.
update public.goals
set
  targets = replace(targets::text, '파이럿', '파이렛')::jsonb,
  updated_at = now()
where targets::text like '%파이럿%';

commit;

-- The result should contain corrected names only.
select slug, name
from public.equipment_catalog
where name like '%파이렛%'
order by level desc nulls last, name;
