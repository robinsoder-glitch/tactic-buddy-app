import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { TacticEditor } from "@/components/TacticEditor";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { createTactic, fetchTactics, openBlankTactic } from "@/lib/db";
import { fetchTacticCards, label, PHASE_LABELS } from "@/lib/taktikbank";
import { formatLabelFor } from "@/lib/rules-presentation";

export const Route = createFileRoute("/_authenticated/taktik")({
  head: () => ({
    meta: [
      { title: "Taktik – rita och animera spelmoment" },
      {
        name: "description",
        content: "Flytta spelare och boll på planen, bygg steg och spela upp taktiken. Här finns även färdiga taktiker.",
      },
      { property: "og:title", content: "Taktik" },
      { property: "og:description", content: "Interaktiv taktiktavla med egna och färdiga taktiker." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TacticPage,
});

function TacticPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [openId, setOpenId] = useState<string | null>(null);

  const tactics = useQuery({ queryKey: ["tactics"], queryFn: fetchTactics });
  const cards = useQuery({ queryKey: ["tactic-cards"], queryFn: fetchTacticCards });

  const list = tactics.data ?? [];

  // Tavlan startar alltid tom – ingen tidigare taktik öppnas automatiskt.
  const blank = useQuery({
    queryKey: ["blank-tactic", user?.id],
    queryFn: () => openBlankTactic(user!.id),
    enabled: !!user && !openId,
    staleTime: Infinity,
  });

  const activeId = openId ?? blank.data ?? null;

  const create = useMutation({
    mutationFn: () => createTactic(user!.id, "Min taktik", "full", null),
    onSuccess: async (id) => {
      await queryClient.invalidateQueries({ queryKey: ["tactics"] });
      setOpenId(id);
    },
    onError: () => toast.error("Det gick inte att skapa en ny taktik."),
  });

  return (
    <main className="mx-auto max-w-5xl px-4 pb-28 pt-6 md:pt-20">
      <h1 className="font-display text-3xl font-bold">Taktik</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Börja med en tom plan – dra ut spelare och boll själv och bygg din taktik.
      </p>

      <section className="mt-4">
        {(tactics.isLoading || blank.isLoading) && (
          <p className="text-sm text-muted-foreground">Förbereder en tom tavla…</p>
        )}
        {!blank.isLoading && !activeId && (
          <div className="rounded-xl border border-dashed border-border p-8 text-center">
            <p className="text-sm text-muted-foreground">Tavlan kunde inte öppnas.</p>
            <Button className="mt-3" disabled={!user || create.isPending} onClick={() => create.mutate()}>
              Skapa en ny tom tavla
            </Button>
          </div>
        )}
        {activeId && <TacticEditor key={activeId} id={activeId} />}
      </section>

      <section className="mt-8">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-2xl font-bold">Mina taktiker</h2>
          <Button size="sm" variant="secondary" disabled={!user || create.isPending} onClick={() => create.mutate()}>
            Ny taktik
          </Button>
        </div>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {list.length === 0 && (
            <li className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
              Här samlas taktikerna du sparar.
            </li>
          )}
          {list.map((tactic) => (
            <li key={tactic.id}>
              <button
                type="button"
                onClick={() => setOpenId(tactic.id)}
                aria-pressed={tactic.id === activeId}
                className={`w-full rounded-xl border p-4 text-left transition-colors ${
                  tactic.id === activeId ? "border-primary bg-primary/10" : "border-border bg-card hover:border-primary/60"
                }`}
              >
                <span className="block font-semibold">{tactic.name}</span>
                <span className="block text-xs text-muted-foreground">
                  Senast ändrad: {new Date(tactic.updated_at).toLocaleDateString("sv-SE")}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-8">
        <h2 className="font-display text-2xl font-bold">Färdiga taktiker</h2>
        <ul className="mt-3 grid gap-3 sm:grid-cols-2">
          {(cards.data ?? []).length === 0 && (
            <li className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
              Inga färdiga taktiker att visa just nu.
            </li>
          )}
          {(cards.data ?? []).map((card) => (
            <li key={card.id} className="rounded-xl border border-border bg-card p-4">
              <h3 className="font-display text-lg font-semibold">{card.title}</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                {[formatLabelFor(card.format), label(PHASE_LABELS, card.phase)].filter(Boolean).join(" · ")}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">{card.purpose ?? "Sammanfattning saknas."}</p>
              <Button className="mt-3" size="sm" variant="secondary" asChild>
                <Link to="/taktikbank/$cardId" params={{ cardId: card.id }}>
                  Visa taktik
                </Link>
              </Button>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
