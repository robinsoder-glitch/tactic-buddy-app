import { useEffect, useState } from "react";
import { createFileRoute, useParams } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Copy } from "lucide-react";
import { useTeamRole } from "@/hooks/useTeamRole";
import { uploadPlayerPhoto } from "@/lib/db";
import { fetchTeam, TEAM_GENDER_LABELS, updateTeam } from "@/lib/teams";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/team/$teamId/about")({
  component: AboutPage,
});

function AboutPage() {
  const { teamId } = useParams({ from: "/_authenticated/team/$teamId/about" });
  const { isCoach, userId } = useTeamRole(teamId);
  const queryClient = useQueryClient();
  const team = useQuery({ queryKey: ["team", teamId], queryFn: () => fetchTeam(teamId) });

  const [about, setAbout] = useState("");
  const [name, setName] = useState("");
  const [ageGroup, setAgeGroup] = useState("");
  const [gender, setGender] = useState("mixed");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!team.data) return;
    setAbout(team.data.about ?? "");
    setName(team.data.name);
    setAgeGroup(team.data.age_group ?? "");
    setGender(team.data.gender);
  }, [team.data]);

  async function save(file?: File | null) {
    setBusy(true);
    try {
      const photo_path = file && userId ? await uploadPlayerPhoto(userId, file) : (team.data?.photo_path ?? null);
      await updateTeam(teamId, { name, age_group: ageGroup || null, gender, about: about || null, photo_path });
      await queryClient.invalidateQueries({ queryKey: ["team", teamId] });
      await queryClient.invalidateQueries({ queryKey: ["teams"] });
      toast.success("Sparat");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Kunde inte spara");
    } finally {
      setBusy(false);
    }
  }

  if (!isCoach) {
    return (
      <section className="space-y-3">
        <h2 className="font-display text-2xl font-bold uppercase">Om laget</h2>
        <p className="whitespace-pre-wrap text-sm text-muted-foreground">
          {team.data?.about || "Tränaren har inte lagt till någon beskrivning än."}
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <h2 className="font-display text-2xl font-bold uppercase">Om laget</h2>

      <div className="rounded-xl border border-border bg-card p-4">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Lagkod för spelare</p>
        <div className="mt-1 flex items-center gap-3">
          <span className="font-mono text-2xl tracking-widest">{team.data?.join_code}</span>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              navigator.clipboard.writeText(team.data?.join_code ?? "");
              toast.success("Kod kopierad");
            }}
          >
            <Copy className="size-4" /> Kopiera
          </Button>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="t-name">Lagnamn</Label>
        <Input id="t-name" value={name} onChange={(event) => setName(event.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="t-age">Åldersgrupp</Label>
        <Input id="t-age" value={ageGroup} onChange={(event) => setAgeGroup(event.target.value)} />
      </div>
      <div className="grid grid-cols-3 gap-2">
        {Object.entries(TEAM_GENDER_LABELS).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setGender(value)}
            className={`rounded-lg border px-2 py-2 text-sm ${
              gender === value ? "border-primary bg-primary/15" : "border-border text-muted-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="t-about">Beskrivning</Label>
        <Textarea id="t-about" rows={5} value={about} onChange={(event) => setAbout(event.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="t-photo">Lagbild</Label>
        <Input
          id="t-photo"
          type="file"
          accept="image/*"
          onChange={(event) => save(event.target.files?.[0] ?? null)}
        />
      </div>
      <Button onClick={() => save()} disabled={busy}>
        Spara
      </Button>
    </section>
  );
}
