import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  FIXTURE_ACCOUNTS,
  FIXTURE_EVENTS,
  FIXTURE_INVITE_STATUSES,
  FIXTURE_PLAYERS,
  FIXTURE_TEAMS,
  fixtureCanRead,
  fixtureGreeting,
} from "@/test/fixtures";

function account(key: string) {
  const found = FIXTURE_ACCOUNTS.find((a) => a.key === key);
  if (!found) throw new Error(`Saknar fixtur ${key}`);
  return found;
}

describe("baslinje: testdata täcker alla roller och lägen", () => {
  it("har två lag med unika koder", () => {
    expect(FIXTURE_TEAMS).toHaveLength(2);
    const codes = FIXTURE_TEAMS.flatMap((t) => [t.joinCode, t.coachJoinCode]);
    expect(new Set(codes).size).toBe(codes.length);
    for (const code of codes) expect(code).toMatch(/^[A-Z0-9]{6}$/);
  });

  it("har tränare, väntande tränare, spelarkonto och vårdnadshavare", () => {
    expect(account("coachPending").memberships[0]?.status).toBe("pending");
    expect(account("playerAccount").memberships[0]?.role).toBe("player");
    expect(account("guardianOneChild").memberships[0]?.role).toBe("guardian");

    expect(account("guardianTwoChildren").guardianForNames).toHaveLength(2);
    const roles = account("coachAndGuardian").memberships.map((m) => m.role);
    expect(roles).toContain("coach");
    expect(roles).toContain("guardian");
  });

  it("har spelare med och utan eget konto", () => {
    expect(FIXTURE_PLAYERS.some((p) => p.account)).toBe(true);
    expect(FIXTURE_PLAYERS.some((p) => !p.account && p.guardians.length > 0)).toBe(true);
  });

  it("har kommande träning, kommande match, tidigare aktivitet och inställd aktivitet", () => {
    const states = FIXTURE_EVENTS.map((e) => `${e.kind}:${e.state}`);
    expect(states).toContain("training:upcoming");
    expect(states).toContain("match:upcoming");
    expect(states).toContain("training:past");
    expect(states).toContain("training:cancelled");
  });

  it("har aktivitet både med och utan registrerad närvaro", () => {
    expect(FIXTURE_EVENTS.some((e) => e.hasAttendance)).toBe(true);
    expect(FIXTURE_EVENTS.some((e) => !e.hasAttendance)).toBe(true);
  });

  it("täcker alla fyra kallelsestatusar", () => {
    const used = new Set(FIXTURE_EVENTS.flatMap((e) => e.invites.map((i) => i.status)));
    for (const status of FIXTURE_INVITE_STATUSES) expect(used).toContain(status);
  });
});

describe("baslinje: namn och lagseparation", () => {
  it("hälsar med namnet, aldrig e-postadressen", () => {
    for (const acc of FIXTURE_ACCOUNTS) {
      const greeting = fixtureGreeting(acc);
      expect(greeting).toBe(`Hej ${acc.displayName}`);
      expect(greeting).not.toContain("@");
    }
  });

  it("visar vårdnadshavaren som Hej Maria och barnet som Elias", () => {
    const maria = account("guardianOneChild");
    expect(fixtureGreeting(maria)).toBe("Hej Maria");
    expect(maria.displayName).not.toContain("vårdnadshavare");
    expect(maria.guardianForNames).toEqual(["Elias"]);
  });

  it("faller tillbaka till Hej! utan namn", () => {
    expect(fixtureGreeting({ displayName: "  " })).toBe("Hej!");
  });

  it("låter inte ett lag läsa det andra lagets data", () => {
    expect(fixtureCanRead(account("coachA"), "teamA")).toBe(true);
    expect(fixtureCanRead(account("coachA"), "teamB")).toBe(false);
    expect(fixtureCanRead(account("playerAccount"), "teamB")).toBe(false);
    expect(fixtureCanRead(account("guardianOneChild"), "teamB")).toBe(false);
  });

  it("ger inte en väntande tränare läsrättigheter", () => {
    expect(fixtureCanRead(account("coachPending"), "teamA")).toBe(false);
  });
});

describe("regressionsmarkering: punkt 7 får inte byggas", () => {
  const matchPlan = readFileSync("src/lib/match-plan.ts", "utf8");


  it("matchens laguppställning har bara den befintliga taktikkopplingen", () => {
    const tacticFields = [...matchPlan.matchAll(/\btactic[A-Za-z_]*\b/g)].map((m) => m[0]);
    for (const field of tacticFields) expect(["tactic_id", "tacticId"]).toContain(field);
  });


  it("matchplanen skapar inga taktikversioner eller frames", () => {
    expect(matchPlan).not.toMatch(/tactic_frames|tactic_versions|saveTacticVersion|createTactic/);
  });

  it("matchplanens sparade fält är oförändrade", () => {
    const lineupType = matchPlan.slice(
      matchPlan.indexOf("export type MatchLineup"),
      matchPlan.indexOf("/** Antal startspelare"),
    );
    const fields = [...lineupType.matchAll(/^\s{2}([a-z_]+):/gm)].map((m) => m[1]);
    expect(fields).toEqual(["event_id", "team_id", "formation", "slots", "bench", "tactic_id"]);
  });
});
