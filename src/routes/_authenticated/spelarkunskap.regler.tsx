import { createFileRoute } from "@tanstack/react-router";
import { BackIconButton } from "@/components/BackLink";
import { PlayerKnowledgeTabs } from "@/components/PlayerKnowledgeTabs";
import { EmptyState } from "@/components/StateViews";

export const Route = createFileRoute("/_authenticated/spelarkunskap/regler")({
  head: () => ({
    meta: [
      { title: "Regler för spelare – Fotbollsrummet" },
      {
        name: "description",
        content: "Enkla fotbollsregler förklarade för barn. Innehållet fylls på efter hand.",
      },
      { property: "og:title", content: "Regler för spelare" },
      {
        property: "og:description",
        content: "Enkla fotbollsregler förklarade för barn.",
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
      <header className="flex items-center gap-2">
        <BackIconButton fallback="/" label="Tillbaka" />
        <div className="flex-1">
          <p className="font-display text-xs tracking-[0.3em] text-primary">Kunskap</p>
          <h1 className="font-display text-3xl font-bold">Regler</h1>
        </div>
      </header>

      <PlayerKnowledgeTabs active="rules" />

      <div className="mt-6">
        <EmptyState
          title="Reglerna kommer snart"
          description="Här kommer enkla förklaringar av fotbollens regler: inkast, hörna, frispark, offside och hur matchen går till. Titta in igen om ett tag."
        />
      </div>
    </main>
  );
}
