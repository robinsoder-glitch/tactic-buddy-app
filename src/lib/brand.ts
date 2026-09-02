/** Tjänstens synliga namn och standardtexter. Ändra här – används överallt. */
export const BRAND_NAME = "Fotbollsrummet";
export const BRAND_LOGO_ALT = "Fotbollsrummets logga";
export const BRAND_TITLE = "Fotbollsrummet – tränarens verktyg för hela laget";
export const BRAND_DESCRIPTION =
  "Planera träningar och matcher, samla laget, visa taktik och följ lagets utveckling med Fotbollsrummet.";
export const BRAND_EYEBROW = "För tränare och ledare inom barn- och ungdomsfotboll";
export const BRAND_TAGLINE = "Planera laget. Utveckla spelarna. Förenkla tränarrollen.";
export const BRAND_INTRO =
  "Fotbollsrummet samlar träningar, matcher, taktik, spelare, kommunikation och statistik på ett ställe. Planera säsongen, bygg träningspass, kalla spelare och ledare, visa spelidén på taktiktavlan och följ lagets utveckling – enkelt före, under och efter varje aktivitet.";

/** Standardmeta för en sida. `title` bör redan innehålla sidans namn. */
export function brandMeta(title: string, description: string) {
  return [
    { title },
    { name: "description", content: description },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ];
}
