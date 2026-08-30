import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, BookOpen, ChevronRight, Search, Star } from "lucide-react";
import {
  addFavorite,
  fetchDistrictProfiles,
  fetchDrills,
  fetchFavorites,
  fetchGoalkeeperCards,
  fetchRulesets,
  fetchTacticCards,
  fetchTrainingSessions,
  removeFavorite,
  GAME_MOMENT_LABELS,
  PHASE_LABELS,
  ROLE_LABELS,
  label,
  type FavoriteKind,
} from "@/lib/taktikbank";
import { useAccount } from "@/hooks/useAccount";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RulesView } from "@/components/rules/RulesView";
import { formatLabelFor } from "@/lib/rules-presentation";


export const Route = createFileRoute("/_authenticated/taktikbank/")({
  head: () => ({
    meta: [
      { title: "Taktikbank 5 mot 5 – kort, övningar och pass" },
      {
        name: "description",
        content:
          "Färdiga taktikkort, målvaktskort, övningar och träningspass för barnfotboll 5 mot 5 och 7 mot 7.",
      },
      { property: "og:title", content: "Taktikbank 5 mot 5 – kort, övningar och pass" },
      {
        property: "og:description",
        content: "Animerade taktikkort med coachfrågor, övningar och färdiga träningspass.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TaktikbankPage,
});

const TABS = ["Taktikkort"] as const;
type Tab = (typeof TABS)[number];

function TaktikbankPage() {
  const { isCoach, isAdmin, loading } = useAccount();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [tab] = useState<Tab>("Taktikkort");
  const [query, setQuery] = useState("");
  const [format, setFormat] = useState<string>("all");
  const [moment, setMoment] = useState<string>("all");
  const [difficulty, setDifficulty] = useState<string>("all");
  const [phase, setPhase] = useState<string>("all");
  const [age, setAge] = useState<string>("all");
  const [role, setRole] = useState<string>("all");
  const [onlyFavorites, setOnlyFavorites] = useState(false);

  const allowed = isCoach || isAdmin;

  const tactics = useQuery({ queryKey: ["tb-tactics"], queryFn: fetchTacticCards, enabled: allowed });
  const favorites = useQuery({ queryKey: ["tb-favorites"], queryFn: fetchFavorites, enabled: allowed });


  const favoriteSet = useMemo(
    () => new Set((favorites.data ?? []).map((item) => `${item.kind}:${item.resource_id}`)),
    [favorites.data],
  );

  const toggleFavorite = useMutation({
    mutationFn: async ({ kind, id }: { kind: FavoriteKind; id: string }) => {
      if (!user) throw new Error("Inte inloggad");
      if (favoriteSet.has(`${kind}:${id}`)) await removeFavorite(user.id, kind, id);
      else await addFavorite(user.id, kind, id);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tb-favorites"] }),
  });

  const formats = useMemo(
    () => Array.from(new Set((tactics.data ?? []).map((card) => card.format))),
    [tactics.data],
  );
  const moments = useMemo(
    () => Array.from(new Set((tactics.data ?? []).map((card) => card.game_moment).filter(Boolean) as string[])),
    [tactics.data],
  );
  const phases = useMemo(
    () => Array.from(new Set((tactics.data ?? []).map((card) => card.phase).filter(Boolean) as string[])),
    [tactics.data],
  );
  const roles = useMemo(
    () =>
      Array.from(
        new Set((tactics.data ?? []).flatMap((card) => card.data.actors?.map((actor) => actor.roleId) ?? [])),
      ),
    [tactics.data],
  );

  const filtered = (tactics.data ?? []).filter((card) => {
    if (onlyFavorites && !favoriteSet.has(`tactic:${card.id}`)) return false;
    if (format !== "all" && card.format !== format) return false;
    if (moment !== "all" && card.game_moment !== moment) return false;
    if (phase !== "all" && card.phase !== phase) return false;
    if (difficulty !== "all" && String(card.difficulty) !== difficulty) return false;
    if (role !== "all" && !(card.data.actors ?? []).some((actor) => actor.roleId === role)) return false;
    if (age !== "all") {
      const wanted = Number(age);
      const fit = card.data.ageFit;
      if (fit && (wanted < fit.min || wanted > fit.max)) return false;
    }
    if (query.trim()) {
      const needle = query.trim().toLowerCase();
      const haystack = [
        card.title,
        card.purpose ?? "",
        card.data.childCue ?? "",
        card.data.trigger ?? "",
        card.data.coachQuestion ?? "",
        card.data.decisionRule ?? "",
        card.data.successSign ?? "",
        card.data.commonError ?? "",
        ...(card.data.roleActions ?? []).map((item) => item.action),
        ...(card.data.keyframes ?? []).map((frame) => frame.caption ?? ""),
      ]
        .join(" ")
        .toLowerCase();
      if (!needle.split(/\s+/).every((word) => haystack.includes(word))) return false;
    }
    return true;
  });


  if (loading) {
    return <main className="grid min-h-screen place-items-center text-muted-foreground">Laddar…</main>;
  }

  if (!allowed) {
    return (
      <main className="mx-auto max-w-md px-4 py-16 text-center">
        <BookOpen className="mx-auto size-8 text-primary" />
        <h1 className="mt-3 font-display text-2xl font-bold uppercase">Taktikbanken</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Taktikbanken är till för tränare och lagledare.
        </p>
        <Link to="/" className="mt-6 inline-block text-sm text-primary underline-offset-4 hover:underline">
          Till startsidan
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-4 pb-24 pt-6">
      <header className="flex items-center gap-2">
        <Button asChild variant="ghost" size="icon" aria-label="Tillbaka">
          <Link to="/">
            <ArrowLeft className="size-5" />
          </Link>
        </Button>
        <div>
          <p className="font-display text-xs uppercase tracking-[0.3em] text-primary">Barnfotboll</p>
          <h1 className="font-display text-3xl font-bold uppercase">Taktikbank</h1>
        </div>
      </header>

      <p className="mt-3 text-sm text-muted-foreground">
        Taktikbanken förklarar hur laget och spelarna ska agera i olika situationer.
      </p>


      {tab === "Taktikkort" && (
        <section className="mt-4 space-y-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Sök på titel, syfte, coachfråga eller barnfras"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-2 text-sm">
            <button
              type="button"
              onClick={() => setOnlyFavorites((value) => !value)}
              className={`flex items-center gap-1 rounded-full border px-3 py-1 text-xs ${
                onlyFavorites
                  ? "border-primary bg-primary/15 text-foreground"
                  : "border-border text-muted-foreground"
              }`}
            >
              <Star className={`size-3.5 ${onlyFavorites ? "fill-current" : ""}`} /> Favoriter
            </button>
            <FilterGroup
              value={format}
              onChange={setFormat}
              options={[["all", "Alla spelformer"], ...formats.map((item) => [item, formatLabelFor(item)] as [string, string])]}
            />
            <FilterGroup
              value={moment}
              onChange={setMoment}
              options={[
                ["all", "Alla moment"],
                ...moments.map((item) => [item, label(GAME_MOMENT_LABELS, item)] as [string, string]),
              ]}
            />
            <FilterGroup
              value={phase}
              onChange={setPhase}
              options={[
                ["all", "Alla faser"],
                ...phases.map((item) => [item, label(PHASE_LABELS, item)] as [string, string]),
              ]}
            />
            <FilterGroup
              value={difficulty}
              onChange={setDifficulty}
              options={[
                ["all", "Alla nivåer"],
                ["1", "Nivå 1"],
                ["2", "Nivå 2"],
                ["3", "Nivå 3"],
              ]}
            />
            <FilterGroup
              value={age}
              onChange={setAge}
              options={[
                ["all", "Alla åldrar"],
                ...[7, 8, 9, 10, 11, 12].map((year) => [String(year), `${year} år`] as [string, string]),
              ]}
            />
            <FilterGroup
              value={role}
              onChange={setRole}
              options={[
                ["all", "Alla spelartyper"],
                ...roles.map((item) => [item, label(ROLE_LABELS, item)] as [string, string]),
              ]}
            />
          </div>

          {tactics.isLoading && <p className="text-sm text-muted-foreground">Laddar taktikkort…</p>}
          {filtered.map((card) => (
            <div
              key={card.id}
              className="flex items-center gap-2 rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary"
            >
              <Link
                to="/taktikbank/$cardId"
                params={{ cardId: card.id }}
                className="flex min-w-0 flex-1 items-center gap-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    {formatLabelFor(card.format)} · {label(GAME_MOMENT_LABELS, card.game_moment)} ·{" "}
                    {label(PHASE_LABELS, card.phase)} · nivå {card.difficulty}
                  </p>
                  <h2 className="font-display text-lg font-semibold">{card.title}</h2>
                  <p className="truncate text-sm text-muted-foreground">{card.purpose}</p>
                </div>
                <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
              </Link>
              <button
                type="button"
                aria-label={favoriteSet.has(`tactic:${card.id}`) ? "Ta bort favorit" : "Spara som favorit"}
                aria-pressed={favoriteSet.has(`tactic:${card.id}`)}
                onClick={() => toggleFavorite.mutate({ kind: "tactic", id: card.id })}
                className="shrink-0 rounded-full p-2 text-muted-foreground hover:text-primary"
              >
                <Star
                  className={`size-5 ${favoriteSet.has(`tactic:${card.id}`) ? "fill-primary text-primary" : ""}`}
                />
              </button>
            </div>
          ))}
          {!tactics.isLoading && filtered.length === 0 && (
            <p className="text-sm text-muted-foreground">Inga kort matchar filtret.</p>
          )}
        </section>
      )}

      <section className="mt-8 rounded-xl border border-border/60 bg-card/50 p-4">
        <h2 className="font-display text-sm uppercase tracking-[0.2em] text-muted-foreground">Mer innehåll</h2>
        <div className="mt-2 flex flex-wrap gap-2 text-sm">
          <Link to="/ovningsbank" className="rounded-full border border-border px-3 py-1 text-primary">
            Övningsbank
          </Link>
          <Link to="/kunskapsbank" className="rounded-full border border-border px-3 py-1 text-primary">
            Kunskapsbank
          </Link>
          <Link to="/taktikbank/regler" className="rounded-full border border-border px-3 py-1 text-muted-foreground">
            Regler
          </Link>
        </div>
      </section>

    </main>
  );
}

function FilterGroup({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  options: [string, string][];
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {options.map(([key, text]) => (
        <button
          key={key}
          type="button"
          onClick={() => onChange(key)}
          className={`rounded-full border px-3 py-1 text-xs ${
            value === key ? "border-primary bg-primary/15 text-foreground" : "border-border text-muted-foreground"
          }`}
        >
          {text}
        </button>
      ))}
    </div>
  );
}
