import { useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeft, BookOpen, PenLine, Search, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useAccount } from "@/hooks/useAccount";
import { createTactic, createTacticFromFrames } from "@/lib/db";
import {
  GAME_FORMATS,
  gameFormatLabel,
  parseGameFormat,
  pitchTypeForFormat,
} from "@/lib/game-format";
import type { GameFormatId } from "@/lib/game-format";

import { cardToFrames, fetchTacticCards, GAME_MOMENT_LABELS, label } from "@/lib/taktikbank";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/skapa")({
  head: () => ({
    meta: [
      { title: "Ny övning – välj mall eller börja från tom plan" },
      {
        name: "description",
        content:
          "Starta en ny taktik: utgå från en färdig mall ur taktikbanken eller bygg din egen från en tom plan.",
      },
      { property: "og:title", content: "Ny övning – välj mall eller börja från tom plan" },
      {
        property: "og:description",
        content: "Färdiga taktikmallar eller en tom plan – välj hur du vill börja.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CreatePage,
});

function CreatePage() {
  const { user } = useAuth();
  const account = useAccount();
  const navigate = useNavigate();
  const [showTemplates, setShowTemplates] = useState(false);
  const [name, setName] = useState("");
  const [format, setFormat] = useState<GameFormatId>("5v5");
  const [teamId, setTeamId] = useState<string>("");
  const [query, setQuery] = useState("");

  const coachTeams = account.memberships.filter(
    (item) => item.role === "coach" && item.status === "approved",
  );
  const canUseBank = account.isCoach || account.isAdmin;

  const cards = useQuery({
    queryKey: ["tb-tactics"],
    queryFn: fetchTacticCards,
    enabled: showTemplates && canUseBank,
  });

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return cards.data ?? [];
    return (cards.data ?? []).filter((card) =>
      `${card.title} ${card.purpose ?? ""} ${card.game_moment ?? ""}`.toLowerCase().includes(needle),
    );
  }, [cards.data, query]);

  const createBlank = useMutation({
    mutationFn: () =>
      createTactic(
        user!.id,
        name.trim() || `Ny övning ${gameFormatLabel(format)}`,
        pitchTypeForFormat(format),
        teamId || null,
      ),
    onSuccess: (id) => navigate({ to: "/tactic/$id", params: { id } }),
    onError: () => toast.error("Kunde inte skapa taktiken"),
  });

  const createFromTemplate = useMutation({
    mutationFn: async (cardId: string) => {
      const card = (cards.data ?? []).find((item) => item.id === cardId);
      if (!card) throw new Error("Mallen hittades inte");
      const frames = cardToFrames(card.data);
      const cardFormat = parseGameFormat(card.format);
      return createTacticFromFrames(
        user!.id,
        card.title,
        pitchTypeForFormat(cardFormat ?? format),
        teamId || null,
        frames,
      );
    },
    onSuccess: (id) => navigate({ to: "/tactic/$id", params: { id } }),
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Kunde inte skapa från mall"),
  });

  return (
    <main className="mx-auto max-w-3xl px-4 pb-24 pt-6">
      <header className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Tillbaka"
          onClick={() => (showTemplates ? setShowTemplates(false) : navigate({ to: "/" }))}
        >
          <ArrowLeft className="size-5" />
        </Button>
        <div>
          <p className="font-display text-xs tracking-[0.3em] text-primary">Taktiktavlan</p>
          <h1 className="font-display text-3xl font-bold">Ny övning</h1>
        </div>
      </header>

      {!showTemplates && (
        <section className="mt-6 space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-semibold" htmlFor="tactic-name">
              Namn (valfritt)
            </label>
            <Input
              id="tactic-name"
              placeholder="T.ex. Uppspel mot högpress"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <p className="text-sm font-semibold">Spelform</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {GAME_FORMATS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={format === item.id}
                  onClick={() => setFormat(item.id)}
                  className={`rounded-xl border p-3 text-left transition-colors ${
                    format === item.id
                      ? "border-primary bg-primary/10"
                      : "border-border hover:border-primary/60"
                  }`}
                >
                  <span className="block font-display text-lg font-semibold">{item.label}</span>
                  <span className="block text-xs text-muted-foreground">{item.hint}</span>
                </button>
              ))}
            </div>
          </div>

          {coachTeams.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-semibold">Spelarbank från lag</p>
              <div className="flex flex-wrap gap-2">
                <Chip active={teamId === ""} onClick={() => setTeamId("")}>
                  Utan lag
                </Chip>
                {coachTeams.map((item) => (
                  <Chip
                    key={item.team_id}
                    active={teamId === item.team_id}
                    onClick={() => setTeamId(item.team_id)}
                  >
                    {item.team?.name ?? "Lag"}
                  </Chip>
                ))}
              </div>
            </div>
          )}

          <Button
            className="w-full"
            size="lg"
            disabled={createBlank.isPending || !user}
            onClick={() => createBlank.mutate()}
          >
            <PenLine className="mr-2 size-4" /> Skapa och öppna tavlan
          </Button>

          {canUseBank && (
            <div className="space-y-3 rounded-xl border border-border bg-card p-4">
              <p className="text-sm text-muted-foreground">
                Vill du hellre utgå från något färdigt?
              </p>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" onClick={() => setShowTemplates(true)}>
                  <Sparkles className="mr-2 size-4" /> Välj färdig mall
                </Button>
                <Button variant="ghost" asChild>
                  <Link to="/taktikbank">
                    <BookOpen className="mr-2 size-4" /> Bläddra i banken
                  </Link>
                </Button>
              </div>
            </div>
          )}
        </section>
      )}

      {showTemplates && (
        <section className="mt-6">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Sök mall"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>

          {cards.isLoading && <p className="mt-4 text-sm text-muted-foreground">Laddar mallar…</p>}

          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {filtered.map((card) => (
              <li key={card.id}>
                <button
                  type="button"
                  disabled={createFromTemplate.isPending}
                  onClick={() => createFromTemplate.mutate(card.id)}
                  className="h-full w-full rounded-xl border border-border bg-card p-4 text-left transition-colors hover:border-primary"
                >
                  <p className="text-xs tracking-wide text-primary">
                    {card.format} · {label(GAME_MOMENT_LABELS, card.game_moment)}
                  </p>
                  <h2 className="mt-1 font-display text-lg font-semibold">{card.title}</h2>
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{card.purpose}</p>
                </button>
              </li>
            ))}
          </ul>

          {!cards.isLoading && filtered.length === 0 && (
            <p className="mt-6 rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              Inga mallar matchar sökningen.
            </p>
          )}
        </section>
      )}
    </main>
  );
}



function Chip({
  active,
  onClick,
  block,
  children,
}: {
  active: boolean;
  onClick: () => void;
  block?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg border px-3 py-2 text-sm ${block ? "w-full" : ""} ${
        active ? "border-primary bg-primary/15 text-foreground" : "border-border text-muted-foreground"
      }`}
    >
      {children}
    </button>
  );
}
