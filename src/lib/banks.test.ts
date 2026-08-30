import { describe, expect, it } from "vitest";
import { drillMeta, filterDrills, filterSessions } from "./ovningsbank";
import {
  KB_CATEGORIES,
  KB_CATEGORY_LABELS,
  KB_LEVEL_LABELS,
  KB_STATUS_LABELS,
  filterArticles,
  visibleArticles,
  type KbArticle,
} from "./kunskapsbank";
import type { Drill, TacticCard, TrainingSessionCard } from "./taktikbank";

const card = (over: Partial<TacticCard> = {}): TacticCard =>
  ({
    id: "t1",
    title: "Press vid inspark",
    format: "5v5",
    difficulty: 2,
    game_moment: "goalkeeper_start",
    phase: "defending",
    purpose: "Stänga mitten",
    formation_ref: null,
    data: { ageFit: { min: 8, max: 10 } },
    ...over,
  }) as unknown as TacticCard;

const drill = (over: Partial<Drill> = {}): Drill =>
  ({
    id: "d1",
    title: "Fyrkant med press",
    default_minutes: 15,
    purpose: "Träna press",
    data: { linkedTacticIds: ["t1"] },
    ...over,
  }) as unknown as Drill;

const session = (over: Partial<TrainingSessionCard> = {}): TrainingSessionCard =>
  ({
    id: "s1",
    title: "Pass 1 – press",
    total_minutes: 60,
    theme: "Press",
    data: { blocks: [{ order: 1, activity: "Uppvärmning", minutes: 10, drillId: "d1" }] },
    ...over,
  }) as unknown as TrainingSessionCard;

const article = (over: Partial<KbArticle> = {}): KbArticle => ({
  id: "a1",
  title: "Lek som grund",
  summary: "Varför lek fungerar",
  coach_value: "Fler bollkontakter",
  category: "coaching",
  age_min: 5,
  age_max: 10,
  level: "basic",
  source_name: "SvFF",
  source_url: "https://example.org",
  published_at: null,
  reviewed_at: null,
  tags: ["lek"],
  status: "verified",
  is_published: true,
  ...over,
});

describe("Övningsbanken", () => {
  it("härleder metadata från kopplade taktikkort", () => {
    const meta = drillMeta(drill(), [card()]);
    expect(meta.formats).toEqual(["5v5"]);
    expect(meta.difficulties).toEqual([2]);
    expect(meta.ageMin).toBe(8);
  });

  it("visar befintliga övningar utan filter och duplicerar inget", () => {
    const drills = [drill(), drill({ id: "d2", title: "Smålagsspel" })];
    const result = filterDrills(drills, [card()], {});
    expect(result).toHaveLength(2);
    expect(new Set(result.map((item) => item.id)).size).toBe(2);
  });

  it("filtrerar på spelform, svårighetsgrad och sökord", () => {
    const drills = [drill()];
    expect(filterDrills(drills, [card()], { format: "7v7" })).toHaveLength(0);
    expect(filterDrills(drills, [card()], { difficulty: "2" })).toHaveLength(1);
    expect(filterDrills(drills, [card()], { query: "press" })).toHaveLength(1);
    expect(filterDrills(drills, [card()], { query: "målvakt" })).toHaveLength(0);
  });

  it("behåller kopplingen mellan pass och övningar", () => {
    const found = filterSessions([session()], {});
    expect(found[0]?.data.blocks[0]?.drillId).toBe("d1");
  });

  it("respekterar favoriter", () => {
    const favorites = new Set(["drill:d1"]);
    expect(filterDrills([drill()], [card()], { onlyFavorites: true, favorites })).toHaveLength(1);
    expect(filterDrills([drill()], [card()], { onlyFavorites: true, favorites: new Set() })).toHaveLength(0);
  });
});

describe("Kunskapsbanken", () => {
  it("fungerar utan artiklar", () => {
    expect(filterArticles(visibleArticles([], false), {})).toEqual([]);
  });

  it("visar bara publicerade och verifierade artiklar för vanliga användare", () => {
    const list = [
      article(),
      article({ id: "a2", status: "unverified" }),
      article({ id: "a3", is_published: false }),
    ];
    expect(visibleArticles(list, false).map((item) => item.id)).toEqual(["a1"]);
    expect(visibleArticles(list, true)).toHaveLength(3);
  });

  it("filtrerar på kategori, nivå, ålder och sökord", () => {
    const list = [article(), article({ id: "a2", category: "technique", level: "advanced", age_min: 11, age_max: null, title: "Finter", summary: "Teknikövningar", coach_value: "Fler finter", tags: ["teknik"] })];
    expect(filterArticles(list, { category: "technique" })).toHaveLength(1);
    expect(filterArticles(list, { level: "basic" })).toHaveLength(1);
    expect(filterArticles(list, { age: "12" }).map((item) => item.id)).toEqual(["a2"]);
    expect(filterArticles(list, { query: "lek" })).toHaveLength(1);
  });

  it("har svenska etiketter för alla kategorier, nivåer och statusar", () => {
    for (const category of KB_CATEGORIES) {
      expect(KB_CATEGORY_LABELS[category]).toBeTruthy();
      expect(KB_CATEGORY_LABELS[category]).not.toBe(category);
    }
    expect(Object.values(KB_LEVEL_LABELS)).toEqual(["Grundläggande", "Fortsättning", "Avancerad"]);
    expect(Object.values(KB_STATUS_LABELS)).toEqual([
      "Verifierad",
      "Behöver kontrolleras",
      "Ej verifierad",
    ]);
  });
});
