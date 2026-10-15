import type { KnowledgeArticle } from "@/lib/knowledge";
import { sourceCheck } from "@/lib/knowledge-summary";

/** Källans sammanfattning, redaktionell tillämpning och underlag hålls läsbara var för sig. */
export function KnowledgeArticleBody({ article }: { article: KnowledgeArticle }) {
  const sourceRows = sourceCheck(article);
  return (
    <div className="mt-4 space-y-4">
      <section className="rounded-xl border border-border bg-card p-4">
        <h2 className="font-display text-lg font-semibold">Sammanfattning</h2>
        <p className="mt-2 whitespace-pre-line text-sm">{article.summary_sv}</p>
      </section>
      {article.learn_sv?.trim() && (
        <section>
          <h2 className="font-display text-lg font-semibold">Det här tar du med dig</h2>
          <p className="mt-2 whitespace-pre-line text-sm">{article.learn_sv}</p>
        </section>
      )}
      {article.try_next_sv?.trim() && (
        <section className="rounded-xl border border-primary/30 bg-primary/5 p-4">
          <h2 className="font-display text-lg font-semibold">Pröva i ditt lag</h2>
          <p className="mt-2 whitespace-pre-line text-sm">{article.try_next_sv}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            Fotbollsrummets förslag till tillämpning. Anpassa efter barnens erfarenhet och behov.
          </p>
        </section>
      )}
      <section className="rounded-xl border border-border p-4">
        <h2 className="font-display text-lg font-semibold">Källa och underlag</h2>
        <dl className="mt-3 space-y-2 text-sm">
          {sourceRows.map(([label, value]) => (
            <div key={label}>
              <dt className="font-semibold">{label}</dt>
              <dd className="mt-0.5 whitespace-pre-line text-muted-foreground">{value}</dd>
            </div>
          ))}
        </dl>
        {!article.evidence_level && (
          <p className="mt-2 text-sm text-muted-foreground">
            Underlagets karaktär är ännu inte beskriven.
          </p>
        )}
        {article.category === "Match och spelformer" &&
          article.source_name &&
          article.source_name !== "Svenska Fotbollförbundet" && (
            <p className="mt-3 text-sm text-muted-foreground">
              Material från andra länder kan ha andra regler och åldersindelningar. För svenska
              matcher, se{" "}
              <a
                className="underline"
                href="https://aktiva.svenskfotboll.se/tranare/spelformer/spelregler/"
                target="_blank"
                rel="noreferrer"
              >
                SvFF:s spelregler
              </a>{" "}
              och distriktets tävlingsbestämmelser.
            </p>
          )}
      </section>
    </div>
  );
}
