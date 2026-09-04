import { supabase } from "@/integrations/supabase/client";
import {
  activeInvitations,
  countInvitations,
  inviteStatusLabel,
  suggestRespondBy,
  type InviteCounts,
  type InviteStatus,
} from "./invite-status";

export {
  ANSWER_STATUSES,
  EXTERNAL_CHANNELS_TEXT,
  INVITE_STATUS_LABELS,
  INVITE_STATUSES,
  LATE_RESPONSE_TEXT,
  PUBLISH_BUTTON_TEXT,
  REACH_LABELS,
  RESPOND_BY_STATE_LABELS,
  activeInvitations,
  canPublishInvitations,
  canRecipientAnswer,
  canRemind,
  countInvitations,
  formatRespondByDate,
  inviteStatusLabel,
  isCoachMembership,
  isLateResponse,
  playerInviteStatus,
  playerReach,
  publishButtonLabel,
  publishResultText,
  respondByState,
  respondByText,
  respondedByText,
  revokedText,
  suggestRespondBy,
  summarizeReach,
  type InviteCounts,
  type InviteStatus,
  type PlayerInviteStatus,
  type Reach,
  type ReachSummary,
  type RespondByState,
} from "./invite-status";

/** Sista svarsdag som förslag. Aldrig ett datum som redan passerat. */
export const defaultRespondBy = suggestRespondBy;

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
  responded_role: string | null;
  revoked_at: string | null;
  revoked_by: string | null;
  last_reminder_at: string | null;
  created_at: string;
  updated_at: string;
  playerName?: string;
  memberUserId?: string | null;
  playerActive?: boolean;
  hasActiveGuardian?: boolean;
  respondedByName?: string | null;
  revokedByName?: string | null;
};

/** Beräknat antal deltagare: säkra ja-svar. */
export function expectedAttendance(counts: InviteCounts): number {
  return counts.attending;
}

/** "12 kommer · 2 kanske · 1 kan inte · 3 ej svarat" */
export function summaryText(counts: InviteCounts): string {
  const parts = [
    `${counts.attending} kommer`,
    `${counts.maybe} kanske`,
    `${counts.declined} kan inte`,
    `${counts.pending} ej svarat`,
  ];
  if (counts.revoked > 0) parts.push(`${counts.revoked} återkallade`);
  return parts.join(" · ");
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

type PlayerRow = {
  name: string | null;
  member_user_id: string | null;
  is_active?: boolean | null;
} | null;

function mapRow(row: Record<string, unknown> & { players?: PlayerRow }): Invitation {
  const player = row.players ?? null;
  return {
    ...(row as unknown as Invitation),
    playerName: player?.name ?? "Spelare",
    memberUserId: player?.member_user_id ?? null,
    playerActive: player?.is_active ?? true,
  };
}

/** Vilka spelare har minst en aktiv vårdnadshavare? Används för nåbarhet. */
export async function fetchGuardedPlayerIds(playerIds: string[]): Promise<Set<string>> {
  if (playerIds.length === 0) return new Set();
  const { data, error } = await supabase
    .from("player_guardians")
    .select("player_id")
    .in("player_id", playerIds)
    .eq("is_active", true);
  if (error) return new Set();
  return new Set((data ?? []).map((row) => row.player_id as string));
}

export async function fetchEventInvitations(eventId: string): Promise<Invitation[]> {
  const { data, error } = await supabase
    .from("event_invitations")
    .select("*, players(name, member_user_id, is_active)")
    .eq("event_id", eventId);
  if (error) throw error;
  const rows = (data ?? []).map((row) => mapRow(row as never));

  const guarded = await fetchGuardedPlayerIds(rows.map((row) => row.player_id));
  for (const row of rows) row.hasActiveGuardian = guarded.has(row.player_id);

  const ids = [
    ...new Set(rows.flatMap((row) => [row.responded_by, row.revoked_by]).filter(Boolean)),
  ] as string[];
  if (ids.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, display_name")
      .in("id", ids);
    const names = new Map(
      (profiles ?? []).map((p) => [p.id as string, p.display_name as string | null]),
    );
    for (const row of rows) {
      row.respondedByName = row.responded_by ? (names.get(row.responded_by) ?? null) : null;
      row.revokedByName = row.revoked_by ? (names.get(row.revoked_by) ?? null) : null;
    }
  }
  return rows.sort((a, b) => (a.playerName ?? "").localeCompare(b.playerName ?? "", "sv"));
}

/**
 * Kallelser hör bara ihop med matcher. Träningar har närvaro i stället, så
 * försök att skapa en kallelse till en träning stoppas redan här.
 */
export async function assertMatchEvent(eventId: string): Promise<void> {
  const { data, error } = await supabase
    .from("events")
    .select("type")
    .eq("id", eventId)
    .maybeSingle();
  if (error) throw error;
  if (data && data.type !== "match") {
    throw new Error("Kallelser skickas bara till matcher. Träningar hanteras via närvaro.");
  }
}

export type PublishResult = {
  added: number;
  selected: number;
  reachable_account: number;
  reachable_guardian: number;
  unreachable: number;
};

/**
 * Publicerar kallelsen. All kontroll görs i databasen: matchen måste vara en
 * match som varken är inställd eller spelad, spelarna måste tillhöra laget och
 * vara aktiva, och sista svarsdag får inte ligga bakåt i tiden.
 */
export async function publishInvitations(input: {
  eventId: string;
  playerIds: string[];
  message: string | null;
  respondBy?: string | null;
}): Promise<PublishResult> {
  if (input.playerIds.length === 0) {
    throw new Error("Välj minst en spelare innan du publicerar kallelsen.");
  }
  // Databasfunktionen tar emot tomma värden, men de genererade typerna
  // beskriver bara textvärden – därför den här överbryggningen.
  const { data, error } = await supabase.rpc("publish_event_invitations", {
    _event_id: input.eventId,
    _player_ids: input.playerIds,
    _message: input.message,
    _respond_by: input.respondBy || null,
  } as never);

  if (error) throw error;
  return data as unknown as PublishResult;
}

/** Uppdaterar informationstexten och sista svarsdag för hela kallelsen. */
export async function updateInvitationDetails(input: {
  eventId: string;
  message: string | null;
  respondBy?: string | null;
  notify?: boolean;
}): Promise<{ updated: number; notified: number }> {
  const { data, error } = await supabase.rpc("update_invitation_details", {
    _event_id: input.eventId,
    _message: input.message,
    _respond_by: input.respondBy || null,
    _notify: input.notify ?? false,
  } as never);

  if (error) throw error;
  return data as unknown as { updated: number; notified: number };
}

/**
 * Sparar allt i dialogen i ett svep: först ändrad information till redan
 * kallade, sedan eventuella nya mottagare.
 */
export async function saveInvitationPlan(input: {
  eventId: string;
  hasExisting: boolean;
  newPlayerIds: string[];
  message: string | null;
  respondBy?: string | null;
  notify?: boolean;
}): Promise<{ added: number; updated: number; published: PublishResult | null }> {
  let updated = 0;
  if (input.hasExisting) {
    const result = await updateInvitationDetails({
      eventId: input.eventId,
      message: input.message,
      respondBy: input.respondBy ?? null,
      notify: input.notify ?? false,
    });
    updated = result.updated;
  }

  let published: PublishResult | null = null;
  if (input.newPlayerIds.length > 0) {
    published = await publishInvitations({
      eventId: input.eventId,
      playerIds: input.newPlayerIds,
      message: input.message,
      respondBy: input.respondBy ?? null,
    });
  }

  return { added: published?.added ?? 0, updated, published };
}

/** Återkallar en kallelse. Historiken finns kvar. */
export async function revokeInvitation(invitationId: string): Promise<void> {
  const { error } = await supabase.rpc("revoke_invitation", { _invitation_id: invitationId });
  if (error) throw error;
}

/** Stänger eller öppnar kallelsen för mottagarnas svar. */
export async function setInvitesClosed(eventId: string, closed: boolean): Promise<void> {
  const { error } = await supabase.rpc("set_event_invites_closed", {
    _event_id: eventId,
    _closed: closed,
  });
  if (error) throw error;
}

/** Skapar en notis till alla kallade när något viktigt ändras. */
export async function notifyInvitedOfChange(input: {
  eventId: string;
  title: string;
  body: string;
}): Promise<number> {
  const { data, error } = await supabase.rpc("notify_invited_of_change", {
    _event_id: input.eventId,
    _title: input.title,
    _body: input.body,
  });
  if (error) throw error;
  return (data as unknown as number) ?? 0;
}

/**
 * Registrerar ett svar. Databasen kontrollerar vem som svarar, sparar svaret
 * och historiken i samma transaktion och rör aldrig närvarodata.
 */
export async function respondToInvitation(input: {
  invitation: Pick<Invitation, "id">;
  status: InviteStatus;
  comment?: string | null;
}): Promise<{ status: string; role: string; late: boolean; closed: boolean }> {
  const { data, error } = await supabase.rpc("respond_to_invitation", {
    _invitation_id: input.invitation.id,
    _status: input.status,
    _comment: input.comment ?? null,
  } as never);

  if (error) throw error;
  return data as unknown as { status: string; role: string; late: boolean; closed: boolean };
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
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, display_name")
    .in("id", ids);
  const names = new Map(
    (profiles ?? []).map((p) => [p.id as string, p.display_name as string | null]),
  );
  return rows.map((row) => ({
    ...row,
    changedByName: row.changed_by ? (names.get(row.changed_by) ?? null) : null,
  }));
}

/**
 * Skapar riktiga notiser i appen via databasen. En användare får en samlad
 * notis även om hen är vårdnadshavare till flera kallade barn. Databasen
 * stoppar påminnelser för inställda och redan startade matcher, hoppar över
 * återkallade och skickar aldrig två notiser inom fem minuter.
 */
export async function createReminders(input: {
  eventId: string;
  title: string;
  body: string;
}): Promise<{
  sent: number;
  skippedRecent: number;
  missingAccount: number;
  unreachablePlayers: string;
}> {
  const { data, error } = await supabase.rpc("send_invite_reminders", {
    _event_id: input.eventId,
    _title: input.title,
    _body: input.body,
  });
  if (error) throw error;
  const row = (Array.isArray(data) ? data[0] : data) as
    | {
        sent: number;
        skipped_recent: number;
        missing_account: number;
        unreachable_players?: string;
      }
    | undefined;
  return {
    sent: row?.sent ?? 0,
    skippedRecent: row?.skipped_recent ?? 0,
    missingAccount: row?.missing_account ?? 0,
    unreachablePlayers: row?.unreachable_players ?? "",
  };
}

export const EXTERNAL_CHANNELS_NOTE =
  "E-post och push är inte aktiverat – notisen finns bara i appen.";

/** Ärlig text om vad som faktiskt hände när påminnelsen skickades. */
export function reminderResultText(result: {
  sent: number;
  skippedRecent: number;
  missingAccount: number;
  unreachablePlayers?: string;
}): string {
  if (result.sent === 0 && result.skippedRecent > 0) {
    return "Ingen ny påminnelse skickades. De obesvarade fick redan en påminnelse nyss.";
  }
  if (result.sent === 0) {
    return "Ingen påminnelse kunde skapas. Ingen av de obesvarade har ett kopplat konto eller en vårdnadshavare.";
  }
  const parts = [`Påminnelse i appen skickad till ${result.sent} mottagare.`];
  if (result.missingAccount > 0) {
    parts.push(
      result.unreachablePlayers
        ? `Nåddes inte: ${result.unreachablePlayers}.`
        : `${result.missingAccount} spelare saknar konto och nåddes inte.`,
    );
  }
  parts.push(EXTERNAL_CHANNELS_NOTE);
  return parts.join(" ");
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
    invites_closed_at: string | null;
    home_team: string | null;
    away_team: string | null;
  };
  teamName: string | null;
};

export async function fetchMyInvitations(): Promise<MyInvitation[]> {
  const { data, error } = await supabase
    .from("event_invitations")
    .select(
      "*, players(name, member_user_id, is_active), events(id, team_id, type, title, starts_at, location, cancelled_at, invites_closed_at, home_team, away_team), teams(name)",
    );
  if (error) throw error;
  return (data ?? [])
    .map((row) => {
      const raw = row as never as { events: MyInvitation["event"]; teams: { name: string } | null };
      return { ...mapRow(row as never), event: raw.events, teamName: raw.teams?.name ?? null };
    })
    .filter((item) => Boolean(item.event) && item.event.type === "match")
    .sort((a, b) => a.event.starts_at.localeCompare(b.event.starts_at)) as MyInvitation[];
}

export async function setEventCancelled(eventId: string, cancelled: boolean) {
  const { error } = await supabase
    .from("events")
    .update({ cancelled_at: cancelled ? new Date().toISOString() : null })
    .eq("id", eventId);
  if (error) throw error;
}

/** Kallelser grupperas per aktivitet så att samma match bara visas en gång. */
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

export type TeamInviteCount = { total: number; answered: number };

/** Kallelseläget per match i ett lag – används i tränarens kallelseöversikt. */
export async function fetchTeamInviteCounts(
  teamId: string,
): Promise<Record<string, TeamInviteCount>> {
  const { data, error } = await supabase
    .from("event_invitations")
    .select("event_id, status")
    .eq("team_id", teamId);
  if (error) throw error;
  const map: Record<string, TeamInviteCount> = {};
  for (const row of activeInvitations(
    (data ?? []) as Array<{ event_id: string; status: string }>,
  )) {
    const key = row.event_id;
    const current = map[key] ?? { total: 0, answered: 0 };
    current.total += 1;
    if (row.status !== "pending") current.answered += 1;
    map[key] = current;
  }
  return map;
}

/** Kort text om kallelsens läge. */
export function inviteStateText(count: TeamInviteCount | undefined): string {
  if (!count || count.total === 0) return "Ingen kallelse publicerad";
  const missing = count.total - count.answered;
  return missing === 0
    ? `Alla ${count.total} har svarat`
    : `${count.answered} av ${count.total} har svarat`;
}

/** Kort statusrad per spelare i tränarens lista. */
export function invitationRowText(invitation: Invitation): string {
  return inviteStatusLabel(invitation.status);
}

export { countInvitations as countInvites };
