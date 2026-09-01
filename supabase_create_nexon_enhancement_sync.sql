-- Per-user NEXON Open API connection and Starforce expense synchronization.
-- encrypted_api_key is AES-256-GCM ciphertext created by the application server.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.nexon_api_connections (
  user_id UUID PRIMARY KEY,
  encrypted_api_key TEXT NOT NULL,
  api_key_last4 TEXT NOT NULL,
  nexon_ouid TEXT NOT NULL,
  starforce_discount_rate INTEGER NOT NULL DEFAULT 0
    CHECK (starforce_discount_rate IN (0, 3, 5, 10, 15)),
  connected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.nexon_enhancement_sync_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  history_type TEXT NOT NULL DEFAULT 'starforce',
  nexon_history_id TEXT NOT NULL,
  expense_id UUID,
  occurred_at TIMESTAMPTZ NOT NULL,
  character_name TEXT NOT NULL,
  world_name TEXT,
  target_item TEXT NOT NULL,
  item_level INTEGER,
  before_starforce INTEGER,
  after_starforce INTEGER,
  result TEXT,
  calculated_amount BIGINT NOT NULL DEFAULT 0,
  calculation_status TEXT NOT NULL DEFAULT 'calculated',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, history_type, nexon_history_id)
);

CREATE INDEX IF NOT EXISTS idx_nexon_enhancement_sync_records_user
  ON public.nexon_enhancement_sync_records(user_id);
CREATE INDEX IF NOT EXISTS idx_nexon_enhancement_sync_records_expense
  ON public.nexon_enhancement_sync_records(expense_id);
CREATE INDEX IF NOT EXISTS idx_nexon_enhancement_sync_records_occurred
  ON public.nexon_enhancement_sync_records(occurred_at);

ALTER TABLE public.nexon_api_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nexon_enhancement_sync_records ENABLE ROW LEVEL SECURITY;

-- These tables are intentionally server-only. API routes use the service role and
-- always scope reads/writes with the authenticated NextAuth user id.

NOTIFY pgrst, 'reload schema';
