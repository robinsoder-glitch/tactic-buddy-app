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
  label,
  type FavoriteKind,
} from "@/lib/taktikbank";
import { useAccount } from "@/hooks/useAccount";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";


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

const TABS = ["Taktikkort", "Målvakt", "Övningar", "Pass", "Regler"] as const;
type Tab = (typeof TABS)[number];

function TaktikbankPage() {
  const { isCoach, isAdmin, loading } = useAccount();
  const [tab, setTab] = useState<Tab>("Taktikkort");
  const [query, setQuery] = useState("");
  const [format, setFormat] = useState<string>("all");
  const [moment, setMoment] = useState<string>("all");
  const [difficulty, setDifficulty] = useState<string>("all");

  const allowed = isCoach || isAdmin;

  const tactics = useQuery({ queryKey: ["tb-tactics"], queryFn: fetchTacticCards, enabled: allowed });
  const keepers = useQuery({ queryKey: ["tb-gk"], queryFn: fetchGoalkeeperCards, enabled: allowed && tab === "Målvakt" });
  const drills = useQuery({ queryKey: ["tb-drills"], queryFn: fetchDrills, enabled: allowed && tab === "Övningar" });
  const sessions = useQuery({
    queryKey: ["tb-sessions"],
    queryFn: fetchTrainingSessions,
    enabled: allowed && tab === "Pass",
  });
  const rulesets = useQuery({ queryKey: ["tb-rules"], queryFn: fetchRulesets, enabled: allowed && tab === "Regler" });
  const districts = useQuery({
    queryKey: ["tb-districts"],
    queryFn: fetchDistrictProfiles,
    enabled: allowed && tab === "Regler",
  });

  const formats = useMemo(
    () => Array.from(new Set((tactics.data ?? []).map((card) => card.format))),
    [tactics.data],
  );
  const moments = useMemo(
    () => Array.from(new Set((tactics.data ?? []).map((card) => card.game_moment).filter(Boolean) as string[])),
    [tactics.data],
  );

  const filtered = (tactics.data ?? []).filter((card) => {
    if (format !== "all" && card.format !== format) return false;
    if (moment !== "all" && card.game_moment !== moment) return false;
    if (difficulty !== "all" && String(card.difficulty) !== difficulty) return false;
    if (query.trim()) {
      const needle = query.trim().toLowerCase();
      const haystack = `${card.title} ${card.purpose ?? ""} ${card.data.childCue ?? ""}`.toLowerCase();
      if (!haystack.includes(needle)) return false;
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

      <nav className="mt-4 flex gap-2 overflow-x-auto pb-1">
        {TABS.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setTab(item)}
            className={`whitespace-nowrap rounded-full border px-4 py-2 text-sm ${
              tab === item ? "border-primary bg-primary/15 text-foreground" : "border-border text-muted-foreground"
            }`}
          >
            {item}
          </button>
        ))}
      </nav>

      {tab === "Taktikkort" && (
        <section className="mt-4 space-y-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Sök på titel eller syfte"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-2 text-sm">
            <FilterGroup
              value={format}
              onChange={setFormat}
              options={[["all", "Alla format"], ...formats.map((item) => [item, item] as [string, string])]}
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
              value={difficulty}
              onChange={setDifficulty}
              options={[
                ["all", "Alla nivåer"],
                ["1", "Nivå 1"],
                ["2", "Nivå 2"],
                ["3", "Nivå 3"],
              ]}
            />
          </div>

          {tactics.isLoading && <p className="text-sm text-muted-foreground">Laddar taktikkort…</p>}
          {filtered.map((card) => (
            <Link
              key={card.id}
              to="/taktikbank/$cardId"
              params={{ cardId: card.id }}
              className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary"
            >
              <div className="min-w-0 flex-1">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  {card.format} · {label(GAME_MOMENT_LABELS, card.game_moment)} ·{" "}
                  {label(PHASE_LABELS, card.phase)} · nivå {card.difficulty}
                </p>
                <h2 className="font-display text-lg font-semibold">{card.title}</h2>
                <p className="truncate text-sm text-muted-foreground">{card.purpose}</p>
              </div>
              <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
            </Link>
          ))}
          {!tactics.isLoading && filtered.length === 0 && (
            <p className="text-sm text-muted-foreground">Inga kort matchar filtret.</p>
          )}
        </section>
      )}

      {tab === "Målvakt" && (
        <section className="mt-4 space-y-3">
          {keepers.isLoading && <p className="text-sm text-muted-foreground">Laddar…</p>}
          {(keepers.data ?? []).map((card) => (
            <article key={card.id} className="rounded-xl border border-border bg-card p-4">
              <h2 className="font-display text-lg font-semibold">{card.title}</h2>
              <p className="text-sm text-muted-foreground">{card.purpose}</p>
              {card.data.trigger && (
                <p className="mt-2 text-sm">
                  <span className="text-muted-foreground">Trigger: </span>
                  {card.data.trigger}
                </p>
              )}
              {card.data.childCues?.length ? (
                <p className="mt-2 text-sm">
                  <span className="text-muted-foreground">Barnfraser: </span>
                  {card.data.childCues.join(" · ")}
                </p>
              ) : null}
              {card.data.steps?.length ? (
                <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm">
                  {card.data.steps.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
              ) : null}
              {card.data.commonErrors?.length ? (
                <p className="mt-2 text-sm text-muted-foreground">
                  Vanliga fel: {card.data.commonErrors.join(" · ")}
                </p>
              ) : null}
            </article>
          ))}
        </section>
      )}

      {tab === "Övningar" && (
        <section className="mt-4 space-y-3">
          {drills.isLoading && <p className="text-sm text-muted-foreground">Laddar…</p>}
          {(drills.data ?? []).map((drill) => (
            <article key={drill.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="font-display text-lg font-semibold">{drill.title}</h2>
                <span className="text-xs text-muted-foreground">{drill.default_minutes} min</span>
              </div>
              <p className="text-sm text-muted-foreground">{drill.purpose}</p>
              {drill.data.linkedTacticIds?.length ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {drill.data.linkedTacticIds.map((tacticId) => (
                    <Link
                      key={tacticId}
                      to="/taktikbank/$cardId"
                      params={{ cardId: tacticId }}
                      className="rounded-full border border-border px-3 py-1 text-xs text-primary"
                    >
                      Taktikkort
                    </Link>
                  ))}
                </div>
              ) : null}
            </article>
          ))}
        </section>
      )}

      {tab === "Pass" && (
        <section className="mt-4 space-y-3">
          {sessions.isLoading && <p className="text-sm text-muted-foreground">Laddar…</p>}
          {(sessions.data ?? []).map((session) => (
            <article key={session.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="font-display text-lg font-semibold">{session.title}</h2>
                <span className="text-xs text-muted-foreground">{session.total_minutes} min</span>
              </div>
              <p className="text-sm text-muted-foreground">{session.theme}</p>
              <ol className="mt-3 space-y-2 text-sm">
                {session.data.blocks
                  .slice()
                  .sort((a, b) => a.order - b.order)
                  .map((block) => (
                    <li key={block.order} className="rounded-lg border border-border/60 px-3 py-2">
                      <div className="flex justify-between gap-3">
                        <span className="font-medium">{block.activity}</span>
                        <span className="text-xs text-muted-foreground">{block.minutes} min</span>
                      </div>
                      {block.focus && <p className="text-xs text-muted-foreground">{block.focus}</p>}
                    </li>
                  ))}
              </ol>
              {session.data.coachLimit && (
                <p className="mt-2 text-xs text-muted-foreground">{session.data.coachLimit}</p>
              )}
            </article>
          ))}
        </section>
      )}

      {tab === "Regler" && (
        <section className="mt-4 space-y-3">
          {(rulesets.isLoading || districts.isLoading) && (
            <p className="text-sm text-muted-foreground">Laddar…</p>
          )}
          {(rulesets.data ?? []).map((rule) => (
            <RuleCard key={rule.id} format={rule.format} season={rule.season} data={rule.data} />
          ))}
          {(districts.data ?? []).map((district) => (
            <article key={district.id} className="rounded-xl border border-border bg-card p-4">
              <h2 className="font-display text-lg font-semibold">{district.name}</h2>
              <pre className="mt-2 whitespace-pre-wrap break-words text-xs text-muted-foreground">
                {readable(district.data)}
              </pre>
            </article>
          ))}
        </section>
      )}
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

function RuleCard({
  format,
  season,
  data,
}: {
  format: string;
  season: string | null;
  data: Record<string, unknown>;
}) {
  const sources = (data["sources"] as { title: string; url?: string }[] | undefined) ?? [];
  return (
    <article className="rounded-xl border border-border bg-card p-4">
      <h2 className="font-display text-lg font-semibold">
        Spelform {format} {season ? `· ${season}` : ""}
      </h2>
      <pre className="mt-2 whitespace-pre-wrap break-words text-xs text-muted-foreground">
        {readable({ ...data, sources: undefined })}
      </pre>
      {sources.length > 0 && (
        <ul className="mt-2 space-y-1 text-xs">
          {sources.map((source) => (
            <li key={source.title}>
              {source.url ? (
                <a href={source.url} target="_blank" rel="noreferrer" className="text-primary underline">
                  {source.title}
                </a>
              ) : (
                source.title
              )}
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}

function readable(value: unknown) {
  return JSON.stringify(value, (_key, item) => (item === undefined ? undefined : item), 2)
    .replace(/[{}"[\]]/g, "")
    .split("\n")
    .map((line) => line.replace(/,$/, "").trimEnd())
    .filter((line) => line.trim().length > 0)
    .join("\n");
}
