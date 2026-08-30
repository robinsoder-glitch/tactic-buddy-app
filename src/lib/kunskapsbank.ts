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
  tags?: string[];
  onlyFavorites?: boolean;
  favorites?: Set<string>;
};

export function filterArticles(articles: KbArticle[], filter: ArticleFilter): KbArticle[] {
  return articles.filter((article) => {
    if (filter.onlyFavorites && !filter.favorites?.has(`article:${article.id}`)) return false;
    if (filter.category && filter.category !== "all" && article.category !== filter.category) return false;
    if (filter.level && filter.level !== "all" && article.level !== filter.level) return false;
    if (filter.tags?.length) {
      const tags = (article.tags ?? []).map((tag) => tag.toLowerCase());
      if (!filter.tags.every((tag) => tags.includes(tag.toLowerCase()))) return false;
    }
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

/** Alla taggar som finns i artiklarna, sorterade och utan dubbletter. */
export function allTags(articles: KbArticle[]): string[] {
  const set = new Set<string>();
  for (const article of articles) for (const tag of article.tags ?? []) set.add(tag.trim());
  return Array.from(set).filter(Boolean).sort((a, b) => a.localeCompare(b, "sv"));
}

/** Validerar en artikel innan den sparas. Returnerar svenska felmeddelanden. */
export function validateArticle(input: ArticleInput): string[] {
  const errors: string[] = [];
  const title = input.title?.trim() ?? "";
  if (!title) errors.push("Ange en titel.");
  if (title.length > 200) errors.push("Titeln får vara högst 200 tecken.");
  if ((input.summary ?? "").length > 1000) errors.push("Sammanfattningen får vara högst 1000 tecken.");
  if (!KB_CATEGORIES.includes(input.category as KbCategory)) errors.push("Välj en giltig kategori.");
  if (!KB_LEVELS.includes(input.level as KbLevel)) errors.push("Välj en giltig kunskapsnivå.");
  if (!KB_STATUSES.includes(input.status as KbStatus)) errors.push("Välj en giltig status.");

  const url = (input.source_url ?? "").trim();
  if (url && !/^https?:\/\/\S+$/i.test(url)) errors.push("Länken måste börja med http:// eller https://.");

  if (input.age_min !== null && input.age_max !== null && input.age_min > input.age_max) {
    errors.push("Ålder från kan inte vara högre än ålder till.");
  }

  const today = new Date().toISOString().slice(0, 10);
  for (const [value, name] of [
    [input.published_at, "Publiceringsdatum"],
    [input.reviewed_at, "Senast granskad"],
  ] as [string | null, string][]) {
    if (!value) continue;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(value))) {
      errors.push(`${name} måste vara ett giltigt datum.`);
    } else if (value > today) {
      errors.push(`${name} kan inte ligga i framtiden.`);
    }
  }

  if (input.status === "verified") {
    if (!input.source_name?.trim() || !url) errors.push("En verifierad artikel behöver både källa och länk.");
    if (!input.reviewed_at) errors.push("En verifierad artikel behöver ett granskningsdatum.");
  }
  if (input.is_published && input.status !== "verified") {
    errors.push("Bara verifierade artiklar kan publiceras.");
  }
  return errors;
}

/** Nyckel som avgör om två artiklar är samma. */
export function articleKey(article: { title: string; source_url?: string | null }): string {
  const url = (article.source_url ?? "").trim().toLowerCase().replace(/\/+$/, "");
  return url || article.title.trim().toLowerCase();
}

export type ImportResult = {
  toImport: ArticleInput[];
  duplicates: number;
  invalid: { title: string; errors: string[] }[];
};

/** Läser en importfil (JSON-lista eller ett objekt med "articles") och sorterar bort dubbletter. */
export function parseArticleImport(raw: string, existing: KbArticle[]): ImportResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Filen är inte en giltig JSON-fil.");
  }
  const list = Array.isArray(parsed)
    ? parsed
    : Array.isArray((parsed as { articles?: unknown })?.articles)
      ? (parsed as { articles: unknown[] }).articles
      : null;
  if (!list) throw new Error("Filen måste innehålla en lista med artiklar.");

  const seen = new Set(existing.map((article) => articleKey(article)));
  const result: ImportResult = { toImport: [], duplicates: 0, invalid: [] };

  for (const item of list) {
    const article = normalizeImported(item as Record<string, unknown>);
    const key = articleKey(article);
    if (seen.has(key)) {
      result.duplicates += 1;
      continue;
    }
    const errors = validateArticle(article);
    if (errors.length) {
      result.invalid.push({ title: article.title || "Namnlös artikel", errors });
      continue;
    }
    seen.add(key);
    result.toImport.push(article);
  }
  return result;
}

function normalizeImported(item: Record<string, unknown>): ArticleInput {
  const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");
  const num = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? Math.round(value) : null);
  const date = (value: unknown) => (typeof value === "string" && value.trim() ? value.trim().slice(0, 10) : null);
  return {
    title: text(item['title']),
    summary: text(item['summary']) || null,
    coach_value: text(item['coach_value']) || null,
    category: text(item['category']) || "coaching",
    age_min: num(item['age_min']),
    age_max: num(item['age_max']),
    level: text(item['level']) || "basic",
    source_name: text(item['source_name']) || null,
    source_url: text(item['source_url']) || null,
    published_at: date(item['published_at']),
    reviewed_at: date(item['reviewed_at']),
    tags: Array.isArray(item['tags'])
      ? (item['tags'] as unknown[]).map((tag) => String(tag).trim()).filter(Boolean)
      : [],
    status: text(item['status']) || "unverified",
    is_published: item['is_published'] === true,
  };
}

export async function importArticles(articles: ArticleInput[], userId: string) {
  if (!articles.length) return 0;
  const rows = articles.map((article) => ({ ...article, created_by: userId }));
  const { error } = await supabase.from("kb_articles").insert(rows);
  if (error) throw error;
  return rows.length;
}
