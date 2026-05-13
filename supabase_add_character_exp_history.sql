ALTER TABLE public.characters
  ADD COLUMN IF NOT EXISTS character_exp_history JSONB;

NOTIFY pgrst, 'reload schema';
