import { supabase } from "@/integrations/supabase/client";

/** Innehållstyper som kan kopplas ihop mellan bankerna. */
export const LINK_TYPES = ["article", "tactic", "drill", "goalkeeper", "session"] as const;
export type LinkType = (typeof LINK_TYPES)[number];

export const LINK_TYPE_LABELS: Record<LinkType, string> = {
  article: "Kunskapsartikel",
  tactic: "Taktikkort",
  drill: "Övning",
  goalkeeper: "Målvaktsövning",
  session: "Träningspass",
};

export type ContentLink = {
  id: string;
  source_type: LinkType;
  source_id: string;
  target_type: LinkType;
  target_id: string;
  note: string | null;
  sort_order: number;
};

export type ContentLinkInput = {
  source_type: LinkType;
  source_id: string;
  target_type: LinkType;
  target_id: string;
  note?: string | null;
  sort_order?: number;
};

const COLUMNS = "id, source_type, source_id, target_type, target_id, note, sort_order";

export async function fetchContentLinks(): Promise<ContentLink[]> {
  const { data, error } = await supabase.from("content_links").select(COLUMNS).order("sort_order");
  if (error) throw error;
  return (data ?? []) as unknown as ContentLink[];
}

export async function createContentLink(input: ContentLinkInput, userId: string) {
  const { error } = await supabase.from("content_links").insert({
    source_type: input.source_type,
    source_id: input.source_id,
    target_type: input.target_type,
    target_id: input.target_id,
    note: input.note?.trim() || null,
    sort_order: input.sort_order ?? 0,
    created_by: userId,
  });
  if (error) {
    if (error.code === "23505") throw new Error("Relationen finns redan.");
    throw error;
  }
}

export async function updateContentLink(id: string, patch: { note?: string | null; sort_order?: number }) {
  const { error } = await supabase.from("content_links").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteContentLink(id: string) {
  const { error } = await supabase.from("content_links").delete().eq("id", id);
  if (error) throw error;
}

/* ---------- rena hjälpfunktioner ---------- */

/** Nyckel som gör en relation unik – samma regel som i databasen. */
export function linkKey(link: {
  source_type: string;
  source_id: string;
  target_type: string;
  target_id: string;
}): string {
  return `${link.source_type}:${link.source_id}->${link.target_type}:${link.target_id}`;
}

/** Sant om relationen redan finns i listan. */
export function isDuplicateLink(links: ContentLink[], candidate: ContentLinkInput): boolean {
  const key = linkKey(candidate);
  return links.some((link) => linkKey(link) === key);
}

export type CatalogEntry = { type: LinkType; id: string; title: string };

/** Slår ihop bankernas titlar till en uppslagstabell. */
export function buildCatalog(entries: CatalogEntry[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const entry of entries) map.set(`${entry.type}:${entry.id}`, entry.title);
  return map;
}

export type RelatedItem = {
  type: LinkType;
  id: string;
  title: string;
  note: string | null;
  sortOrder: number;
};

/**
 * Hämtar relaterat innehåll för ett objekt. Relationer läses åt båda hållen så att
 * en artikel som pekar på ett taktikkort också syns från taktikkortet.
 */
export function relatedItems(
  links: ContentLink[],
  self: { type: LinkType; id: string },
  targetTypes: LinkType[],
  catalog: Map<string, string>,
): RelatedItem[] {
  const items: RelatedItem[] = [];
  const seen = new Set<string>();
  for (const link of links) {
    let type: LinkType | null = null;
    let id = "";
    if (link.source_type === self.type && link.source_id === self.id) {
      type = link.target_type;
      id = link.target_id;
    } else if (link.target_type === self.type && link.target_id === self.id) {
      type = link.source_type;
      id = link.source_id;
    }
    if (!type || !targetTypes.includes(type)) continue;
    const key = `${type}:${id}`;
    if (seen.has(key)) continue;
    const title = catalog.get(key);
    if (!title) continue;
    seen.add(key);
    items.push({ type, id, title, note: link.note, sortOrder: link.sort_order });
  }
  return items.sort((a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title, "sv"));
}

export type RelatedSection = { title: string; items: RelatedItem[] };

/** Bygger avsnitt och tar bort dem som saknar innehåll. */
export function relatedSections(
  links: ContentLink[],
  self: { type: LinkType; id: string },
  spec: { title: string; types: LinkType[] }[],
  catalog: Map<string, string>,
): RelatedSection[] {
  return spec
    .map((section) => ({ title: section.title, items: relatedItems(links, self, section.types, catalog) }))
    .filter((section) => section.items.length > 0);
}

export type LinkTarget =
  | { to: "/kunskapsbank/$slug"; params: { slug: string } }
  | { to: "/taktikbank/$cardId"; params: { cardId: string } }
  | { to: "/ovningsbank"; search: { flik: "ovningar" | "malvakt" | "pass"; markera: string } };

/** Vart en relation ska länka. */
export function linkTarget(item: { type: LinkType; id: string }): LinkTarget {
  switch (item.type) {
    case "article":
      return { to: "/kunskapsbank/$slug", params: { slug: item.id } };
    case "tactic":
      return { to: "/taktikbank/$cardId", params: { cardId: item.id } };
    case "goalkeeper":
      return { to: "/ovningsbank", search: { flik: "malvakt", markera: item.id } };
    case "session":
      return { to: "/ovningsbank", search: { flik: "pass", markera: item.id } };
    default:
      return { to: "/ovningsbank", search: { flik: "ovningar", markera: item.id } };
  }
}
