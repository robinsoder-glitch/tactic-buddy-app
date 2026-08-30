import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/** Filer som utgör Kunskapsbanken i appen. */
const KNOWLEDGE_FILES = [
  "src/components/KnowledgeLibrary.tsx",
  "src/routes/_authenticated/kunskapsbank.index.tsx",
  "src/routes/_authenticated/kunskapsbank.$slug.tsx",
];

const FORBIDDEN_TEXTS = ["Lägg till träningspass", "Lägg till träning", "Lägg till i träning"];
const FORBIDDEN_CODE = ["AddToTrainingButton", "AddToTrainingDialog", "PlanTrainingDialog"];

function read(path: string): string {
  return readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
}

describe("Kunskapsbanken – inga knappar för att skapa träningar", () => {
  for (const file of KNOWLEDGE_FILES) {
    it(`${file} saknar knapptexter för att lägga till träning`, () => {
      const source = read(file);
      for (const text of FORBIDDEN_TEXTS) expect(source).not.toContain(text);
    });

    it(`${file} importerar eller renderar inga tilläggsflöden`, () => {
      const source = read(file);
      for (const token of FORBIDDEN_CODE) expect(source).not.toContain(token);
    });

    it(`${file} länkar inte till flöden för att skapa träningspass`, () => {
      const source = read(file);
      expect(source).not.toContain("/traningspass/nytt");
      expect(source).not.toContain("createSession");
      expect(source).not.toContain("addResourceToSession");
    });
  }
});
