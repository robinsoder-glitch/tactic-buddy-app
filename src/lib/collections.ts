import { supabase } from "@/integrations/supabase/client";
import type { FavoriteKind } from "./taktikbank";

export type Collection = { id: string; name: string; created_at: string };
export type CollectionItem = {
  id: string;
  collection_id: string;
  kind: FavoriteKind;
  resource_id: string;
};

/** Namnet som visas och jämförs – trimmat, aldrig tomt. */
export function cleanName(name: string): string {
  return name.trim().replace(/\s+/g, " ").slice(0, 80);
}

/** Finns namnet redan? Jämförs utan hänsyn till versaler. */
export function nameTaken(collections: Collection[], name: string): boolean {
  const key = cleanName(name).toLocaleLowerCase("sv-SE");
  return collections.some((c) => cleanName(c.name).toLocaleLowerCase("sv-SE") === key);
}

export async function fetchCollections(): Promise<Collection[]> {
  const { data, error } = await supabase
    .from("tb_collections")
    .select("id, name, created_at")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Collection[];
}

export async function fetchCollectionItems(): Promise<CollectionItem[]> {
  const { data, error } = await supabase
    .from("tb_collection_items")
    .select("id, collection_id, kind, resource_id");
  if (error) throw error;
  return (data ?? []) as CollectionItem[];
}

export async function createCollection(name: string): Promise<Collection> {
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) throw new Error("Du behöver vara inloggad för att skapa en samling.");
  const clean = cleanName(name);
  if (!clean) throw new Error("Ge samlingen ett namn.");
  const { data, error } = await supabase
    .from("tb_collections")
    .insert({ user_id: userId, name: clean })
    .select("id, name, created_at")
    .single();
  if (error) {
    if (error.code === "23505") throw new Error("Du har redan en samling med det namnet.");
    throw error;
  }
  return data as Collection;
}

export async function renameCollection(id: string, name: string) {
  const clean = cleanName(name);
  if (!clean) throw new Error("Ge samlingen ett namn.");
  const { error } = await supabase.from("tb_collections").update({ name: clean }).eq("id", id);
  if (error) {
    if (error.code === "23505") throw new Error("Du har redan en samling med det namnet.");
    throw error;
  }
}

export async function deleteCollection(id: string) {
  const { error } = await supabase.from("tb_collections").delete().eq("id", id);
  if (error) throw error;
}

export async function addToCollection(
  collectionId: string,
  kind: FavoriteKind,
  resourceId: string,
) {
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) throw new Error("Du behöver vara inloggad.");
  const { error } = await supabase
    .from("tb_collection_items")
    .insert({ collection_id: collectionId, user_id: userId, kind, resource_id: resourceId });
  if (error && error.code !== "23505") throw error;
}

export async function removeFromCollection(
  collectionId: string,
  kind: FavoriteKind,
  resourceId: string,
) {
  const { error } = await supabase
    .from("tb_collection_items")
    .delete()
    .eq("collection_id", collectionId)
    .eq("kind", kind)
    .eq("resource_id", resourceId);
  if (error) throw error;
}

/** Antal kort per samling. */
export function countByCollection(items: CollectionItem[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const item of items) map.set(item.collection_id, (map.get(item.collection_id) ?? 0) + 1);
  return map;
}

/** Samlingar som redan innehåller ett visst kort. */
export function collectionsWith(
  items: CollectionItem[],
  kind: FavoriteKind,
  resourceId: string,
): Set<string> {
  return new Set(
    items
      .filter((item) => item.kind === kind && item.resource_id === resourceId)
      .map((item) => item.collection_id),
  );
}
