CREATE TABLE public.tb_collections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 80),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX tb_collections_user_name_key
  ON public.tb_collections (user_id, lower(btrim(name)));

CREATE TABLE public.tb_collection_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id uuid NOT NULL REFERENCES public.tb_collections(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('tactic','goalkeeper','drill','session','article')),
  resource_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (collection_id, kind, resource_id)
);

CREATE INDEX tb_collection_items_collection_idx ON public.tb_collection_items (collection_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tb_collections TO authenticated;
GRANT ALL ON public.tb_collections TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tb_collection_items TO authenticated;
GRANT ALL ON public.tb_collection_items TO service_role;

ALTER TABLE public.tb_collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tb_collection_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own collections" ON public.tb_collections
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "own collection items" ON public.tb_collection_items
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.tb_collections c
      WHERE c.id = collection_id AND c.user_id = auth.uid()
    )
  );