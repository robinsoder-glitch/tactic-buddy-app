/**
 * Regler och texter för kallelser. Här finns bara ren logik utan databas, så att
 * allt går att testa. Kallelsesvar är aldrig samma sak som närvaro – närvaron
 * registreras efter matchen och rörs inte av något här.
 */

/** Statusvärden som sparas i databasen. */
export type InviteStatus = "pending" | "attending" | "declined" | "maybe" | "revoked";

/** Det spelaren visas som i gränssnittet. "not_invited" finns bara i appen. */
export type PlayerInviteStatus = InviteStatus | "not_invited";

export const INVITE_STATUS_LABELS: Record<PlayerInviteStatus, string> = {
  not_invited: "Ej kallad",
  pending: "Ej svarat",
  attending: "Kommer",
  maybe: "Kanske",
  declined: "Kommer inte",
  revoked: "Återkallad",
};

/** Statusar som en mottagare kan välja själv. */
export const ANSWER_STATUSES: InviteStatus[] = ["attending", "maybe", "declined"];

/** Statusar som visas som filter i tränarens lista. */
export const INVITE_STATUSES: InviteStatus[] = [
  "attending",
  "declined",
  "maybe",
  "pending",
  "revoked",
];

/** Svensk text för en status. Okända värden visas som "Ej kallad". */
export function inviteStatusLabel(status: string | null | undefined): string {
  if (!status) return INVITE_STATUS_LABELS.not_invited;
  return INVITE_STATUS_LABELS[status as PlayerInviteStatus] ?? INVITE_STATUS_LABELS.not_invited;
}

/** En spelare utan kallelserad är "Ej kallad" – aldrig "Ej svarat". */
export function playerInviteStatus(
  playerId: string,
  invitations: Array<{ player_id: string; status: string }>,
): PlayerInviteStatus {
  const row = invitations.find((item) => item.player_id === playerId);
  if (!row) return "not_invited";
  return (row.status as InviteStatus) ?? "pending";
}

/** Återkallade kallelser räknas aldrig som aktiva. */
export function activeInvitations<T extends { status: string }>(list: T[]): T[] {
  return list.filter((item) => item.status !== "revoked");
}

export type InviteCounts = {
  attending: number;
  declined: number;
  maybe: number;
  pending: number;
  revoked: number;
  /** Aktiva kallelser, alltså utan de återkallade. */
  total: number;
};

/** Räknar ihop svaren. Återkallade hamnar utanför totalen. */
export function countInvitations(list: Array<{ status: string }>): InviteCounts {
  const counts: InviteCounts = {
    attending: 0,
    declined: 0,
    maybe: 0,
    pending: 0,
    revoked: 0,
    total: 0,
  };
  for (const item of list) {
    if (item.status === "revoked") {
      counts.revoked += 1;
      continue;
    }
    counts.total += 1;
    if (item.status === "attending") counts.attending += 1;
    else if (item.status === "declined") counts.declined += 1;
    else if (item.status === "maybe") counts.maybe += 1;
    else counts.pending += 1;
  }
  return counts;
}

/* --------------------------- nåbarhet --------------------------- */

export type Reach = "account" | "guardian" | "none";

export const REACH_LABELS: Record<Reach, string> = {
  account: "Nås via eget konto",
  guardian: "Nås via vårdnadshavare",
  none: "Saknar digital mottagare",
};

export type ReachablePlayer = {
  id: string;
  member_user_id?: string | null;
  hasActiveGuardian?: boolean | null;
};

/** Var når vi spelaren? Eget konto går före vårdnadshavare. */
export function playerReach(player: ReachablePlayer): Reach {
  if (player.member_user_id) return "account";
  if (player.hasActiveGuardian) return "guardian";
  return "none";
}

export type ReachSummary = {
  selected: number;
  account: number;
  guardian: number;
  none: number;
};

/** Summering inför publicering: hur många nås, och hur? */
export function summarizeReach(players: ReachablePlayer[]): ReachSummary {
  const summary: ReachSummary = { selected: players.length, account: 0, guardian: 0, none: 0 };
  for (const player of players) summary[playerReach(player)] += 1;
  return summary;
}

/** Ärlig text efter publicering – aldrig ett generellt "det gick bra". */
export function publishResultText(summary: ReachSummary): string {
  const parts = [
    `Kallelsen publicerades för ${summary.selected} ${summary.selected === 1 ? "spelare" : "spelare"}.`,
    `${summary.account} nås via konto, ${summary.guardian} via vårdnadshavare och ${summary.none} saknar digital mottagare.`,
  ];
  return parts.join(" ");
}

/** Texten på publiceringsknappen, med exakt antal. */
export function publishButtonLabel(count: number): string {
  if (count === 0) return "Välj minst en spelare";
  return `Publicera till ${count} ${count === 1 ? "spelare" : "spelare"}`;
}

/* ------------------------- sista svarsdag ------------------------- */

export type RespondByState = "none" | "open" | "soon" | "passed" | "closed";

export const RESPOND_BY_STATE_LABELS: Record<RespondByState, string> = {
  none: "Ingen sista svarsdag",
  open: "Öppen",
  soon: "Svarstiden går ut snart",
  passed: "Sista svarsdag har passerat",
  closed: "Stängd",
};

const MONTHS = [
  "januari",
  "februari",
  "mars",
  "april",
  "maj",
  "juni",
  "juli",
  "augusti",
  "september",
  "oktober",
  "november",
  "december",
];

/** "2026-09-12" → "12 september" */
export function formatRespondByDate(value: string | null | undefined): string {
  if (!value) return "";
  const [year, month, day] = value.split("-").map((part) => Number(part));
  if (!year || !month || !day) return "";
  return `${day} ${MONTHS[month - 1]}`;
}

/** "Svara senast 12 september" */
export function respondByText(value: string | null | undefined): string {
  const date = formatRespondByDate(value);
  return date ? `Svara senast ${date}` : "Ingen sista svarsdag är satt.";
}

function localDate(now: number): string {
  const d = new Date(now);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function daysBetween(from: string, to: string): number {
  const a = Date.parse(`${from}T00:00:00`);
  const b = Date.parse(`${to}T00:00:00`);
  return Math.round((b - a) / 86_400_000);
}

/** Läget för sista svarsdag. En stängd kallelse är alltid "closed". */
export function respondByState(input: {
  respondBy: string | null | undefined;
  now?: number;
  closed?: boolean;
}): RespondByState {
  if (input.closed) return "closed";
  if (!input.respondBy) return "none";
  const today = localDate(input.now ?? Date.now());
  const diff = daysBetween(today, input.respondBy);
  if (diff < 0) return "passed";
  if (diff <= 2) return "soon";
  return "open";
}

/** Sant när svaret kom efter sista svarsdag. */
export function isLateResponse(
  respondedAt: string | null | undefined,
  respondBy: string | null | undefined,
): boolean {
  if (!respondedAt || !respondBy) return false;
  const answered = new Date(respondedAt);
  if (Number.isNaN(answered.getTime())) return false;
  return localDate(answered.getTime()) > respondBy;
}

export const LATE_RESPONSE_TEXT = "Svar efter sista svarsdag";

/**
 * Förslag på sista svarsdag: sju dagar före matchen, men aldrig ett datum som
 * redan passerat. Ligger matchen närmare än sju dagar föreslås dagen före
 * matchen, och som allra sist matchdagen. Tränaren kan alltid ändra.
 */
export function suggestRespondBy(startsAt: string | null | undefined, now?: number): string {
  if (!startsAt) return "";
  const start = new Date(startsAt);
  if (Number.isNaN(start.getTime())) return "";
  const today = localDate(now ?? Date.now());
  const startDay = localDate(start.getTime());
  const week = localDate(start.getTime() - 7 * 86_400_000);
  if (week >= today) return week;
  const dayBefore = localDate(start.getTime() - 86_400_000);
  if (dayBefore >= today) return dayBefore;
  if (startDay >= today) return startDay;
  return today;
}

/* --------------------------- handlingar --------------------------- */

export type EventGate = {
  cancelled: boolean;
  startsAt: string;
  endsAt?: string | null;
  invitesClosed?: boolean;
  pendingCount?: number;
  now?: number;
};

/** Får tränaren publicera fler kallelser? Samma regler som i databasen. */
export function canPublishInvitations(gate: EventGate): { ok: boolean; reason: string } {
  const now = gate.now ?? Date.now();
  if (gate.cancelled) return { ok: false, reason: "Matchen är inställd." };
  const end = new Date(gate.endsAt ?? gate.startsAt).getTime();
  if (end < now) return { ok: false, reason: "Matchen är redan spelad." };
  return { ok: true, reason: "" };
}

/** Får tränaren påminna? Samma regler som i databasen. */
export function canRemind(gate: EventGate): { ok: boolean; reason: string } {
  const now = gate.now ?? Date.now();
  if (gate.cancelled) return { ok: false, reason: "Matchen är inställd." };
  if (new Date(gate.startsAt).getTime() < now)
    return { ok: false, reason: "Matchen har redan börjat." };
  if ((gate.pendingCount ?? 0) === 0) return { ok: false, reason: "Alla kallade har svarat." };
  return { ok: true, reason: "" };
}

/** Får mottagaren svara själv? En stängd eller inställd match stoppar svaret. */
export function canRecipientAnswer(input: {
  status: string;
  cancelled: boolean;
  invitesClosed?: boolean;
}): { ok: boolean; reason: string } {
  if (input.status === "revoked") return { ok: false, reason: "Kallelsen är återkallad." };
  if (input.cancelled) return { ok: false, reason: "Matchen är inställd. Nya svar är stängda." };
  if (input.invitesClosed) return { ok: false, reason: "Kallelsen är stängd. Kontakta en ledare." };
  return { ok: true, reason: "" };
}

/** Vem svarade? Visas alltid i listan. */
export function respondedByText(input: { role?: string | null; name?: string | null }): string {
  const who = input.name ? ` av ${input.name}` : "";
  if (input.role === "coach") return `Registrerat av ledare${who}`;
  if (input.role === "guardian") return `Svarat av vårdnadshavare${who}`;
  if (input.role === "player") return `Svarat av spelaren${who}`;
  return who ? `Svarat${who}` : "";
}

/** Text när tränaren återkallat en kallelse. */
export function revokedText(input: {
  name?: string | null;
  at?: string | null;
  formatDateTime?: (value: string) => string;
}): string {
  if (!input.at) return "Återkallad";
  const stamp = input.formatDateTime ? input.formatDateTime(input.at) : input.at;
  return `Återkallad av ${input.name ?? "en ledare"} ${stamp}`;
}

/** Externa kanaler saknas – var ärlig om det. */
export const EXTERNAL_CHANNELS_TEXT =
  "E-post och push är inte aktiverat – kallelsen finns bara i appen.";

export const PUBLISH_BUTTON_TEXT = "Publicera kallelse i Fotbollsrummet";

/* --------------------------- tränarlag --------------------------- */

export type CoachTeamRole = string | null | undefined;

const COACH_ROLES = new Set(["coach", "head_coach", "club_admin"]);

/** Bara riktiga ledarroller får visas som tränarlag i kallelseöversikten. */
export function isCoachMembership(item: { role?: CoachTeamRole; status?: string | null }): boolean {
  return item.status === "approved" && COACH_ROLES.has(String(item.role ?? ""));
}
