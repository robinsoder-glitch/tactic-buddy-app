import { supabase } from "@/integrations/supabase/client";

/** Interna statusvärden – visas aldrig för användaren. */
export type InviteStatus = "pending" | "attending" | "declined" | "maybe";

export const INVITE_STATUSES: InviteStatus[] = ["attending", "declined", "maybe", "pending"];

export const INVITE_STATUS_LABELS: Record<InviteStatus, string> = {
  pending: "Ej svarat",
  attending: "Kommer",
  declined: "Kommer inte",
  maybe: "Kanske",
};

/** Svensk text för ett svar. Okända värden faller tillbaka på "Ej svarat". */
export function inviteStatusLabel(status: string | null | undefined): string {
  return INVITE_STATUS_LABELS[(status ?? "pending") as InviteStatus] ?? "Ej svarat";
}

export type Invitation = {
  id: string;
  event_id: string;
  team_id: string;
  player_id: string;
  status: InviteStatus;
  comment: string | null;
  respond_by: string | null;
  message: string | null;
  responded_by: string | null;
  responded_at: string | null;
  last_reminder_at: string | null;
  created_at: string;
  updated_at: string;
  playerName?: string;
  memberUserId?: string | null;
  playerActive?: boolean;
  respondedByName?: string | null;
};

export type InviteCounts = {
  attending: number;
  declined: number;
  maybe: number;
  pending: number;
  total: number;
};

/** Räknar ihop svaren i en kallelse. */
export function countInvitations(list: Array<{ status: string }>): InviteCounts {
  const counts: InviteCounts = { attending: 0, declined: 0, maybe: 0, pending: 0, total: list.length };
  for (const item of list) {
    if (item.status === "attending") counts.attending += 1;
    else if (item.status === "declined") counts.declined += 1;
    else if (item.status === "maybe") counts.maybe += 1;
    else counts.pending += 1;
  }
  return counts;
}

/** Beräknat antal deltagare: säkra ja-svar. */
export function expectedAttendance(counts: InviteCounts): number {
  return counts.attending;
}

/** "12 kommer · 2 kanske · 1 kan inte · 3 ej svarat" */
export function summaryText(counts: InviteCounts): string {
  return [
    `${counts.attending} kommer`,
    `${counts.maybe} kanske`,
    `${counts.declined} kan inte`,
    `${counts.pending} ej svarat`,
  ].join(" · ");
}

/** Kan den här användaren svara själv? Kräver en säker koppling till spelarkortet. */
export function canRespondSelf(
  invitation: Pick<Invitation, "memberUserId">,
  userId: string | null | undefined,
): boolean {
  return Boolean(userId) && invitation.memberUserId === userId;
}

/** Vårdnadshavare får svara för kopplade barn. */
export function canRespondAsGuardian(
  invitation: Pick<Invitation, "player_id">,
  guardedPlayerIds: string[],
): boolean {
  return guardedPlayerIds.includes(invitation.player_id);
}

export const NO_ACCOUNT_TEXT = "Spelaren saknar kopplat konto. En ledare kan registrera svaret.";
export const NO_REMINDER_TEXT =
  "Ingen digital påminnelse kan skickas eftersom spelaren saknar kopplat konto.";

export const NO_PLAYER_LINK_TEXT =
  "Ditt konto är inte kopplat till någon spelare ännu. Be en ledare i laget att koppla ditt konto till rätt spelare för att du ska kunna få och besvara kallelser.";
export const COACH_ONLY_TEXT =
  "Du är inloggad som ledare. Här visas bara kallelser som är kopplade till dig som spelare.";

/** Förklarande text när listan med kallelser är tom. */
export function emptyInviteMessage(input: {
  hasPlayerLink: boolean;
  isCoach: boolean;
  showPast: boolean;
}): string[] {
  if (!input.hasPlayerLink) {
    return input.isCoach ? [NO_PLAYER_LINK_TEXT, COACH_ONLY_TEXT] : [NO_PLAYER_LINK_TEXT];
  }
  if (input.showPast) return ["Inga tidigare kallelser."];
  return ["Du har inga kallelser just nu."];
}

/** Är det inloggade kontot kopplat till minst ett spelarkort? */
export async function hasLinkedPlayer(userId: string | null | undefined): Promise<boolean> {
  if (!userId) return false;
  const { data, error } = await supabase
    .from("players")
    .select("id")
    .eq("member_user_id", userId)
    .limit(1);
  if (error) throw error;
  return (data ?? []).length > 0;
}

/* ------------------------------ data ------------------------------ */

type PlayerRow = { name: string | null; member_user_id: string | null; is_active?: boolean | null } | null;

function mapRow(row: Record<string, unknown> & { players?: PlayerRow }): Invitation {
  const player = row.players ?? null;
  return {
    ...(row as unknown as Invitation),
    playerName: player?.name ?? "Spelare",
    memberUserId: player?.member_user_id ?? null,
    playerActive: player?.is_active ?? true,
  };
}

export async function fetchEventInvitations(eventId: string): Promise<Invitation[]> {
  const { data, error } = await supabase
    .from("event_invitations")
    .select("*, players(name, member_user_id, is_active)")
    .eq("event_id", eventId);
  if (error) throw error;
  const rows = (data ?? []).map((row) => mapRow(row as never));
  const ids = [...new Set(rows.map((row) => row.responded_by).filter(Boolean))] as string[];
  if (ids.length > 0) {
    const { data: profiles } = await supabase.from("profiles").select("id, display_name").in("id", ids);
    const names = new Map((profiles ?? []).map((p) => [p.id as string, p.display_name as string | null]));
    for (const row of rows) {
      row.respondedByName = row.responded_by ? names.get(row.responded_by) ?? null : null;
    }
  }
  return rows.sort((a, b) => (a.playerName ?? "").localeCompare(b.playerName ?? "", "sv"));
}

/** Skapar kallelser för valda spelare. Befintliga kallelser lämnas orörda. */
export async function createInvitations(input: {
  eventId: string;
  teamId: string;
  playerIds: string[];
  message: string | null;
  createdBy: string;
}): Promise<number> {
  if (input.playerIds.length === 0) return 0;
  // Inaktiva spelare får aldrig nya kallelser.
  const { data: active, error: activeError } = await supabase
    .from("players")
    .select("id")
    .in("id", input.playerIds)
    .eq("is_active", true);
  if (activeError) throw activeError;
  const allowed = new Set((active ?? []).map((row) => row.id as string));
  input = { ...input, playerIds: input.playerIds.filter((id) => allowed.has(id)) };
  if (input.playerIds.length === 0) return 0;
  const rows = input.playerIds.map((playerId) => ({
    event_id: input.eventId,
    team_id: input.teamId,
    player_id: playerId,
    message: input.message,
    created_by: input.createdBy,
  }));
  const { data, error } = await supabase
    .from("event_invitations")
    .upsert(rows, { onConflict: "event_id,player_id", ignoreDuplicates: true })
    .select("id");
  if (error) throw error;
  return data?.length ?? 0;
}

/** Uppdaterar informationstexten för hela kallelsen. */
export async function updateInvitationDetails(input: {
  eventId: string;
  message: string | null;
}): Promise<Array<{ id: string; event_id: string; message: string | null }>> {
  const { data, error } = await supabase
    .from("event_invitations")
    .update({ message: input.message })
    .eq("event_id", input.eventId)
    .select("id, event_id, message");
  if (error) throw error;
  if (!data || data.length === 0) {
    throw new Error("Kallelsen kunde inte uppdateras. Inga rader ändrades.");
  }
  return data;
}

/** Sparar kallelsen: uppdaterar befintliga rader och skapar bara för nya spelare. */
export async function saveInvitationPlan(input: {
  eventId: string;
  teamId: string;
  hasExisting: boolean;
  newPlayerIds: string[];
  message: string | null;
  createdBy: string;
}): Promise<{ added: number; updated: number }> {
  let updated = 0;
  if (input.hasExisting) {
    const rows = await updateInvitationDetails({
      eventId: input.eventId,
      message: input.message,
    });
    updated = rows.length;
  }

  let added = 0;
  if (input.newPlayerIds.length > 0) {
    added = await createInvitations({
      eventId: input.eventId,
      teamId: input.teamId,
      playerIds: input.newPlayerIds,
      message: input.message,
      createdBy: input.createdBy,
    });
  }

  return { added, updated };
}



export async function removeInvitation(id: string) {
  const { error } = await supabase.from("event_invitations").delete().eq("id", id);
  if (error) throw error;
}

/** Registrerar ett svar och sparar ändringen i historiken. Rör aldrig närvarodata. */
export async function respondToInvitation(input: {
  invitation: Invitation;
  status: InviteStatus;
  comment?: string | null;
  userId: string;
  role: "coach" | "player" | "guardian";
}) {
  const { error } = await supabase
    .from("event_invitations")
    .update({
      status: input.status,
      comment: input.comment ?? input.invitation.comment,
      responded_by: input.userId,
      responded_at: new Date().toISOString(),
    })
    .eq("id", input.invitation.id);
  if (error) throw error;

  await supabase.from("event_invitation_log").insert({
    invitation_id: input.invitation.id,
    team_id: input.invitation.team_id,
    from_status: input.invitation.status,
    to_status: input.status,
    changed_by: input.userId,
    changed_role: input.role,
  });
}

export type InvitationLogRow = {
  id: string;
  from_status: string | null;
  to_status: string;
  changed_role: string;
  created_at: string;
  changed_by?: string | null;
  changedByName?: string | null;
};

export async function fetchInvitationLog(invitationId: string): Promise<InvitationLogRow[]> {
  const { data, error } = await supabase
    .from("event_invitation_log")
    .select("id, from_status, to_status, changed_role, created_at, changed_by")
    .eq("invitation_id", invitationId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  const rows = (data ?? []) as InvitationLogRow[];
  const ids = [...new Set(rows.map((row) => row.changed_by).filter(Boolean))] as string[];
  if (ids.length === 0) return rows;
  const { data: profiles } = await supabase.from("profiles").select("id, display_name").in("id", ids);
  const names = new Map((profiles ?? []).map((p) => [p.id as string, p.display_name as string | null]));
  return rows.map((row) => ({ ...row, changedByName: row.changed_by ? names.get(row.changed_by) ?? null : null }));
}

/**
 * Skapar riktiga notiser i appen via databasen. Databasfunktionen skickar bara
 * till spelare med status "Ej svarat", når spelarens eget konto och alla aktiva
 * vårdnadshavare, och hoppar över mottagare som redan fått en påminnelse de
 * senaste fem minuterna. Två snabba tryck kan därför inte ge dubbla notiser.
 * Inga mejl eller pushnotiser skickas – de kanalerna är inte aktiverade.
 */
export async function createReminders(input: {
  eventId: string;
  title: string;
  body: string;
}): Promise<{ sent: number; skippedRecent: number; missingAccount: number }> {
  const { data, error } = await supabase.rpc("send_invite_reminders", {
    _event_id: input.eventId,
    _title: input.title,
    _body: input.body,
  });
  if (error) throw error;
  const row = (Array.isArray(data) ? data[0] : data) as
    | { sent: number; skipped_recent: number; missing_account: number }
    | undefined;
  return {
    sent: row?.sent ?? 0,
    skippedRecent: row?.skipped_recent ?? 0,
    missingAccount: row?.missing_account ?? 0,
  };
}

/** Ärlig text om vad som faktiskt hände när påminnelsen skickades. */
export function reminderResultText(result: {
  sent: number;
  skippedRecent: number;
  missingAccount: number;
}): string {
  if (result.sent === 0 && result.skippedRecent > 0) {
    return "Ingen ny påminnelse skickades. De obesvarade fick redan en påminnelse nyss.";
  }
  if (result.sent === 0) {
    return "Ingen påminnelse kunde skapas. Ingen av de obesvarade har ett kopplat konto eller en vårdnadshavare.";
  }
  const parts = [`Påminnelse i appen skickad till ${result.sent} mottagare.`];
  if (result.missingAccount > 0) {
    parts.push(`${result.missingAccount} spelare saknar konto och nåddes inte.`);
  }
  parts.push(EXTERNAL_CHANNELS_TEXT);
  return parts.join(" ");
}

export const EXTERNAL_CHANNELS_TEXT =
  "E-post och push är inte aktiverat – notisen finns bara i appen.";

/** Sätter sista svarsdag utan att röra befintliga svar. */
export async function setRespondBy(eventId: string, respondBy: string | null): Promise<void> {
  const { error } = await supabase
    .from("event_invitations")
    .update({ respond_by: respondBy })
    .eq("event_id", eventId);
  if (error) throw error;
}

export type MyInvitation = Invitation & {
  event: {
    id: string;
    team_id: string;
    type: "training" | "match";
    title: string | null;
    starts_at: string;
    location: string | null;
    cancelled_at: string | null;
    home_team: string | null;
    away_team: string | null;
  };
  teamName: string | null;
};

export async function fetchMyInvitations(): Promise<MyInvitation[]> {
  const { data, error } = await supabase
    .from("event_invitations")
    .select(
      "*, players(name, member_user_id, is_active), events(id, team_id, type, title, starts_at, location, cancelled_at, home_team, away_team), teams(name)",
    );
  if (error) throw error;
  return (data ?? [])
    .map((row) => {
      const raw = row as never as { events: MyInvitation["event"]; teams: { name: string } | null };
      return { ...mapRow(row as never), event: raw.events, teamName: raw.teams?.name ?? null };
    })
    .filter((item) => Boolean(item.event))
    .sort((a, b) => a.event.starts_at.localeCompare(b.event.starts_at)) as MyInvitation[];
}

export async function setEventCancelled(eventId: string, cancelled: boolean) {
  const { error } = await supabase
    .from("events")
    .update({ cancelled_at: cancelled ? new Date().toISOString() : null })
    .eq("id", eventId);
  if (error) throw error;
}

/** Kallelser grupperas per aktivitet så att samma träning bara visas en gång. */
export type InvitationGroup = {
  eventId: string;
  teamId: string;
  teamName?: string | undefined;
  event: MyInvitation["event"];
  invitations: MyInvitation[];
};

export function groupInvitationsByEvent(list: MyInvitation[]): InvitationGroup[] {
  const groups = new Map<string, InvitationGroup>();
  for (const invitation of list) {
    const existing = groups.get(invitation.event_id);
    if (existing) {
      existing.invitations.push(invitation);
      continue;
    }
    groups.set(invitation.event_id, {
      eventId: invitation.event_id,
      teamId: invitation.team_id,
      teamName: invitation.teamName ?? undefined,
      event: invitation.event,
      invitations: [invitation],
    });
  }
  return [...groups.values()];
}

/** Sant när kontot är kopplat till flera spelare – då måste namnet visas per svar. */
export function hasMultiplePlayers(list: MyInvitation[]): boolean {
  return new Set(list.map((item) => item.player_id ?? item.playerName ?? "")).size > 1;
}
