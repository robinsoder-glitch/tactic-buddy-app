ALTER TABLE public.tactics ADD COLUMN IF NOT EXISTS is_draft boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS tactics_user_draft_idx ON public.tactics (user_id, is_draft, updated_at DESC);