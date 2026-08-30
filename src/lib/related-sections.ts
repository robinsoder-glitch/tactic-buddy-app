import type { LinkType } from "./content-links";

export type SectionSpec = { title: string; types: LinkType[] };

/** Avsnitt på en kunskapsartikel. */
export const ARTICLE_SECTIONS: SectionSpec[] = [
  { title: "Se taktiken", types: ["tactic"] },
  { title: "Träna detta", types: ["drill", "goalkeeper"] },
  { title: "Använd i ett träningspass", types: ["session"] },
];

/** Avsnitt på ett taktikkort. */
export const TACTIC_SECTIONS: SectionSpec[] = [
  { title: "Träna detta", types: ["drill", "goalkeeper"] },
  { title: "Fördjupa dig", types: ["article"] },
];

/** Avsnitt på en övning. */
export const DRILL_SECTIONS: SectionSpec[] = [
  { title: "Taktiken bakom övningen", types: ["tactic"] },
  { title: "Därför tränar vi detta", types: ["article"] },
];
