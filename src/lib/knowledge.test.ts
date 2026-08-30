import { describe, expect, it } from "vitest";
import { filterKnowledge, knowledgeAgeLabel, knowledgeCategories, type KnowledgeArticle } from "./knowledge";

const base: KnowledgeArticle = {
  id: "1",
  slug: "spelforstaelse",
  title_sv: "Spelförståelse i småspel",
  title_original: null,
  summary_sv: "Småspel ger fler bollkontakter.",
  learn_sv: null,
  try_next_sv: null,
  category: "Spelförståelse och taktik",
  age_label: null,
  age_5_7: true,
  age_8_9: false,
  age_10: false,
  game_format_label: null,
  format_3v3: true,
  format_5v5: false,
  format_7v7: false,
  level: null,
  content_type: null,
  language: "sv",
  source_name: "SvFF",
  source_type: null,
  reading_minutes: 5,
  coach_value: null,
  evidence_level: null,
  original_url: "https://example.com",
  checked_date: null,
  is_published: true,
  featured: false,
  sort_order: 1,
  copyright_note: null,
};

const other: KnowledgeArticle = { ...base, id: "2", slug: "malvakt", title_sv: "Målvaktsspel", category: "Målvakt", age_5_7: false, age_8_9: true, format_3v3: false, format_5v5: true, featured: true };

describe("kunskapsbanken", () => {
  it("filtrerar på kategori", () => {
    expect(filterKnowledge([base, other], { category: "Målvakt" })).toHaveLength(1);
  });
  it("filtrerar på ålder och spelform", () => {
    expect(filterKnowledge([base, other], { age: "age_8_9" })[0]?.id).toBe("2");
    expect(filterKnowledge([base, other], { format: "format_3v3" })[0]?.id).toBe("1");
  });
  it("filtrerar på fritext och utvalda", () => {
    expect(filterKnowledge([base, other], { query: "småspel" })).toHaveLength(1);
    expect(filterKnowledge([base, other], { onlyFeatured: true })).toHaveLength(1);
  });
  it("visar svenska åldersetiketter", () => {
    expect(knowledgeAgeLabel(base)).toBe("5–7 år");
    expect(knowledgeCategories([base, other])).toEqual(["Målvakt", "Spelförståelse och taktik"]);
  });
});
