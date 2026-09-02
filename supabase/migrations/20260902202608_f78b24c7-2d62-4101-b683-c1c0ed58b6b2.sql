ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS guardian1_name text,
  ADD COLUMN IF NOT EXISTS guardian1_phone text,
  ADD COLUMN IF NOT EXISTS guardian1_email text,
  ADD COLUMN IF NOT EXISTS guardian2_name text,
  ADD COLUMN IF NOT EXISTS guardian2_phone text,
  ADD COLUMN IF NOT EXISTS guardian2_email text,
  ADD COLUMN IF NOT EXISTS has_allergy boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS allergy_note text;