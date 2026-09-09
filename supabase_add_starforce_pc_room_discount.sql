-- Add per-attempt calculation details required to toggle the Starforce PC room discount.

ALTER TABLE public.nexon_enhancement_sync_records
  ADD COLUMN IF NOT EXISTS base_amount BIGINT,
  ADD COLUMN IF NOT EXISTS event_discount_rate NUMERIC,
  ADD COLUMN IF NOT EXISTS personal_discount_rate NUMERIC,
  ADD COLUMN IF NOT EXISTS protection_surcharge BIGINT,
  ADD COLUMN IF NOT EXISTS pc_room_discount_applied BOOLEAN NOT NULL DEFAULT false;

NOTIFY pgrst, 'reload schema';
