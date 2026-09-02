import { describe, expect, it } from "vitest";
import { planStatus, planStatusLabel } from "@/lib/plan-status";
import {
  addDraftItem,
  draftMinutes,
  draftPayload,
  emptyDraft,
  hasResource,
  moveDraftItem,
  removeDraftItem,
  updateDraftItem,
} from "@/lib/training-draft";

describe("planStatus", () => {
  it("match utan planering är Ej klar", () => {
    expect(planStatus({ type: "match", planSaved: false })).toBe("todo");
  });

  it("match utan ledare är Ej klar", () => {
    expect(planStatus({ type: "match", planSaved: true, playerCount: 2, coachCount: 0 })).toBe("todo");
  });

  it("match utan spelare är Ej klar", () => {
    expect(planStatus({ type: "match", planSaved: true, playerCount: 0, coachCount: 2 })).toBe("todo");
  });

  it("match med sparad plan, spelare och ledare är Klar", () => {
    expect(planStatus({ type: "match", planSaved: true, playerCount: 2, coachCount: 2 })).toBe("done");
  });

  it("träning utan övningar är Ej klar", () => {
    expect(planStatus({ type: "training", planSaved: true, resourceCount: 0 })).toBe("todo");
  });

  it("träning med minst en övning och sparad plan är Klar", () => {
    expect(planStatus({ type: "training", planSaved: true, resourceCount: 1 })).toBe("done");
  });

  it("visar bara Klar eller Ej klar", () => {
    expect(planStatusLabel("done")).toBe("Klar");
    expect(planStatusLabel("todo")).toBe("Ej klar");
  });
});

describe("träningsutkast", () => {
  const base = () =>
    addDraftItem(
      addDraftItem(emptyDraft("e1"), {
        kind: "drill",
        resourceId: "d1",
        title: "Hitta den fria porten",
        minutes: 10,
        note: null,
      }),
      { kind: "drill", resourceId: "d2", title: "Fyrkantspel", minutes: 15, note: null },
    );

  it("lägger till rader med egna nycklar", () => {
    const draft = base();
    expect(draft.items).toHaveLength(2);
    expect(draft.items[0]!.key).not.toBe(draft.items[1]!.key);
  });

  it("känner igen en övning som redan finns", () => {
    expect(hasResource(base(), "d1")).toBe(true);
    expect(hasResource(base(), "d9")).toBe(false);
  });

  it("tillåter samma övning en gång till med eget id", () => {
    const draft = addDraftItem(base(), {
      kind: "drill",
      resourceId: "d1",
      title: "Hitta den fria porten",
      minutes: 10,
      note: null,
    });
    expect(draft.items).toHaveLength(3);
    expect(new Set(draft.items.map((item) => item.key)).size).toBe(3);
  });

  it("flyttar rader och stannar innanför listan", () => {
    const draft = moveDraftItem(base(), 1, -1);
    expect(draft.items[0]!.resourceId).toBe("d2");
    expect(moveDraftItem(base(), 0, -1).items[0]!.resourceId).toBe("d1");
    expect(moveDraftItem(base(), 1, 1).items[1]!.resourceId).toBe("d2");
  });

  it("tar bort en rad", () => {
    const draft = base();
    expect(removeDraftItem(draft, draft.items[0]!.key).items).toHaveLength(1);
  });

  it("uppdaterar tid och anteckning", () => {
    const draft = base();
    const next = updateDraftItem(draft, draft.items[0]!.key, { minutes: 20, note: "Fokus: lyfta blicken" });
    expect(next.items[0]!.minutes).toBe(20);
    expect(next.items[0]!.note).toBe("Fokus: lyfta blicken");
  });

  it("summerar tiden och bygger payload i rätt ordning", () => {
    expect(draftMinutes(base())).toBe(25);
    expect(draftPayload(base()).map((item) => item.resource_id)).toEqual(["d1", "d2"]);
  });

  it("tömd anteckning sparas som tom text", () => {
    const draft = { ...base(), notes: "" };
    expect(draft.notes).toBe("");
  });
});
