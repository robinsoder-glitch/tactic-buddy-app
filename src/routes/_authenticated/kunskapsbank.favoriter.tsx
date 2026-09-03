import { useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Star } from "lucide-react";
import { fetchFavorites } from "@/lib/taktikbank";
import { fetchKnowledgeArticles } from "@/lib/knowledge";
import { fetchArticles } from "@/lib/kunskapsbank";
import { KnowledgeTabs } from "@/components/KnowledgeTabs";

export const Route = createFileRoute("/_authenticated/kunskapsbank/favoriter")({
  head: () => ({
    meta: [
      { title: "Mina favoriter – Kunskapsbanken" },
      {
        name: "description",
        content:
          "Alla artiklar du har sparat som favoriter i Kunskapsbanken, samlade på ett ställe.",
      },
      { property: "og:title", content: "Mina favoriter i Kunskapsbanken" },
      { property: "og:description", content: "Dina sparade artiklar samlade på ett ställe." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: FavoritesPage,
});

function FavoritesPage() {
  const favorites = useQuery({ queryKey: ["tb-favorites"], queryFn: fetchFavorites });
  const knowledge = useQuery({ queryKey: ["knowledge-articles"], queryFn: fetchKnowledgeArticles });
  const kb = useQuery({ queryKey: ["kb-articles"], queryFn: fetchArticles });

  const ids = useMemo(
    () =>
      new Set(
        (favorites.data ?? [])
          .filter((item) => item.kind === "article")
          .map((item) => item.resource_id),
      ),
    [favorites.data],
  );

  const savedKnowledge = (knowledge.data ?? []).filter((article) => ids.has(article.id));
  const savedKb = (kb.data ?? []).filter((article) => ids.has(article.id));
  const loading = favorites.isLoading || knowledge.isLoading || kb.isLoading;
  const empty = !loading && savedKnowledge.length === 0 && savedKb.length === 0;

  return (
    <main className="mx-auto max-w-3xl px-4 pb-28 pt-8 md:pt-20">
      <h1 className="flex items-center gap-2 font-display text-3xl font-bold">
        <Star className="size-6 fill-primary text-primary" aria-hidden /> Mina favoriter
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Här samlas artiklarna du har markerat med stjärnan i Kunskapsbanken.
      </p>

      <KnowledgeTabs active="favorites" />

      {loading && <p className="mt-6 text-sm text-muted-foreground">Laddar dina favoriter …</p>}

      {empty && (
        <div className="mt-6 rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Du har inga favoriter ännu. Tryck på stjärnan på en artikel för att spara den här.
        </div>
      )}

      <ul className="mt-6 space-y-3">
        {savedKnowledge.map((article) => (
          <li key={article.id}>
            <Link
              to="/kunskapsbank/$slug"
              params={{ slug: article.slug }}
              className="block rounded-xl border border-border bg-card p-4 transition hover:border-primary"
            >
              <p className="text-xs text-muted-foreground">{article.category}</p>
              <h2 className="font-display text-lg font-semibold">{article.title_sv}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{article.summary_sv}</p>
            </Link>
          </li>
        ))}
        {savedKb.map((article) => (
          <li key={article.id} className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">{article.category}</p>
            <h2 className="font-display text-lg font-semibold">{article.title}</h2>
            {article.summary && (
              <p className="mt-1 text-sm text-muted-foreground">{article.summary}</p>
            )}
            {article.source_url && (
              <a
                href={article.source_url}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-block text-sm text-primary underline-offset-4 hover:underline"
              >
                Öppna källa
              </a>
            )}
          </li>
        ))}
      </ul>
    </main>
  );
}
