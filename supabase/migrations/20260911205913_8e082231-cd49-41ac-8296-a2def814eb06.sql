ALTER TABLE public.events ADD COLUMN IF NOT EXISTS match_status text;
ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_match_status_check;
ALTER TABLE public.events ADD CONSTRAINT events_match_status_check CHECK (match_status IS NULL OR match_status IN ('planerad','skickad','spelad'));