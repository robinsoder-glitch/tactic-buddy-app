import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Vårdnadshavarkopplingar: klienten ska gå via den säkra databasfunktionen
 * (servern validerar roll, medlemsstatus och lag) och dialogen får bara
 * erbjuda godkända medlemmar – aldrig väntande konton.
 */

const guardiansSource = readFileSync(resolve(__dirname, "guardians.ts"), "utf8");
const dialogSource = readFileSync(
  resolve(__dirname, "../components/GuardianLinks.tsx"),
  "utf8",
);

describe("linkGuardian", () => {
  it("går via den säkra databasfunktionen", () => {
    expect(guardiansSource).toContain('supabase.rpc("link_guardian"');
  });

  it("skriver aldrig direkt till tabellen", () => {
    expect(guardiansSource).not.toMatch(/from\("player_guardians"\)\s*\.(upsert|insert)/);
  });
});

describe("GuardianLinks", () => {
  it("erbjuder bara godkända medlemmar", () => {
    expect(dialogSource).toContain('member.status === "approved"');
  });
});
