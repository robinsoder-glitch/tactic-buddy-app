ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS game_format text;
ALTER TABLE public.teams DROP CONSTRAINT IF EXISTS teams_game_format_check;
ALTER TABLE public.teams ADD CONSTRAINT teams_game_format_check CHECK (game_format IS NULL OR game_format IN ('5v5','7v7','9v9','11v11'));