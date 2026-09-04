import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";

/**
 * Instruktion 10C: sista svarsdag ska finnas i kallelsen. Den tidigare regeln
 * om att dölja fältet gäller inte längre.
 */
const DIALOG = fileURLToPath(new URL("../components/InviteDialog.tsx", import.meta.url));
const EVENT_PAGE = fileURLToPath(
  new URL("../routes/_authenticated/team.$teamId.event.$eventId.tsx", import.meta.url),
);

describe("Sista svarsdag", () => {
  it("kan sättas i kallelsedialogen", () => {
    const source = readFileSync(DIALOG, "utf8");
    expect(source).toContain("Sista svarsdag");
    expect(source).toContain("setRespondBy");
  });

  it("visas med läge på matchsidan", () => {
    const source = readFileSync(EVENT_PAGE, "utf8");
    expect(source).toContain("respondByState");
  });
});
