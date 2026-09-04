import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  approvalHelpText,
  duplicateNames,
  needsPlayerCard,
  playerOptionLabel,
} from "./join-approval";

const read = (path: string) => readFileSync(path, "utf8");
const migrations = readdirSync("supabase/migrations")
  .map((file) => read(`supabase/migrations/${file}`))
  .join("\n");

describe("godkänna ansökan", () => {
  it("kräver spelarkort för spelare och vårdnadshavare, men inte för ledare", () => {
    expect(needsPlayerCard("player")).toBe(true);
    expect(needsPlayerCard("guardian")).toBe(true);
    expect(needsPlayerCard("coach")).toBe(false);
    expect(needsPlayerCard("head_coach")).toBe(false);
    expect(needsPlayerCard(null)).toBe(false);
  });

  it("skiljer spelare med samma namn åt med tröjnummer", () => {
    const players = [
      { id: "1", name: "Ella Andersson", number: 7 },
      { id: "2", name: "Ella Andersson", number: 12 },
      { id: "3", name: "Noa Berg", number: null },
    ];
    expect(players.map(playerOptionLabel)).toEqual([
      "#7 Ella Andersson",
      "#12 Ella Andersson",
      "Noa Berg",
    ]);
    expect(duplicateNames(players)).toEqual(["ella andersson"]);
    expect(approvalHelpText("player", players)).toContain("tröjnumret");
    expect(approvalHelpText("guardian", [players[2]!])).toContain("vårdnadshavare");
  });

  it("skickar med spelarkortet till databasen", () => {
    const teams = read("src/lib/teams.ts");
    expect(teams).toContain("playerId: string | null = null");
    expect(teams).toContain("_player_id: playerId");
  });

  it("låter tränaren välja kort i truppvyn", () => {
    const squad = read("src/routes/_authenticated/team.$teamId.index.tsx");
    expect(squad).toContain("needsPlayerCard(member.role)");
    expect(squad).toContain("playerOptionLabel(player)");
    expect(squad).toContain("approve.mutate({ id: member.id, playerId: null })");
  });

  it("har en migration som slutar gissa utifrån namn", () => {
    expect(migrations).toContain("DROP FUNCTION IF EXISTS public.approve_team_join_request(uuid)");
    expect(migrations).toContain("Välj vilket spelarkort personen hör till.");
    expect(migrations).toContain("Spelarkortet hör inte till det här laget.");
    expect(migrations).toContain("Ansökan är redan behandlad.");
    expect(migrations).toContain("Spelarkortet är redan kopplat till ett annat konto.");
    expect(migrations).toContain("Personen är redan vårdnadshavare för spelaren.");
    expect(migrations).toContain("FOR UPDATE");
  });
});
