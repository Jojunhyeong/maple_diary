ALTER TABLE public.records
ADD COLUMN IF NOT EXISTS character_id UUID;

CREATE INDEX IF NOT EXISTS idx_records_character_id
  ON public.records(character_id);

NOTIFY pgrst, 'reload schema';
