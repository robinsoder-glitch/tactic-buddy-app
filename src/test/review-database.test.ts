import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const owner = id(1),
  colleague = id(2),
  playerUser = id(3),
  guardian = id(4),
  pending = id(5),
  outsider = id(6);
const team = id(10),
  otherTeam = id(11),
  training = id(20),
  match = id(21),
  otherTraining = id(22),
  player = id(30),
  revokedPlayer = id(31);
const oldTime = "2026-10-20T17:00:00Z";
let db: PGlite;

async function asUser(userId: string, sql: string, args: unknown[] = []) {
  await db.exec(`SET ROLE authenticated; SET app.uid='${userId}';`);
  try {
    return await db.query(sql, args);
  } finally {
    await db.exec("RESET ROLE;");
  }
}

async function saveTraining(userId: string, notes: string, eventId = training, targetTeam = team) {
  return asUser(userId, "SELECT save_training_plan_v2($1,$2,$3,$4,$5,$6)", [
    eventId,
    targetTeam,
    notes,
    ["Passning"],
    "Hitta fri spelare",
    JSON.stringify([
      { kind: "drill", resource_id: "test-drill", minutes: 10, details: { purpose: "Test" } },
    ]),
  ]);
}

async function saveMatch(userId: string, updateEvent = false, startsAt = oldTime) {
  return asUser(userId, "SELECT save_match_plan($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)", [
    match,
    team,
    userId === owner ? "Original" : "Kollegans ändring",
    [player],
    [userId],
    "5v5",
    "[]",
    [],
    null,
    0,
    updateEvent,
    "Testplan",
    startsAt,
  ]);
}

describe.sequential("behörigheter och atomisk planering i PostgreSQL", () => {
  beforeAll(async () => {
    db = new PGlite();
    await db.exec(readFileSync(new URL("./fixtures/review-baseline.sql", import.meta.url), "utf8"));
    const migration = readFileSync(
      new URL(
        "../../supabase/migrations/20261015220000_review_functional_fixes.sql",
        import.meta.url,
      ),
      "utf8",
    );
    await db.exec(migration);
    // Även ett upprepat körförsök ska vara ofarligt.
    await db.exec(migration);
  }, 30_000);

  beforeEach(async () => {
    await db.exec(`RESET ROLE; SET app.uid='';
      TRUNCATE teams,team_members,events,players,event_plans,event_resources,event_squad,event_coaches,match_lineups,event_invitations,player_guardians,event_change_log,app_notifications,user_roles;
      INSERT INTO teams VALUES ('${team}','Testlag','${owner}'),('${otherTeam}','Annat lag','${outsider}');
      INSERT INTO team_members VALUES
        ('${team}','${owner}','head_coach','approved'),('${team}','${colleague}','coach','approved'),
        ('${team}','${playerUser}','player','approved'),('${team}','${guardian}','guardian','approved'),
        ('${team}','${pending}','coach','pending'),('${otherTeam}','${outsider}','coach','approved');
      INSERT INTO events (id,team_id,type,location,starts_at) VALUES
        ('${training}','${team}','training','Testplan','${oldTime}'),
        ('${match}','${team}','match','Testplan','${oldTime}'),
        ('${otherTraining}','${otherTeam}','training','Annan plan','${oldTime}');
      INSERT INTO players VALUES ('${player}','${team}','${owner}','${playerUser}'),('${revokedPlayer}','${team}','${owner}','${pending}');
      INSERT INTO event_invitations (event_id,team_id,player_id,status) VALUES
        ('${match}','${team}','${player}','pending'),('${match}','${team}','${revokedPlayer}','revoked');
      INSERT INTO player_guardians VALUES ('${player}','${guardian}',true);
    `);
  });
  afterAll(async () => {
    await db?.close();
  });

  it("låter en ledare ändra laguppgifter men stoppar ägarövertagande och radering", async () => {
    await asUser(colleague, "UPDATE teams SET name='Uppdaterat namn' WHERE id=$1", [team]);
    await expect(
      asUser(colleague, "UPDATE teams SET created_by=$1 WHERE id=$2", [colleague, team]),
    ).rejects.toThrow("Bara lagets ägare");
    await expect(
      asUser(colleague, "SELECT transfer_team_ownership($1,$2)", [team, colleague]),
    ).rejects.toThrow("Bara lagets ägare");
    const deleted = await asUser(colleague, "DELETE FROM teams WHERE id=$1 RETURNING id", [team]);
    expect(deleted.rows).toHaveLength(0);
    expect((await db.query("SELECT created_by FROM teams WHERE id=$1", [team])).rows[0]).toEqual({
      created_by: owner,
    });
  });

  it("låter ägaren överlåta laget utan att ändra mottagarens ledarroll", async () => {
    await asUser(owner, "SELECT transfer_team_ownership($1,$2)", [team, colleague]);
    expect((await db.query("SELECT created_by FROM teams WHERE id=$1", [team])).rows[0]).toEqual({
      created_by: colleague,
    });
    expect(
      (await db.query("SELECT role FROM team_members WHERE user_id=$1", [colleague])).rows[0],
    ).toEqual({ role: "coach" });
  });

  it("nekar överlåtelse till väntande ledare, spelare och ledare från andra lag", async () => {
    for (const target of [pending, playerUser, outsider]) {
      await expect(
        asUser(owner, "SELECT transfer_team_ownership($1,$2)", [team, target]),
      ).rejects.toThrow("godkänd ledare");
    }
  });

  it("låter kollegan uppdatera en träningsplan och bevarar skaparen", async () => {
    await saveTraining(owner, "Original");
    await saveTraining(colleague, "Kollegans ändring");
    expect(
      (await db.query("SELECT notes,created_by FROM event_plans WHERE event_id=$1", [training]))
        .rows[0],
    ).toEqual({ notes: "Kollegans ändring", created_by: owner });
    expect((await db.query("SELECT count(*)::int AS n FROM event_resources")).rows[0]).toEqual({
      n: 1,
    });
  });

  it("låter kollegan uppdatera en matchplan och bevarar skaparen", async () => {
    await saveMatch(owner);
    await saveMatch(colleague);
    expect(
      (await db.query("SELECT notes,created_by FROM event_plans WHERE event_id=$1", [match]))
        .rows[0],
    ).toEqual({ notes: "Kollegans ändring", created_by: owner });
  });

  it("nekar spelare, vårdnadshavare, väntande ledare och utomstående att spara planen", async () => {
    for (const userId of [playerUser, guardian, pending, outsider]) {
      await expect(saveTraining(userId, "Otillåten ändring")).rejects.toThrow();
      await expect(saveMatch(userId)).rejects.toThrow();
    }
    expect((await db.query("SELECT count(*)::int AS n FROM event_plans")).rows[0]).toEqual({
      n: 0,
    });
  });

  it("stoppar träningsplaner med fel lag eller en match som mål", async () => {
    await expect(saveTraining(owner, "Fel lag", otherTraining)).rejects.toThrow(
      "Träningen hittades inte",
    );
    await expect(saveTraining(owner, "Fel typ", match)).rejects.toThrow("Träningen hittades inte");
  });

  it("sparar ändrad matchtid och notis till aktiva mottagare tillsammans", async () => {
    await saveMatch(owner);
    await saveMatch(colleague, true, "2026-10-20T18:00:00Z");
    const notices = await db.query<{ user_id: string }>(
      "SELECT user_id FROM app_notifications ORDER BY user_id",
    );
    expect(notices.rows.map((row) => row.user_id)).toEqual([playerUser, guardian]);
    expect((await db.query("SELECT count(*)::int AS n FROM event_change_log")).rows[0]).toEqual({
      n: 1,
    });
    await saveMatch(colleague, true, "2026-10-20T18:00:00Z");
    expect((await db.query("SELECT count(*)::int AS n FROM app_notifications")).rows[0]).toEqual({
      n: 2,
    });
  });

  it("rullar tillbaka tidsändringen om ändringsloggen inte kan sparas", async () => {
    await saveMatch(owner);
    await db.exec("ALTER TABLE event_change_log ADD CONSTRAINT test_log_failure CHECK (false);");
    try {
      await expect(saveMatch(colleague, true, "2026-10-20T18:00:00Z")).rejects.toThrow(
        "test_log_failure",
      );
      const row = (
        await db.query<{ starts_at: Date }>("SELECT starts_at FROM events WHERE id=$1", [match])
      ).rows[0];
      expect(new Date(row!.starts_at).toISOString()).toBe("2026-10-20T17:00:00.000Z");
    } finally {
      await db.exec("ALTER TABLE event_change_log DROP CONSTRAINT test_log_failure;");
    }
  });

  it("använder samma skydd för aktivitetsdialogens sparfunktion", async () => {
    await asUser(colleague, "SELECT save_event_details($1,$2,NULL,NULL,$3)", [
      match,
      "2026-10-20T18:00:00Z",
      "Ny testplan",
    ]);
    expect((await db.query("SELECT count(*)::int AS n FROM event_change_log")).rows[0]).toEqual({
      n: 1,
    });
    await expect(
      asUser(playerUser, "SELECT save_event_details($1,$2,NULL,NULL,$3)", [
        match,
        oldTime,
        "Otillåten",
      ]),
    ).rejects.toThrow();
  });
});
