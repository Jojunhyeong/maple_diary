CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.boss_revenues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  character_id UUID,
  cycle_type TEXT NOT NULL DEFAULT 'weekly',
  week_key TEXT NOT NULL,
  state JSONB NOT NULL DEFAULT '{}'::jsonb,
  total_revenue BIGINT NOT NULL DEFAULT 0,
  selected_bosses INTEGER NOT NULL DEFAULT 0,
  selected_clears INTEGER NOT NULL DEFAULT 0,
  by_category JSONB NOT NULL DEFAULT '{"general":0,"subboss":0,"grandis":0}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.boss_revenues
  ADD COLUMN IF NOT EXISTS character_id UUID,
  ADD COLUMN IF NOT EXISTS cycle_type TEXT NOT NULL DEFAULT 'weekly';

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'set_boss_revenues_updated_at'
      AND tgrelid = 'public.boss_revenues'::regclass
  ) THEN
    CREATE TRIGGER set_boss_revenues_updated_at
    BEFORE UPDATE ON public.boss_revenues
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;

DROP INDEX IF EXISTS idx_boss_revenues_user_week;
DROP INDEX IF EXISTS idx_boss_revenues_user_cycle_week;

CREATE UNIQUE INDEX IF NOT EXISTS idx_boss_revenues_user_cycle_week
  ON public.boss_revenues(user_id, character_id, cycle_type, week_key);

CREATE INDEX IF NOT EXISTS idx_boss_revenues_user_id
  ON public.boss_revenues(user_id);

CREATE INDEX IF NOT EXISTS idx_boss_revenues_character_id
  ON public.boss_revenues(character_id);

CREATE INDEX IF NOT EXISTS idx_boss_revenues_cycle_week_key
  ON public.boss_revenues(week_key);

CREATE INDEX IF NOT EXISTS idx_boss_revenues_cycle_type
  ON public.boss_revenues(cycle_type);

ALTER TABLE public.boss_revenues ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'boss_revenues' AND policyname = 'boss_revenues_select_own'
  ) THEN
    CREATE POLICY boss_revenues_select_own ON public.boss_revenues
      FOR SELECT USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'boss_revenues' AND policyname = 'boss_revenues_insert_own'
  ) THEN
    CREATE POLICY boss_revenues_insert_own ON public.boss_revenues
      FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'boss_revenues' AND policyname = 'boss_revenues_update_own'
  ) THEN
    CREATE POLICY boss_revenues_update_own ON public.boss_revenues
      FOR UPDATE USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'boss_revenues' AND policyname = 'boss_revenues_delete_own'
  ) THEN
    CREATE POLICY boss_revenues_delete_own ON public.boss_revenues
      FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
