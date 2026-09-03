import { useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen, Copy, FilePlus2, LayoutTemplate, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { CoachOnly } from "@/components/CoachOnly";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAccount } from "@/hooks/useAccount";
import { useConfirm } from "@/components/ConfirmDelete";
import {
  createCoachSession,
  deleteCoachSession,
  emptyDraft,
  fetchAllSessionItems,
  fetchCoachSessions,
  totalMinutes,
  type CoachSession,
} from "@/lib/coach-sessions";
import {
  canEditTemplate,
  copySession,
  DURATION_BUCKETS,
  filterSessions,
  renameSession,
  setTemplate,
  templateCards,
  type DurationBucket,
  type SessionFilters,
} from "@/lib/session-templates";
import {
  recommendDrills,
  recommendTemplates,
  STEP_LABELS,
  type ProgressionStep,
} from "@/lib/session-recommendations";
import { fetchDrills } from "@/lib/taktikbank";
import { formatDateTime } from "@/lib/teams";

export const Route = createFileRoute("/_authenticated/traningspass/nytt")({
  head: () => ({
    meta: [
      { title: "Nytt träningspass – tomt, mall eller kopia" },
      {
        name: "description",
        content:
          "Börja planera träningen på tre sätt: skapa ett tomt pass, använd en sparad mall eller kopiera ett tidigare pass. Kopian blir alltid fristående.",
      },
      { property: "og:title", content: "Nytt träningspass" },
      {
        property: "og:description",
        content: "Skapa tomt pass, använd mall eller kopiera ett tidigare pass.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <CoachOnly>
      <NewSessionPage />
    </CoachOnly>
  ),
});

const selectClass = "h-10 w-full rounded-md border border-input bg-background px-3 text-sm";

type Mode = "start" | "template" | "copy";

function NewSessionPage() {
  const { user, memberships } = useAccount();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { confirm, confirmDialog } = useConfirm();
  const [mode, setMode] = useState<Mode>("start");

  const coachTeams = memberships.filter(
    (item) => item.status === "approved" && item.role === "coach",
  );

  const sessions = useQuery({ queryKey: ["coach-sessions"], queryFn: fetchCoachSessions });
  const items = useQuery({ queryKey: ["coach-session-items"], queryFn: fetchAllSessionItems });
  const drills = useQuery({ queryKey: ["tb-drills"], queryFn: fetchDrills });

  const all = useMemo(() => sessions.data ?? [], [sessions.data]);
  const allItems = useMemo(() => items.data ?? [], [items.data]);
  const cards = useMemo(
    () => templateCards(all, allItems, user?.id ?? null),
    [all, allItems, user?.id],
  );

  // Förutsättningar som styr rekommendationerna.
  const [teamId, setTeamId] = useState<string>("");
  const [ageGroup, setAgeGroup] = useState("");
  const [gameFormat, setGameFormat] = useState("");
  const [theme, setTheme] = useState("");
  const [minutes, setMinutes] = useState("60");
  const [step, setStep] = useState<ProgressionStep>(1);

  const input = {
    ageGroup: ageGroup || null,
    gameFormat: gameFormat || null,
    theme: theme || null,
    minutes: Number(minutes) || null,
    step,
  };
  const drillTips = recommendDrills(drills.data ?? [], input);
  const templateTips = recommendTemplates(cards, input);

  const createEmpty = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Du måste vara inloggad.");
      return createCoachSession(
        {
          ...emptyDraft,
          title: "Nytt träningspass",
          age_group: ageGroup || null,
          game_format: gameFormat || null,
          theme: theme || null,
          team_id: teamId || null,
        },
        user.id,
      );
    },
    onSuccess: async (id) => {
      await queryClient.invalidateQueries({ queryKey: ["coach-sessions"] });
      navigate({ to: "/traningspass/$id", params: { id } });
    },
    onError: () => toast.error("Det gick inte att skapa passet."),
  });

  const copy = useMutation({
    mutationFn: (sourceId: string) => copySession({ sourceId, teamId: teamId || null }),
    onSuccess: async (id) => {
      await queryClient.invalidateQueries({ queryKey: ["coach-sessions"] });
      await queryClient.invalidateQueries({ queryKey: ["coach-session-items"] });
      toast.success("Kopian är fristående. Välj aktivitet i nästa steg.");
      navigate({ to: "/traningspass/$id", params: { id } });
    },
    onError: (error: Error) => toast.error(error.message || "Det gick inte att kopiera passet."),
  });

  const rename = useMutation({
    mutationFn: (input: { id: string; title: string }) => renameSession(input.id, input.title),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["coach-sessions"] });
      toast.success("Mallen fick ett nytt namn.");
    },
    onError: (error: Error) => toast.error(error.message || "Namnet kunde inte sparas."),
  });

  const share = useMutation({
    mutationFn: (input: { id: string; visibility: "private" | "team"; teamId: string | null }) =>
      setTemplate({
        sessionId: input.id,
        isTemplate: true,
        visibility: input.visibility,
        teamId: input.teamId,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["coach-sessions"] });
      toast.success("Delningen uppdaterades.");
    },
    onError: () => toast.error("Delningen kunde inte ändras."),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteCoachSession(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["coach-sessions"] });
      toast.success("Mallen raderades.");
    },
    onError: () => toast.error("Mallen kunde inte raderas."),
  });

  // Filter för Kopiera tidigare pass.
  const [filters, setFilters] = useState<SessionFilters>({});
  const previous = useMemo(
    () => filterSessions(all, allItems, filters),
    [all, allItems, filters],
  );
  const themes = Array.from(new Set(all.map((row) => row.theme).filter(Boolean))) as string[];
  const ages = Array.from(new Set(all.map((row) => row.age_group).filter(Boolean))) as string[];
  const formats = Array.from(new Set(all.map((row) => row.game_format).filter(Boolean))) as string[];

  function sessionMinutes(session: CoachSession) {
    return totalMinutes(allItems.filter((item) => item.session_id === session.id));
  }

  return (
    <main className="mx-auto max-w-4xl px-4 pb-24 pt-6 md:pt-20">
      {confirmDialog}
      <Button variant="ghost" asChild className="mb-2">
        <Link to="/traningspass">← Mina träningar</Link>
      </Button>
      <h1 className="font-display text-3xl font-bold">Nytt träningspass</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Välj hur du vill börja. Ingenting sparas förrän du väljer ett alternativ.
      </p>

      <section className="mt-6 grid gap-3 sm:grid-cols-3">
        <button
          type="button"
          onClick={() => createEmpty.mutate()}
          disabled={createEmpty.isPending}
          className="rounded-xl border border-border bg-card p-5 text-left transition-colors hover:border-primary"
        >
          <FilePlus2 className="size-6 text-primary" aria-hidden />
          <h2 className="mt-3 font-display text-lg font-semibold">Skapa tomt pass</h2>
          <p className="mt-1 text-sm text-muted-foreground">Bygg passet från grunden.</p>
        </button>
        <button
          type="button"
          onClick={() => setMode("template")}
          className={`rounded-xl border p-5 text-left transition-colors hover:border-primary ${
            mode === "template" ? "border-primary bg-primary/10" : "border-border bg-card"
          }`}
        >
          <LayoutTemplate className="size-6 text-primary" aria-hidden />
          <h2 className="mt-3 font-display text-lg font-semibold">Använd mall</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Egna mallar och lagets delade mallar.
          </p>
        </button>
        <button
          type="button"
          onClick={() => setMode("copy")}
          className={`rounded-xl border p-5 text-left transition-colors hover:border-primary ${
            mode === "copy" ? "border-primary bg-primary/10" : "border-border bg-card"
          }`}
        >
          <Copy className="size-6 text-primary" aria-hidden />
          <h2 className="mt-3 font-display text-lg font-semibold">Kopiera tidigare pass</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Datum och kalenderkoppling följer inte med.
          </p>
        </button>
      </section>

      <section className="mt-8 rounded-xl border border-border bg-card p-4">
        <h2 className="font-display text-lg font-semibold">Lagets förutsättningar</h2>
        <p className="text-xs text-muted-foreground">
          Styr både nytt pass och rekommendationerna nedan.
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {coachTeams.length > 0 && (
            <div className="space-y-1.5">
              <Label htmlFor="ns-team">Lag</Label>
              <select
                id="ns-team"
                className={selectClass}
                value={teamId}
                onChange={(event) => setTeamId(event.target.value)}
              >
                <option value="">Inget lag</option>
                {coachTeams.map((item) => (
                  <option key={item.team_id} value={item.team_id}>
                    {item.team?.name ?? "Lag"}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="ns-age">Åldersgrupp</Label>
            <Input
              id="ns-age"
              value={ageGroup}
              placeholder="P10"
              onChange={(event) => setAgeGroup(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ns-format">Spelform</Label>
            <Input
              id="ns-format"
              value={gameFormat}
              placeholder="5v5"
              onChange={(event) => setGameFormat(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ns-theme">Tema</Label>
            <Input
              id="ns-theme"
              value={theme}
              placeholder="Spelbarhet"
              onChange={(event) => setTheme(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ns-minutes">Träningstid (minuter)</Label>
            <Input
              id="ns-minutes"
              inputMode="numeric"
              value={minutes}
              onChange={(event) => setMinutes(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ns-step">Progressionssteg</Label>
            <select
              id="ns-step"
              className={selectClass}
              value={step}
              onChange={(event) => setStep(Number(event.target.value) as ProgressionStep)}
            >
              {([1, 2, 3, 4] as ProgressionStep[]).map((value) => (
                <option key={value} value={value}>
                  Vecka {value} – {STEP_LABELS[value]}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <section className="mt-6 rounded-xl border border-border bg-card p-4">
        <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
          <Sparkles className="size-5 text-primary" aria-hidden /> Rekommenderat
        </h2>
        {drillTips.length === 0 && templateTips.length === 0 && (
          <p className="mt-2 text-sm text-muted-foreground">
            Inga rekommendationer ännu. Fyll i spelform, ålder eller tema ovan.
          </p>
        )}
        {templateTips.length > 0 && (
          <ul className="mt-3 space-y-2">
            {templateTips.map((tip) => (
              <li
                key={tip.item.id}
                className="flex items-start justify-between gap-3 rounded-lg border border-border p-3"
              >
                <div className="min-w-0">
                  <p className="font-semibold">{tip.item.title}</p>
                  <p className="text-xs text-muted-foreground">{tip.reason}</p>
                </div>
                <Button size="sm" onClick={() => copy.mutate(tip.item.id)} disabled={copy.isPending}>
                  Använd mallen
                </Button>
              </li>
            ))}
          </ul>
        )}
        {drillTips.length > 0 && (
          <ul className="mt-3 space-y-2">
            {drillTips.map((tip) => (
              <li key={tip.item.id} className="rounded-lg border border-border p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold">{tip.item.title}</p>
                  <Button size="sm" variant="outline" asChild>
                    <Link to="/ovningsbank/$drillId" params={{ drillId: tip.item.id }}>
                      Visa övningen
                    </Link>
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">{tip.reason}</p>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
          <BookOpen className="size-4" aria-hidden /> Läs inför träningen:{" "}
          <Link className="underline" to="/kunskapsbank">
            Kunskapsbanken
          </Link>
        </p>
      </section>

      {mode === "template" && (
        <section className="mt-6">
          <h2 className="font-display text-xl font-semibold">Mallar</h2>
          {cards.length === 0 && (
            <p className="mt-2 text-sm text-muted-foreground">
              Du har inga mallar ännu. Öppna ett pass och spara det som mall.
            </p>
          )}
          <ul className="mt-3 space-y-2">
            {cards.map((card) => {
              const source = all.find((row) => row.id === card.id) as CoachSession;
              const editable = canEditTemplate(source, user?.id ?? null);
              return (
                <li key={card.id} className="rounded-xl border border-border bg-card p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold">{card.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {card.minutes} min · {card.itemCount} moment ·{" "}
                        {card.ageGroup ?? "Ingen ålder"} · {card.gameFormat ?? "Ingen spelform"} ·{" "}
                        {card.theme ?? "Inget tema"} · {card.visibilityLabel}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Uppdaterad {formatDateTime(card.updatedAt)}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" onClick={() => copy.mutate(card.id)} disabled={copy.isPending}>
                        Använd mallen
                      </Button>
                      <Button size="sm" variant="outline" asChild>
                        <Link to="/traningspass/$id/visa" params={{ id: card.id }}>
                          Förhandsgranska
                        </Link>
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => copy.mutate(card.id)}
                        disabled={copy.isPending}
                      >
                        Duplicera
                      </Button>
                      {editable && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              const title = window.prompt("Nytt namn på mallen", card.title);
                              if (title) rename.mutate({ id: card.id, title });
                            }}
                          >
                            Byt namn
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              share.mutate({
                                id: card.id,
                                visibility: card.visibility === "team" ? "private" : "team",
                                teamId: card.teamId ?? teamId ?? null,
                              })
                            }
                          >
                            {card.visibility === "team" ? "Gör privat" : "Dela med laget"}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={async () => {
                              const ok = await confirm({
                                title: "Radera mallen?",
                                description: "Mallen tas bort. Pass som skapats från den finns kvar.",
                              });
                              if (ok) remove.mutate(card.id);
                            }}
                          >
                            Radera
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {mode === "copy" && (
        <section className="mt-6">
          <h2 className="font-display text-xl font-semibold">Kopiera tidigare pass</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="f-team">Lag</Label>
              <select
                id="f-team"
                className={selectClass}
                value={filters.teamId ?? ""}
                onChange={(event) =>
                  setFilters({ ...filters, teamId: event.target.value || null })
                }
              >
                <option value="">Alla lag</option>
                {coachTeams.map((item) => (
                  <option key={item.team_id} value={item.team_id}>
                    {item.team?.name ?? "Lag"}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="f-from">Från datum</Label>
              <Input
                id="f-from"
                type="date"
                value={filters.fromDate ?? ""}
                onChange={(event) =>
                  setFilters({ ...filters, fromDate: event.target.value || null })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="f-theme">Tema</Label>
              <select
                id="f-theme"
                className={selectClass}
                value={filters.theme ?? ""}
                onChange={(event) => setFilters({ ...filters, theme: event.target.value || null })}
              >
                <option value="">Alla teman</option>
                {themes.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="f-age">Åldersgrupp</Label>
              <select
                id="f-age"
                className={selectClass}
                value={filters.ageGroup ?? ""}
                onChange={(event) =>
                  setFilters({ ...filters, ageGroup: event.target.value || null })
                }
              >
                <option value="">Alla åldrar</option>
                {ages.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="f-format">Spelform</Label>
              <select
                id="f-format"
                className={selectClass}
                value={filters.gameFormat ?? ""}
                onChange={(event) =>
                  setFilters({ ...filters, gameFormat: event.target.value || null })
                }
              >
                <option value="">Alla spelformer</option>
                {formats.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="f-duration">Längd</Label>
              <select
                id="f-duration"
                className={selectClass}
                value={filters.duration ?? ""}
                onChange={(event) =>
                  setFilters({
                    ...filters,
                    duration: event.target.value
                      ? (Number(event.target.value) as DurationBucket)
                      : null,
                  })
                }
              >
                <option value="">Alla längder</option>
                {DURATION_BUCKETS.map((value) => (
                  <option key={value} value={value}>
                    {value} minuter
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="f-status">Status</Label>
              <select
                id="f-status"
                className={selectClass}
                value={filters.status ?? ""}
                onChange={(event) =>
                  setFilters({
                    ...filters,
                    status: (event.target.value || null) as "draft" | "done" | null,
                  })
                }
              >
                <option value="">Alla</option>
                <option value="draft">Planerat</option>
                <option value="done">Genomfört</option>
              </select>
            </div>
          </div>

          {previous.length === 0 && (
            <p className="mt-4 text-sm text-muted-foreground">
              Inga tidigare pass matchar filtret.
            </p>
          )}
          <ul className="mt-3 space-y-2">
            {previous.map((session) => (
              <li
                key={session.id}
                className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-border bg-card p-4"
              >
                <div className="min-w-0">
                  <p className="font-semibold">{session.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {sessionMinutes(session)} min · {session.age_group ?? "Ingen ålder"} ·{" "}
                    {session.game_format ?? "Ingen spelform"} · {session.theme ?? "Inget tema"} ·{" "}
                    {session.status === "done" ? "Genomfört" : "Planerat"}
                  </p>
                </div>
                <Button
                  size="sm"
                  onClick={() => copy.mutate(session.id)}
                  disabled={copy.isPending}
                >
                  Kopiera passet
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
