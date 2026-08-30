import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, Clock, Search, Sparkles } from "lucide-react";
import {
  KNOWLEDGE_AGE_OPTIONS,
  KNOWLEDGE_FORMAT_OPTIONS,
  fetchKnowledgeArticles,
  filterKnowledge,
  knowledgeAgeLabel,
  knowledgeCategories,
  knowledgeFormatLabel,
} from "@/lib/knowledge";
import { Input } from "@/components/ui/input";

function Chips({
  value,
  onChange,
  options,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  options: [string, string][];
  label: string;
}) {
  return (
    <div className="flex flex-wrap gap-1" aria-label={label}>
      {options.map(([key, text]) => (
        <button
          key={key}
          type="button"
          aria-pressed={value === key}
          onClick={() => onChange(key)}
          className={`rounded-full border px-3 py-1 text-xs ${
            value === key ? "border-primary bg-primary/15 text-foreground" : "border-border text-muted-foreground"
          }`}
        >
          {text}
        </button>
      ))}
    </div>
  );
}

export function KnowledgeLibrary() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [age, setAge] = useState("all");
  const [format, setFormat] = useState("all");
  const [onlyFeatured, setOnlyFeatured] = useState(false);

  const articles = useQuery({ queryKey: ["knowledge-articles"], queryFn: fetchKnowledgeArticles });
  const all = articles.data ?? [];
  const categories = useMemo(() => knowledgeCategories(all), [all]);
  const list = useMemo(
    () => filterKnowledge(all, { query, category, age, format, onlyFeatured }),
    [all, query, category, age, format, onlyFeatured],
  );

  return (
    <section aria-label="Granskade artiklar" className="mt-4">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Sök bland granskade artiklar"
          aria-label="Sök bland granskade artiklar"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>

      <div className="mt-3 space-y-2">
        <Chips
          label="Kategori"
          value={category}
          onChange={setCategory}
          options={[["all", "Alla kategorier"], ...categories.map((item) => [item, item] as [string, string])]}
        />
        <Chips label="Ålder" value={age} onChange={setAge} options={KNOWLEDGE_AGE_OPTIONS} />
        <Chips label="Spelform" value={format} onChange={setFormat} options={KNOWLEDGE_FORMAT_OPTIONS} />
        <button
          type="button"
          aria-pressed={onlyFeatured}
          onClick={() => setOnlyFeatured((value) => !value)}
          className={`flex items-center gap-1 rounded-full border px-3 py-1 text-xs ${
            onlyFeatured ? "border-primary bg-primary/15 text-foreground" : "border-border text-muted-foreground"
          }`}
        >
          <Sparkles className="size-3.5" /> Utvalda
        </button>
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        {articles.isLoading ? "Laddar artiklar…" : `${list.length} av ${all.length} artiklar`}
      </p>

      <div className="mt-2 space-y-3">
        {list.map((article) => (
          <Link
            key={article.id}
            to="/kunskapsbank/$slug"
            params={{ slug: article.slug }}
            className="block rounded-xl border border-border bg-card p-4 transition hover:border-primary"
          >
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              {article.category} · {knowledgeAgeLabel(article)}
              {knowledgeFormatLabel(article) ? ` · ${knowledgeFormatLabel(article)}` : ""}
            </p>
            <h3 className="mt-1 font-display text-lg font-semibold">{article.title_sv}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{article.summary_sv}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              {article.source_name && <span>Källa: {article.source_name}</span>}
              {article.reading_minutes ? (
                <span className="inline-flex items-center gap-1">
                  <Clock className="size-3.5" /> {article.reading_minutes} min
                </span>
              ) : null}
              {article.featured && <span className="rounded-full border border-border px-2 py-0.5">Utvald</span>}
            </div>
          </Link>
        ))}
        {!articles.isLoading && list.length === 0 && (
          <div className="rounded-xl border border-dashed border-border p-8 text-center">
            <BookOpen className="mx-auto size-8 text-primary" />
            <p className="mt-3 text-sm text-muted-foreground">Inga artiklar matchar filtren.</p>
          </div>
        )}
      </div>
    </section>
  );
}
