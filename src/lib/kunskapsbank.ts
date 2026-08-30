import { supabase } from "@/integrations/supabase/client";

export const KB_CATEGORIES = [
  "coaching",
  "technique",
  "game_understanding",
  "physical",
  "nutrition",
  "goalkeeper",
  "team_environment",
  "injury",
  "rules_formats",
  "research",
] as const;

export type KbCategory = (typeof KB_CATEGORIES)[number];

export const KB_CATEGORY_LABELS: Record<string, string> = {
  coaching: "Tränarskap och pedagogik",
  technique: "Teknik",
  game_understanding: "Spelförståelse och taktik",
  physical: "Fysik och motorik",
  nutrition: "Kost och återhämtning",
  goalkeeper: "Målvakt",
  team_environment: "Laget och trygg miljö",
  injury: "Skador och belastning",
  rules_formats: "Regler och spelformer",
  research: "Fördjupning och forskning",
};

export const KB_LEVELS = ["basic", "intermediate", "advanced"] as const;
export type KbLevel = (typeof KB_LEVELS)[number];

export const KB_LEVEL_LABELS: Record<string, string> = {
  basic: "Grundläggande",
  intermediate: "Fortsättning",
  advanced: "Avancerad",
};

export const KB_STATUSES = ["verified", "needs_check", "unverified"] as const;
export type KbStatus = (typeof KB_STATUSES)[number];

export const KB_STATUS_LABELS: Record<string, string> = {
  verified: "Verifierad",
  needs_check: "Behöver kontrolleras",
  unverified: "Ej verifierad",
};

export type KbArticle = {
  id: string;
  title: string;
  summary: string | null;
  coach_value: string | null;
  category: string;
  age_min: number | null;
  age_max: number | null;
  level: string;
  source_name: string | null;
  source_url: string | null;
  published_at: string | null;
  reviewed_at: string | null;
  tags: string[];
  status: string;
  is_published: boolean;
};

const COLUMNS =
  "id, title, summary, coach_value, category, age_min, age_max, level, source_name, source_url, published_at, reviewed_at, tags, status, is_published";

export async function fetchArticles(): Promise<KbArticle[]> {
  const { data, error } = await supabase.from("kb_articles").select(COLUMNS).order("title");
  if (error) throw error;
  return (data ?? []) as unknown as KbArticle[];
}

export type ArticleInput = Omit<KbArticle, "id"> & { id?: string };

export async function saveArticle(input: ArticleInput, userId: string) {
  const payload = { ...input, created_by: userId };
  if (input.id) {
    const { id, ...rest } = payload;
    const { error } = await supabase.from("kb_articles").update(rest).eq("id", id as string);
    if (error) throw error;
    return;
  }
  const { id: _ignored, ...rest } = payload;
  const { error } = await supabase.from("kb_articles").insert(rest);
  if (error) throw error;
}

export async function deleteArticle(id: string) {
  const { error } = await supabase.from("kb_articles").delete().eq("id", id);
  if (error) throw error;
}

/** Vanliga användare får bara se publicerade och verifierade artiklar. */
export function visibleArticles(articles: KbArticle[], isAdmin: boolean): KbArticle[] {
  if (isAdmin) return articles;
  return articles.filter((article) => article.is_published && article.status === "verified");
}

export type ArticleFilter = {
  query?: string;
  category?: string;
  level?: string;
  age?: string;
  onlyFavorites?: boolean;
  favorites?: Set<string>;
};

export function filterArticles(articles: KbArticle[], filter: ArticleFilter): KbArticle[] {
  return articles.filter((article) => {
    if (filter.onlyFavorites && !filter.favorites?.has(`article:${article.id}`)) return false;
    if (filter.category && filter.category !== "all" && article.category !== filter.category) return false;
    if (filter.level && filter.level !== "all" && article.level !== filter.level) return false;
    if (filter.age && filter.age !== "all") {
      const wanted = Number(filter.age);
      if (article.age_min !== null && wanted < article.age_min) return false;
      if (article.age_max !== null && wanted > article.age_max) return false;
    }
    const needle = (filter.query ?? "").trim().toLowerCase();
    if (!needle) return true;
    const haystack = [article.title, article.summary ?? "", article.coach_value ?? "", ...(article.tags ?? [])]
      .join(" ")
      .toLowerCase();
    return needle.split(/\s+/).every((word) => haystack.includes(word));
  });
}

export function ageLabel(article: KbArticle): string {
  if (article.age_min === null && article.age_max === null) return "Alla åldrar";
  if (article.age_min !== null && article.age_max !== null) return `${article.age_min}–${article.age_max} år`;
  if (article.age_min !== null) return `Från ${article.age_min} år`;
  return `Till ${article.age_max} år`;
}
