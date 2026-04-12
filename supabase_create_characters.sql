CREATE TABLE public.characters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  character_name VARCHAR(50) NOT NULL,
  character_ocid VARCHAR(255),
  class VARCHAR(50),
  level INT,
  image_url TEXT,
  character_world TEXT,
  character_exp_rate NUMERIC,
  character_combat_power BIGINT,

  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT valid_level CHECK (level >= 1 AND level <= 300)
);

CREATE INDEX idx_characters_user_id ON public.characters(user_id);
CREATE INDEX idx_characters_user_active ON public.characters(user_id, is_active);
CREATE INDEX idx_characters_user_ocid ON public.characters(user_id, character_ocid);

NOTIFY pgrst, 'reload schema';
