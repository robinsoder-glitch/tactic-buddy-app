import { describe, expect, it } from "vitest";
import {
  ageFromGroup,
  recommendDrills,
  recommendTemplates,
  reasonText,
} from "./session-recommendations";
import type { Drill } from "./taktikbank";
import type { TemplateCard } from "./session-templates";

function drill(patch: Partial<Drill> & { id: string; title: string }): Drill {
  return {
    default_minutes: 10,
    purpose: null,
    data: { id: patch.id, title: patch.title },
    ...patch,
  } as Drill;
}

const drills: Drill[] = [
  drill({
    id: "d1",
    title: "Spelbarhet i ruta",
    purpose: "Träna spelbarhet",
    default_minutes: 10,
    data: { id: "d1", title: "Spelbarhet i ruta", format: "5v5", ageFit: { min: 8, max: 11 } },
  }),
  drill({
    id: "d2",
    title: "Långt spel",
    data: { id: "d2", title: "Långt spel", format: "9v9", ageFit: { min: 12, max: 14 } },
  }),
  drill({
    id: "d3",
    title: "Smålagsspel med spelbarhet",
    default_minutes: 20,
    data: { id: "d3", title: "Smålagsspel med spelbarhet", format: "5v5" },
  }),
];

describe("övningsrekommendationer", () => {
  it("rekommenderar utifrån ålder, spelform och tema", () => {
    const list = recommendDrills(drills, {
      ageGroup: "P10",
      gameFormat: "5v5",
      theme: "spelbarhet",
      step: 1,
    });
    expect(list.map((row) => row.item.id)).toEqual(["d1", "d3"]);
    expect(list[0]?.reason).toContain("Passar eftersom");
  });

  it("ger högst tre förslag", () => {
    const many = [...drills, ...drills].map((row, index) => ({ ...row, id: `${row.id}-${index}` }));
    expect(recommendDrills(many, { gameFormat: "5v5" }).length).toBeLessThanOrEqual(3);
  });

  it("visar inga förslag när ingenting matchar", () => {
    expect(recommendDrills(drills, { gameFormat: "11v11", theme: "hörnor" })).toEqual([]);
  });

  it("progressionssteget påverkar valet", () => {
    const early = recommendDrills(drills, { gameFormat: "5v5", step: 1 });
    const late = recommendDrills(drills, { gameFormat: "5v5", step: 3 });
    expect(early[0]?.item.id).toBe("d1");
    expect(late[0]?.item.id).toBe("d3");
  });

  it("åldersgrupp tolkas", () => {
    expect(ageFromGroup("P10")).toBe(10);
    expect(ageFromGroup("F 9")).toBe(9);
    expect(ageFromGroup(null)).toBeNull();
  });

  it("motiveringen är läsbar svenska", () => {
    expect(reasonText(["laget spelar 5v5"])).toBe("Passar eftersom laget spelar 5v5.");
    expect(reasonText([])).toContain("allmänt komplement");
  });
});

describe("mallrekommendationer", () => {
  const cards: TemplateCard[] = [
    {
      id: "t1",
      title: "Spelbarhet 60",
      minutes: 60,
      ageGroup: "P10",
      gameFormat: "5v5",
      theme: "Spelbarhet",
      itemCount: 5,
      visibility: "private",
      visibilityLabel: "Privat mall",
      updatedAt: "2026-09-01T10:00:00Z",
      ownerId: "coach-1",
      teamId: "team-1",
    },
    {
      id: "t2",
      title: "Presspass",
      minutes: 90,
      ageGroup: "P14",
      gameFormat: "11v11",
      theme: "Press",
      itemCount: 6,
      visibility: "team",
      visibilityLabel: "Lagmall",
      updatedAt: "2026-09-01T10:00:00Z",
      ownerId: "coach-2",
      teamId: "team-1",
    },
  ];

  it("högst två mallar och rätt ordning", () => {
    const list = recommendTemplates(cards, {
      gameFormat: "5v5",
      ageGroup: "P10",
      theme: "Spelbarhet",
      minutes: 60,
    });
    expect(list).toHaveLength(1);
    expect(list[0]?.item.id).toBe("t1");
    expect(list.length).toBeLessThanOrEqual(2);
  });
});
