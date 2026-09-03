import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

async function assertAdmin(context: { supabase: any; userId: string }) {
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
  details: Record<string, unknown> = {},
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
    await assertAdmin(context as any);
    const db = await admin();

    const users: { id: string; email?: string | null; created_at: string; last_sign_in_at?: string | null; email_confirmed_at?: string | null }[] = [];
    for (let page = 1; page <= 20; page += 1) {
      const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
      if (error) throw new Error(error.message);
      users.push(...(data.users as any[]));
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
    await assertAdmin(context as any);
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
    await assertAdmin(context as any);
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

/** Raderar ett lag med allt innehåll. */
export const deleteTeam = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ teamId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as any);
    const db = await admin();

    const { data: team } = await db.from("teams").select("name").eq("id", data.teamId).maybeSingle();
    const { data: events } = await db.from("events").select("id").eq("team_id", data.teamId);
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
      await db.from(table).delete().eq("team_id", data.teamId);
    }
    await db.from("events").delete().eq("team_id", data.teamId);
    await db.from("players").delete().eq("team_id", data.teamId);
    await db.from("tactics").update({ team_id: null }).eq("team_id", data.teamId);

    const { error } = await db.from("teams").delete().eq("id", data.teamId);
    if (error) throw new Error(error.message);

    await log(context.userId, "delete_team", "team", data.teamId, { name: team?.name ?? null });
    return { ok: true as const };
  });
