/** Appens huvudmeny. Ordningen är densamma på dator och i mobilmenyn. */
export type MainTab = {
  to: string;
  label: string;
  /** Sant när fliken bara ska markeras vid exakt träff på adressen. */
  exact: boolean;
};

/** Primära arbetsområden – samma ordning på mobil och dator. */
export const MAIN_TABS: MainTab[] = [
  { to: "/", label: "Idag", exact: true },
  { to: "/kalender", label: "Kalender", exact: false },
  { to: "/kallelser", label: "Kallelser", exact: false },
  { to: "/planera", label: "Planera", exact: false },
  { to: "/teams", label: "Lag", exact: false },
];

/** Hur många primära flikar mobilens bottenmeny visar; resten hamnar i menyn. */
export const MOBILE_MAIN_LIMIT = 5;

/** Sekundär meny: bibliotek och verktyg. */
export const SECONDARY_TABS: MainTab[] = [
  { to: "/kunskapsbank", label: "Kunskap", exact: false },
  { to: "/meddelanden", label: "Meddelanden", exact: false },
  { to: "/tranarsnack", label: "Tränarsnack", exact: false },
  { to: "/installningar", label: "Inställningar", exact: false },
];

export const SECONDARY_LABEL = "Mer";

/** Sidor som samlas under Planera – visas som kort på planeringssidan. */
export const PLANNING_TABS: MainTab[] = [
  { to: "/planera-traning", label: "Planera träning", exact: false },
  { to: "/planera-match", label: "Matcher", exact: false },
  { to: "/narvaro", label: "Närvaro", exact: false },
  { to: "/spelare", label: "Spelare", exact: false },
  { to: "/ovningsbank", label: "Träningsbank", exact: false },
  { to: "/taktik", label: "Taktik", exact: false },
];

/** Spelare och vårdnadshavare ser bara sina egna sidor – ingen planering. */
export const PLAYER_MAIN_TABS: MainTab[] = [
  { to: "/", label: "Idag", exact: true },
  { to: "/kalender", label: "Kalender", exact: false },
  { to: "/kallelser", label: "Mina kallelser", exact: false },
  { to: "/teams", label: "Mitt lag", exact: false },
  { to: "/kunskapsbank", label: "Kunskap", exact: false },
];

export const PLAYER_SECONDARY_TABS: MainTab[] = [
  { to: "/meddelanden", label: "Meddelanden", exact: false },
  { to: "/installningar", label: "Inställningar", exact: false },
];

/** Vilka flikar som ska visas beroende på roll. */
export function tabsForRole(isCoachOrAdmin: boolean): {
  main: MainTab[];
  secondary: MainTab[];
} {
  return isCoachOrAdmin
    ? { main: MAIN_TABS, secondary: SECONDARY_TABS }
    : { main: PLAYER_MAIN_TABS, secondary: PLAYER_SECONDARY_TABS };
}

/** Gamla adresser som ska leda vidare till rätt ny sida. */
export const LEGACY_REDIRECTS: Record<string, string> = {
  "/mina-kallelser": "/kallelser",
  "/kalender/kallelser": "/kallelser",
};

export function isTabActive(pathname: string, tab: MainTab): boolean {
  return tab.exact ? pathname === tab.to : pathname === tab.to || pathname.startsWith(`${tab.to}/`);
}

/** Alla adresser som menyn känner till, inklusive sidorna under Planera. */
const ALL_TABS = [
  ...MAIN_TABS,
  ...SECONDARY_TABS,
  ...PLANNING_TABS,
  ...PLAYER_MAIN_TABS,
  ...PLAYER_SECONDARY_TABS,
];

/**
 * Föräldervyn för en detaljsida. Returnerar null när sidan redan är en
 * huvud- eller verktygsflik, eller när ingen tydlig förälder finns.
 */
export function parentPathFor(pathname: string): string | null {
  if (PLANNING_TABS.some((tab) => tab.to === pathname)) return "/planera";
  if (ALL_TABS.some((tab) => tab.to === pathname)) return null;
  const owner = ALL_TABS.filter((tab) => tab.to !== "/").find((tab) =>
    pathname.startsWith(`${tab.to}/`),
  );
  if (owner) return owner.to;
  if (pathname.startsWith("/team/")) return "/teams";
  return null;
}
