import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen, Clock, Search, Star } from "lucide-react";
import { toast } from "sonner";
import { addFavorite, fetchFavorites, removeFavorite } from "@/lib/taktikbank";
import { useAuth } from "@/hooks/useAuth";
import {
  KNOWLEDGE_AGE_OPTIONS,
  fetchKnowledgeArticles,
  filterKnowledge,
  knowledgeAgeLabel,
  knowledgeCategories,
  knowledgeLevels,
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

const PAGE_SIZE = 12;

export function KnowledgeLibrary() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [age, setAge] = useState("all");
  const [level, setLevel] = useState("all");
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const [visible, setVisible] = useState(PAGE_SIZE);


  const { user } = useAuth();
  const queryClient = useQueryClient();
  const articles = useQuery({ queryKey: ["knowledge-articles"], queryFn: fetchKnowledgeArticles });
  const favorites = useQuery({ queryKey: ["tb-favorites"], queryFn: fetchFavorites });
  const favoriteSet = useMemo(
    () =>
      new Set(
        (favorites.data ?? []).filter((item) => item.kind === "article").map((item) => item.resource_id),
      ),
    [favorites.data],
  );
  const toggleFavorite = useMutation({
    mutationFn: async (input: { id: string; active: boolean }) => {
      if (!user) throw new Error("Inte inloggad");
      if (input.active) await removeFavorite(user.id, "article", input.id);
      else await addFavorite(user.id, "article", input.id);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tb-favorites"] }),
    onError: () => toast.error("Det gick inte att spara favoriten."),
  });

  const all = articles.data ?? [];
  const categories = useMemo(() => knowledgeCategories(all), [all]);
  const levels = useMemo(() => knowledgeLevels(all), [all]);
  const list = useMemo(
    () =>
      filterKnowledge(all, { query, category, age, level }).filter(
        (article) => !onlyFavorites || favoriteSet.has(article.id),
      ),
    [all, query, category, age, level, onlyFavorites, favoriteSet],
  );
  useEffect(() => {
    setVisible(PAGE_SIZE);
  }, [query, category, age, level, onlyFavorites]);
  const shown = list.slice(0, visible);

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
        <Chips label="Åldersgrupp" value={age} onChange={setAge} options={KNOWLEDGE_AGE_OPTIONS} />
        {levels.length > 1 && (
          <Chips
            label="Nivå"
            value={level}
            onChange={setLevel}
            options={[["all", "Alla nivåer"], ...levels.map((item) => [item, item] as [string, string])]}
          />
        )}
        <button
          type="button"
          aria-pressed={onlyFavorites}
          onClick={() => setOnlyFavorites((value) => !value)}
          className={`flex items-center gap-1 rounded-full border px-3 py-1 text-xs ${
            onlyFavorites ? "border-primary bg-primary/15 text-foreground" : "border-border text-muted-foreground"
          }`}
        >
          <Star className="size-3.5" /> Mina favoriter
        </button>
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        {articles.isLoading ? "Laddar artiklar…" : `${list.length} av ${all.length} artiklar`}
      </p>

      <div className="mt-2 space-y-3">
        {shown.map((article) => (
          <div key={article.id} className="relative">
          <button
            type="button"
            aria-pressed={favoriteSet.has(article.id)}
            aria-label={
              favoriteSet.has(article.id)
                ? `Ta bort ${article.title_sv} från Mina favoriter`
                : `Spara ${article.title_sv} i Mina favoriter`
            }
            onClick={() => toggleFavorite.mutate({ id: article.id, active: favoriteSet.has(article.id) })}
            className="absolute right-2 top-2 z-10 rounded-full p-2 text-muted-foreground hover:text-primary"
          >
            <Star className={`size-4 ${favoriteSet.has(article.id) ? "fill-current text-primary" : ""}`} />
          </button>
          <Link
            to="/kunskapsbank/$slug"
            params={{ slug: article.slug }}
            className="block rounded-xl border border-border bg-card p-4 pr-12 transition hover:border-primary"
          >
            <p className="text-xs tracking-wide text-muted-foreground">
              {article.category} · {knowledgeAgeLabel(article)}
              {article.level ? ` · ${article.level}` : ""}
            </p>
            <h3 className="mt-1 font-display text-lg font-semibold">{article.title_sv}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{article.summary_sv}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              {article.reading_minutes ? (
                <span className="inline-flex items-center gap-1">
                  <Clock className="size-3.5" /> {article.reading_minutes} min
                </span>
              ) : null}
            </div>
          </Link>
          <div className="mt-2">
          </div>
          </div>
        ))}

        {list.length > shown.length && (
          <button
            type="button"
            onClick={() => setVisible((value) => value + PAGE_SIZE)}
            className="w-full rounded-xl border border-border px-4 py-3 text-sm font-semibold hover:border-primary"
          >
            Visa fler artiklar ({list.length - shown.length} kvar)
          </button>
        )}

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
