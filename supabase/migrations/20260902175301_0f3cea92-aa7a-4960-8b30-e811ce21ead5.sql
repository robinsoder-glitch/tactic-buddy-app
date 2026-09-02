DELETE FROM public.event_resources a USING public.event_resources b
WHERE a.ctid < b.ctid AND a.event_id = b.event_id AND a.kind = b.kind AND a.resource_id = b.resource_id;

CREATE UNIQUE INDEX IF NOT EXISTS event_resources_event_kind_resource_key
ON public.event_resources (event_id, kind, resource_id);