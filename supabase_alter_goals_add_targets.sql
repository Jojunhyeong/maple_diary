-- Add multi-target support to goals
alter table public.goals
  add column if not exists targets jsonb not null default '[]'::jsonb;

-- Support legacy goal fields used by the UI
alter table public.goals
  add column if not exists time_goal_minutes int;

-- Persist the card order in the list view.
alter table public.goals
  add column if not exists position int not null default 0;

alter table public.goals
  alter column month drop not null;

-- Goals are no longer month-based.
update public.goals
  set month = null
  where month is not null;

drop index if exists idx_goals_user_month;
drop index if exists idx_goals_user_id;

create index if not exists idx_goals_user_position
  on public.goals (user_id, position);
