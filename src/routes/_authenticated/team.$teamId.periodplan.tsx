import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  createPeriod,
  currentPeriod,
  deletePeriod,
  fetchFocusAreas,
  fetchObservations,
  fetchPeriods,
  fetchProgression,
  periodWeeks,
  previousPeriod,
  PROGRESSION_STEPS,
  saveProgression,
  teamOverview,
  validatePeriod,
} from "@/lib/period-plan";
import { fetchTeamPlayers } from "@/lib/teams";
import { useTeamRole } from "@/hooks/useTeamRole";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/team/$teamId/periodplan")({
  head: () => ({
    meta: [
      { title: "Periodplan – lagets teman i fyra till sex veckor" },
      {
        name: "description",
        content: "Planera lagets perioder med huvudtema, delteman, mål och progression i fyra steg.",
      },
      { property: "og:title", content: "Periodplan" },
      { property: "og:description", content: "Huvudtema, delteman, mål och progression för lagets period." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PeriodPlan,
});

const emptyForm = { name: "", start_date: "", end_date: "", main_theme: "", sub1: "", sub2: "", goal: "" };

function PeriodPlan() {
  const { teamId } = Route.useParams();
  const { isCoach } = useTeamRole(teamId);
  const queryClient = useQueryClient();
  const [form, setForm] = useState(emptyForm);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);

  const periods = useQuery({ queryKey: ["team-periods", teamId], queryFn: () => fetchPeriods(teamId) });
  const players = useQuery({ queryKey: ["team-players", teamId], queryFn: () => fetchTeamPlayers(teamId) });
  const focus = useQuery({ queryKey: ["focus-areas", teamId], queryFn: () => fetchFocusAreas(teamId) });
  const observations = useQuery({ queryKey: ["observations", teamId], queryFn: () => fetchObservations(teamId) });

  const list = periods.data ?? [];
  const activePeriod = selected
    ? (list.find((item) => item.id === selected) ?? null)
    : (currentPeriod(list) ?? list[0] ?? null);
  const earlier = activePeriod ? previousPeriod(list, activePeriod) : null;

  const progression = useQuery({
    queryKey: ["period-progression", activePeriod?.id],
    queryFn: () => fetchProgression(activePeriod!.id),
    enabled: !!activePeriod,
  });

  const create = useMutation({
    mutationFn: async () => {
      const payload = {
        team_id: teamId,
        name: form.name,
        start_date: form.start_date,
        end_date: form.end_date,
        main_theme: form.main_theme,
        sub_themes: [form.sub1, form.sub2].map((value) => value.trim()).filter(Boolean),
        goal: form.goal.trim() || null,
      };
      const problem = validatePeriod(payload);
      if (problem) throw new Error(problem);
      return createPeriod(payload);
    },
    onSuccess: () => {
      setForm(emptyForm);
      setOpen(false);
      queryClient.invalidateQueries({ queryKey: ["team-periods", teamId] });
      toast.success("Perioden är skapad");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deletePeriod(id),
    onSuccess: () => {
      setSelected(null);
      queryClient.invalidateQueries({ queryKey: ["team-periods", teamId] });
      toast.success("Perioden togs bort");
    },
    onError: () => toast.error("Det gick inte att ta bort perioden."),
  });

  const saveStep = useMutation({
    mutationFn: ({ step, notes }: { step: number; notes: string }) => saveProgression(activePeriod!.id, step, notes),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["period-progression", activePeriod?.id] }),
    onError: () => toast.error("Steget kunde inte sparas."),
  });

  const overview = teamOverview({
    players: (players.data ?? []).map((player) => ({ id: player.id, name: player.name })),
    focus: focus.data ?? [],
    observations: observations.data ?? [],
  });

  if (!isCoach) {
    return <p className="text-sm text-muted-foreground">Periodplanen är bara till för lagets ledare.</p>;
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-display text-xl font-bold">Periodplan</h2>
          <p className="text-sm text-muted-foreground">
            Ett tema i taget i fyra till sex veckor, med progression och uppföljning.
          </p>
        </div>
        <Button onClick={() => setOpen((value) => !value)}>
          <Plus className="mr-2 size-4" /> Ny period
        </Button>
      </header>

      {open && (
        <section className="space-y-3 rounded-xl border border-border bg-card p-4">
          <div className="space-y-1">
            <Label htmlFor="period-name">Namn</Label>
            <Input
              id="period-name"
              value={form.name}
              placeholder="Till exempel Höst 1"
              onChange={(event) => setForm({ ...form, name: event.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label htmlFor="period-start">Startdatum</Label>
              <Input
                id="period-start"
                type="date"
                value={form.start_date}
                onChange={(event) => setForm({ ...form, start_date: event.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="period-end">Slutdatum</Label>
              <Input
                id="period-end"
                type="date"
                value={form.end_date}
                onChange={(event) => setForm({ ...form, end_date: event.target.value })}
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="period-theme">Huvudtema</Label>
            <Input
              id="period-theme"
              value={form.main_theme}
              placeholder="Till exempel spela ut från målvakt"
              onChange={(event) => setForm({ ...form, main_theme: event.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label htmlFor="period-sub1">Deltema 1</Label>
              <Input
                id="period-sub1"
                value={form.sub1}
                onChange={(event) => setForm({ ...form, sub1: event.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="period-sub2">Deltema 2</Label>
              <Input
                id="period-sub2"
                value={form.sub2}
                onChange={(event) => setForm({ ...form, sub2: event.target.value })}
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="period-goal">Mål med perioden</Label>
            <Textarea
              id="period-goal"
              rows={3}
              value={form.goal}
              onChange={(event) => setForm({ ...form, goal: event.target.value })}
            />
          </div>
          <Button onClick={() => create.mutate()} disabled={create.isPending}>
            Spara perioden
          </Button>
        </section>
      )}

      <section className="rounded-xl border border-border bg-card p-4">
        <h3 className="font-display text-lg font-semibold">Lagets perioder</h3>
        {list.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            Ingen period är skapad ännu. Börja med ett tema för de närmaste fyra till sex veckorna.
          </p>
        ) : (
          <ul className="mt-2 space-y-2">
            {list.map((period) => (
              <li
                key={period.id}
                className={`flex items-center justify-between gap-2 rounded-lg border p-3 ${
                  activePeriod?.id === period.id ? "border-primary bg-primary/5" : "border-border"
                }`}
              >
                <button className="min-w-0 flex-1 text-left" onClick={() => setSelected(period.id)}>
                  <span className="block font-medium">{period.name}</span>
                  <span className="block text-xs text-muted-foreground">
                    {period.start_date} – {period.end_date} · {periodWeeks(period)} veckor · {period.main_theme}
                  </span>
                </button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Ta bort perioden ${period.name}`}
                  onClick={() => remove.mutate(period.id)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {activePeriod && (
        <section className="space-y-3 rounded-xl border border-border bg-card p-4">
          <h3 className="font-display text-lg font-semibold">Progression: {activePeriod.main_theme}</h3>
          {activePeriod.sub_themes.length > 0 && (
            <p className="text-sm text-muted-foreground">Delteman: {activePeriod.sub_themes.join(" · ")}</p>
          )}
          {activePeriod.goal && <p className="text-sm">{activePeriod.goal}</p>}
          <p className="text-sm text-muted-foreground">
            Föregående periods tema: {earlier ? `${earlier.name} – ${earlier.main_theme}` : "Ingen tidigare period"}
          </p>
          {PROGRESSION_STEPS.map((step) => {
            const saved = (progression.data ?? []).find((row) => row.step === step.step);
            return (
              <div key={step.step} className="space-y-1">
                <Label htmlFor={`step-${step.step}`}>
                  {step.step}. {step.label}
                </Label>
                <p className="text-xs text-muted-foreground">{step.help}</p>
                <Textarea
                  id={`step-${step.step}`}
                  rows={2}
                  defaultValue={saved?.notes ?? ""}
                  onBlur={(event) => saveStep.mutate({ step: step.step, notes: event.target.value })}
                />
              </div>
            );
          })}
        </section>
      )}

      <section className="rounded-xl border border-border bg-card p-4">
        <h3 className="font-display text-lg font-semibold">Spelarutveckling i laget</h3>
        <p className="text-sm text-muted-foreground">
          Ingen topplista och inga betyg. Bara en översikt över vilka som har ett fokusområde och när du senast skrev
          en observation.
        </p>
        <p className="mt-2 text-sm">
          {overview.withFocus} med fokusområde · {overview.withoutFocus} utan
        </p>
        <ul className="mt-3 space-y-1 text-sm">
          {overview.latestObservation.map((row) => (
            <li key={row.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
              <span>{row.name}</span>
              <span className="text-xs text-muted-foreground">
                {row.hasFocus ? "Har fokusområde" : "Inget fokusområde"} ·{" "}
                {row.lastObservation
                  ? `senaste observation ${new Date(row.lastObservation).toLocaleDateString("sv-SE")}`
                  : "ingen observation"}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
