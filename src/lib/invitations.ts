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

/** Kan den här användaren svara själv? Kräver en säker koppling till spelarkortet. */
export function canRespondSelf(
  invitation: Pick<Invitation, "memberUserId">,
  userId: string | null | undefined,
): boolean {
  return Boolean(userId) && invitation.memberUserId === userId;
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

type PlayerRow = { name: string | null; member_user_id: string | null } | null;

function mapRow(row: Record<string, unknown> & { players?: PlayerRow }): Invitation {
  const player = row.players ?? null;
  return {
    ...(row as unknown as Invitation),
    playerName: player?.name ?? "Spelare",
    memberUserId: player?.member_user_id ?? null,
  };
}

export async function fetchEventInvitations(eventId: string): Promise<Invitation[]> {
  const { data, error } = await supabase
    .from("event_invitations")
    .select("*, players(name, member_user_id)")
    .eq("event_id", eventId);
  if (error) throw error;
  return (data ?? [])
    .map((row) => mapRow(row as never))
    .sort((a, b) => (a.playerName ?? "").localeCompare(b.playerName ?? "", "sv"));
}

/** Skapar kallelser för valda spelare. Befintliga kallelser lämnas orörda. */
export async function createInvitations(input: {
  eventId: string;
  teamId: string;
  playerIds: string[];
  respondBy: string | null;
  message: string | null;
  createdBy: string;
}): Promise<number> {
  if (input.playerIds.length === 0) return 0;
  const rows = input.playerIds.map((playerId) => ({
    event_id: input.eventId,
    team_id: input.teamId,
    player_id: playerId,
    respond_by: input.respondBy,
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

/** Uppdaterar sista svarsdag och information för hela kallelsen. */
export async function updateInvitationDetails(input: {
  eventId: string;
  respondBy: string | null;
  message: string | null;
}) {
  const { error } = await supabase
    .from("event_invitations")
    .update({ respond_by: input.respondBy, message: input.message })
    .eq("event_id", input.eventId);
  if (error) throw error;
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
  role: "coach" | "player";
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
};

export async function fetchInvitationLog(invitationId: string): Promise<InvitationLogRow[]> {
  const { data, error } = await supabase
    .from("event_invitation_log")
    .select("id, from_status, to_status, changed_role, created_at")
    .eq("invitation_id", invitationId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as InvitationLogRow[];
}

/**
 * Skapar interna påminnelser i appen. Inga mejl, SMS eller pushnotiser skickas.
 * Returnerar hur många som fick en notis och hur många som saknar konto.
 */
export async function createReminders(input: {
  invitations: Invitation[];
  teamId: string;
  eventId: string;
  title: string;
  body: string;
  createdBy: string;
}): Promise<{ sent: number; missingAccount: number }> {
  const withAccount = input.invitations.filter((item) => item.memberUserId);
  const missingAccount = input.invitations.length - withAccount.length;
  if (withAccount.length === 0) return { sent: 0, missingAccount };

  const { error } = await supabase.from("app_notifications").insert(
    withAccount.map((item) => ({
      user_id: item.memberUserId as string,
      team_id: input.teamId,
      event_id: input.eventId,
      kind: "invite_reminder",
      title: input.title,
      body: input.body,
      created_by: input.createdBy,
    })),
  );
  if (error) throw error;

  const now = new Date().toISOString();
  await supabase
    .from("event_invitations")
    .update({ last_reminder_at: now })
    .in(
      "id",
      withAccount.map((item) => item.id),
    );

  return { sent: withAccount.length, missingAccount };
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
      "*, players(name, member_user_id), events(id, team_id, type, title, starts_at, location, cancelled_at, home_team, away_team), teams(name)",
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
