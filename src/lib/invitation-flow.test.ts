import { describe, expect, it } from "vitest";
import { ATTENDANCE_STATUSES } from "./attendance";
import {
  COACH_ONLY_TEXT,
  INVITE_STATUSES,
  NO_PLAYER_LINK_TEXT,
  countInvitations,
  emptyInviteMessage,
} from "./invitations";

/** Enkel modell av kallelseflödet, speglar reglerna i databasen. */
function createInvitations(
  eventId: string,
  playerIds: string[],
  existing: Array<{ event_id: string; player_id: string }> = [],
) {
  const rows = [...existing];
  for (const playerId of playerIds) {
    const duplicate = rows.some((row) => row.event_id === eventId && row.player_id === playerId);
    if (duplicate) continue;
    rows.push({ event_id: eventId, player_id: playerId });
  }
  return rows;
}

describe("kallelseflödet för två testspelare", () => {
  const players = ["TEST Kallelse A", "TEST Kallelse B"];

  it("skapar en kallelse per spelare med statusen Ej svarat", () => {
    const rows = createInvitations("event-1", players).map((row) => ({
      ...row,
      status: "pending",
    }));
    expect(rows).toHaveLength(2);
    expect(countInvitations(rows)).toMatchObject({
      pending: 2,
      attending: 0,
      declined: 0,
      maybe: 0,
    });
  });

  it("uppdaterar räknarna när svaren ändras", () => {
    let rows = [
      { player_id: players[0]!, status: "pending" },
      { player_id: players[1]!, status: "pending" },
    ];
    rows = rows.map((row) =>
      row.player_id === players[0] ? { ...row, status: "attending" } : row,
    );
    rows = rows.map((row) => (row.player_id === players[1] ? { ...row, status: "maybe" } : row));
    expect(countInvitations(rows)).toMatchObject({ attending: 1, maybe: 1, pending: 0 });

    rows = rows.map((row) => (row.player_id === players[1] ? { ...row, status: "declined" } : row));
    expect(countInvitations(rows)).toMatchObject({
      attending: 1,
      declined: 1,
      maybe: 0,
      pending: 0,
    });
  });

  it("blockerar dubbletter av samma kallelse", () => {
    const first = createInvitations("event-1", players);
    const second = createInvitations("event-1", players, first);
    expect(second).toHaveLength(2);
  });

  it("håller kallelsesvar och faktisk närvaro helt åtskilda", () => {
    for (const status of INVITE_STATUSES) {
      expect(ATTENDANCE_STATUSES as readonly string[]).not.toContain(status);
    }
    for (const status of ATTENDANCE_STATUSES) {
      expect(INVITE_STATUSES as string[]).not.toContain(status);
    }
  });
});

describe("tomläget i Mina kallelser", () => {
  it("förklarar att kontot saknar spelarkoppling", () => {
    expect(emptyInviteMessage({ hasPlayerLink: false, isCoach: false, showPast: false })).toEqual([
      NO_PLAYER_LINK_TEXT,
    ]);
  });

  it("lägger till en förklaring för ledare utan spelarkort", () => {
    expect(emptyInviteMessage({ hasPlayerLink: false, isCoach: true, showPast: false })).toEqual([
      NO_PLAYER_LINK_TEXT,
      COACH_ONLY_TEXT,
    ]);
  });

  it("visar inga tekniska identifierare i hjälptexterna", () => {
    const texts = emptyInviteMessage({ hasPlayerLink: false, isCoach: true, showPast: false }).join(
      " ",
    );
    expect(texts).not.toMatch(/uuid|user_id|player_id|member_user_id|table|select/i);
  });

  it("behåller den korta texten när kontot är kopplat", () => {
    expect(emptyInviteMessage({ hasPlayerLink: true, isCoach: false, showPast: false })).toEqual([
      "Du har inga kallelser just nu.",
    ]);
    expect(emptyInviteMessage({ hasPlayerLink: true, isCoach: false, showPast: true })).toEqual([
      "Inga tidigare kallelser.",
    ]);
  });
});
