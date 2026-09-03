import { supabase } from "@/integrations/supabase/client";

export type KnowledgeArticle = {
  id: string;
  slug: string;
  title_sv: string;
  title_original: string | null;
  summary_sv: string;
  learn_sv: string | null;
  try_next_sv: string | null;
  category: string;
  age_label: string | null;
  age_5_7: boolean;
  age_8_9: boolean;
  age_10: boolean;
  game_format_label: string | null;
  format_3v3: boolean;
  format_5v5: boolean;
  format_7v7: boolean;
  level: string | null;
  content_type: string | null;
  language: string | null;
  source_name: string | null;
  source_type: string | null;
  reading_minutes: number | null;
  coach_value: string | null;
  evidence_level: string | null;
  original_url: string;
  checked_date: string | null;
  is_published: boolean;
  featured: boolean;
  sort_order: number | null;
  copyright_note: string | null;
};

const COLUMNS =
  "id, slug, title_sv, title_original, summary_sv, learn_sv, try_next_sv, category, age_label, age_5_7, age_8_9, age_10, game_format_label, format_3v3, format_5v5, format_7v7, level, content_type, language, source_name, source_type, reading_minutes, coach_value, evidence_level, original_url, checked_date, is_published, featured, sort_order, copyright_note";

export async function fetchKnowledgeArticles(): Promise<KnowledgeArticle[]> {
  const { data, error } = await supabase
    .from("knowledge_articles")
    .select(COLUMNS)
    .eq("is_published", true)
    .order("featured", { ascending: false })
    .order("sort_order", { ascending: true })
    .order("title_sv", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as KnowledgeArticle[];
}

export async function fetchKnowledgeArticle(slug: string): Promise<KnowledgeArticle | null> {
  const { data, error } = await supabase
    .from("knowledge_articles")
    .select(COLUMNS)
    .eq("slug", slug)
    .eq("is_published", true)
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as unknown as KnowledgeArticle | null;
}

export const KNOWLEDGE_AGE_OPTIONS: [string, string][] = [
  ["all", "Alla åldrar"],
  ["age_5_7", "5–7 år"],
  ["age_8_9", "8–9 år"],
  ["age_10", "10 år"],
];

export const KNOWLEDGE_FORMAT_OPTIONS: [string, string][] = [
  ["all", "Alla spelformer"],
  ["format_3v3", "3 mot 3"],
  ["format_5v5", "5 mot 5"],
  ["format_7v7", "7 mot 7"],
];

export type KnowledgeFilter = {
  query?: string;
  category?: string;
  age?: string;
  format?: string;
  level?: string;
  language?: string;
  source?: string;
  onlyFeatured?: boolean;
};

export function knowledgeCategories(articles: KnowledgeArticle[]): string[] {
  return Array.from(new Set(articles.map((a) => a.category).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b, "sv"),
  );
}

function distinctValues(
  articles: KnowledgeArticle[],
  key: "level" | "language" | "source_name",
): string[] {
  return Array.from(
    new Set(articles.map((a) => a[key]).filter((v): v is string => Boolean(v))),
  ).sort((a, b) => a.localeCompare(b, "sv"));
}

/** Nivåerna visas alltid i stigande svårighetsgrad. */
export const KNOWLEDGE_LEVEL_ORDER = ["Grund", "Fortsättning", "Fördjupning"];

export function knowledgeLevels(articles: KnowledgeArticle[]): string[] {
  const present = new Set(distinctValues(articles, "level"));
  const ordered = KNOWLEDGE_LEVEL_ORDER.filter((level) => present.has(level));
  const rest = Array.from(present).filter((level) => !KNOWLEDGE_LEVEL_ORDER.includes(level));
  return [...ordered, ...rest];
}

export function knowledgeLanguages(articles: KnowledgeArticle[]): string[] {
  return distinctValues(articles, "language");
}

export function knowledgeSources(articles: KnowledgeArticle[]): string[] {
  return distinctValues(articles, "source_name");
}

export function filterKnowledge(
  articles: KnowledgeArticle[],
  filter: KnowledgeFilter,
): KnowledgeArticle[] {
  return articles.filter((article) => {
    if (filter.onlyFeatured && !article.featured) return false;
    if (filter.category && filter.category !== "all" && article.category !== filter.category)
      return false;
    if (
      filter.age &&
      filter.age !== "all" &&
      !article[filter.age as "age_5_7" | "age_8_9" | "age_10"]
    )
      return false;
    if (
      filter.format &&
      filter.format !== "all" &&
      !article[filter.format as "format_3v3" | "format_5v5" | "format_7v7"]
    ) {
      return false;
    }
    if (filter.level && filter.level !== "all" && article.level !== filter.level) return false;
    if (filter.language && filter.language !== "all" && article.language !== filter.language)
      return false;
    if (filter.source && filter.source !== "all" && article.source_name !== filter.source)
      return false;
    const needle = (filter.query ?? "").trim().toLowerCase();
    if (!needle) return true;
    const haystack = [
      article.title_sv,
      article.title_original ?? "",
      article.summary_sv,
      article.learn_sv ?? "",
      article.coach_value ?? "",
      article.category,
      article.source_name ?? "",
    ]
      .join(" ")
      .toLowerCase();
    return needle.split(/\s+/).every((word) => haystack.includes(word));
  });
}

export function knowledgeAgeLabel(article: KnowledgeArticle): string {
  if (article.age_label) return article.age_label;
  const parts: string[] = [];
  if (article.age_5_7) parts.push("5–7 år");
  if (article.age_8_9) parts.push("8–9 år");
  if (article.age_10) parts.push("10 år");
  return parts.length ? parts.join(", ") : "Alla åldrar";
}

export function knowledgeFormatLabel(article: KnowledgeArticle): string | null {
  if (article.game_format_label) return article.game_format_label;
  const parts: string[] = [];
  if (article.format_3v3) parts.push("3 mot 3");
  if (article.format_5v5) parts.push("5 mot 5");
  if (article.format_7v7) parts.push("7 mot 7");
  return parts.length ? parts.join(", ") : null;
}

export type KnowledgeKind = "Artikel" | "Forskning" | "Resursbank" | "Verktyg";

/** Skiljer en vanlig artikel från forskning, portalsidor och verktyg. */
export function knowledgeKind(article: KnowledgeArticle): KnowledgeKind {
  const text = `${article.content_type ?? ""} ${article.source_type ?? ""}`.toLowerCase();
  if (text.includes("verktyg") || text.includes("app")) return "Verktyg";
  if (text.includes("resursbank") || text.includes("resursarkiv") || text.includes("dokumentarkiv"))
    return "Resursbank";
  if (
    text.includes("vetenskap") ||
    text.includes("systematisk") ||
    text.includes("forskning") ||
    text.includes("medicinsk")
  )
    return "Forskning";
  return "Artikel";
}
