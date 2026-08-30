import { fitsYouIf, keyMessages, notCovered, practicalAdvice, sourceCheck } from "@/lib/knowledge-summary";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Clock, ExternalLink, Star } from "lucide-react";
import { toast } from "sonner";
import {
  fetchKnowledgeArticle,
  knowledgeAgeLabel,
  knowledgeFormatLabel,
} from "@/lib/knowledge";
import { addFavorite, fetchFavorites, removeFavorite } from "@/lib/taktikbank";
import { useAuth } from "@/hooks/useAuth";
import { useRelatedContent } from "@/hooks/useRelatedContent";
import { RelatedContent } from "@/components/RelatedContent";
import { AddToTrainingButton } from "@/components/AddToTrainingDialog";
import { ARTICLE_SECTIONS } from "@/lib/related-sections";

export const Route = createFileRoute("/_authenticated/kunskapsbank/$slug")({
  head: () => ({
    meta: [
      { title: "Artikel – Kunskapsbank för barnfotbollstränare" },
      {
        name: "description",
        content: "Granskad artikel med sammanfattning, vad du lär dig och vad du kan testa på nästa träning.",
      },
      { property: "og:title", content: "Artikel i Kunskapsbanken" },
      { property: "og:description", content: "Granskad kunskap för dig som tränar barn i fotboll." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: KnowledgeArticlePage,
});

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
      toast.success(isFavorite ? "Artikeln togs bort från Mina favoriter" : "Artikeln sparades i Mina favoriter");
    },
    onError: () => toast.error("Det gick inte att spara favoriten."),
  });

  const sections = useRelatedContent(data ? { type: "article", id: data.slug } : null, ARTICLE_SECTIONS);

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
          <p className="mt-1 text-sm text-muted-foreground">Den kan ha tagits bort eller avpublicerats.</p>
        </div>
      )}

      {data && (
        <article className="mt-4">
          <p className="text-xs tracking-wide text-muted-foreground">
            {data.category} · {knowledgeAgeLabel(data)}
            {knowledgeFormatLabel(data) ? ` · ${knowledgeFormatLabel(data)}` : ""}
          </p>
          <div className="mt-1 flex items-start gap-2">
            <h1 className="min-w-0 flex-1 font-display text-2xl font-semibold">{data.title_sv}</h1>
            <button
              type="button"
              aria-pressed={isFavorite}
              aria-label={isFavorite ? "Ta bort artikeln från Mina favoriter" : "Spara artikeln i Mina favoriter"}
              onClick={() => toggleFavorite.mutate()}
              className="shrink-0 rounded-full p-2 text-muted-foreground hover:text-primary"
            >
              <Star className={`size-5 ${isFavorite ? "fill-current text-primary" : ""}`} />
            </button>
          </div>
          {data.title_original && data.title_original !== data.title_sv && (
            <p className="mt-1 text-sm text-muted-foreground">Originaltitel: {data.title_original}</p>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {data.source_name && <span className="rounded-full border border-border px-2 py-0.5">{data.source_name}</span>}
            {data.level && <span className="rounded-full border border-border px-2 py-0.5">{data.level}</span>}
            {data.evidence_level && (
              <span className="rounded-full border border-border px-2 py-0.5">Underlag: {data.evidence_level}</span>
            )}
            {data.reading_minutes ? (
              <span className="inline-flex items-center gap-1">
                <Clock className="size-3.5" /> {data.reading_minutes} min
              </span>
            ) : null}
            {data.checked_date && <span>Kontrollerad {data.checked_date}</span>}
          </div>

          <section className="mt-5 rounded-xl border border-border bg-card p-4">
            <h2 className="font-display text-sm tracking-[0.2em] text-muted-foreground">Passar dig som</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
              {fitsYouIf(data).map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>

          <section className="mt-3 rounded-xl border border-border bg-card p-4">
            <h2 className="font-display text-sm tracking-[0.2em] text-muted-foreground">Huvudbudskap</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
              {keyMessages(data).map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>

          {practicalAdvice(data).length > 0 && (
            <section className="mt-3 rounded-xl border border-border bg-card p-4">
              <h2 className="font-display text-sm tracking-[0.2em] text-muted-foreground">Praktiska råd</h2>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                {practicalAdvice(data).map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>
          )}

          <section className="mt-3 rounded-xl border border-border bg-card p-4">
            <h2 className="font-display text-sm tracking-[0.2em] text-muted-foreground">
              Vad artikeln inte svarar på
            </h2>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              {notCovered(data).map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>

          <section className="mt-3 rounded-xl border border-border bg-card p-4">
            <h2 className="font-display text-sm tracking-[0.2em] text-muted-foreground">Källa och kontroll</h2>
            <dl className="mt-2 grid gap-2 text-sm sm:grid-cols-2">
              {sourceCheck(data).map(([term, value]) => (
                <div key={term}>
                  <dt className="text-xs text-muted-foreground">{term}</dt>
                  <dd className="font-medium">{value}</dd>
                </div>
              ))}
            </dl>
          </section>

          <details className="mt-3 rounded-xl border border-border bg-card p-4">
            <summary className="cursor-pointer text-sm font-semibold">Hela sammanfattningen</summary>
            <p className="mt-2 text-sm">{data.summary_sv}</p>
            {data.learn_sv && (
              <>
                <h3 className="mt-3 text-xs font-semibold text-muted-foreground">Det här lär du dig</h3>
                <p className="mt-1 whitespace-pre-line text-sm">{data.learn_sv}</p>
              </>
            )}
            {data.try_next_sv && (
              <>
                <h3 className="mt-3 text-xs font-semibold text-muted-foreground">Testa på nästa träning</h3>
                <p className="mt-1 whitespace-pre-line text-sm">{data.try_next_sv}</p>
              </>
            )}
            {data.coach_value && (
              <>
                <h3 className="mt-3 text-xs font-semibold text-muted-foreground">Nytta för dig som tränare</h3>
                <p className="mt-1 text-sm">{data.coach_value}</p>
              </>
            )}
          </details>


          <a
            href={data.original_url}
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-flex items-center gap-1 text-sm text-primary underline-offset-4 hover:underline"
          >
            Läs originalkällan <ExternalLink className="size-3.5" />
          </a>

          {data.copyright_note && <p className="mt-3 text-xs text-muted-foreground">{data.copyright_note}</p>}

          <div className="mt-4">
<AddToTrainingButton kind="article" resourceId={data.slug} title={data.title_sv} defaultMinutes={5} size="sm" />
          </div>

          <RelatedContent sections={sections} />
        </article>
      )}
    </main>
  );
}
