import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Check, ChevronDown, Dumbbell, Search, Star } from "lucide-react";
import {
  doneCount,
  loadProgress,
  resetSession,
  toggleBlock,
  type SessionProgress,
} from "@/lib/session-progress";
import {
  addFavorite,
  fetchDrills,
  fetchFavorites,
  fetchGoalkeeperCards,
  fetchTacticCards,
  fetchTrainingSessions,
  removeFavorite,
  label,
  PHASE_LABELS,
  type FavoriteKind,
  type Drill,
} from "@/lib/taktikbank";
import { drillMeta, filterDrills, filterSessions } from "@/lib/ovningsbank";
import { drillDefaultMinutes, drillDurationLabel } from "@/lib/drill-duration";
import { formatLabelFor } from "@/lib/rules-presentation";
import { fetchKnowledgeArticles } from "@/lib/knowledge";
import { buildCatalog, fetchContentLinks, relatedSections } from "@/lib/content-links";
import { RelatedContent } from "@/components/RelatedContent";
import { PickDrillButton } from "@/components/PickDrillButton";
import { PickModeBanner } from "@/components/PickModeBanner";
import { createFromTemplate } from "@/lib/coach-sessions";
import { DRILL_SECTIONS } from "@/lib/related-sections";
import { useAccount } from "@/hooks/useAccount";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FilterPanel, FilterRow } from "@/components/FilterPanel";
import { CoachOnly } from "@/components/CoachOnly";

type OvningsbankSearch = {
  flik?: "ovningar" | "malvakt" | "pass" | undefined;
  markera?: string | undefined;
  eventId?: string | undefined;
  teamId?: string | undefined;
};

export const Route = createFileRoute("/_authenticated/ovningsbank/")({
  validateSearch: (search: Record<string, unknown>): OvningsbankSearch => {
    const flik = search["flik"];
    const markera = search["markera"];
    return {
      flik: flik === "malvakt" || flik === "pass" || flik === "ovningar" ? flik : undefined,
      markera: typeof markera === "string" && markera ? markera : undefined,
      eventId:
        typeof search["eventId"] === "string" && search["eventId"]
          ? (search["eventId"] as string)
          : undefined,
      teamId:
        typeof search["teamId"] === "string" && search["teamId"]
          ? (search["teamId"] as string)
          : undefined,
    };
  },
  head: () => ({
    meta: [
      { title: "Träningsbank – övningar, målvaktsövningar och träningspass" },
      {
        name: "description",
        content:
          "Sök bland övningar, målvaktsövningar och färdiga träningspass för barnfotboll. Filtrera på ålder, spelform, träningsområde och svårighetsgrad.",
      },
      { property: "og:title", content: "Träningsbank – så tränar ni det" },
      {
        property: "og:description",
        content: "Övningar, målvaktsövningar och träningspass kopplade till taktikkorten.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <CoachOnly>
      <OvningsbankPage />
    </CoachOnly>
  ),
});

const TABS = ["Övningar", "Målvaktsövningar"] as const;
type Tab = (typeof TABS)[number];

function OvningsbankPage() {
  const { isCoach, isAdmin, loading } = useAccount();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const search = Route.useSearch();
  const initialTab: Tab = search.flik === "malvakt" ? "Målvaktsövningar" : "Övningar";
  const [tab, setTab] = useState<Tab>(initialTab);
  const highlight = search.markera ?? null;
  const [query, setQuery] = useState("");
  const [format, setFormat] = useState("all");
  const [area, setArea] = useState("all");
  const [difficulty, setDifficulty] = useState("all");
  const [age, setAge] = useState("all");
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const navigate = useNavigate();
  const [templateError, setTemplateError] = useState<string | null>(null);
  const [progress, setProgress] = useState<SessionProgress>({});
  useEffect(() => setProgress(loadProgress()), []);
  const [openSession, setOpenSession] = useState<string | null>(
    search.flik === "pass" ? (search.markera ?? null) : null,
  );

  useEffect(() => {
    if (!highlight) return;
    const prefix =
      search.flik === "malvakt" ? "malvakt" : search.flik === "pass" ? "pass" : "ovning";
    const timer = window.setTimeout(() => {
      document
        .getElementById(`${prefix}-${highlight}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 300);
    return () => window.clearTimeout(timer);
  }, [highlight, search.flik]);

  const allowed = isCoach || isAdmin;

  const drills = useQuery({ queryKey: ["tb-drills"], queryFn: fetchDrills, enabled: allowed });
  const cards = useQuery({ queryKey: ["tb-tactics"], queryFn: fetchTacticCards, enabled: allowed });
  const keepers = useQuery({
    queryKey: ["tb-gk"],
    queryFn: fetchGoalkeeperCards,
    enabled: allowed,
  });
  const sessions = useQuery({
    queryKey: ["tb-sessions"],
    queryFn: fetchTrainingSessions,
    enabled: allowed,
  });
  const favorites = useQuery({
    queryKey: ["tb-favorites"],
    queryFn: fetchFavorites,
    enabled: allowed,
  });
  const links = useQuery({
    queryKey: ["content-links"],
    queryFn: fetchContentLinks,
    enabled: allowed,
  });
  const articles = useQuery({
    queryKey: ["knowledge-articles"],
    queryFn: fetchKnowledgeArticles,
    enabled: allowed,
  });

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

  const allCards = cards.data ?? [];
  const catalog = useMemo(
    () =>
      buildCatalog([
        ...(articles.data ?? []).map((item) => ({
          type: "article" as const,
          id: item.slug,
          title: item.title_sv,
        })),
        ...allCards.map((item) => ({ type: "tactic" as const, id: item.id, title: item.title })),
        ...(drills.data ?? []).map((item) => ({
          type: "drill" as const,
          id: item.id,
          title: item.title,
        })),
        ...(keepers.data ?? []).map((item) => ({
          type: "goalkeeper" as const,
          id: item.id,
          title: item.title,
        })),
        ...(sessions.data ?? []).map((item) => ({
          type: "session" as const,
          id: item.id,
          title: item.title,
        })),
      ]),
    [articles.data, allCards, drills.data, keepers.data, sessions.data],
  );
  const formats = useMemo(
    () => Array.from(new Set(allCards.map((card) => card.format))),
    [allCards],
  );
  const areas = useMemo(
    () => Array.from(new Set(allCards.map((card) => card.phase).filter(Boolean) as string[])),
    [allCards],
  );

  const visibleDrills = filterDrills(drills.data ?? [], allCards, {
    query,
    format,
    area,
    difficulty,
    age,
    onlyFavorites,
    favorites: favoriteSet,
  });

  const visibleSessions = filterSessions(sessions.data ?? [], {
    query,
    onlyFavorites,
    favorites: favoriteSet,
  });

  const visibleKeepers = (keepers.data ?? []).filter((card) => {
    if (onlyFavorites && !favoriteSet.has(`goalkeeper:${card.id}`)) return false;
    const needle = query.trim().toLowerCase();
    if (!needle) return true;
    return [card.title, card.purpose ?? ""].join(" ").toLowerCase().includes(needle);
  });

  if (loading) {
    return (
      <main className="grid min-h-screen place-items-center text-muted-foreground">Laddar…</main>
    );
  }

  if (!allowed) {
    return (
      <main className="mx-auto max-w-md px-4 py-16 text-center">
        <Dumbbell className="mx-auto size-8 text-primary" />
        <h1 className="mt-3 font-display text-2xl font-bold">Träningsbanken</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Träningsbanken är till för tränare och lagledare. Innehållet här används när du planerar
          träning.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" asChild>
            <Link to="/planera-traning">Till Planera träning</Link>
          </Button>
        </div>
        <Link
          to="/"
          className="mt-6 inline-block text-sm text-primary underline-offset-4 hover:underline"
        >
          Till startsidan
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-4 pb-32 pt-6">
      <PickModeBanner />
      <header className="flex items-center gap-2">
        <Button asChild variant="ghost" size="icon" aria-label="Tillbaka">
          <Link to="/">
            <ArrowLeft className="size-5" />
          </Link>
        </Button>
        <div>
          <p className="font-display text-xs tracking-[0.3em] text-primary">Så tränar ni det</p>
          <h1 className="font-display text-3xl font-bold">Träningsbank</h1>
        </div>
        <Button asChild className="ml-auto">
          <Link to="/traningspass">Skapa träningspass</Link>
        </Button>
      </header>

      <p className="mt-2 text-sm text-muted-foreground">
        Här hittar du övningar, målvaktsövningar och färdiga träningspass. Taktikbanken visar vad
        laget ska göra – här visas hur ni tränar på det.
      </p>

      <nav className="mt-4 flex gap-2 overflow-x-auto pb-1" aria-label="Delar av träningsbanken">
        {TABS.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setTab(item)}
            aria-pressed={tab === item}
            className={`whitespace-nowrap rounded-full border px-4 py-2 text-sm ${
              tab === item
                ? "border-primary bg-primary/15 text-foreground"
                : "border-border text-muted-foreground"
            }`}
          >
            {item}
          </button>
        ))}
      </nav>

      <div className="relative mt-4">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Sök på titel eller syfte"
          aria-label="Sök i träningsbanken"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>

      <FilterPanel
        activeCount={
          (onlyFavorites ? 1 : 0) +
          (tab === "Övningar"
            ? [age, format, area, difficulty].filter((value) => value !== "all").length
            : 0)
        }
        onClear={() => {
          setOnlyFavorites(false);
          setAge("all");
          setFormat("all");
          setArea("all");
          setDifficulty("all");
        }}
        primary={
          <button
            type="button"
            onClick={() => setOnlyFavorites((value) => !value)}
            aria-pressed={onlyFavorites}
            className={`flex items-center gap-1 rounded-full border px-3 py-1 text-xs ${
              onlyFavorites
                ? "border-primary bg-primary/15 text-foreground"
                : "border-border text-muted-foreground"
            }`}
          >
            <Star className={`size-3.5 ${onlyFavorites ? "fill-current" : ""}`} /> Favoriter
          </button>
        }
      >
        {tab === "Övningar" ? (
          <>
            <FilterRow title="Ålder">
              <FilterGroup
                value={age}
                onChange={setAge}
                options={[
                  ["all", "Alla åldrar"],
                  ...[7, 8, 9, 10, 11, 12].map(
                    (year) => [String(year), `${year} år`] as [string, string],
                  ),
                ]}
              />
            </FilterRow>
            <FilterRow title="Spelform">
              <FilterGroup
                value={format}
                onChange={setFormat}
                options={[
                  ["all", "Alla spelformer"],
                  ...formats.map((item) => [item, formatLabelFor(item)] as [string, string]),
                ]}
              />
            </FilterRow>
            <FilterRow title="Träningsområde">
              <FilterGroup
                value={area}
                onChange={setArea}
                options={[
                  ["all", "Alla träningsområden"],
                  ...areas.map((item) => [item, label(PHASE_LABELS, item)] as [string, string]),
                ]}
              />
            </FilterRow>
            <FilterRow title="Svårighetsgrad">
              <FilterGroup
                value={difficulty}
                onChange={setDifficulty}
                options={[
                  ["all", "Alla svårighetsgrader"],
                  ["1", "Nivå 1"],
                  ["2", "Nivå 2"],
                  ["3", "Nivå 3"],
                ]}
              />
            </FilterRow>
          </>
        ) : (
          <p className="text-xs text-muted-foreground">
            Fler filter finns för fliken Övningar. Här söker du på titel och syfte.
          </p>
        )}
      </FilterPanel>

      {tab === "Övningar" && (
        <section className="mt-4 space-y-3" aria-label="Övningar">
          {drills.isLoading && <p className="text-sm text-muted-foreground">Laddar övningar…</p>}
          {visibleDrills.map((drill) => {
            const meta = drillMeta(drill, allCards);
            return (
              <article
                key={drill.id}
                id={`ovning-${drill.id}`}
                className={`relative flex items-start gap-2 rounded-xl border bg-card p-4 transition hover:border-primary ${
                  highlight === drill.id ? "border-primary" : "border-border"
                }`}
              >
                <Link
                  to="/ovningsbank/$drillId"
                  params={{ drillId: drill.id }}
                  aria-label={`Öppna övningen ${drill.title}`}
                  className="absolute inset-0 rounded-xl"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-xs tracking-wide text-muted-foreground">
                    {meta.formats.map(formatLabelFor).join(" · ") || "Alla spelformer"}
                    {meta.areas.length
                      ? ` · ${meta.areas.map((a) => label(PHASE_LABELS, a)).join(" · ")}`
                      : ""}
                    {` · ${drillDurationLabel(drill)}`}
                  </p>
                  <h2 className="font-display text-lg font-semibold">{drill.title}</h2>
                  <p className="text-sm text-muted-foreground">{drill.purpose}</p>
                  <DrillKeyFacts drill={drill} />

                  <div className="relative z-10">
                    <RelatedContent
                      sections={relatedSections(
                        links.data ?? [],
                        { type: "drill", id: drill.id },
                        DRILL_SECTIONS,
                        catalog,
                      )}
                    />
                  </div>
                  <div className="relative z-10 mt-3">
                    <PickDrillButton
                      kind="drill"
                      resourceId={drill.id}
                      title={drill.title}
                      defaultMinutes={drillDefaultMinutes(drill)}
                      size="sm"
                    />
                  </div>
                </div>
                <div className="relative z-10">
                  <FavoriteButton
                    active={favoriteSet.has(`drill:${drill.id}`)}
                    onClick={() => toggleFavorite.mutate({ kind: "drill", id: drill.id })}
                  />
                </div>
              </article>
            );
          })}
          {!drills.isLoading && visibleDrills.length === 0 && (
            <p className="text-sm text-muted-foreground">Inga övningar matchar filtret.</p>
          )}
        </section>
      )}

      {tab === "Målvaktsövningar" && (
        <section className="mt-4 space-y-3" aria-label="Målvaktsövningar">
          {keepers.isLoading && <p className="text-sm text-muted-foreground">Laddar…</p>}
          {visibleKeepers.map((card) => (
            <article
              key={card.id}
              id={`malvakt-${card.id}`}
              className={`flex items-start gap-2 rounded-xl border bg-card p-4 ${
                highlight === card.id ? "border-primary" : "border-border"
              }`}
            >
              <div className="min-w-0 flex-1">
                <h2 className="font-display text-lg font-semibold">{card.title}</h2>
                <p className="text-sm text-muted-foreground">{card.purpose}</p>
                {card.data.trigger && (
                  <p className="mt-2 text-sm">
                    <span className="text-muted-foreground">Startsignal: </span>
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
              </div>
              <FavoriteButton
                active={favoriteSet.has(`goalkeeper:${card.id}`)}
                onClick={() => toggleFavorite.mutate({ kind: "goalkeeper", id: card.id })}
              />
              <div className="mt-3">
                <PickDrillButton
                  kind="goalkeeper"
                  resourceId={card.id}
                  title={card.title}
                  size="sm"
                />
              </div>
            </article>
          ))}
          {!keepers.isLoading && visibleKeepers.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Inga målvaktsövningar matchar sökningen.
            </p>
          )}
        </section>
      )}
    </main>
  );
}

function FavoriteButton({ active, onClick }: { active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={active ? "Ta bort favorit" : "Spara som favorit"}
      aria-pressed={active}
      onClick={onClick}
      className="shrink-0 rounded-full p-2 text-muted-foreground hover:text-primary"
    >
      <Star className={`size-5 ${active ? "fill-primary text-primary" : ""}`} />
    </button>
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
            value === key
              ? "border-primary bg-primary/15 text-foreground"
              : "border-border text-muted-foreground"
          }`}
        >
          {text}
        </button>
      ))}
    </div>
  );
}

function DrillKeyFacts({ drill }: { drill: Drill }) {
  const facts: Array<[string, string]> = [];
  if (drill.data.players) facts.push(["Spelare", drill.data.players]);
  if (drill.data.area) facts.push(["Yta", drill.data.area]);
  facts.push(["Tid", drillDurationLabel(drill)]);
  if (drill.data.equipment?.length) facts.push(["Utrustning", drill.data.equipment.join(", ")]);
  if (!facts.length) return null;
  return (
    <dl className="mt-2 flex flex-wrap gap-1.5 text-xs">
      {facts.map(([term, value]) => (
        <div key={term} className="rounded-full bg-secondary/70 px-3 py-1">
          <dt className="inline text-muted-foreground">{term}: </dt>
          <dd className="inline font-medium text-foreground">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
