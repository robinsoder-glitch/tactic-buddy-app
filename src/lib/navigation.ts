/** Appens huvudmeny. Ordningen är densamma på dator och i mobilmenyn. */
export type MainTab = {
  to: string;
  label: string;
  /** Sant när fliken bara ska markeras vid exakt träff på adressen. */
  exact: boolean;
};

export const MAIN_TABS: MainTab[] = [
  { to: "/planera-traning", label: "Planera träning", exact: false },
  { to: "/planera-match", label: "Planera match", exact: false },
  { to: "/taktik", label: "Taktik", exact: false },
  { to: "/kunskapsbank", label: "Kunskap", exact: false },
  { to: "/ovningsbank", label: "Träningsbank", exact: false },
  { to: "/mina-kallelser", label: "Mina kallelser", exact: false },
  { to: "/teams", label: "Mina lag", exact: false },
  { to: "/installningar", label: "Inställningar", exact: false },
];

/** De fyra viktigaste valen visas direkt i mobilens nedre rad. */
export const MOBILE_PRIMARY = ["/planera-traning", "/planera-match", "/taktik", "/kunskapsbank"];

/** Gamla adresser som ska leda vidare till rätt ny sida. */
export const LEGACY_REDIRECTS: Record<string, string> = {
  "/skapa": "/taktik",
  "/taktikbank": "/taktik",
  "/bank": "/teams",
};

export function isTabActive(pathname: string, tab: MainTab): boolean {
  return tab.exact ? pathname === tab.to : pathname === tab.to || pathname.startsWith(`${tab.to}/`);
}
