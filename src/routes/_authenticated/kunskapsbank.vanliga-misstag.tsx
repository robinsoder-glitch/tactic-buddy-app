import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { MISTAKE_SOURCES, mistakesByRank, type CoachMistake } from "@/lib/coach-mistakes";
import { KnowledgeTabs } from "@/components/KnowledgeTabs";

export const Route = createFileRoute("/_authenticated/kunskapsbank/vanliga-misstag")({
  head: () => ({
    meta: [
      { title: "10 vanliga tränarmisstag 5–8 år – Fotbollsrummet" },
      {
        name: "description",
        content:
          "Prioriterad lista över tio vanliga tränarmisstag i fotboll för barn 5–8 år, med vad du gör i stället och vad du kan säga.",
      },
      { property: "og:title", content: "10 vanliga tränarmisstag – viktigast först" },
      {
        property: "og:description",
        content:
          "Trygghet, jämn speltid, glädje och mindre prat – tio saker att rätta först i barnfotbollen.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CoachMistakesPage,
});

function CoachMistakesPage() {
  const mistakes = mistakesByRank();

  return (
    <main className="mx-auto max-w-3xl px-4 pb-32 pt-6">
      <header className="flex items-center gap-2">
        <Button asChild variant="ghost" size="icon" aria-label="Tillbaka till kunskapsbanken">
          <Link to="/kunskapsbank">
            <ArrowLeft className="size-5" />
          </Link>
        </Button>
        <div className="flex-1">
          <p className="font-display text-xs tracking-[0.3em] text-primary">Kunskapsbank</p>
          <h1 className="font-display text-3xl font-bold">
            10 vanliga tränarmisstag – viktigast först
          </h1>
        </div>
      </header>

      <KnowledgeTabs active="mistakes" />

      <p className="mt-4 max-w-[70ch] text-sm text-muted-foreground">
        Listan gäller fotboll för barn 5–8 år. Nummer 1 är viktigast att rätta först. Ordningen
        väger samman trygghet, hur ofta problemet återkommer och hur mycket det påverkar barnens
        glädje, motivation, deltagande och lärande.
      </p>
      <p className="mt-3 max-w-[70ch] rounded-xl border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
        Det finns ingen enskild studie som exakt rangordnar alla tio misstagen. Listan är en samlad
        bedömning utifrån riktlinjer från SvFF, Riksidrottsförbundet och FIFA samt forskning om
        tränarbeteende och motivation.
      </p>

      <Accordion type="single" collapsible className="mt-6 space-y-3">
        {mistakes.map((mistake) => (
          <AccordionItem
            key={mistake.rank}
            value={`mistake-${mistake.rank}`}
            className="rounded-2xl border border-border bg-card px-4 shadow-sm"
          >
            <AccordionTrigger className="min-h-16 gap-4 py-4 text-left hover:no-underline">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                {mistake.rank}
              </span>
              <span className="flex-1 text-base font-semibold">{mistake.title}</span>
              {mistake.rank <= 3 && (
                <span className="hidden shrink-0 rounded-full border border-border px-2 py-0.5 text-xs font-normal text-muted-foreground sm:inline">
                  Rätta först
                </span>
              )}
            </AccordionTrigger>
            <AccordionContent className="pb-5 sm:pl-13">
              <MistakeContent mistake={mistake} />
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>

      <section className="mt-10" aria-labelledby="underlag">
        <h2 id="underlag" className="font-display text-lg font-semibold">
          Underlag för listan
        </h2>
        <p className="mt-1 max-w-[70ch] text-sm text-muted-foreground">
          Ordningen är en samlad bedömning utifrån följande källor, inte en vetenskapligt bevisad
          rangordning.
        </p>
        <ol className="mt-3 space-y-2 text-sm">
          {MISTAKE_SOURCES.map((source) => (
            <li key={source.key}>
              <a
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-primary underline-offset-4 hover:underline"
              >
                {source.label} <ExternalLink className="size-3.5" aria-hidden />
              </a>
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}

function MistakeContent({ mistake }: { mistake: CoachMistake }) {
  return (
    <div className="max-w-[70ch] space-y-4 text-sm leading-relaxed">
      <div>
        <h3 className="font-semibold">Vad felet är</h3>
        <p className="mt-1 text-muted-foreground">{mistake.whatItIs}</p>
      </div>
      <div>
        <h3 className="font-semibold">Varför det är viktigt</h3>
        <p className="mt-1 text-muted-foreground">{mistake.whyItMatters}</p>
      </div>
      <div>
        <h3 className="font-semibold">Gör så här i stället</h3>
        <p className="mt-1 text-muted-foreground">{mistake.doInstead}</p>
      </div>
      <div>
        <h3 className="font-semibold">Säg så här</h3>
        <blockquote className="mt-1 border-l-2 border-primary pl-3 italic">
          {mistake.coachPhrase}
        </blockquote>
      </div>
    </div>
  );
}
