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
      expect(row).toBeDefined();
      if (!row) throw new Error("Matchen saknas i testunderlaget.");
      expect(new Date(row.starts_at).toISOString()).toBe("2026-10-20T17:00:00.000Z");
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

describe.sequential("inbjudningar, ägarskydd och städning i PostgreSQL", () => {
  beforeAll(async () => {
    db = new PGlite();
    const sql = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
    await db.exec(sql("./fixtures/review-baseline.sql"));
    await db.exec(sql("../../supabase/migrations/20261015220000_review_functional_fixes.sql"));
    await db.exec(sql("./fixtures/e2e-review-baseline.sql"));
    await db.exec(sql("../../drizzle/migrations/0001_e2e_invite_owner_reminder_club_fixes.sql"));
  }, 30_000);

  beforeEach(async () => {
    await db.exec(`RESET ROLE; SET app.uid='';
      TRUNCATE teams,team_members,clubs,team_invites,events,players,event_invitations,player_guardians,app_notifications,user_roles CASCADE;
      INSERT INTO clubs VALUES ('${id(40)}','Provklubben','${owner}');
      INSERT INTO teams (id,name,created_by,club_id,age_group) VALUES ('${team}','Provlaget','${owner}','${id(40)}','P2016');
      INSERT INTO team_members VALUES
        ('${team}','${owner}','head_coach','approved'),('${team}','${colleague}','coach','approved'),
        ('${team}','${guardian}','guardian','approved');
      INSERT INTO players (id,team_id,user_id,name) VALUES ('${player}','${team}','${owner}','Provspelaren');
      INSERT INTO player_guardians VALUES ('${player}','${guardian}',true);
      INSERT INTO events (id,team_id,type,starts_at) VALUES ('${match}','${team}','match',now()+interval '1 day');
      INSERT INTO event_invitations (event_id,team_id,player_id) VALUES ('${match}','${team}','${player}');
    `);
  });
  afterAll(async () => { await db?.close(); });

  it("förhandsvisar en riktig personlig inbjudan som anonym med klubbnamn", async () => {
    await db.exec(`INSERT INTO team_invites (team_id,token,role,email,expires_at)
      VALUES ('${team}','provtoken','coach','test@example.invalid',now()+interval '1 day');
      SET ROLE anon;`);
    try {
      const result = await db.query("SELECT state,team_name,club_name,age_group,invite_role,email_locked FROM preview_team_invite('provtoken')");
      expect(result.rows).toEqual([{ state: "active", team_name: "Provlaget", club_name: "Provklubben", age_group: "P2016", invite_role: "coach", email_locked: true }]);
      expect((await db.query("SELECT state FROM preview_team_invite('saknas')")).rows).toEqual([{ state: "invalid" }]);
    } finally { await db.exec("RESET ROLE;"); }
  });

  it("stoppar en ledare från att ta bort lagägaren med rätt felkod", async () => {
    await expect(asUser(colleague, "DELETE FROM team_members WHERE team_id=$1 AND user_id=$2", [team, owner]))
      .rejects.toMatchObject({ code: "42501", message: "Lagets ägare kan inte tas bort. Överlåt laget först." });
    expect((await db.query("SELECT is_team_coach($1,$2) AS allowed", [team, owner])).rows).toEqual([{ allowed: true }]);
  });

  it("stoppar nedgradering och ej godkänd status för lagägaren", async () => {
    for (const change of ["role='player'", "status='pending'"]) {
      await expect(asUser(colleague, `UPDATE team_members SET ${change} WHERE team_id=$1 AND user_id=$2`, [team, owner]))
        .rejects.toMatchObject({ code: "42501", message: "Lagets ägare måste vara en godkänd ledare. Överlåt laget först." });
    }
  });

  it("behåller överlåtelse och lämna-funktionen utan att släppa ägarskyddet", async () => {
    await expect(asUser(owner, "SELECT leave_team($1)", [team])).rejects.toThrow("Du har skapat laget");
    await asUser(owner, "SELECT transfer_team_ownership($1,$2)", [team, colleague]);
    await asUser(owner, "SELECT leave_team($1)", [team]);
    expect((await db.query("SELECT user_id FROM team_members WHERE team_id=$1 AND role IN ('coach','head_coach')", [team])).rows).toEqual([{ user_id: colleague }]);
  });

  it("tillåter plattformsadmin och underhåll utan inloggad användare", async () => {
    await db.exec(`INSERT INTO user_roles VALUES ('${outsider}','admin');`);
    await asUser(outsider, "UPDATE team_members SET role='player' WHERE user_id=$1", [owner]);
    await db.exec(`SET app.uid=''; DELETE FROM team_members WHERE user_id='${owner}';`);
    expect((await db.query("SELECT user_id FROM team_members WHERE user_id=$1", [owner])).rows).toHaveLength(0);
  });

  it("anropar påminnelser två gånger i samma transaktion utan dubbla notiser", async () => {
    await db.exec(`BEGIN; SET ROLE authenticated; SET app.uid='${owner}';`);
    try {
      const first = await db.query("SELECT * FROM send_invite_reminders($1,'Påminnelse','Svara')", [match]);
      const second = await db.query("SELECT * FROM send_invite_reminders($1,'Påminnelse','Svara')", [match]);
      expect(first.rows).toEqual([{ sent: 1, skipped_recent: 0, missing_account: 0, unreachable_players: "" }]);
      expect(second.rows).toEqual([{ sent: 0, skipped_recent: 1, missing_account: 0, unreachable_players: "" }]);
      expect((await db.query("SELECT count(*)::int AS n FROM app_notifications")).rows).toEqual([{ n: 1 }]);
    } finally { await db.exec("ROLLBACK; RESET ROLE;"); }
  });

  it.each(["coach", "head_coach", "club_admin"])("räknar godkänd %s som ledare i mottagarförhandsvisningen", async (role) => {
    await db.query("UPDATE team_members SET role=$1 WHERE user_id=$2", [role, owner]);
    const result = await asUser(owner, "SELECT preview_announcement_audience($1,NULL,'manual',$2) AS audience", [team, [owner, guardian]]);
    expect(result.rows).toEqual([{ audience: { recipients: 2, coaches: 1, players: 0, guardians: 1, without_account: 0 } }]);
  });

  it("raderar laget och ägarens tomma klubb", async () => {
    await asUser(owner, "SELECT delete_own_team($1)", [team]);
    expect((await db.query("SELECT id FROM teams WHERE id=$1", [team])).rows).toHaveLength(0);
    expect((await db.query("SELECT user_id FROM team_members WHERE team_id=$1", [team])).rows).toHaveLength(0);
    expect((await db.query("SELECT id FROM clubs WHERE id=$1", [id(40)])).rows).toHaveLength(0);
  });

  it("bevarar klubben när ett annat lag använder den", async () => {
    await db.query("INSERT INTO teams (id,name,created_by,club_id) VALUES ($1,'Annat lag',$2,$3)", [otherTeam, outsider, id(40)]);
    await asUser(owner, "SELECT delete_own_team($1)", [team]);
    expect((await db.query("SELECT id FROM clubs WHERE id=$1", [id(40)])).rows).toHaveLength(1);
    expect((await db.query("SELECT club_id FROM teams WHERE id=$1", [otherTeam])).rows).toEqual([{ club_id: id(40) }]);
  });

  it("bevarar en tom klubb som skapats av någon annan", async () => {
    await db.query("UPDATE clubs SET created_by=$1 WHERE id=$2", [outsider, id(40)]);
    await asUser(owner, "SELECT delete_own_team($1)", [team]);
    expect((await db.query("SELECT id FROM clubs WHERE id=$1", [id(40)])).rows).toHaveLength(1);
  });
});
