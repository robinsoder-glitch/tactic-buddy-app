import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { sendTemplateEmail } from "@/lib/email-templates/send-email";

/** Svensk datum- och tidstext, t.ex. "lördag 20 september kl. 11:00". */
function formatDateTime(value: string | null): string | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Stockholm",
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  })
    .format(date)
    .replace(/(\d{2}:\d{2})$/, "kl. $1");
}

function formatDate(value: string | null): string | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Stockholm",
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(date);
}

export type InvitationEmailResult = {
  sent: number;
  skipped: number;
  failed: number;
};

/**
 * Skickar kallelsen som mejl till spelarens eget konto och till kopplade
 * vårdnadshavare. Bara en ledare i laget får göra det. Mejlet är en kopia –
 * svaret registreras alltid i appen.
 */
export const sendInvitationEmails = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ eventId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }): Promise<InvitationEmailResult> => {
    const db = context.supabase;

    const { data: event, error: eventError } = await db
      .from("events")
      .select(
        "id, team_id, type, title, starts_at, meet_at, location, home_team, away_team, cancelled_at",
      )
      .eq("id", data.eventId)
      .maybeSingle();
    if (eventError) throw new Error(eventError.message);
    if (!event) throw new Error("Aktiviteten finns inte.");
    if (event.type !== "match") throw new Error("Mejlkallelser skickas bara för matcher.");
    if (event.cancelled_at) throw new Error("Matchen är inställd.");

    const { data: isCoach, error: coachError } = await db.rpc("is_team_coach", {
      _team_id: event.team_id,
      _user_id: context.userId,
    });
    if (coachError) throw new Error(coachError.message);
    if (!isCoach) throw new Error("Bara lagets ledare kan skicka mejlkallelser.");

    const { data: team } = await db.from("teams").select("name").eq("id", event.team_id).maybeSingle();

    const { data: invitations, error: inviteError } = await db
      .from("event_invitations")
      .select("id, player_id, message, respond_by, revoked_at, players(name, member_user_id)")
      .eq("event_id", data.eventId);
    if (inviteError) throw new Error(inviteError.message);

    const active = (invitations ?? []).filter((row) => !row.revoked_at);
    if (active.length === 0) return { sent: 0, skipped: 0, failed: 0 };

    const playerIds = active.map((row) => row.player_id as string);
    const { data: guardianRows, error: guardianError } = await db
      .from("player_guardians")
      .select("player_id, guardian_user_id")
      .in("player_id", playerIds)
      .eq("is_active", true);
    // Ett läsfel får aldrig se ut som att mottagare saknas – då avbryter vi
    // hellre hela utskicket än skickar till en ofullständig mottagarlista.
    if (guardianError) throw new Error("Kunde inte hämta kopplade vårdnadshavare.");

    const guardiansByPlayer = new Map<string, string[]>();
    for (const row of guardianRows ?? []) {
      const key = row.player_id as string;
      const list = guardiansByPlayer.get(key) ?? [];
      if (row.guardian_user_id) list.push(row.guardian_user_id as string);
      guardiansByPlayer.set(key, list);
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Uppslagningsfel skiljs från verklig avsaknad av e-post: felet räknas
    // som failed så tränaren ser att något gick snett, inte "skipped".
    const emailCache = new Map<string, { email: string | null; error: boolean }>();
    async function emailFor(userId: string): Promise<{ email: string | null; error: boolean }> {
      const cached = emailCache.get(userId);
      if (cached) return cached;
      const { data: user, error } = await supabaseAdmin.auth.admin.getUserById(userId);
      const entry = { email: error ? null : (user?.user?.email ?? null), error: Boolean(error) };
      emailCache.set(userId, entry);
      return entry;
    }

    const matchTitle =
      event.title ||
      [event.home_team, event.away_team].filter(Boolean).join(" – ") ||
      "Match";

    let sent = 0;
    let skipped = 0;
    let failed = 0;

    for (const invitation of active) {
      const player = (invitation as unknown as { players: { name: string | null } | null }).players;
      const recipients = new Set<string>();
      let lookupFailed = false;
      const memberUserId = (
        invitation as unknown as { players: { member_user_id: string | null } | null }
      ).players?.member_user_id;
      if (memberUserId) {
        const result = await emailFor(memberUserId);
        if (result.error) lookupFailed = true;
        else if (result.email) recipients.add(result.email);
      }
      for (const guardianId of guardiansByPlayer.get(invitation.player_id as string) ?? []) {
        const result = await emailFor(guardianId);
        if (result.error) lookupFailed = true;
        else if (result.email) recipients.add(result.email);
      }
      if (recipients.size === 0) {
        // Verklig avsaknad av mottagare är skipped – tekniskt fel är failed.
        if (lookupFailed) failed += 1;
        else skipped += 1;
        continue;
      }
      // Spårbart delresultat: vissa mottagare nåddes, andra gick inte att slå upp.
      if (lookupFailed) failed += 1;

      for (const recipient of recipients) {
        try {
          const result = await sendTemplateEmail("match-invitation", recipient, {
            idempotencyKey: `match-invitation-${invitation.id}-${recipient}`,
            templateData: {
              playerName: player?.name ?? undefined,
              teamName: team?.name ?? undefined,
              matchTitle,
              startsAt: formatDateTime(event.starts_at),
              meetAt: formatDateTime(event.meet_at),
              location: event.location ?? undefined,
              respondBy: formatDate(invitation.respond_by as string | null),
              message: (invitation.message as string | null) ?? undefined,
            },
          });
          if (result.sent) sent += 1;
          else skipped += 1;
        } catch (error) {
          console.error("Kunde inte skicka mejlkallelse", error);
          failed += 1;
        }
      }
    }

    return { sent, skipped, failed };
  });
