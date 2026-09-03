import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Plus, Shield, Users } from "lucide-react";
import { toast } from "sonner";
import { useAccount } from "@/hooks/useAccount";
import { usePendingJoins } from "@/hooks/usePendingJoins";
import { createTeam, fetchClubs, fetchMyTeams, TEAM_GENDER_LABELS } from "@/lib/teams";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BackLink } from "@/components/BackLink";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/teams")({
  head: () => ({
    meta: [
      { title: "Mina lag – Fotbollsrummet" },
      {
        name: "description",
        content: "Skapa och hantera dina lag: klubb, åldersgrupp, kön och lagkod för spelarna.",
      },
      { property: "og:title", content: "Mina lag – Fotbollsrummet" },
      { property: "og:description", content: "Skapa klubb och lag, bjud in spelare med lagkoden." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TeamsPage,
});

function TeamsPage() {
  const { userId, isCoach } = useAccount();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [clubId, setClubId] = useState<string | null>(null);
  const [clubName, setClubName] = useState("");
  const [ageGroup, setAgeGroup] = useState("");
  const [gender, setGender] = useState("mixed");
  const [homeGround, setHomeGround] = useState("");

  const [showArchived, setShowArchived] = useState(false);
  const { byTeam: pendingByTeam } = usePendingJoins();
  const teams = useQuery({ queryKey: ["teams"], queryFn: fetchMyTeams });
  const allTeams = teams.data ?? [];
  const archivedCount = allTeams.filter((team) => team.archived_at).length;
  const visibleTeams = showArchived ? allTeams : allTeams.filter((team) => !team.archived_at);
  const clubs = useQuery({ queryKey: ["clubs"], queryFn: fetchClubs });

  const create = useMutation({
    mutationFn: () => {
      if (!userId) throw new Error("Inte inloggad");
      if (!name.trim()) throw new Error("Ange ett lagnamn");
      return createTeam({ userId, name, clubId, clubName, ageGroup, gender, homeGround });
    },
    onSuccess: (id) => {
      setOpen(false);
      setName("");
      queryClient.invalidateQueries();
      navigate({ to: "/team/$teamId", params: { teamId: id } });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Kunde inte skapa laget"),
  });

  if (!isCoach) {
    return (
      <main className="mx-auto max-w-md px-4 py-16 text-center">
        <p className="text-muted-foreground">Endast tränare kan skapa lag.</p>
        <Button asChild variant="secondary" className="mt-4">
          <Link to="/">Till startsidan</Link>
        </Button>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-4 pb-24 pt-8">
      <BackLink fallback="/">Tillbaka</BackLink>
      <h1 className="mt-3 font-display text-4xl font-bold">Mina lag</h1>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button className="mt-5 w-full">
            <Plus className="size-4" /> Nytt lag
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nytt lag</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="club">Klubb</Label>
              <select
                id="club"
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={clubId ?? ""}
                onChange={(event) => setClubId(event.target.value || null)}
              >
                <option value="">Skapa ny klubb…</option>
                {clubs.data?.map((club) => (
                  <option key={club.id} value={club.id}>
                    {club.name}
                  </option>
                ))}
              </select>
              {!clubId && (
                <Input
                  placeholder="Klubbens namn"
                  value={clubName}
                  onChange={(event) => setClubName(event.target.value)}
                />
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="team-name">Lagnamn</Label>
              <Input
                id="team-name"
                placeholder="T.ex. PF-18 FO"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="age">Åldersgrupp</Label>
              <Input
                id="age"
                placeholder="T.ex. P14 eller 2012"
                value={ageGroup}
                onChange={(event) => setAgeGroup(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ground">Hemmaplan</Label>
              <Input
                id="ground"
                placeholder="T.ex. Långholmens IP"
                value={homeGround}
                onChange={(event) => setHomeGround(event.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Föreslås automatiskt som plats för träningar och matcher.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {Object.entries(TEAM_GENDER_LABELS).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setGender(value)}
                  className={`rounded-lg border px-2 py-2 text-sm ${
                    gender === value
                      ? "border-primary bg-primary/15"
                      : "border-border text-muted-foreground"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => create.mutate()} disabled={create.isPending}>
              Skapa lag
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <section className="mt-6 space-y-3">
        {teams.isLoading && <p className="text-sm text-muted-foreground">Laddar lag…</p>}
        {archivedCount > 0 && (
          <button
            type="button"
            onClick={() => setShowArchived((value) => !value)}
            className="text-xs text-muted-foreground underline"
          >
            {showArchived ? "Dölj arkiverade lag" : `Visa arkiverade lag (${archivedCount})`}
          </button>
        )}
        {visibleTeams.length === 0 && !teams.isLoading && (
          <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            Inga lag än. Skapa ditt första lag!
          </p>
        )}
        {visibleTeams.map((team) => (
          <Link
            key={team.id}
            to="/team/$teamId"
            params={{ teamId: team.id }}
            className="flex items-center gap-3 rounded-xl border border-border bg-card p-3"
          >
            <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-secondary">
              {team.photoUrl ? (
                <img src={team.photoUrl} alt={team.name} className="size-full object-cover" />
              ) : (
                <Shield className="size-5 text-muted-foreground" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="truncate font-display text-xl font-semibold">
                {team.name}
                {(pendingByTeam[team.id] ?? 0) > 0 && (
                  <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-destructive px-2 py-0.5 align-middle text-[10px] font-bold text-destructive-foreground">
                    {pendingByTeam[team.id]} vill gå med
                  </span>
                )}
                {team.archived_at && (
                  <span className="ml-2 rounded bg-secondary px-1.5 py-0.5 align-middle text-[10px] text-muted-foreground">
                    Arkiverat
                  </span>
                )}
              </h2>
              <p className="text-xs text-muted-foreground">
                {[team.club?.name, team.age_group, TEAM_GENDER_LABELS[team.gender]]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
            <span className="rounded-md bg-secondary px-2 py-1 font-mono text-xs">
              {team.join_code}
            </span>
          </Link>
        ))}
      </section>

      <p className="mt-6 flex items-center gap-2 text-xs text-muted-foreground">
        <Users className="size-4" /> Dela lagkoden med spelarna – de ansöker med koden och du
        godkänner dem i truppen.
      </p>
    </main>
  );
}
