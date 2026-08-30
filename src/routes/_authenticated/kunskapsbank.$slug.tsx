import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Clock, ExternalLink } from "lucide-react";
import {
  fetchKnowledgeArticle,
  knowledgeAgeLabel,
  knowledgeFormatLabel,
} from "@/lib/knowledge";

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
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            {data.category} · {knowledgeAgeLabel(data)}
            {knowledgeFormatLabel(data) ? ` · ${knowledgeFormatLabel(data)}` : ""}
          </p>
          <h1 className="mt-1 font-display text-2xl font-semibold">{data.title_sv}</h1>
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
            <h2 className="font-display text-sm uppercase tracking-[0.2em] text-muted-foreground">Sammanfattning</h2>
            <p className="mt-2 text-sm">{data.summary_sv}</p>
          </section>

          {data.learn_sv && (
            <section className="mt-3 rounded-xl border border-border bg-card p-4">
              <h2 className="font-display text-sm uppercase tracking-[0.2em] text-muted-foreground">
                Det här lär du dig
              </h2>
              <p className="mt-2 whitespace-pre-line text-sm">{data.learn_sv}</p>
            </section>
          )}

          {data.try_next_sv && (
            <section className="mt-3 rounded-xl border border-border bg-card p-4">
              <h2 className="font-display text-sm uppercase tracking-[0.2em] text-muted-foreground">
                Testa på nästa träning
              </h2>
              <p className="mt-2 whitespace-pre-line text-sm">{data.try_next_sv}</p>
            </section>
          )}

          {data.coach_value && (
            <section className="mt-3 rounded-xl border border-border bg-card p-4">
              <h2 className="font-display text-sm uppercase tracking-[0.2em] text-muted-foreground">
                Nytta för dig som tränare
              </h2>
              <p className="mt-2 text-sm">{data.coach_value}</p>
            </section>
          )}

          <a
            href={data.original_url}
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-flex items-center gap-1 text-sm text-primary underline-offset-4 hover:underline"
          >
            Läs originalkällan <ExternalLink className="size-3.5" />
          </a>

          {data.copyright_note && <p className="mt-3 text-xs text-muted-foreground">{data.copyright_note}</p>}
        </article>
      )}
    </main>
  );
}
