import { createFileRoute } from "@tanstack/react-router";
import { BackIconButton } from "@/components/BackLink";
import { PlayerKnowledgeTabs } from "@/components/PlayerKnowledgeTabs";
import { FAIR_PLAY_RULES } from "@/lib/fair-play";

export const Route = createFileRoute("/_authenticated/spelarkunskap/fair-play")({
  head: () => ({
    meta: [
      { title: "Fair play – tio punkter för dig som spelar – Fotbollsrummet" },
      {
        name: "description",
        content:
          "Tio enkla punkter om hur man är en bra kompis på planen, skriven för barn 5–10 år.",
      },
      { property: "og:title", content: "Fair play – tio punkter" },
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
      <header className="flex items-center gap-2">
        <BackIconButton fallback="/" label="Tillbaka" />
        <div className="flex-1">
          <p className="font-display text-xs tracking-[0.3em] text-primary">Kunskap</p>
          <h1 className="font-display text-3xl font-bold">Fair play</h1>
        </div>
      </header>

      <PlayerKnowledgeTabs active="fairplay" />

      <p className="mt-4 max-w-[70ch] text-sm text-muted-foreground">
        Fair play betyder att spela schyst och vara en bra kompis. Här är tio punkter att komma ihåg
        – på träningen, på matchen och efteråt.
      </p>

      <ol className="mt-6 space-y-3">
        {FAIR_PLAY_RULES.map((rule) => (
          <li
            key={rule.number}
            className="flex gap-3 rounded-2xl border border-border bg-card p-4"
          >
            <span
              aria-hidden
              className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/15 font-display text-base font-bold text-primary"
            >
              {rule.number}
            </span>
            <div>
              <p className="font-semibold">{rule.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{rule.text}</p>
            </div>
          </li>
        ))}
      </ol>
    </main>
  );
}
