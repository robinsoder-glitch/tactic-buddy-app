import { describe, expect, it } from "vitest";
import { cleanName, collectionsWith, countByCollection, nameTaken } from "./collections";
import type { Collection, CollectionItem } from "./collections";

const collection = (id: string, name: string): Collection => ({
  id,
  name,
  created_at: "2026-01-01",
});

const item = (collection_id: string, resource_id: string): CollectionItem => ({
  id: `${collection_id}-${resource_id}`,
  collection_id,
  kind: "drill",
  resource_id,
});

describe("samlingar", () => {
  it("städar namnet", () => {
    expect(cleanName("  Uppvärmning   höst ")).toBe("Uppvärmning höst");
    expect(cleanName("   ")).toBe("");
  });

  it("upptäcker upptaget namn oavsett versaler", () => {
    const list = [collection("a", "Uppvärmning")];
    expect(nameTaken(list, " uppvärmning ")).toBe(true);
    expect(nameTaken(list, "Avslutning")).toBe(false);
  });

  it("räknar kort per samling", () => {
    const map = countByCollection([item("a", "d1"), item("a", "d2"), item("b", "d1")]);
    expect(map.get("a")).toBe(2);
    expect(map.get("b")).toBe(1);
  });

  it("hittar samlingar som redan har kortet", () => {
    const has = collectionsWith([item("a", "d1"), item("b", "d2")], "drill", "d1");
    expect([...has]).toEqual(["a"]);
  });
});
