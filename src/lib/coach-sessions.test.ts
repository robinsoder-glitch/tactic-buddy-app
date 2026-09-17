import { describe, expect, it } from "vitest";
import {
  copyTitle,
  moveItem,
  nextSortOrder,
  teamSessionsForDisplay,
  templateItems,
  totalMinutes,
  type CoachSession,
} from "./coach-sessions";
import type { TrainingSessionCard } from "./taktikbank";

const items = [
  { id: "a", sort_order: 0, minutes: 10 },
  { id: "b", sort_order: 1, minutes: 20 },
  { id: "c", sort_order: 2, minutes: 15 },
];

describe("coach-sessions", () => {
  it("summerar total träningstid", () => {
    expect(totalMinutes(items)).toBe(45);
  });

  it("flyttar en del uppåt och numrerar om ordningen", () => {
    const next = moveItem(items, 2, -1);
    expect(next.map((item) => item.id)).toEqual(["a", "c", "b"]);
    expect(next.map((item) => item.sort_order)).toEqual([0, 1, 2]);
  });

  it("lämnar listan orörd vid ogiltig flytt", () => {
    expect(moveItem(items, 0, -1).map((item) => item.id)).toEqual(["a", "b", "c"]);
  });

  it("skapar kopietitel", () => {
    expect(copyTitle("Tisdagsträning")).toBe("Kopia av Tisdagsträning");
  });

  it("bygger delar från en redaktionell mall utan att ändra originalet", () => {
    const template = {
      id: "pass-1",
      title: "Passningspass",
      total_minutes: 60,
      theme: "Passning",
      data: {
        id: "pass-1",
        title: "Passningspass",
        blocks: [
          { order: 2, minutes: 20, activity: "Spelövning", kind: "drill", drillId: "drill-2" },
          { order: 1, minutes: 10, activity: "Uppvärmning", kind: "warmup" },
        ],
      },
    } as unknown as TrainingSessionCard;

    const result = templateItems(template);
    expect(result.map((item) => item.title)).toEqual(["Uppvärmning", "Spelövning"]);
    expect(result[0]?.kind).toBe("custom");
    expect(result[1]?.resource_id).toBe("drill-2");
    expect(template.data.blocks[0]?.order).toBe(2);
  });
});

describe("ordning med dubbletter", () => {
  const duplicates = [
    { id: "a", sort_order: 0, minutes: 10 },
    { id: "b", sort_order: 0, minutes: 10 },
    { id: "c", sort_order: 0, minutes: 10 },
  ];

  it("ger varje rad en egen plats även när platserna var lika", () => {
    const next = moveItem(duplicates, 2, -1);
    expect(next.map((item) => item.id)).toEqual(["a", "c", "b"]);
    expect(next.map((item) => item.sort_order)).toEqual([0, 1, 2]);
  });

  it("lägger samma övning sist utan att krocka", () => {
    expect(nextSortOrder(duplicates)).toBe(1);
    expect(nextSortOrder([...duplicates, { id: "d", sort_order: 4, minutes: 5 }])).toBe(5);
  });
});

describe("lagets träningspass i truppen", () => {
  const session = (patch: Partial<CoachSession>): CoachSession => ({
    id: "session",
    user_id: "coach",
    title: "Träning",
    session_date: null,
    age_group: null,
    game_format: null,
    theme: null,
    focus_areas: [],
    goal: null,
    notes: null,
    status: "draft",
    template_id: null,
    team_id: "team-1",
    is_template: false,
    visibility: "private",
    source_session_id: null,
    created_at: "2026-09-01T10:00:00Z",
    updated_at: "2026-09-01T10:00:00Z",
    ...patch,
  });

  it("visar bara rätt lags vanliga pass med daterade först", () => {
    const result = teamSessionsForDisplay(
      [
        session({ id: "utan-datum", updated_at: "2026-09-17T10:00:00Z" }),
        session({ id: "senare", session_date: "2026-09-20" }),
        session({ id: "tidigare", session_date: "2026-09-18" }),
        session({ id: "mall", is_template: true }),
        session({ id: "annat-lag", team_id: "team-2" }),
      ],
      "team-1",
    );

    expect(result.map((item) => item.id)).toEqual(["tidigare", "senare", "utan-datum"]);
  });
});
