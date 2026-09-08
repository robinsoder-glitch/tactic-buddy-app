import { createFileRoute } from "@tanstack/react-router";
import { ExternalLink } from "lucide-react";
import { BackIconButton } from "@/components/BackLink";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { PlayerKnowledgeTabs } from "@/components/PlayerKnowledgeTabs";
import { skillMovesByRank } from "@/lib/skill-moves";

export const Route = createFileRoute("/_authenticated/spelarkunskap/")({
  head: () => ({
    meta: [
      { title: "Teknik för spelare – Fotbollsrummet" },
      {
        name: "description",
        content:
          "Fem finter och vändningar du kan träna på själv: så gör du steg för steg, och vad du ska tänka på.",
      },
      { property: "og:title", content: "Teknik för spelare" },
      {
        property: "og:description",
        content: "Lär dig kroppsfint, sulvändning, insida–utsida, översteg och Cruyffvändning.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PlayerTechniquePage,
});

function PlayerTechniquePage() {
  const moves = skillMovesByRank();

  return (
    <main className="mx-auto max-w-3xl px-4 pb-32 pt-6">
      <header className="flex items-center gap-2">
        <BackIconButton fallback="/" label="Tillbaka" />
        <div className="flex-1">
          <p className="font-display text-xs tracking-[0.3em] text-primary">Kunskap</p>
          <h1 className="font-display text-3xl font-bold">Teknik</h1>
        </div>
      </header>

      <PlayerKnowledgeTabs active="technique" />

      <p className="mt-4 max-w-[70ch] text-sm text-muted-foreground">
        Här är fem finter och vändningar du kan träna på. Börja långsamt, gör den många gånger och
        öka farten först när det känns lätt. Träna gärna med båda fötterna.
      </p>

      <Accordion type="single" collapsible className="mt-6">
        {moves.map((move) => (
          <AccordionItem key={move.id} value={move.id}>
            <AccordionTrigger className="text-left">
              <span>
                {move.rank}. {move.title}
              </span>
            </AccordionTrigger>
            <AccordionContent>
              <p className="max-w-[70ch] text-sm text-muted-foreground">{move.purpose}</p>

              <h2 className="mt-4 text-sm font-semibold">Så gör du</h2>
              <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm">
                {move.howTo.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>

              <h2 className="mt-4 text-sm font-semibold">Tänk på det här</h2>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                {move.mistakes.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>

              {move.videos.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-3">
                  {move.videos.map((video) => (
                    <a
                      key={video.url}
                      href={video.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex min-h-11 items-center gap-2 rounded-full border border-border px-4 text-sm"
                    >
                      {video.label} <ExternalLink className="size-4" />
                    </a>
                  ))}
                </div>
              )}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </main>
  );
}
