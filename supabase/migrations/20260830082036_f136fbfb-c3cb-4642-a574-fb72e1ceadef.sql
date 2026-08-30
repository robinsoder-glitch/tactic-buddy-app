ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS meet_at timestamptz,
  ADD COLUMN IF NOT EXISTS home_team text,
  ADD COLUMN IF NOT EXISTS away_team text,
  ADD COLUMN IF NOT EXISTS kit text,
  ADD COLUMN IF NOT EXISTS match_kind text,
  ADD COLUMN IF NOT EXISTS series_id uuid;