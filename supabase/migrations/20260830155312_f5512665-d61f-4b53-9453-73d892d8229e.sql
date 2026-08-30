ALTER TABLE public.event_resources
  ADD COLUMN IF NOT EXISTS minutes integer,
  ADD COLUMN IF NOT EXISTS note text,
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;