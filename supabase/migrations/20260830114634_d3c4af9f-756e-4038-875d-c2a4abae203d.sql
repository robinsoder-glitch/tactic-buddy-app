CREATE TABLE IF NOT EXISTS public.knowledge_articles (
  id text PRIMARY KEY,
  slug text UNIQUE NOT NULL,
  title_sv text NOT NULL,
  title_original text,
  summary_sv text NOT NULL,
  learn_sv text,
  try_next_sv text,
  category text NOT NULL,
  age_label text,
  age_5_7 boolean NOT NULL DEFAULT false,
  age_8_9 boolean NOT NULL DEFAULT false,
  age_10 boolean NOT NULL DEFAULT false,
  game_format_label text,
  format_3v3 boolean NOT NULL DEFAULT false,
  format_5v5 boolean NOT NULL DEFAULT false,
  format_7v7 boolean NOT NULL DEFAULT false,
  level text,
  content_type text,
  language text,
  source_name text,
  source_type text,
  reading_minutes integer,
  coach_value text,
  evidence_level text,
  original_url text NOT NULL,
  checked_date date,
  is_published boolean NOT NULL DEFAULT true,
  featured boolean NOT NULL DEFAULT false,
  sort_order integer,
  copyright_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.knowledge_articles TO anon;
GRANT SELECT ON public.knowledge_articles TO authenticated;
GRANT ALL ON public.knowledge_articles TO service_role;

ALTER TABLE public.knowledge_articles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Publicerade artiklar kan läsas av alla" ON public.knowledge_articles;
CREATE POLICY "Publicerade artiklar kan läsas av alla"
  ON public.knowledge_articles FOR SELECT
  TO anon, authenticated
  USING (is_published = true);

DROP POLICY IF EXISTS "Admin kan läsa alla artiklar" ON public.knowledge_articles;
CREATE POLICY "Admin kan läsa alla artiklar"
  ON public.knowledge_articles FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admin kan skriva artiklar" ON public.knowledge_articles;
CREATE POLICY "Admin kan skriva artiklar"
  ON public.knowledge_articles FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS knowledge_articles_category_idx ON public.knowledge_articles (category);
CREATE INDEX IF NOT EXISTS knowledge_articles_level_idx ON public.knowledge_articles (level);
CREATE INDEX IF NOT EXISTS knowledge_articles_language_idx ON public.knowledge_articles (language);
CREATE INDEX IF NOT EXISTS knowledge_articles_source_idx ON public.knowledge_articles (source_name);
CREATE INDEX IF NOT EXISTS knowledge_articles_sort_idx ON public.knowledge_articles (sort_order);
CREATE INDEX IF NOT EXISTS knowledge_articles_published_idx ON public.knowledge_articles (is_published);
CREATE INDEX IF NOT EXISTS knowledge_articles_age_idx ON public.knowledge_articles (age_5_7, age_8_9, age_10);
CREATE INDEX IF NOT EXISTS knowledge_articles_format_idx ON public.knowledge_articles (format_3v3, format_5v5, format_7v7);

DROP TRIGGER IF EXISTS set_knowledge_articles_updated_at ON public.knowledge_articles;
CREATE TRIGGER set_knowledge_articles_updated_at
  BEFORE UPDATE ON public.knowledge_articles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();