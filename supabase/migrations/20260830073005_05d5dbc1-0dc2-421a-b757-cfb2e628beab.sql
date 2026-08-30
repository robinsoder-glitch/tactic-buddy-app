-- ROLES
CREATE TYPE public.app_role AS ENUM ('admin', 'coach', 'player');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

GRANT SELECT, INSERT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "read own roles" ON public.user_roles FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "self assign coach or player" ON public.user_roles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND role <> 'admin');

-- PROFILES
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS birth_date date,
  ADD COLUMN IF NOT EXISTS avatar_path text,
  ADD COLUMN IF NOT EXISTS is_adult_confirmed boolean NOT NULL DEFAULT false;

CREATE POLICY "admins read all profiles" ON public.profiles FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- CLUBS
CREATE TABLE public.clubs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  city text,
  logo_path text,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clubs TO authenticated;
GRANT ALL ON public.clubs TO service_role;
ALTER TABLE public.clubs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated read clubs" ON public.clubs FOR SELECT TO authenticated USING (true);
CREATE POLICY "coaches create clubs" ON public.clubs FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by AND public.has_role(auth.uid(), 'coach'));
CREATE POLICY "creator updates club" ON public.clubs FOR UPDATE TO authenticated
  USING (auth.uid() = created_by) WITH CHECK (auth.uid() = created_by);
CREATE POLICY "creator deletes club" ON public.clubs FOR DELETE TO authenticated
  USING (auth.uid() = created_by);
CREATE TRIGGER clubs_updated_at BEFORE UPDATE ON public.clubs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- TEAMS
CREATE TABLE public.teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid REFERENCES public.clubs(id) ON DELETE SET NULL,
  name text NOT NULL,
  age_group text,
  gender text NOT NULL DEFAULT 'mixed',
  photo_path text,
  about text,
  join_code text NOT NULL UNIQUE DEFAULT upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6)),
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.teams TO authenticated;
GRANT ALL ON public.teams TO service_role;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER teams_updated_at BEFORE UPDATE ON public.teams
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- TEAM MEMBERS
CREATE TABLE public.team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'player',
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (team_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.team_members TO authenticated;
GRANT ALL ON public.team_members TO service_role;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER team_members_updated_at BEFORE UPDATE ON public.team_members
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.is_team_coach(_team_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.team_members
    WHERE team_id = _team_id AND user_id = _user_id AND role = 'coach' AND status = 'approved'
  )
$$;

CREATE OR REPLACE FUNCTION public.is_team_member(_team_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.team_members
    WHERE team_id = _team_id AND user_id = _user_id AND status = 'approved'
  )
$$;

CREATE POLICY "teams visible to members and admins" ON public.teams FOR SELECT TO authenticated
  USING (
    auth.uid() = created_by
    OR public.is_team_member(id, auth.uid())
    OR EXISTS (SELECT 1 FROM public.team_members m WHERE m.team_id = teams.id AND m.user_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  );
CREATE POLICY "coaches create teams" ON public.teams FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by AND public.has_role(auth.uid(), 'coach'));
CREATE POLICY "coaches update teams" ON public.teams FOR UPDATE TO authenticated
  USING (auth.uid() = created_by OR public.is_team_coach(id, auth.uid()))
  WITH CHECK (auth.uid() = created_by OR public.is_team_coach(id, auth.uid()));
CREATE POLICY "creator deletes team" ON public.teams FOR DELETE TO authenticated
  USING (auth.uid() = created_by);

CREATE POLICY "members read team members" ON public.team_members FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_team_coach(team_id, auth.uid())
    OR public.is_team_member(team_id, auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  );
CREATE POLICY "join or coach adds member" ON public.team_members FOR INSERT TO authenticated
  WITH CHECK (
    (user_id = auth.uid() AND role = 'player' AND status = 'pending')
    OR (user_id = auth.uid() AND role = 'coach' AND status = 'approved'
        AND EXISTS (SELECT 1 FROM public.teams t WHERE t.id = team_id AND t.created_by = auth.uid()))
    OR public.is_team_coach(team_id, auth.uid())
  );
CREATE POLICY "coaches update members" ON public.team_members FOR UPDATE TO authenticated
  USING (public.is_team_coach(team_id, auth.uid()))
  WITH CHECK (public.is_team_coach(team_id, auth.uid()));
CREATE POLICY "coach or self deletes member" ON public.team_members FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.is_team_coach(team_id, auth.uid()));

-- TEAM LOOKUP BY JOIN CODE (avoids exposing all teams)
CREATE OR REPLACE FUNCTION public.find_team_by_code(_code text)
RETURNS TABLE (id uuid, name text, age_group text, club_name text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT t.id, t.name, t.age_group, c.name
  FROM public.teams t
  LEFT JOIN public.clubs c ON c.id = t.club_id
  WHERE t.join_code = upper(trim(_code))
$$;
REVOKE ALL ON FUNCTION public.find_team_by_code(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.find_team_by_code(text) TO authenticated;

-- PLAYERS
ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS team_id uuid REFERENCES public.teams(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS birth_date date,
  ADD COLUMN IF NOT EXISTS gender text,
  ADD COLUMN IF NOT EXISTS member_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE POLICY "team players readable by team" ON public.players FOR SELECT TO authenticated
  USING (
    team_id IS NOT NULL AND (
      public.is_team_member(team_id, auth.uid()) OR public.has_role(auth.uid(), 'admin')
    )
  );
CREATE POLICY "coaches manage team players" ON public.players FOR ALL TO authenticated
  USING (team_id IS NOT NULL AND public.is_team_coach(team_id, auth.uid()))
  WITH CHECK (team_id IS NOT NULL AND public.is_team_coach(team_id, auth.uid()));

-- EVENTS
CREATE TABLE public.events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT 'training',
  title text,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz,
  location text,
  notes text,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.events TO authenticated;
GRANT ALL ON public.events TO service_role;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER events_updated_at BEFORE UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE POLICY "team reads events" ON public.events FOR SELECT TO authenticated
  USING (public.is_team_member(team_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "coaches manage events" ON public.events FOR ALL TO authenticated
  USING (public.is_team_coach(team_id, auth.uid()))
  WITH CHECK (public.is_team_coach(team_id, auth.uid()));

-- TACTICS
ALTER TABLE public.tactics
  ADD COLUMN IF NOT EXISTS team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL;

-- STORAGE POLICIES FOR TEAM PHOTOS (existing private bucket player-photos)
CREATE POLICY "team members read player photos" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'player-photos');
