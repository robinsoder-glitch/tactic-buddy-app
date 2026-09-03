import { describe, expect, it } from "vitest";
import { buildCatalog, isDuplicateLink, relatedSections, type ContentLink } from "./content-links";
import { ARTICLE_SECTIONS } from "./related-sections";

const links: ContentLink[] = [
  {
    id: "1",
    source_type: "article",
    source_id: "ytor",
    target_type: "drill",
    target_id: "d1",
    note: null,
    sort_order: 0,
  },
  {
    id: "2",
    source_type: "tactic",
    source_id: "t1",
    target_type: "article",
    target_id: "ytor",
    note: "Se kortet",
    sort_order: 0,
  },
  {
    id: "3",
    source_type: "article",
    source_id: "ytor",
    target_type: "drill",
    target_id: "d1",
    note: null,
    sort_order: 1,
  },
];

const catalog = buildCatalog([
  { type: "article", id: "ytor", title: "Bygg förståelse för ytor" },
  { type: "tactic", id: "t1", title: "Press vid inspark" },
  { type: "drill", id: "d1", title: "Fyrkant med press" },
]);

describe("innehållsrelationer", () => {
  it("hittar relationer åt båda hållen", () => {
    const sections = relatedSections(
      links,
      { type: "article", id: "ytor" },
      ARTICLE_SECTIONS,
      catalog,
    );
    const titles = sections.flatMap((section) => section.items.map((item) => item.title));
    expect(titles).toContain("Press vid inspark");
    expect(titles).toContain("Fyrkant med press");
  });

  it("visar inga dubbletter", () => {
    const sections = relatedSections(
      links,
      { type: "article", id: "ytor" },
      ARTICLE_SECTIONS,
      catalog,
    );
    const items = sections.flatMap((section) =>
      section.items.map((item) => `${item.type}:${item.id}`),
    );
    expect(new Set(items).size).toBe(items.length);
  });

  it("hoppar över tomma avsnitt", () => {
    const sections = relatedSections(
      links,
      { type: "article", id: "ytor" },
      ARTICLE_SECTIONS,
      catalog,
    );
    expect(sections.every((section) => section.items.length > 0)).toBe(true);
  });

  it("känner igen en dubblett innan den sparas", () => {
    expect(
      isDuplicateLink(links, {
        source_type: "article",
        source_id: "ytor",
        target_type: "drill",
        target_id: "d1",
      }),
    ).toBe(true);
  });
});
