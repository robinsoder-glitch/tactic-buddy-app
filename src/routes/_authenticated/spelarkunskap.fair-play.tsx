import { createFileRoute } from "@tanstack/react-router";
import { BackIconButton } from "@/components/BackLink";
import { PlayerKnowledgeTabs } from "@/components/PlayerKnowledgeTabs";
import { FAIR_PLAY_RULES } from "@/lib/fair-play";

export const Route = createFileRoute("/_authenticated/spelarkunskap/fair-play")({
  head: () => ({
    meta: [
      { title: "Fair play – Fotbollsrummets tio punkter" },
      {
        name: "description",
        content:
          "Fotbollsrummets fair play-regelbok: tio punkter om hur man är en bra kompis på planen, för spelare 5–10 år.",
      },
      { property: "og:title", content: "Fair play – Fotbollsrummets tio punkter" },
      {
        property: "og:description",
        content: "Så är du en bra lagkamrat: peppa, hjälp upp, spela schyst och var ärlig.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: FairPlayPage,
});

function FairPlayPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 pb-32 pt-6">
      <header className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-2">
        <BackIconButton fallback="/" label="Tillbaka" />
        <div className="min-w-0">
          <p className="font-display text-xs tracking-[0.3em] text-primary">Kunskap</p>
          <h1 className="font-display text-2xl font-bold sm:text-3xl">Fair play</h1>
        </div>
      </header>

      <PlayerKnowledgeTabs active="fairplay" />

      <p className="mt-4 max-w-[36ch] text-base leading-relaxed sm:max-w-[60ch] sm:text-lg">
        Fair play betyder att spela schyst och vara en bra kompis. Det här är Fotbollsrummets tio
        punkter – vårt eget lilla regelverk för hur vi är mot varandra, på träningen, på matchen och
        efteråt.
      </p>

      <section aria-labelledby="fair-play-paragrafer" className="mt-6">
        <div className="border-b border-border pb-3">
          <p className="font-display text-xs tracking-[0.3em] text-primary">Paragraferna</p>
          <h2
            id="fair-play-paragrafer"
            className="mt-1 break-words font-display text-xl font-bold sm:text-2xl"
          >
            Fotbollsrummets tio punkter
          </h2>
        </div>

        <ol className="mt-4 space-y-3">
          {FAIR_PLAY_RULES.map((rule) => (
            <li key={rule.number} className="rounded-2xl border border-border bg-card p-4">
              <p className="text-lg font-bold">
                <span className="mr-2 font-display text-primary">§ {rule.number}</span>
                {rule.title}
              </p>
              <p className="mt-1 max-w-[36ch] text-base leading-relaxed sm:max-w-[60ch]">
                {rule.text}
              </p>
            </li>
          ))}
        </ol>
      </section>

      <footer className="mt-10 rounded-2xl border border-border bg-card p-4 text-base leading-relaxed text-muted-foreground">
        Kan du de här tio punkterna? Då är du en kompis alla vill ha i sitt lag. Det här är
        Fotbollsrummets egen text – era tränare och ledare hjälper er att leva upp till den.
      </footer>
    </main>
  );
}
