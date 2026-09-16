import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

type AdminContext = {
  supabase: {
    rpc: (
      fn: string,
      args: Record<string, unknown>,
    ) => Promise<{ data: unknown; error: { message: string } | null }>;
  };
  userId: string;
};

async function assertAdmin(context: AdminContext) {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden");
}

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function log(
  actorId: string,
  action: string,
  targetType: string,
  targetId: string | null,
  details: Record<string, string | number | boolean | null> = {},
) {
  const db = await admin();
  await db.from("admin_audit_log").insert({
    actor_id: actorId,
    action,
    target_type: targetType,
    target_id: targetId,
    details,
  });
}

export type AdminAccount = {
  id: string;
  email: string | null;
  displayName: string | null;
  createdAt: string;
  lastSignInAt: string | null;
  confirmed: boolean;
  roles: string[];
  teams: { teamId: string; teamName: string; role: string; status: string }[];
};

/** Alla konton med e-post, roller och lagtillhörighet. Endast för plattformsadmin. */
export const listAccounts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminAccount[]> => {
    await assertAdmin(context as unknown as AdminContext);
    const db = await admin();

    const users: {
      id: string;
      email?: string | null;
      created_at: string;
      last_sign_in_at?: string | null;
      email_confirmed_at?: string | null;
    }[] = [];
    for (let page = 1; page <= 20; page += 1) {
      const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
      if (error) throw new Error(error.message);
      users.push(...(data.users as typeof users));
      if (!data.users.length || data.users.length < 200) break;
    }

    const [profiles, roles, members, teams] = await Promise.all([
      db.from("profiles").select("id, display_name"),
      db.from("user_roles").select("user_id, role"),
      db.from("team_members").select("team_id, user_id, role, status"),
      db.from("teams").select("id, name"),
    ]);

    const teamName = new Map((teams.data ?? []).map((t) => [t.id, t.name]));

    return users
      .map((user) => ({
        id: user.id,
        email: user.email ?? null,
        displayName: (profiles.data ?? []).find((p) => p.id === user.id)?.display_name ?? null,
        createdAt: user.created_at,
        lastSignInAt: user.last_sign_in_at ?? null,
        confirmed: Boolean(user.email_confirmed_at),
        roles: (roles.data ?? []).filter((r) => r.user_id === user.id).map((r) => r.role as string),
        teams: (members.data ?? [])
          .filter((m) => m.user_id === user.id)
          .map((m) => ({
            teamId: m.team_id,
            teamName: teamName.get(m.team_id) ?? "Okänt lag",
            role: m.role,
            status: m.status,
          })),
      }))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  });

/** Ger eller tar bort global adminroll. */
export const setAdminRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ userId: z.string().uuid(), makeAdmin: z.boolean() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context as unknown as AdminContext);
    const db = await admin();

    if (data.makeAdmin) {
      const { error } = await db
        .from("user_roles")
        .upsert({ user_id: data.userId, role: "admin" }, { onConflict: "user_id,role" });
      if (error) throw new Error(error.message);
    } else {
      const { count } = await db
        .from("user_roles")
        .select("id", { count: "exact", head: true })
        .eq("role", "admin");
      if ((count ?? 0) <= 1) throw new Error("Det måste finnas minst en administratör kvar.");
      const { error } = await db
        .from("user_roles")
        .delete()
        .eq("user_id", data.userId)
        .eq("role", "admin");
      if (error) throw new Error(error.message);
    }

    await log(context.userId, data.makeAdmin ? "grant_admin" : "revoke_admin", "user", data.userId);
    return { ok: true as const };
  });

/** Raderar ett konto och kopplade personuppgifter. */
export const deleteAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ userId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as unknown as AdminContext);
    if (data.userId === context.userId) throw new Error("Du kan inte radera ditt eget konto här.");
    const db = await admin();

    await db.from("team_members").delete().eq("user_id", data.userId);
    await db.from("user_roles").delete().eq("user_id", data.userId);
    await db.from("player_guardians").delete().eq("guardian_user_id", data.userId);
    await db.from("players").update({ member_user_id: null }).eq("member_user_id", data.userId);
    await db.from("app_notifications").delete().eq("user_id", data.userId);

    const { error } = await db.auth.admin.deleteUser(data.userId);
    if (error) throw new Error(error.message);

    await log(context.userId, "delete_account", "user", data.userId);
    return { ok: true as const };
  });

type AdminDb = Awaited<ReturnType<typeof admin>>;

/** Tar bort alla rader som hänger på spelarkorten innan korten raderas. */
async function purgePlayers(db: AdminDb, playerIds: string[]) {
  if (!playerIds.length) return;
  for (const table of [
    "event_attendance",
    "event_invitations",
    "event_squad",
    "player_observations",
    "player_focus_areas",
    "player_stats",
    "player_guardians",
    "session_run_attendance",
    "session_run_player_notes",
  ] as const) {
    await db.from(table).delete().in("player_id", playerIds);
  }
  await db
    .from("team_invites")
    .update({ target_player_id: null })
    .in("target_player_id", playerIds);
  const { error } = await db.from("players").delete().in("id", playerIds);
  if (error) throw new Error(error.message);
}

/** Raderar ett lag med allt innehåll. */
async function purgeTeam(db: AdminDb, teamId: string) {
  const { data: team } = await db.from("teams").select("name").eq("id", teamId).maybeSingle();
  const { data: events } = await db.from("events").select("id").eq("team_id", teamId);
  const eventIds = (events ?? []).map((e) => e.id);

  if (eventIds.length) {
    for (const table of [
      "event_attendance",
      "event_coaches",
      "event_invitations",
      "event_plans",
      "event_resources",
      "event_squad",
      "match_lineups",
      "match_shares",
    ] as const) {
      await db.from(table).delete().in("event_id", eventIds);
    }
  }

  for (const table of [
    "player_observations",
    "player_focus_areas",
    "player_stats",
    "team_chat_messages",
    "team_photos",
    "team_invites",
    "team_periods",
    "coach_sessions",
    "team_members",
  ] as const) {
    await db.from(table).delete().eq("team_id", teamId);
  }
  await db.from("events").delete().eq("team_id", teamId);
  await db.from("players").delete().eq("team_id", teamId);
  await db.from("tactics").update({ team_id: null }).eq("team_id", teamId);

  const { error } = await db.from("teams").delete().eq("id", teamId);
  if (error) throw new Error(error.message);
  return team?.name ?? null;
}

/** Raderar ett lag med allt innehåll. */
export const deleteTeam = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ teamId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as unknown as AdminContext);
    const db = await admin();
    const name = await purgeTeam(db, data.teamId);
    await log(context.userId, "delete_team", "team", data.teamId, { name });
    return { ok: true as const };
  });

/** Raderar flera lag på en gång. */
export const deleteTeams = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ teamIds: z.array(z.string().uuid()).min(1).max(100) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context as unknown as AdminContext);
    const db = await admin();
    for (const teamId of data.teamIds) {
      const name = await purgeTeam(db, teamId);
      await log(context.userId, "delete_team", "team", teamId, { name });
    }
    return { ok: true as const, deleted: data.teamIds.length };
  });

/** Raderar flera klubbar med alla deras lag och allt laginnehåll. */
export const deleteClubs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ clubIds: z.array(z.string().uuid()).min(1).max(100) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context as unknown as AdminContext);
    const db = await admin();

    const { data: teams } = await db.from("teams").select("id").in("club_id", data.clubIds);
    let deletedTeams = 0;
    for (const team of teams ?? []) {
      const name = await purgeTeam(db, team.id);
      deletedTeams += 1;
      await log(context.userId, "delete_team", "team", team.id, { name });
    }

    const { error } = await db.from("clubs").delete().in("id", data.clubIds);
    if (error) throw new Error(error.message);
    for (const clubId of data.clubIds) {
      await log(context.userId, "delete_club", "club", clubId, { teams: deletedTeams });
    }
    return { ok: true as const, deletedClubs: data.clubIds.length, deletedTeams };
  });

/** Raderar flera spelarkort på en gång. */
export const deletePlayers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ playerIds: z.array(z.string().uuid()).min(1).max(200) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context as unknown as AdminContext);
    const db = await admin();
    await purgePlayers(db, data.playerIds);
    for (const playerId of data.playerIds) {
      await log(context.userId, "delete_player", "player", playerId);
    }
    return { ok: true as const, deleted: data.playerIds.length };
  });

/** Raderar flera konton på en gång. */
export const deleteAccounts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ userIds: z.array(z.string().uuid()).min(1).max(100) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context as unknown as AdminContext);
    const db = await admin();
    let deleted = 0;
    for (const userId of data.userIds) {
      if (userId === context.userId) continue;
      await db.from("team_members").delete().eq("user_id", userId);
      await db.from("user_roles").delete().eq("user_id", userId);
      await db.from("player_guardians").delete().eq("guardian_user_id", userId);
      await db.from("players").update({ member_user_id: null }).eq("member_user_id", userId);
      await db.from("app_notifications").delete().eq("user_id", userId);
      const { error } = await db.auth.admin.deleteUser(userId);
      if (error) throw new Error(error.message);
      await log(context.userId, "delete_account", "user", userId);
      deleted += 1;
    }
    return { ok: true as const, deleted };
  });
