import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = fileURLToPath(new URL("../", import.meta.url));

/** Alla filer under src/ (utom tester). */
function allSourceFiles(dir = SRC): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...allSourceFiles(path));
    else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) out.push(path);
  }
  return out;
}

/** Filer som utgör Kunskapsbanken – hittas automatiskt så nya vyer täcks in. */
function knowledgeFiles(): string[] {
  return allSourceFiles().filter((path) => /kunskapsbank|Knowledge/i.test(path));
}

const FORBIDDEN_TEXTS = ["Lägg till träningspass", "Lägg till träning", "Lägg till i träning"];
const FORBIDDEN_CODE = ["AddToTrainingButton", "AddToTrainingDialog", "PlanTrainingDialog"];
const FORBIDDEN_LINKS = ["/traningspass/nytt", "createCoachSession", "addSessionItem", "addResourceToEvent"];

describe("Kunskapsbanken – inga knappar för att skapa träningar", () => {
  const files = knowledgeFiles();

  it("hittar Kunskapsbankens filer", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  for (const path of files) {
    const name = path.replace(SRC, "src/");
    const source = readFileSync(path, "utf8");

    it(`${name} saknar knapptexter för att lägga till träning`, () => {
      for (const text of FORBIDDEN_TEXTS) expect(source).not.toContain(text);
    });

    it(`${name} importerar eller renderar inga tilläggsflöden`, () => {
      for (const token of FORBIDDEN_CODE) expect(source).not.toContain(token);
    });

    it(`${name} länkar inte till flöden för att skapa träningspass`, () => {
      for (const token of FORBIDDEN_LINKS) expect(source).not.toContain(token);
    });
  }
});
