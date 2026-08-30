import { useState } from "react";
import { createFileRoute, useParams } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, Plus, Trash2, UserRound, X } from "lucide-react";
import { useTeamRole } from "@/hooks/useTeamRole";
import {
  deleteTeamPlayer,
  fetchTeamMembers,
  fetchTeamPlayers,
  GENDER_LABELS,
  removeMember,
  saveTeamPlayer,
  setMemberStatus,
  uploadTeamMedia,
  type TeamPlayer,
} from "@/lib/teams";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useConfirm } from "@/components/ConfirmDelete";

export const Route = createFileRoute("/_authenticated/team/$teamId/")({
  component: SquadPage,
});

function SquadPage() {
  const { confirm, confirmDialog } = useConfirm();
  const { teamId } = useParams({ from: "/_authenticated/team/$teamId/" });
  const { isCoach, userId } = useTeamRole(teamId);
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<TeamPlayer | null>(null);
  const [name, setName] = useState("");
  const [number, setNumber] = useState("");
  const [birth, setBirth] = useState("");
  const [gender, setGender] = useState<string>("none");
  const [isGk, setIsGk] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const players = useQuery({ queryKey: ["team-players", teamId], queryFn: () => fetchTeamPlayers(teamId) });
  const members = useQuery({
    queryKey: ["team-members", teamId],
    queryFn: () => fetchTeamMembers(teamId),
    enabled: isCoach,
  });

  const pending = (members.data ?? []).filter((member) => member.status === "pending");

  function openNew() {
    setEditing(null);
    setName("");
    setNumber("");
    setBirth("");
    setGender("none");
    setIsGk(false);
    setFile(null);
    setOpen(true);
  }

  function openEdit(player: TeamPlayer) {
    setEditing(player);
    setName(player.name);
    setNumber(player.number?.toString() ?? "");
    setBirth(player.birth_date ?? "");
    setGender(player.gender ?? "none");
    setIsGk(player.is_goalkeeper);
    setFile(null);
    setOpen(true);
  }

  async function save() {
    if (!userId) return;
    if (!name.trim()) {
      toast.error("Ange ett namn");
      return;
    }
    setBusy(true);
    try {
      const photo_path = file ? await uploadTeamMedia(teamId, file, "players") : (editing?.photo_path ?? null);
      await saveTeamPlayer({
        id: editing?.id,
        teamId,
        userId,
        name: name.trim(),
        number: number ? Number(number) : null,
        birth_date: birth || null,
        gender,
        is_goalkeeper: isGk,
        photo_path,
      });
      await queryClient.invalidateQueries({ queryKey: ["team-players", teamId] });
      setOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Kunde inte spara spelaren");
    } finally {
      setBusy(false);
    }
  }

  const approve = useMutation({
    mutationFn: (id: string) => setMemberStatus(id, "approved"),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["team-members", teamId] }),
  });
  const reject = useMutation({
    mutationFn: (id: string) => removeMember(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["team-members", teamId] }),
  });
  const remove = useMutation({
    mutationFn: (id: string) => deleteTeamPlayer(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["team-players", teamId] }),
  });

  return (
    <section>
      {isCoach && pending.length > 0 && (
        <div className="mb-5 rounded-xl border border-primary/40 bg-primary/10 p-4">
          <h2 className="font-display text-lg font-semibold uppercase">Ansökningar</h2>
          <ul className="mt-3 space-y-2">
            {pending.map((member) => (
              <li key={member.id} className="flex items-center gap-2 text-sm">
                <span className="flex-1 truncate">{member.displayName ?? "Ny spelare"}</span>
                <Button size="sm" onClick={() => approve.mutate(member.id)}>
                  <Check className="size-4" />
                </Button>
                <Button size="sm" variant="secondary" onClick={() => reject.mutate(member.id)}>
                  <X className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex items-center justify-between">
        <h2 className="font-display text-2xl font-bold uppercase">Truppen</h2>
        {isCoach && (
          <Button size="sm" onClick={openNew}>
            <Plus className="size-4" /> Spelare
          </Button>
        )}
      </div>

      <ul className="mt-4 divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
        {players.data?.length === 0 && (
          <li className="p-6 text-center text-sm text-muted-foreground">Inga spelare i truppen än.</li>
        )}
        {players.data?.map((player) => (
          <li key={player.id} className="flex items-center gap-3 p-3">
            <div className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-secondary">
              {player.photoUrl ? (
                <img src={player.photoUrl} alt={player.name} className="size-full object-cover" />
              ) : (
                <UserRound className="size-5 text-muted-foreground" />
              )}
            </div>
            <button
              type="button"
              className="min-w-0 flex-1 text-left"
              onClick={() => isCoach && openEdit(player)}
            >
              <p className="truncate font-medium">
                {player.number != null && <span className="mr-2 text-primary">#{player.number}</span>}
                {player.name}
              </p>
              <p className="text-xs text-muted-foreground">
                {[
                  player.is_goalkeeper ? "Målvakt" : null,
                  player.gender ? GENDER_LABELS[player.gender] : null,
                  player.birth_date,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </button>
            {isCoach && (
              <Button size="icon" variant="ghost" onClick={() => {
                  void confirm({
                    title: "Radera spelare",
                    description: `${player.name} tas bort från lagets trupp permanent.`,
                  }).then((ok) => ok && remove.mutate(player.id));
                }}>
                <Trash2 className="size-4" />
              </Button>
            )}
          </li>
        ))}
      </ul>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Redigera spelare" : "Ny spelare"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="p-name">Namn</Label>
              <Input id="p-name" value={name} onChange={(event) => setName(event.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="p-number">Nummer</Label>
                <Input id="p-number" type="number" value={number} onChange={(event) => setNumber(event.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="p-birth">Födelsedatum</Label>
                <Input id="p-birth" type="date" value={birth} onChange={(event) => setBirth(event.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {Object.entries(GENDER_LABELS).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setGender(value)}
                  className={`rounded-lg border px-2 py-2 text-xs ${
                    gender === value ? "border-primary bg-primary/15" : "border-border text-muted-foreground"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <label className="flex items-center gap-3 rounded-lg border border-border p-3 text-sm">
              <input
                type="checkbox"
                checked={isGk}
                onChange={(event) => setIsGk(event.target.checked)}
                className="size-4 accent-[var(--color-primary)]"
              />
              Målvakt (får egen tröjfärg på taktiktavlan)
            </label>
            <div className="space-y-1.5">
              <Label htmlFor="p-photo">Bild</Label>
              <Input
                id="p-photo"
                type="file"
                accept="image/*"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={save} disabled={busy}>
              Spara
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
  {confirmDialog}
    </section>
  );
}
