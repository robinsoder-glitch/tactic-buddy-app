import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  SKILL_AGE_NOTES,
  SKILL_PROGRESSION,
  skillMovesByRank,
  type SkillMove,
} from "@/lib/skill-moves";
import { KnowledgeTabs } from "@/components/KnowledgeTabs";

export const Route = createFileRoute("/_authenticated/kunskapsbank/teknik")({
  head: () => ({
    meta: [
      { title: "Teknik: fem finter och vändningar 5–8 år – Fotbollsrummet" },
      {
        name: "description",
        content:
          "Kroppsfint, sulvändning, insida–utsida, översteg och Cruyffvändning – steg för steg, med övningar, coachfraser och vanliga fel.",
      },
      { property: "og:title", content: "Fem grundläggande finter och vändningar för barn 5–8 år" },
      {
        property: "og:description",
        content: "Lär ut finter i rätt ordning: långsamt, mot kon, mot passiv försvarare och sedan 1 mot 1.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TechniquePage,
});

function TechniquePage() {
  const moves = skillMovesByRank();

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
            Fem grundläggande finter och vändningar för barn 5–8 år
          </h1>
        </div>
      </header>

      <KnowledgeTabs active="technique" />

      <p className="mt-4 max-w-[70ch] text-sm text-muted-foreground">
        Finter handlar inte bara om vad spelaren gör med bollen. För att lura en motståndare behöver spelaren
        använda hela kroppen, byta riktning och öka farten efter rörelsen.
      </p>
      <p className="mt-3 max-w-[70ch] rounded-xl border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
        Barnet bör först lära sig rörelsen långsamt. Därefter tränas den mot en kon, sedan mot en passiv
        försvarare och till sist i en riktig 1 mot 1-situation.
      </p>

      <Accordion type="single" collapsible className="mt-6 space-y-3">
        {moves.map((move) => (
          <AccordionItem
            key={move.id}
            value={move.id}
            className="rounded-2xl border border-border bg-card px-4 shadow-sm"
          >
            <AccordionTrigger className="min-h-16 gap-4 py-4 text-left hover:no-underline">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                {move.rank}
              </span>
              <span className="flex-1 text-base font-semibold">{move.title}</span>
            </AccordionTrigger>
            <AccordionContent className="pb-5 sm:pl-13">
              <MoveContent move={move} />
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>

      <section className="mt-10" aria-labelledby="progression">
        <h2 id="progression" className="font-display text-lg font-semibold">
          Gemensam träningsmodell
        </h2>
        <p className="mt-1 max-w-[70ch] text-sm text-muted-foreground">
          Använd gärna samma progression för samtliga finter:
        </p>
        <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
          {SKILL_PROGRESSION.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </section>

      <section className="mt-8" aria-labelledby="viktigt">
        <h2 id="viktigt" className="font-display text-lg font-semibold">
          Viktigt för barn 5–8 år
        </h2>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          {SKILL_AGE_NOTES.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
        <p className="mt-3 max-w-[70ch] text-sm text-muted-foreground">
          Målet är inte att barnen ska göra perfekta rörelser. Målet är att de ska våga utmana, lösa
          situationer och ha roligt med bollen.
        </p>
      </section>
    </main>
  );
}

function MoveContent({ move }: { move: SkillMove }) {
  return (
    <div className="max-w-[70ch] space-y-4 text-sm leading-relaxed">
      <dl className="space-y-1 text-muted-foreground">
        <div className="flex gap-2">
          <dt className="font-semibold text-foreground">Svenskt namn:</dt>
          <dd>{move.nameSv}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="font-semibold text-foreground">Engelskt namn:</dt>
          <dd>{move.nameEn}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="font-semibold text-foreground">Andra namn:</dt>
          <dd>{move.otherNames}</dd>
        </div>
      </dl>

      <div>
        <h3 className="font-semibold">Vad är syftet?</h3>
        <p className="mt-1 text-muted-foreground">{move.purpose}</p>
      </div>

      <div>
        <h3 className="font-semibold">Så gör man</h3>
        <ol className="mt-1 list-decimal space-y-1 pl-5 text-muted-foreground">
          {move.howTo.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ol>
      </div>

      <div>
        <h3 className="font-semibold">Så tränar man</h3>
        <div className="mt-1 space-y-2">
          {move.practice.map((step) => (
            <div key={step.title}>
              <p className="font-medium">{step.title}</p>
              <p className="text-muted-foreground">{step.text}</p>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="font-semibold">Tränarens coachfraser</h3>
        <ul className="mt-1 space-y-1">
          {move.phrases.map((phrase) => (
            <li key={phrase} className="border-l-2 border-primary pl-3 italic">
              {phrase}
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h3 className="font-semibold">Vanliga fel</h3>
        <ul className="mt-1 list-disc space-y-1 pl-5 text-muted-foreground">
          {move.mistakes.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>

      <div>
        <h3 className="font-semibold">Videor</h3>
        <ul className="mt-1 space-y-1">
          {move.videos.map((video) => (
            <li key={video.label}>
              <a
                href={video.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-primary underline-offset-4 hover:underline"
              >
                {video.label} <ExternalLink className="size-3.5" aria-hidden />
              </a>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
