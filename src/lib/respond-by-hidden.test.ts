import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";

/**
 * Instruktion 10C: sista svarsdag ska finnas i kallelsen. Den tidigare regeln
 * om att dölja fältet gäller inte längre.
 */
const EVENT_PAGE = fileURLToPath(
  new URL("../routes/_authenticated/team.$teamId.event.$eventId.tsx", import.meta.url),
);

describe("Sista svarsdag", () => {
  it("kan sättas och visas i kallelsen", () => {
    const source = readFileSync(EVENT_PAGE, "utf8");
    expect(source).toContain("Sista svarsdag");
    expect(source).toContain("setRespondBy");
  });
});
