CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.gathering_revenues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  character_id UUID NOT NULL,
  date TEXT NOT NULL,
  item_tab TEXT NOT NULL,
  item_name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 0,
  unit_price BIGINT NOT NULL DEFAULT 0,
  total_amount BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.gathering_revenues
  ADD COLUMN IF NOT EXISTS character_id UUID,
  ADD COLUMN IF NOT EXISTS item_tab TEXT NOT NULL DEFAULT 'seed';

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
    WHERE tgname = 'set_gathering_revenues_updated_at'
      AND tgrelid = 'public.gathering_revenues'::regclass
  ) THEN
    CREATE TRIGGER set_gathering_revenues_updated_at
    BEFORE UPDATE ON public.gathering_revenues
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_gathering_revenues_user_id
  ON public.gathering_revenues(user_id);

CREATE INDEX IF NOT EXISTS idx_gathering_revenues_character_id
  ON public.gathering_revenues(character_id);

CREATE INDEX IF NOT EXISTS idx_gathering_revenues_date
  ON public.gathering_revenues(date);

CREATE INDEX IF NOT EXISTS idx_gathering_revenues_item_tab
  ON public.gathering_revenues(item_tab);

ALTER TABLE public.gathering_revenues ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'gathering_revenues' AND policyname = 'gathering_revenues_select_own'
  ) THEN
    CREATE POLICY gathering_revenues_select_own ON public.gathering_revenues
      FOR SELECT USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'gathering_revenues' AND policyname = 'gathering_revenues_insert_own'
  ) THEN
    CREATE POLICY gathering_revenues_insert_own ON public.gathering_revenues
      FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'gathering_revenues' AND policyname = 'gathering_revenues_update_own'
  ) THEN
    CREATE POLICY gathering_revenues_update_own ON public.gathering_revenues
      FOR UPDATE USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'gathering_revenues' AND policyname = 'gathering_revenues_delete_own'
  ) THEN
    CREATE POLICY gathering_revenues_delete_own ON public.gathering_revenues
      FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
