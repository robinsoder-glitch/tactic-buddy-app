import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/**
 * Raderar ett lag som lagets skapare. Spelarkort tas bort med laget, och
 * spelar- och vårdnadshavarkonton som bara fanns i det här laget raderas helt
 * (profil + inloggning) så att ingen familj ligger kvar efter ett nedlagt lag.
 */
export const deleteTeamWithMembers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { teamId: string }) =>
    z.object({ teamId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: team, error: teamError } = await supabase
      .from("teams")
      .select("id, name, created_by")
      .eq("id", data.teamId)
      .maybeSingle();
    if (teamError) throw new Error(teamError.message);
    if (!team) throw new Error("Laget finns inte.");
    if (team.created_by !== userId)
      throw new Error("Bara tränaren som skapade laget kan radera det.");

    // Spelare och vårdnadshavare i laget – kandidater för kontoradering.
    const { data: members, error: membersError } = await supabase
      .from("team_members")
      .select("user_id, role")
      .eq("team_id", data.teamId)
      .in("role", ["player", "guardian"]);
    if (membersError) throw new Error(membersError.message);
    const candidates = [...new Set((members ?? []).map((m) => m.user_id as string))].filter(
      (id) => id !== userId,
    );

    const { data: result, error: deleteError } = await supabase.rpc("delete_own_team", {
      _team_id: data.teamId,
    });
    if (deleteError) throw new Error(deleteError.message);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let deletedAccounts = 0;
    for (const id of candidates) {
      const { data: rest, error: restError } = await supabaseAdmin
        .from("team_members")
        .select("id")
        .eq("user_id", id)
        .limit(1);
      if (restError) continue;
      if ((rest ?? []).length > 0) continue; // med i ett annat lag – behåll kontot

      await supabaseAdmin.from("player_guardians").delete().eq("guardian_user_id", id);
      await supabaseAdmin.from("profiles").delete().eq("id", id);
      const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(id);
      if (!authError) deletedAccounts += 1;
    }

    const name =
      (result as { team_name?: string } | null)?.team_name ?? (team.name as string) ?? "Laget";
    return { team_name: name, deleted_accounts: deletedAccounts };
  });
