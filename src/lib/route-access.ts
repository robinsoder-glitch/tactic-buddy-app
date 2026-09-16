/**
 * Karta över vilka sidor som kräver ledarbehörighet. Används av testerna som
 * vaktar att en spelare eller vårdnadshavare aldrig kan öppna en tränarsida,
 * och som checklista när nya sidor läggs till.
 */

/** Sidor som kräver tränar-/adminkonto (spärras av CoachOnly). */
export const COACH_ONLY_ROUTES = [
  "traningspass.index.tsx",
  "traningspass.$id.tsx",
  "planera.tsx",
  "planera-match.tsx",
  "planera-traning.tsx",
  "taktik.tsx",
  "tactic.$id.tsx",
  "bank.tsx",
  "skapa.tsx",
  "spelare.tsx",
  "narvaro.tsx",
  "tranarsnack.tsx",
  "ovningsbank.index.tsx",
  "ovningsbank.$drillId.tsx",
  "ovningsbank.samlingar.tsx",
  "kunskapsbank.index.tsx",
  "kunskapsbank.$slug.tsx",
  "kunskapsbank.teknik.tsx",
  "kunskapsbank.favoriter.tsx",
  "kunskapsbank.vanliga-misstag.tsx",
] as const;

/** Lagsidor som bara lagets ledare ska se (spärras av TeamCoachOnly). */
export const TEAM_COACH_ONLY_ROUTES = [
  "team.$teamId.statistik.tsx",
  "team.$teamId.periodplan.tsx",
  "team.$teamId.photos.tsx",
  "team.$teamId.narvaro.tsx",
] as const;

/** Sidor som spelare och vårdnadshavare alltid ska kunna öppna. */
export const PLAYER_ROUTES = [
  "kalender.index.tsx",
  "kallelser.tsx",
  "mina-kallelser.tsx",
  "meddelanden.tsx",
  "installningar.tsx",
  "teams.tsx",
  "team.$teamId.index.tsx",
  "team.$teamId.calendar.tsx",
  "team.$teamId.matches.tsx",
  "team.$teamId.leaders.tsx",
  "team.$teamId.player.$playerId.tsx",
  "spelarkunskap.index.tsx",
  "spelarkunskap.regler.tsx",
  "spelarkunskap.fair-play.tsx",
] as const;

/** Databasfunktioner som måste kontrollera ledarbehörighet själva. */
export const COACH_ONLY_RPCS = [
  "get_team_codes",
  "rotate_team_code",
  "save_event_attendance",
  "save_match_plan",
  "save_training_plan",
  "publish_event_invitations",
  "save_invitation_plan",
  "approve_team_join_request",
  "create_team",
] as const;

/** Sidor som spelare och vårdnadshavare alltid kan öppna. */
export const PLAYER_HOME_LINKS = [
  { to: "/" as const, label: "Idag" },
  { to: "/kalender" as const, label: "Kalender" },
  { to: "/kallelser" as const, label: "Mina kallelser" },
  { to: "/spelarkunskap" as const, label: "Kunskap" },
];

export type AccountKind = "coach" | "admin" | "player" | "guardian";

/** Enkel regel som speglar CoachOnly: bara tränare och admin släpps in. */
export function canOpenCoachPage(kind: AccountKind): boolean {
  return kind === "coach" || kind === "admin";
}
