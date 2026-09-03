/**
 * Etapp 1 – aktiviteten som nav.
 * Rena funktioner som härleder aktivitetens läge, stegens status och
 * nästa rekommenderade handling. All status räknas fram ur befintliga data.
 */

export type EventState = "upcoming" | "ongoing" | "done" | "cancelled";

export type StepStatus = "not_started" | "in_progress" | "done" | "needs_action" | "not_applicable";

export type StepKey =
  | "details"
  | "invitation"
  | "planning"
  | "execution"
  | "attendance"
  | "followup";

export const STEP_ORDER: StepKey[] = [
  "details",
  "invitation",
  "planning",
  "execution",
  "attendance",
  "followup",
];

export const STEP_LABELS: Record<StepKey, string> = {
  details: "Uppgifter",
  invitation: "Kallelse",
  planning: "Planering",
  execution: "Genomförande",
  attendance: "Närvaro",
  followup: "Uppföljning",
};

export const STEP_STATUS_LABELS: Record<StepStatus, string> = {
  not_started: "Inte påbörjad",
  in_progress: "Pågår",
  done: "Klar",
  needs_action: "Behöver åtgärd",
  not_applicable: "Ej aktuell",
};

export const EVENT_STATE_LABELS: Record<EventState, string> = {
  upcoming: "Kommande",
  ongoing: "Pågår",
  done: "Genomförd",
  cancelled: "Inställd",
};

export type EventSnapshot = {
  /** Tidpunkt att räkna mot, i millisekunder. */
  now: number;
  startsAt: string;
  endsAt?: string | null;
  cancelledAt?: string | null;
  type: string | null | undefined;
  /** Grunduppgifter som behövs för att steget Uppgifter ska vara klart. */
  hasLocation: boolean;
  /** Väntande medlemsansökningar i laget. */
  pendingMembers: number;
  /** Antal kallade spelare. */
  invitationCount: number;
  /** Antal kallade utan svar. */
  pendingResponses: number;
  /** Tränaren har uttryckligen gått vidare trots obesvarade. */
  invitationClosed?: boolean;
  /** Planeringen är klar enligt planStatus. */
  planDone: boolean;
  /** Ett aktivt genomförande (session_run) finns. */
  runActive: boolean;
  /** Ett avslutat genomförande finns. */
  runFinished: boolean;
  /** Antal spelare med registrerad närvarostatus. */
  attendanceCount: number;
  /** Antal spelare som förväntas få en närvarostatus. */
  expectedPlayers: number;
  /** Uppföljning finns (anteckning eller sammanfattning). */
  hasFollowup: boolean;
};

/** Antal minuter efter start då aktiviteten räknas som pågående utan sluttid. */
const DEFAULT_DURATION_MINUTES = 90;

export function eventState(input: {
  now: number;
  startsAt: string;
  endsAt?: string | null;
  cancelledAt?: string | null;
}): EventState {
  if (input.cancelledAt) return "cancelled";
  const start = new Date(input.startsAt).getTime();
  if (Number.isNaN(start)) return "upcoming";
  const endValue = input.endsAt ? new Date(input.endsAt).getTime() : Number.NaN;
  const end = Number.isNaN(endValue) ? start + DEFAULT_DURATION_MINUTES * 60_000 : endValue;
  if (input.now < start) return "upcoming";
  if (input.now <= end) return "ongoing";
  return "done";
}

export function stepStatuses(snapshot: EventSnapshot): Record<StepKey, StepStatus> {
  const state = eventState(snapshot);
  const started = state === "ongoing" || state === "done";
  const cancelled = state === "cancelled";

  const details: StepStatus = snapshot.hasLocation ? "done" : "needs_action";

  let invitation: StepStatus;
  if (cancelled) invitation = "not_applicable";
  else if (snapshot.invitationCount === 0) invitation = started ? "needs_action" : "not_started";
  else if (snapshot.pendingResponses === 0 || snapshot.invitationClosed) invitation = "done";
  else invitation = "in_progress";

  let planning: StepStatus;
  if (cancelled) planning = "not_applicable";
  else if (snapshot.planDone) planning = "done";
  else planning = started ? "needs_action" : "not_started";

  let execution: StepStatus;
  if (cancelled) execution = "not_applicable";
  else if (snapshot.runActive) execution = "in_progress";
  else if (snapshot.runFinished) execution = "done";
  else if (snapshot.type === "match") execution = "not_applicable";
  else if (state === "ongoing") execution = "needs_action";
  else execution = "not_started";

  let attendance: StepStatus;
  if (cancelled) attendance = "not_applicable";
  else if (snapshot.expectedPlayers > 0 && snapshot.attendanceCount >= snapshot.expectedPlayers)
    attendance = "done";
  else if (snapshot.attendanceCount > 0) attendance = "in_progress";
  else if (state === "done") attendance = "needs_action";
  else attendance = "not_started";

  let followup: StepStatus;
  if (cancelled) followup = "not_applicable";
  else if (snapshot.hasFollowup) followup = "done";
  else if (state === "done") followup = "in_progress";
  else followup = "not_started";

  return { details, invitation, planning, execution, attendance, followup };
}

export type CoachActionKey =
  | "manage_members"
  | "create_invitation"
  | "remind_pending"
  | "continue_planning"
  | "start_session"
  | "continue_session"
  | "register_attendance"
  | "show_summary"
  | "none";

export type MemberActionKey =
  | "respond_invitation"
  | "read_message"
  | "show_event"
  | "cancelled"
  | "none";

export const COACH_ACTION_LABELS: Record<CoachActionKey, string> = {
  manage_members: "Hantera medlemmar",
  create_invitation: "Skapa kallelse",
  remind_pending: "Påminn obesvarade",
  continue_planning: "Fortsätt planera",
  start_session: "Starta träningen",
  continue_session: "Fortsätt träningen",
  register_attendance: "Registrera närvaro",
  show_summary: "Visa sammanfattning",
  none: "Visa aktivitet",
};

export const MEMBER_ACTION_LABELS: Record<MemberActionKey, string> = {
  respond_invitation: "Svara på kallelsen",
  read_message: "Läs meddelandet",
  show_event: "Visa aktivitet",
  cancelled: "Aktiviteten är inställd",
  none: "Visa aktivitet",
};

/** Timmar före start då obesvarade kallelser räknas som nära aktiviteten. */
const REMIND_WINDOW_HOURS = 48;

export function coachPrimaryAction(snapshot: EventSnapshot): CoachActionKey {
  const state = eventState(snapshot);
  if (state === "cancelled") return "none";

  if (snapshot.pendingMembers > 0 && snapshot.invitationCount === 0) return "manage_members";
  if (snapshot.invitationCount === 0) return "create_invitation";

  const start = new Date(snapshot.startsAt).getTime();
  const nearStart = !Number.isNaN(start) && start - snapshot.now <= REMIND_WINDOW_HOURS * 3_600_000;
  if (snapshot.pendingResponses > 0 && nearStart && state === "upcoming") return "remind_pending";

  if (!snapshot.planDone) return "continue_planning";

  if (snapshot.runActive) return "continue_session";
  if (snapshot.type !== "match" && state === "ongoing" && !snapshot.runFinished)
    return "start_session";

  const steps = stepStatuses(snapshot);
  if (state === "done" && steps.attendance !== "done") return "register_attendance";
  if (state === "done") return "show_summary";
  return "none";
}

export type MemberSnapshot = {
  now: number;
  startsAt: string;
  endsAt?: string | null;
  cancelledAt?: string | null;
  /** Saknar den egna eller barnets kallelse ett svar? */
  hasPendingResponse: boolean;
  /** Finns ett viktigt oläst aktivitetsmeddelande? */
  hasUnreadMessage: boolean;
};

export function memberPrimaryAction(snapshot: MemberSnapshot): MemberActionKey {
  const state = eventState(snapshot);
  if (state === "cancelled") return "cancelled";
  if (snapshot.hasPendingResponse) return "respond_invitation";
  if (snapshot.hasUnreadMessage) return "read_message";
  return "show_event";
}

/** Kort svensk förklaring som visas under steget. */
export function stepHint(step: StepKey, status: StepStatus): string {
  if (status === "not_applicable") return "Gäller inte den här aktiviteten.";
  if (step === "invitation" && status === "not_started") return "Ingen kallelse har skapats ännu.";
  if (step === "invitation" && status === "in_progress") return "Alla har inte svarat ännu.";
  if (step === "planning" && status === "not_started") return "Planeringen är inte påbörjad.";
  if (step === "attendance" && status === "needs_action")
    return "Aktiviteten har passerat men närvaron är inte registrerad.";
  if (step === "execution" && status === "in_progress") return "Genomförandet pågår just nu.";
  if (step === "details" && status === "needs_action") return "Plats saknas.";
  return STEP_STATUS_LABELS[status];
}
