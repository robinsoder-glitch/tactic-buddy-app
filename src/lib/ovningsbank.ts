import type { Drill, TacticCard, TrainingSessionCard } from "./taktikbank";

/** Härledd metadata för en övning, baserad på de taktikkort övningen är kopplad till. */
export type DrillMeta = {
  formats: string[];
  areas: string[];
  difficulties: number[];
  ageMin: number | null;
  ageMax: number | null;
};

export function drillMeta(drill: Drill, cards: TacticCard[]): DrillMeta {
  const linked = drill.data.linkedTacticIds ?? [];
  const related = cards.filter((card) => linked.includes(card.id));
  const formats = Array.from(new Set(related.map((card) => card.format)));
  const areas = Array.from(new Set(related.map((card) => card.phase).filter(Boolean) as string[]));
  const difficulties = Array.from(new Set(related.map((card) => card.difficulty))).sort();
  const mins = related.map((card) => card.data.ageFit?.min).filter((n): n is number => typeof n === "number");
  const maxs = related.map((card) => card.data.ageFit?.max).filter((n): n is number => typeof n === "number");
  return {
    formats,
    areas,
    difficulties,
    ageMin: mins.length ? Math.min(...mins) : null,
    ageMax: maxs.length ? Math.max(...maxs) : null,
  };
}

export type DrillFilter = {
  query?: string;
  format?: string;
  area?: string;
  difficulty?: string;
  age?: string;
  onlyFavorites?: boolean;
  favorites?: Set<string>;
};

export function filterDrills(drills: Drill[], cards: TacticCard[], filter: DrillFilter): Drill[] {
  return drills.filter((drill) => {
    const meta = drillMeta(drill, cards);
    if (filter.onlyFavorites && !filter.favorites?.has(`drill:${drill.id}`)) return false;
    if (filter.format && filter.format !== "all" && !meta.formats.includes(filter.format)) return false;
    if (filter.area && filter.area !== "all" && !meta.areas.includes(filter.area)) return false;
    if (filter.difficulty && filter.difficulty !== "all" && !meta.difficulties.includes(Number(filter.difficulty)))
      return false;
    if (filter.age && filter.age !== "all") {
      const wanted = Number(filter.age);
      if (meta.ageMin !== null && wanted < meta.ageMin) return false;
      if (meta.ageMax !== null && wanted > meta.ageMax) return false;
    }
    const needle = (filter.query ?? "").trim().toLowerCase();
    if (needle) {
      const haystack = [drill.title, drill.purpose ?? ""].join(" ").toLowerCase();
      if (!needle.split(/\s+/).every((word) => haystack.includes(word))) return false;
    }
    return true;
  });
}

export function filterSessions(
  sessions: TrainingSessionCard[],
  filter: { query?: string; onlyFavorites?: boolean; favorites?: Set<string> },
): TrainingSessionCard[] {
  return sessions.filter((session) => {
    if (filter.onlyFavorites && !filter.favorites?.has(`session:${session.id}`)) return false;
    const needle = (filter.query ?? "").trim().toLowerCase();
    if (!needle) return true;
    const haystack = [session.title, session.theme ?? "", ...session.data.blocks.map((b) => b.activity)]
      .join(" ")
      .toLowerCase();
    return needle.split(/\s+/).every((word) => haystack.includes(word));
  });
}
