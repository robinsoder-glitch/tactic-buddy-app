import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Clock, ExternalLink, Star } from "lucide-react";
import { toast } from "sonner";
import { fetchKnowledgeArticle, knowledgeFormatLabel, knowledgeKind } from "@/lib/knowledge";
import { addFavorite, fetchFavorites, removeFavorite } from "@/lib/taktikbank";
import { useAuth } from "@/hooks/useAuth";
import { useRelatedContent } from "@/hooks/useRelatedContent";
import { RelatedContent } from "@/components/RelatedContent";
import { ARTICLE_SECTIONS } from "@/lib/related-sections";

export const Route = createFileRoute("/_authenticated/kunskapsbank/$slug")({
  head: () => ({
    meta: [
      { title: "Artikel – Kunskapsbank för barnfotbollstränare" },
      {
        name: "description",
        content:
          "Granskad artikel med sammanfattning, vad du lär dig och vad du kan testa på nästa träning.",
      },
      { property: "og:title", content: "Artikel i Kunskapsbanken" },
      {
        property: "og:description",
        content: "Granskad kunskap för dig som tränar barn i fotboll.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: KnowledgeArticlePage,
});

/** "Passar dig som tränar barn och spelar 5 mot 5." */
function fitsYouText(data: Parameters<typeof knowledgeFormatLabel>[0]): string {
  const format = knowledgeFormatLabel(data);
  if (format) return `Passar dig som tränar barn och spelar ${format}.`;
  return "Passar dig som tränar barn i fotboll.";
}


/** En sammanhängande text i stället för flera korta stycken. */
function summaryText(data: {
  summary_sv: string;
  learn_sv?: string | null;
  coach_value?: string | null;
}): string {
  return [data.summary_sv, data.learn_sv, data.coach_value]
    .map((part) => (part ?? "").trim())
    .filter(Boolean)
    .join("\n\n");
}

function KnowledgeArticlePage() {
  const { slug } = Route.useParams();
  const article = useQuery({
    queryKey: ["knowledge-article", slug],
    queryFn: () => fetchKnowledgeArticle(slug),
  });

  const data = article.data;
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const favorites = useQuery({ queryKey: ["tb-favorites"], queryFn: fetchFavorites });
  const isFavorite = (favorites.data ?? []).some(
    (item) => item.kind === "article" && item.resource_id === data?.id,
  );
  const toggleFavorite = useMutation({
    mutationFn: async () => {
      if (!user || !data) throw new Error("Inte inloggad");
      if (isFavorite) await removeFavorite(user.id, "article", data.id);
      else await addFavorite(user.id, "article", data.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tb-favorites"] });
      toast.success(
        isFavorite
          ? "Artikeln togs bort från Mina favoriter"
          : "Artikeln sparades i Mina favoriter",
      );
    },
    onError: () => toast.error("Det gick inte att spara favoriten."),
  });

  const sections = useRelatedContent(
    data ? { type: "article", id: data.slug } : null,
    ARTICLE_SECTIONS,
  );

  return (
    <main className="mx-auto w-full max-w-3xl px-4 pb-24 pt-6">
      <Link
        to="/kunskapsbank"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Kunskapsbanken
      </Link>

      {article.isLoading && <p className="mt-6 text-sm text-muted-foreground">Laddar artikeln…</p>}

      {!article.isLoading && !data && (
        <div className="mt-6 rounded-xl border border-dashed border-border p-8 text-center">
          <p className="font-display text-lg font-semibold">Artikeln hittades inte</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Den kan ha tagits bort eller avpublicerats.
          </p>
        </div>
      )}

      {data && (
        <article className="mt-4">
          <p className="flex flex-wrap items-center gap-2 text-xs tracking-wide text-muted-foreground">
            <span
              className={`rounded-full px-2 py-0.5 ${
                knowledgeKind(data) === "Artikel"
                  ? "bg-secondary"
                  : "border border-primary/40 bg-primary/10 text-foreground"
              }`}
            >
              {knowledgeKind(data)}
            </span>
            <span>{data.category}</span>
          </p>

          <div className="mt-1 flex items-start gap-2">
            <h1 className="min-w-0 flex-1 font-display text-2xl font-semibold">{data.title_sv}</h1>
            <button
              type="button"
              aria-pressed={isFavorite}
              aria-label={
                isFavorite
                  ? "Ta bort artikeln från Mina favoriter"
                  : "Spara artikeln i Mina favoriter"
              }
              onClick={() => toggleFavorite.mutate()}
              className="shrink-0 rounded-full p-2 text-muted-foreground hover:text-primary"
            >
              <Star className={`size-5 ${isFavorite ? "fill-current text-primary" : ""}`} />
            </button>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {data.source_name && (
              <span className="rounded-full border border-border px-2 py-0.5">
                {data.source_name}
              </span>
            )}
            {data.level && (
              <span className="rounded-full border border-border px-2 py-0.5">{data.level}</span>
            )}
            {data.reading_minutes ? (
              <span className="inline-flex items-center gap-1">
                <Clock className="size-3.5" /> {data.reading_minutes} min
              </span>
            ) : null}
          </div>

          <p className="mt-4 text-sm font-semibold">{fitsYouText(data)}</p>

          <section className="mt-4 rounded-xl border border-border bg-card p-4">
            <h2 className="font-display text-sm tracking-[0.2em] text-muted-foreground">
              Sammanfattning
            </h2>
            <p className="mt-2 whitespace-pre-line text-sm">{summaryText(data)}</p>
          </section>

          <a
            href={data.original_url}
            target="_blank"
            rel="noreferrer"
            className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition hover:opacity-90 sm:w-auto"
          >
            Läs vidare hos källan <ExternalLink className="size-4" />
          </a>

          <RelatedContent sections={sections} />
        </article>
      )}
    </main>
  );
}
