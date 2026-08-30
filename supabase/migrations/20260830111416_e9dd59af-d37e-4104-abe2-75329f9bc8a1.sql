CREATE TABLE public.kb_articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  summary text,
  coach_value text,
  category text NOT NULL,
  age_min integer,
  age_max integer,
  level text NOT NULL DEFAULT 'basic',
  source_name text,
  source_url text,
  published_at date,
  reviewed_at date,
  tags text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'unverified',
  is_published boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT kb_articles_level_check CHECK (level IN ('basic','intermediate','advanced')),
  CONSTRAINT kb_articles_status_check CHECK (status IN ('verified','needs_check','unverified'))
);

GRANT SELECT ON public.kb_articles TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.kb_articles TO authenticated;
GRANT ALL ON public.kb_articles TO service_role;

ALTER TABLE public.kb_articles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Alla inloggade kan lasa publicerade verifierade artiklar"
ON public.kb_articles FOR SELECT TO authenticated
USING ((is_published AND status = 'verified') OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin kan skapa artiklar"
ON public.kb_articles FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin kan andra artiklar"
ON public.kb_articles FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin kan radera artiklar"
ON public.kb_articles FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER kb_articles_set_updated_at
BEFORE UPDATE ON public.kb_articles
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX kb_articles_category_idx ON public.kb_articles (category);