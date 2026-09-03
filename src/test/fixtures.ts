/**
 * Gemensam testdata för hela roadmapen (Etapp 0).
 *
 * Fixturerna är rena datastrukturer utan databasanrop. De beskriver den
 * uppsättning lag, konton och aktiviteter som varje etapp ska kunna testas mot,
 * både i enhetstester och som facit när testkonton skapas manuellt.
 *
 * Ingen produktionsdata skapas eller ändras av den här filen.
 */

export type FixtureRole = "coach" | "player" | "guardian" | "admin";
export type FixtureMemberStatus = "approved" | "pending";
export type FixtureEventKind = "training" | "match" | "other";
export type FixtureEventState = "upcoming" | "past" | "cancelled";
export type FixtureInviteStatus = "yes" | "maybe" | "no" | "pending";

export type FixtureTeam = {
  key: string;
  name: string;
  club: string;
  ageGroup: string;
  gender: string;
  joinCode: string;
  coachJoinCode: string;
};

export type FixtureAccount = {
  key: string;
  /** Namnet som ska visas i hälsningen, aldrig e-postadressen. */
  displayName: string;
  email: string;
  /** Barnets namn när kontot är vårdnadshavare. */
  guardianForNames: string[];
  memberships: { team: string; role: FixtureRole; status: FixtureMemberStatus }[];
};

export type FixturePlayer = {
  key: string;
  team: string;
  name: string;
  /** Spelare utan eget konto styrs helt av tränare och vårdnadshavare. */
  account: string | null;
  guardians: string[];
};

export type FixtureEvent = {
  key: string;
  team: string;
  kind: FixtureEventKind;
  state: FixtureEventState;
  title: string;
  /** Har närvaro registrerats efter aktiviteten? */
  hasAttendance: boolean;
  invites: { player: string; status: FixtureInviteStatus }[];
};

export const FIXTURE_TEAMS: FixtureTeam[] = [
  {
    key: "teamA",
    name: "Lag A P2017",
    club: "Testviks IF",
    ageGroup: "P2017",
    gender: "Pojkar",
    joinCode: "AAA111",
    coachJoinCode: "AAC111",
  },
  {
    key: "teamB",
    name: "Lag B F2016",
    club: "Norrby BK",
    ageGroup: "F2016",
    gender: "Flickor",
    joinCode: "BBB222",
    coachJoinCode: "BBC222",
  },
];

export const FIXTURE_ACCOUNTS: FixtureAccount[] = [
  {
    key: "coachA",
    displayName: "Robin",
    email: "robin.coach.a@fixture.test",
    guardianForNames: [],
    memberships: [{ team: "teamA", role: "coach", status: "approved" }],
  },
  {
    key: "coachB",
    displayName: "Sara",
    email: "sara.coach.b@fixture.test",
    guardianForNames: [],
    memberships: [{ team: "teamB", role: "coach", status: "approved" }],
  },
  {
    key: "coachPending",
    displayName: "Jonas",
    email: "jonas.coach.pending@fixture.test",
    guardianForNames: [],
    memberships: [{ team: "teamA", role: "coach", status: "pending" }],
  },
  {
    key: "playerAccount",
    displayName: "Noel",
    email: "noel.player@fixture.test",
    guardianForNames: [],
    memberships: [{ team: "teamA", role: "player", status: "approved" }],
  },
  {
    key: "guardianOneChild",
    displayName: "Maria",
    email: "maria.guardian@fixture.test",
    guardianForNames: ["Elias"],
    memberships: [{ team: "teamA", role: "guardian", status: "approved" }],
  },
  {
    key: "guardianTwoChildren",
    displayName: "Peter",
    email: "peter.guardian@fixture.test",
    guardianForNames: ["Wilma", "Alva"],
    memberships: [
      { team: "teamA", role: "guardian", status: "approved" },
      { team: "teamB", role: "guardian", status: "approved" },
    ],
  },
  {
    key: "coachAndGuardian",
    displayName: "Anna",
    email: "anna.coach.guardian@fixture.test",
    guardianForNames: ["Liv"],
    memberships: [
      { team: "teamB", role: "coach", status: "approved" },
      { team: "teamB", role: "guardian", status: "approved" },
    ],
  },
];

export const FIXTURE_PLAYERS: FixturePlayer[] = [
  { key: "playerNoel", team: "teamA", name: "Noel", account: "playerAccount", guardians: [] },
  { key: "playerElias", team: "teamA", name: "Elias", account: null, guardians: ["guardianOneChild"] },
  { key: "playerWilma", team: "teamA", name: "Wilma", account: null, guardians: ["guardianTwoChildren"] },
  { key: "playerAlva", team: "teamB", name: "Alva", account: null, guardians: ["guardianTwoChildren"] },
  { key: "playerLiv", team: "teamB", name: "Liv", account: null, guardians: ["coachAndGuardian"] },
];

export const FIXTURE_EVENTS: FixtureEvent[] = [
  {
    key: "trainingUpcoming",
    team: "teamA",
    kind: "training",
    state: "upcoming",
    title: "Träning tisdag",
    hasAttendance: false,
    invites: [
      { player: "playerNoel", status: "yes" },
      { player: "playerElias", status: "maybe" },
      { player: "playerWilma", status: "no" },
    ],
  },
  {
    key: "matchUpcoming",
    team: "teamA",
    kind: "match",
    state: "upcoming",
    title: "Match mot Norrby BK",
    hasAttendance: false,
    invites: [
      { player: "playerNoel", status: "yes" },
      { player: "playerElias", status: "pending" },
    ],
  },
  {
    key: "trainingPast",
    team: "teamA",
    kind: "training",
    state: "past",
    title: "Träning förra veckan",
    hasAttendance: true,
    invites: [{ player: "playerNoel", status: "yes" }],
  },
  {
    key: "trainingCancelled",
    team: "teamA",
    kind: "training",
    state: "cancelled",
    title: "Inställd träning",
    hasAttendance: false,
    invites: [{ player: "playerNoel", status: "pending" }],
  },
  {
    key: "trainingTeamB",
    team: "teamB",
    kind: "training",
    state: "upcoming",
    title: "Träning Lag B",
    hasAttendance: false,
    invites: [{ player: "playerAlva", status: "yes" }],
  },
];

/** Alla kallelsestatusar som ska finnas representerade i testdatan. */
export const FIXTURE_INVITE_STATUSES: FixtureInviteStatus[] = ["yes", "maybe", "no", "pending"];

/** Hälsningen ska alltid använda namnet, aldrig e-postadressen. */
export function fixtureGreeting(account: Pick<FixtureAccount, "displayName">): string {
  const name = account.displayName.trim();
  return name ? `Hej ${name}` : "Hej!";
}

/** Lag som ett konto får läsa data i. */
export function fixtureTeamsForAccount(account: FixtureAccount): string[] {
  return account.memberships.filter((m) => m.status === "approved").map((m) => m.team);
}

/** Enkel RLS-modell för tester: åtkomst kräver godkänt medlemskap i laget. */
export function fixtureCanRead(account: FixtureAccount, teamKey: string): boolean {
  return fixtureTeamsForAccount(account).includes(teamKey);
}
