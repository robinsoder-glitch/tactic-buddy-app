ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS account_kind text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_account_kind_check'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_account_kind_check
      CHECK (account_kind IS NULL OR account_kind IN ('coach', 'player', 'guardian'));
  END IF;
END $$;

UPDATE public.profiles p
SET account_kind = 'coach'
WHERE p.account_kind IS NULL
  AND EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = p.id AND r.role = 'coach');

UPDATE public.profiles p
SET account_kind = 'player'
WHERE p.account_kind IS NULL
  AND EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = p.id AND r.role = 'player');