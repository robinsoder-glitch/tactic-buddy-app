CREATE TABLE public.content_links (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  source_type text NOT NULL CHECK (source_type IN ('article','tactic','drill','goalkeeper','session')),
  source_id text NOT NULL,
  target_type text NOT NULL CHECK (target_type IN ('article','tactic','drill','goalkeeper','session')),
  target_id text NOT NULL,
  note text,
  sort_order integer NOT NULL DEFAULT 0,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT content_links_unique UNIQUE (source_type, source_id, target_type, target_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.content_links TO authenticated;
GRANT ALL ON public.content_links TO service_role;

ALTER TABLE public.content_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Inloggade kan lasa relationer"
  ON public.content_links FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin kan skapa relationer"
  ON public.content_links FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin kan andra relationer"
  ON public.content_links FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin kan ta bort relationer"
  ON public.content_links FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX content_links_source_idx ON public.content_links (source_type, source_id);
CREATE INDEX content_links_target_idx ON public.content_links (target_type, target_id);

CREATE TRIGGER content_links_updated_at
  BEFORE UPDATE ON public.content_links
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();