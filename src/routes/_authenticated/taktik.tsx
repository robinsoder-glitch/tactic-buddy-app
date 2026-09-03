import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { TacticEditor } from "@/components/TacticEditor";
import { useConfirm } from "@/components/ConfirmDelete";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { deleteAllTactics, deleteTactic, fetchTactics, openBlankTactic } from "@/lib/db";
import { fetchTacticCards, label, PHASE_LABELS } from "@/lib/taktikbank";
import { formatLabelFor } from "@/lib/rules-presentation";
import { CoachOnly } from "@/components/CoachOnly";

export const Route = createFileRoute("/_authenticated/taktik")({
  head: () => ({
    meta: [
      { title: "Taktik – rita och animera spelmoment" },
      {
        name: "description",
        content:
          "Flytta spelare och boll på planen, bygg steg och spela upp taktiken. Här finns även färdiga taktiker.",
      },
      { property: "og:title", content: "Taktik" },
      {
        property: "og:description",
        content: "Interaktiv taktiktavla med egna och färdiga taktiker.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <CoachOnly>
      <TacticPage />
    </CoachOnly>
  ),
});

function TacticPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [openId, setOpenId] = useState<string | null>(null);

  const { confirm, confirmDialog } = useConfirm();

  const tactics = useQuery({ queryKey: ["tactics"], queryFn: fetchTactics });
  const cards = useQuery({ queryKey: ["tactic-cards"], queryFn: fetchTacticCards });

  const list = tactics.data ?? [];

  // Tavlan startar alltid tom. Utkastet ligger kvar i bakgrunden men syns inte
  // i "Mina taktiker" förrän användaren trycker Spara och ger den ett namn.
  const [blankId, setBlankId] = useState<string | null>(null);
  const [blankError, setBlankError] = useState(false);

  useEffect(() => {
    if (!user || blankId) return;
    let cancelled = false;
    openBlankTactic(user.id)
      .then((id) => {
        if (!cancelled) setBlankId(id);
      })
      .catch(() => {
        if (!cancelled) setBlankError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [user, blankId]);

  const activeId = openId ?? blankId;

  /** Börja om med en ny, tom tavla. */
  function startNewBoard() {
    setOpenId(null);
    setBlankId(null);
    setBlankError(false);
    void queryClient.invalidateQueries({ queryKey: ["tactics"] });
    toast.success("Ny tom tavla.");
  }

  const removeTactic = useMutation({
    mutationFn: (id: string) => deleteTactic(id),
    onSuccess: (_data, id) => {
      if (openId === id) setOpenId(null);
      void queryClient.invalidateQueries({ queryKey: ["tactics"] });
      toast.success("Taktiken raderades.");
    },
    onError: () => toast.error("Taktiken kunde inte raderas."),
  });

  const removeAll = useMutation({
    mutationFn: () => {
      if (!user) throw new Error("Inte inloggad");
      return deleteAllTactics(user.id);
    },
    onSuccess: (count) => {
      setOpenId(null);
      setBlankId(null);
      void queryClient.invalidateQueries();
      toast.success(count > 0 ? `${count} taktiker raderades.` : "Inga taktiker att radera.");
    },
    onError: () => toast.error("Taktikerna kunde inte raderas."),
  });

  async function askDeleteAll() {
    const ok = await confirm({
      title: "Radera alla taktiker",
      description: "Alla dina taktiker och deras steg tas bort permanent. Det går inte att ångra.",
      confirmLabel: "Radera alla",
    });
    if (ok) removeAll.mutate();
  }

  async function askDelete(id: string, name: string) {
    const ok = await confirm({
      title: "Radera taktik",
      description: `Taktiken "${name}" och alla dess steg tas bort permanent.`,
      confirmLabel: "Radera",
    });
    if (ok) removeTactic.mutate(id);
  }

  return (
    <main className="mx-auto max-w-5xl px-4 pb-28 pt-6 md:pt-20">
      <h1 className="font-display text-3xl font-bold">Taktik</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Börja med en tom plan – dra ut spelare och boll själv och bygg din taktik.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" variant="secondary" asChild>
          <Link to="/planera-match">Koppla en taktik till en match</Link>
        </Button>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Taktiker används i matchplaneringen. Övningar för träning finns i Träningsbanken.
      </p>

      <section className="mt-4">
        {!activeId && !blankError && (
          <p className="text-sm text-muted-foreground">Förbereder en tom tavla…</p>
        )}
        {blankError && !activeId && (
          <div className="rounded-xl border border-dashed border-border p-8 text-center">
            <p className="text-sm text-muted-foreground">Tavlan kunde inte öppnas.</p>
            <Button className="mt-3" disabled={!user} onClick={startNewBoard}>
              Försök igen
            </Button>
          </div>
        )}
        {activeId && <TacticEditor key={activeId} id={activeId} />}
      </section>

      <section className="mt-8">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-2xl font-bold">Mina taktiker</h2>
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" disabled={!user} onClick={startNewBoard}>
              Ny tom tavla
            </Button>
            {list.length > 0 && (
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive hover:text-destructive"
                disabled={!user || removeAll.isPending}
                onClick={() => void askDeleteAll()}
              >
                <Trash2 className="h-4 w-4" /> Radera alla
              </Button>
            )}
          </div>
        </div>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {list.length === 0 && (
            <li className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
              Här samlas taktikerna du sparar.
            </li>
          )}
          {list.map((tactic) => (
            <li
              key={tactic.id}
              className={`flex items-center gap-2 rounded-xl border transition-colors ${
                tactic.id === activeId
                  ? "border-primary bg-primary/10"
                  : "border-border bg-card hover:border-primary/60"
              }`}
            >
              <button
                type="button"
                onClick={() => setOpenId(tactic.id)}
                aria-pressed={tactic.id === activeId}
                className="flex-1 rounded-l-xl p-4 text-left"
              >
                <span className="block font-semibold">{tactic.name}</span>
                <span className="block text-xs text-muted-foreground">
                  Senast ändrad: {new Date(tactic.updated_at).toLocaleDateString("sv-SE")}
                </span>
              </button>
              <Button
                size="icon"
                variant="ghost"
                className="mr-2 text-muted-foreground hover:text-destructive"
                aria-label={`Radera ${tactic.name}`}
                disabled={removeTactic.isPending}
                onClick={() => void askDelete(tactic.id, tactic.name)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
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
                {[formatLabelFor(card.format), label(PHASE_LABELS, card.phase)]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                {card.purpose ?? "Sammanfattning saknas."}
              </p>
              <Button className="mt-3" size="sm" variant="secondary" asChild>
                <Link to="/taktikbank/$cardId" params={{ cardId: card.id }}>
                  Visa taktik
                </Link>
              </Button>
            </li>
          ))}
        </ul>
      </section>
      {confirmDialog}
    </main>
  );
}
