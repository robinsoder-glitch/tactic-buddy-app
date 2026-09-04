import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const source = readFileSync("src/lib/db.ts", "utf8");

/**
 * Sparfel får aldrig radera tidigare sekvenser: koden läser in stegen innan
 * de tas bort och lägger tillbaka dem om skrivningen misslyckas.
 */
describe("saveFrames skyddar tidigare sekvenser", () => {
  const body = source.slice(source.indexOf("export async function saveFrames"));

  it("läser in tidigare steg innan de tas bort", () => {
    const read = body.indexOf("const { data: previous");
    const remove = body.indexOf(".delete()");
    expect(read).toBeGreaterThan(-1);
    expect(read).toBeLessThan(remove);
  });

  it("lägger tillbaka tidigare steg när skrivningen misslyckas", () => {
    expect(body).toContain("await supabase.from(\"tactic_frames\").insert(previous as never)");
  });
});
