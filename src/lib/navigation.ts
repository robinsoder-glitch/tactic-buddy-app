/** Appens huvudmeny. Ordningen är densamma på dator och i mobilmenyn. */
export type MainTab = {
  to: string;
  label: string;
  /** Sant när fliken bara ska markeras vid exakt träff på adressen. */
  exact: boolean;
};

/** Primära arbetsområden – samma ordning på mobil och dator. */
export const MAIN_TABS: MainTab[] = [
  { to: "/planera-traning", label: "Planera träning", exact: false },
  { to: "/planera-match", label: "Matcher", exact: false },
  { to: "/kalender", label: "Kalender", exact: false },
  { to: "/narvaro", label: "Närvaro", exact: false },
  { to: "/taktik", label: "Taktik", exact: false },
  { to: "/ovningsbank", label: "Träningsbank", exact: false },
  { to: "/kunskapsbank", label: "Kunskap", exact: false },
];

/** Hur många primära flikar mobilens bottenmeny visar; resten hamnar i menyn. */
export const MOBILE_MAIN_LIMIT = 4;

/** Sekundär meny: Lag och verktyg. */
export const SECONDARY_TABS: MainTab[] = [
  { to: "/spelare", label: "Spelare", exact: false },
  { to: "/meddelanden", label: "Meddelanden", exact: false },
  { to: "/tranarsnack", label: "Tränarsnack", exact: false },
  { to: "/teams", label: "Mina lag", exact: false },
  { to: "/installningar", label: "Inställningar", exact: false },
];

export const SECONDARY_LABEL = "Lag och verktyg";

/** Spelare och vårdnadshavare ser bara sina egna sidor – ingen planering. */
export const PLAYER_MAIN_TABS: MainTab[] = [
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
  "/bank": "/teams",
  "/mina-kallelser": "/kallelser",
  "/kalender/kallelser": "/kallelser",
};

export function isTabActive(pathname: string, tab: MainTab): boolean {
  return tab.exact ? pathname === tab.to : pathname === tab.to || pathname.startsWith(`${tab.to}/`);
}

/**
 * Föräldervyn för en detaljsida. Returnerar null när sidan redan är en
 * huvud- eller verktygsflik, eller när ingen tydlig förälder finns.
 */
export function parentPathFor(pathname: string): string | null {
  const all = [...MAIN_TABS, ...SECONDARY_TABS];
  if (all.some((tab) => tab.to === pathname)) return null;
  const owner = all.find((tab) => pathname.startsWith(`${tab.to}/`));
  if (owner) return owner.to;
  if (pathname.startsWith("/team/")) return "/teams";
  return null;
}
