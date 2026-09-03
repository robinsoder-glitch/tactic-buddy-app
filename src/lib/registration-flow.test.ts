import { beforeEach, describe, expect, it, vi } from "vitest";

const findTeamByCode = vi.fn();
const joinTeamWithCode = vi.fn();
const claimRole = vi.fn();
const updateProfile = vi.fn();

vi.mock("./teams", () => ({
  findTeamByCode: (...args: unknown[]) => findTeamByCode(...args),
  joinTeamWithCode: (...args: unknown[]) => joinTeamWithCode(...args),
  claimRole: (...args: unknown[]) => claimRole(...args),
  updateProfile: (...args: unknown[]) => updateProfile(...args),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: { updateUser: vi.fn().mockResolvedValue({ error: null }) } },
}));

import {
  SETUP_ERRORS,
  accountKindOf,
  applyAccountSetup,
  codeKindError,
  guardianChildName,
  isCompleteTeamCode,
  normalizeTeamCode,
  profileDisplayName,
  setupFromMetadata,
  setupToMetadata,
  validateSetup,
  type AccountSetup,
} from "./account-setup";

const player: AccountSetup = { role: "player", name: "Elias", code: "A1B2C3" };
const coach: AccountSetup = {
  role: "coach",
  name: "Anna",
  birth: "1985-05-05",
  adultConfirmed: true,
  code: "C0ACH1",
};
const guardian: AccountSetup = {
  role: "player",
  name: "Maria",
  isGuardian: true,
  playerName: "Elias",
  code: "A1B2C3",
};

function team(join_role: "coach" | "player") {
  return { id: "team-1", name: "IFK P12", age_group: "P12", club_name: "IFK", join_role };
}

beforeEach(() => {
  vi.clearAllMocks();
  updateProfile.mockResolvedValue(undefined);
  claimRole.mockResolvedValue(undefined);
  joinTeamWithCode.mockResolvedValue({
    teamId: "team-1",
    teamName: "IFK P12",
    role: "player",
    status: "pending",
  });
});

describe("kodnormalisering", () => {
  it("trimmar och versaliserar", () => {
    expect(normalizeTeamCode("  a1b2c3 ")).toBe("A1B2C3");
  });

  it("kräver exakt sex tecken", () => {
    expect(isCompleteTeamCode("A1B2C")).toBe(false);
    expect(isCompleteTeamCode("A1B2C3")).toBe(true);
    expect(isCompleteTeamCode("A1B2C3D")).toBe(false);
    expect(validateSetup({ ...player, code: "A1B2C" }, { requireCode: true })).toBe(
      SETUP_ERRORS.codeLength,
    );
    expect(validateSetup({ ...player, code: "A1B2C3D" }, { requireCode: true })).toBe(
      SETUP_ERRORS.codeLength,
    );
  });
});

describe("kodtyper", () => {
  it("godkänner giltig spelarkod för spelare och vårdnadshavare", () => {
    expect(codeKindError(player, "player")).toBeNull();
    expect(codeKindError(guardian, "player")).toBeNull();
  });

  it("godkänner giltig tränarkod för tränare", () => {
    expect(codeKindError(coach, "coach")).toBeNull();
  });

  it("avvisar spelare som använder tränarkod", () => {
    expect(codeKindError(player, "coach")).toBe(SETUP_ERRORS.codeNeedsPlayer);
  });

  it("avvisar tränare som använder spelarkod", () => {
    expect(codeKindError(coach, "player")).toBe(SETUP_ERRORS.codeNeedsCoach);
  });
});

describe("applyAccountSetup", () => {
  it("ansluter spelare med giltig spelarkod", async () => {
    findTeamByCode.mockResolvedValue(team("player"));
    const result = await applyAccountSetup("user-1", { ...player, code: " a1b2c3 " });
    expect(joinTeamWithCode).toHaveBeenCalledWith("A1B2C3", "player");
    expect(result.teamName).toBe("IFK P12");
  });

  it("ansluter tränare med giltig tränarkod", async () => {
    findTeamByCode.mockResolvedValue(team("coach"));
    joinTeamWithCode.mockResolvedValue({
      teamId: "team-1",
      teamName: "IFK P12",
      role: "coach",
      status: "pending",
    });
    await applyAccountSetup("user-1", coach);
    expect(joinTeamWithCode).toHaveBeenCalledWith("C0ACH1", "coach");
  });

  it("avvisar ogiltig kod utan att skapa roller", async () => {
    findTeamByCode.mockResolvedValue(null);
    await expect(applyAccountSetup("user-1", player)).rejects.toThrow(SETUP_ERRORS.codeInvalid);
    expect(joinTeamWithCode).not.toHaveBeenCalled();
    expect(claimRole).not.toHaveBeenCalled();
    expect(updateProfile).not.toHaveBeenCalled();
  });

  it("avvisar gammal kod efter kodrotation (finns inte längre)", async () => {
    findTeamByCode.mockResolvedValue(null);
    await expect(applyAccountSetup("user-1", { ...player, code: "OLDCOD" })).rejects.toThrow(
      SETUP_ERRORS.codeInvalid,
    );
  });

  it("avvisar arkiverat lag med databasens meddelande", async () => {
    findTeamByCode.mockResolvedValue(team("player"));
    joinTeamWithCode.mockRejectedValue(new Error("Laget är arkiverat. Be din tränare om en ny kod."));
    await expect(applyAccountSetup("user-1", player)).rejects.toThrow(/arkiverat/i);
  });

  it("skapar inte motsägelsefulla roller vid fel kodtyp", async () => {
    findTeamByCode.mockResolvedValue(team("coach"));
    await expect(applyAccountSetup("user-1", player)).rejects.toThrow(SETUP_ERRORS.codeNeedsPlayer);
    expect(claimRole).not.toHaveBeenCalled();
    expect(joinTeamWithCode).not.toHaveBeenCalled();
  });

  it("sparar vårdnadshavarens och barnets namn separat", async () => {
    findTeamByCode.mockResolvedValue(team("player"));
    joinTeamWithCode.mockResolvedValue({
      teamId: "team-1",
      teamName: "IFK P12",
      role: "guardian",
      status: "pending",
    });
    await applyAccountSetup("user-1", guardian);
    expect(updateProfile).toHaveBeenCalledWith(
      expect.objectContaining({ display_name: "Maria", guardian_for_name: "Elias" }),
    );
    expect(joinTeamWithCode).toHaveBeenCalledWith("A1B2C3", "guardian");
  });
});

describe("namn och kontotyp", () => {
  it("hälsar på personen, inte e-posten eller barnet", () => {
    expect(profileDisplayName({ role: "player", name: "Robin" })).toBe("Robin");
    expect(profileDisplayName(guardian)).toBe("Maria");
    expect(guardianChildName(guardian)).toBe("Elias");
    expect(guardianChildName(player)).toBeNull();
  });

  it("vårdnadshavare får kontotypen guardian", () => {
    expect(accountKindOf(guardian)).toBe("guardian");
    expect(accountKindOf(player)).toBe("player");
    expect(accountKindOf(coach)).toBe("coach");
  });
});

describe("e-postbekräftelse på annan enhet", () => {
  it("återskapar registreringsunderlaget från auth-metadata", () => {
    const meta = setupToMetadata(guardian);
    expect(meta).toMatchObject({
      schema_version: 1,
      account_kind: "guardian",
      display_name: "Maria",
      player_name: "Elias",
      team_code: "A1B2C3",
    });
    const restored = setupFromMetadata(meta as unknown as Record<string, unknown>);
    expect(restored).toMatchObject({
      role: "player",
      name: "Maria",
      isGuardian: true,
      playerName: "Elias",
      code: "A1B2C3",
    });
  });

  it("ger null när metadata saknas", () => {
    expect(setupFromMetadata(null)).toBeNull();
    expect(setupFromMetadata({ display_name: "Robin" })).toBeNull();
  });
});
