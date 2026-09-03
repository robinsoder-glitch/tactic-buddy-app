import { describe, expect, it } from "vitest";
import {
  SETUP_ERRORS,
  accountKindOf,
  codeKindError,
  guardianChildName,
  isCompleteTeamCode,
  normalizeTeamCode,
  profileDisplayName,
  requiredCodeKind,
  setupFromMetadata,
  setupToMetadata,
  validateSetup,
  type AccountSetup,
} from "./account-setup";

const player: AccountSetup = { role: "player", name: "Robin", code: "ABC123" };
const coach: AccountSetup = {
  role: "coach",
  name: "Maria",
  birth: "1990-01-01",
  adultConfirmed: true,
  code: "COACH1",
};
const guardian: AccountSetup = {
  role: "player",
  name: "Maria",
  isGuardian: true,
  playerName: "Elias",
  code: "ABC123",
};

describe("lagkoder", () => {
  it("1. giltig spelarkod passar spelare", () => {
    expect(validateSetup(player, { requireCode: true })).toBeNull();
    expect(codeKindError(player, "player")).toBeNull();
  });

  it("2. giltig tränarkod passar tränare", () => {
    expect(validateSetup(coach, { requireCode: true })).toBeNull();
    expect(codeKindError(coach, "coach")).toBeNull();
  });

  it("3. ogiltig/tom kod stoppas när kod krävs", () => {
    expect(validateSetup({ ...player, code: "" }, { requireCode: true })).toBe(
      "Ange lagkoden du fått av din tränare",
    );
  });

  it("4. fem respektive sju tecken underkänns", () => {
    expect(isCompleteTeamCode("ABC12")).toBe(false);
    expect(isCompleteTeamCode("ABC1234")).toBe(false);
    expect(validateSetup({ ...player, code: "ABC12" }, { requireCode: true })).toBe(
      SETUP_ERRORS.codeLength,
    );
  });

  it("5. gemener och blanksteg normaliseras", () => {
    expect(normalizeTeamCode("  abc123 ")).toBe("ABC123");
    expect(isCompleteTeamCode(" abc123 ")).toBe(true);
  });

  it("6. spelare med tränarkod avvisas", () => {
    expect(codeKindError(player, "coach")).toBe(SETUP_ERRORS.codeNeedsPlayer);
    expect(requiredCodeKind(player)).toBe("player");
  });

  it("7. tränare med spelarkod avvisas", () => {
    expect(codeKindError(coach, "player")).toBe(SETUP_ERRORS.codeNeedsCoach);
  });

  it("8. vårdnadshavare har eget namn och separat barnnamn", () => {
    expect(accountKindOf(guardian)).toBe("guardian");
    expect(profileDisplayName(guardian)).toBe("Maria");
    expect(guardianChildName(guardian)).toBe("Elias");
    expect(codeKindError(guardian, "player")).toBeNull();
  });

  it("9. underlaget överlever e-postbekräftelse på annan enhet", () => {
    const meta = setupToMetadata(guardian);
    expect(meta).toMatchObject({
      account_kind: "guardian",
      display_name: "Maria",
      player_name: "Elias",
      team_code: "ABC123",
    });
    const restored = setupFromMetadata(meta as unknown as Record<string, unknown>);
    expect(restored).toMatchObject({
      role: "player",
      name: "Maria",
      isGuardian: true,
      playerName: "Elias",
      code: "ABC123",
    });
  });

  it("10-12. tydliga felmeddelanden finns för konto, kod och rotation", () => {
    expect(SETUP_ERRORS.emailTaken).toMatch(/redan ett konto/);
    expect(SETUP_ERRORS.codeExpired).toMatch(/gäller inte längre/);
    expect(SETUP_ERRORS.codeLookupFailed).toMatch(/kunde inte kontrolleras/);
    expect(SETUP_ERRORS.weakPassword).toMatch(/minst 6 tecken/);
  });
});
