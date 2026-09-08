import { createFileRoute } from "@tanstack/react-router";
import { BackIconButton } from "@/components/BackLink";
import { PlayerKnowledgeTabs } from "@/components/PlayerKnowledgeTabs";
import { PLAYER_RULEBOOK } from "@/lib/player-rules";

export const Route = createFileRoute("/_authenticated/spelarkunskap/regler")({
  head: () => ({
    meta: [
      { title: "Regler – Fotbollsrummets lilla regelbok" },
      {
        name: "description",
        content:
          "Fotbollsrummets lilla regelbok: match, bollen in och ut, frisparkar, händer, offside och byten – enkelt förklarat för spelare.",
      },
      { property: "og:title", content: "Fotbollsrummets lilla regelbok" },
      {
        property: "og:description",
        content: "Enkla fotbollsregler förklarade för barn, samlade som en regelbok.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PlayerRulesPage,
});

function PlayerRulesPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 pb-32 pt-6">
      <header className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-2">
        <BackIconButton fallback="/" label="Tillbaka" />
        <div className="min-w-0">
          <p className="font-display text-xs tracking-[0.3em] text-primary">Kunskap</p>
          <h1 className="font-display text-2xl font-bold sm:text-3xl">Regler</h1>
        </div>
      </header>

      <PlayerKnowledgeTabs active="rules" />

      <p className="mt-4 max-w-[36ch] text-base leading-relaxed sm:max-w-[60ch] sm:text-lg">
        Fotbollsrummets lilla regelbok – sex kapitel om hur en match fungerar, skrivna för er som
        spelar. Läs ett kapitel i taget, och fråga tränaren om du undrar något.
      </p>

      <nav aria-label="Innehåll" className="mt-6 rounded-2xl border border-border bg-card p-4">
        <p className="font-display text-base font-bold tracking-wide">Innehåll</p>
        <ol className="mt-2 space-y-1">
          {PLAYER_RULEBOOK.map((chapter) => (
            <li key={chapter.number}>
              <a
                href={`#kapitel-${chapter.number}`}
                className="flex min-h-11 items-center text-base text-primary underline-offset-2 hover:underline"
              >
                Kapitel {chapter.number} – {chapter.title}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <div className="mt-8 space-y-10">
        {PLAYER_RULEBOOK.map((chapter) => (
          <section
            key={chapter.number}
            id={`kapitel-${chapter.number}`}
            aria-labelledby={`kapitel-${chapter.number}-rubrik`}
            className="scroll-mt-24"
          >
            <div className="border-b border-border pb-3">
              <p className="font-display text-xs tracking-[0.3em] text-primary">
                Kapitel {chapter.number}
              </p>
              <h2
                id={`kapitel-${chapter.number}-rubrik`}
                className="mt-1 font-display text-2xl font-bold"
              >
                {chapter.title}
              </h2>
              <p className="mt-2 max-w-[70ch] text-sm text-muted-foreground">{chapter.intro}</p>
            </div>

            <ol className="mt-4 space-y-3">
              {chapter.rules.map((rule) => (
                <li
                  key={rule.number}
                  className="rounded-2xl border border-border bg-card p-4"
                >
                  <p className="font-semibold">
                    <span className="mr-2 font-display text-primary">
                      § {chapter.number}.{rule.number}
                    </span>
                    {rule.title}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">{rule.text}</p>
                </li>
              ))}
            </ol>
          </section>
        ))}
      </div>

      <footer className="mt-10 rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground">
        Det här är Fotbollsrummets egen enkla regelbok. De exakta reglerna för ert lag och er
        serie hittar ni hos er förening eller på svenskfotboll.se.
      </footer>
    </main>
  );
}
