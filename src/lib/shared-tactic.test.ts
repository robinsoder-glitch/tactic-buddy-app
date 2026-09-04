import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseSharedTactic } from "./shared-tactic";

const read = (path: string) => readFileSync(path, "utf8");

const payload = {
  id: "t1",
  name: "Uppspel",
  pitch_type: "five",
  frames: [
    {
      id: "f1",
      name: "Start",
      note: "Vänd spelet",
      objects: [
        { id: "a", kind: "player", label: "Spelare 1", number: 7, team: "home", x: 0.2, y: 0.3 },
        { id: "b", kind: "player", label: "Spelare 2", number: null, team: "away", x: 0.6, y: 0.4 },
        { id: "c", kind: "ball", label: "", team: "home", x: 0.5, y: 0.5 },
      ],
      drawings: [{ id: "d1", type: "pass", objectId: "a", x1: 0.2, y1: 0.3, x2: 0.6, y2: 0.4 }],
    },
  ],
};

describe("delad taktik", () => {
  it("behåller taktik, bilder och ritade linjer", () => {
    const tactic = parseSharedTactic(payload);
    expect(tactic.name).toBe("Uppspel");
    expect(tactic.pitch_type).toBe("five");
    expect(tactic.frames).toHaveLength(1);
    expect(tactic.frames[0]?.objects).toHaveLength(3);
    expect(tactic.frames[0]?.drawings).toHaveLength(1);
    expect(tactic.frames[0]?.note).toBe("Vänd spelet");
  });

  it("tar bort spelar-id och foto-länk även om de skulle följa med", () => {
    const smuggled = {
      ...payload,
      frames: [
        {
          ...payload.frames[0],
          objects: [
            {
              id: "a",
              kind: "player",
              label: "Ella Andersson",
              playerId: "11111111-1111-1111-1111-111111111111",
              photoUrl: "https://example.test/ella.jpg",
              number: 7,
              team: "home",
              x: 0.2,
              y: 0.3,
            },
          ],
        },
      ],
    };
    const object = parseSharedTactic(smuggled).frames[0]?.objects[0];
    expect(object).toBeDefined();
    expect(Object.keys(object ?? {})).not.toContain("playerId");
    expect(Object.keys(object ?? {})).not.toContain("photoUrl");
    expect(object?.label).toBe("Ella Andersson");
    const text = JSON.stringify(parseSharedTactic(smuggled));
    expect(text).not.toContain("example.test");
    expect(text).not.toContain("11111111-1111-1111-1111-111111111111");
  });

  it("ger neutrala etiketter när namn saknas", () => {
    const anonymous = {
      ...payload,
      frames: [
        {
          ...payload.frames[0],
          objects: [
            { id: "a", kind: "player", team: "home", x: 0.1, y: 0.1 },
            { id: "b", kind: "player", team: "away", x: 0.2, y: 0.2 },
          ],
        },
      ],
    };
    const labels = parseSharedTactic(anonymous).frames[0]?.objects.map((item) => item.label);
    expect(labels).toEqual(["Spelare 1", "Spelare 2"]);
  });

  it("säger ifrån när delningen är avstängd", () => {
    expect(() => parseSharedTactic(null)).toThrow(/inte delad/);
    expect(() => parseSharedTactic({})).toThrow(/inte delad/);
  });

  it("hämtar delad taktik via den säkra databasfunktionen", () => {
    const db = read("src/lib/db.ts");
    expect(db).toContain('supabase.rpc("get_shared_tactic"');
    expect(db).not.toContain('.eq("is_public", true)');
  });

  it("berättar för tränaren att anteckningar visas publikt", () => {
    const editor = read("src/components/TacticEditor.tsx");
    expect(editor).toContain("anteckningar i bilderna visas som de är");
  });
});
