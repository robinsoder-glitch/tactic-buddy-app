import { useState } from "react";
import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, Pencil, Plus, Trash2, UserRound, X } from "lucide-react";
import { useTeamRole } from "@/hooks/useTeamRole";
import {
  deleteTeamPlayer,
  fetchTeamMembers,
  fetchTeamPlayers,
  GENDER_LABELS,
  removeMember,
  findSimilarPlayers,
  saveTeamPlayer,
  approveTeamJoinRequest,
  uploadTeamMedia,
  type TeamPlayer,
} from "@/lib/teams";
import {
  GENDER_OPTIONS,
  PHOTO_CONSENT_TEXT,
  birthLabel,
  birthYearOf,
  hasExactBirthDate,
  toStoredBirth,
} from "@/lib/player-privacy";
import { friendlyError } from "@/lib/user-errors";
import { joinSourceLabel } from "@/lib/invite-links";
import { approvalHelpText, needsPlayerCard, playerOptionLabel } from "@/lib/join-approval";
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
  const [birthYear, setBirthYear] = useState("");
  const [useExactDate, setUseExactDate] = useState(false);
  const [gender, setGender] = useState<string>("none");
  const [isGk, setIsGk] = useState(false);
  const [guardians, setGuardians] = useState([
    { name: "", phone: "", email: "" },
    { name: "", phone: "", email: "" },
  ]);
  const [hasAllergy, setHasAllergy] = useState(false);
  const [allergyNote, setAllergyNote] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  function setGuardian(index: number, key: "name" | "phone" | "email", value: string) {
    setGuardians((prev) => prev.map((item, i) => (i === index ? { ...item, [key]: value } : item)));
  }

  const players = useQuery({
    queryKey: ["team-players", teamId],
    queryFn: () => fetchTeamPlayers(teamId),
  });
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
    setBirthYear("");
    setUseExactDate(false);
    setGender("none");
    setIsGk(false);
    setGuardians([
      { name: "", phone: "", email: "" },
      { name: "", phone: "", email: "" },
    ]);
    setHasAllergy(false);
    setAllergyNote("");
    setFile(null);
    setOpen(true);
  }

  function openEdit(player: TeamPlayer) {
    setEditing(player);
    setName(player.name);
    setNumber(player.number?.toString() ?? "");
    setBirth(player.birth_date ?? "");
    setBirthYear(birthYearOf(player.birth_date));
    setUseExactDate(hasExactBirthDate(player.birth_date));
    setGender(player.gender ?? "none");
    setIsGk(player.is_goalkeeper);
    setGuardians([
      {
        name: player.guardian1_name ?? "",
        phone: player.guardian1_phone ?? "",
        email: player.guardian1_email ?? "",
      },
      {
        name: player.guardian2_name ?? "",
        phone: player.guardian2_phone ?? "",
        email: player.guardian2_email ?? "",
      },
    ]);
    setHasAllergy(player.has_allergy ?? false);
    setAllergyNote(player.allergy_note ?? "");
    setFile(null);
    setOpen(true);
  }

  async function save(force = false) {
    if (!userId) return;
    if (!name.trim()) {
      toast.error("Ange ett namn");
      return;
    }
    if (!force) {
      const similar = findSimilarPlayers(name, players.data ?? [], editing?.id);
      if (similar.length) {
        setDuplicates(similar.map((player) => ({ id: player.id, name: player.name })));
        return;
      }
    }
    setBusy(true);
    try {
      const photo_path = file
        ? await uploadTeamMedia(teamId, file, "players")
        : (editing?.photo_path ?? null);
      const clean = (value: string) => (value.trim() ? value.trim() : null);
      await saveTeamPlayer({
        id: editing?.id,
        teamId,
        userId,
        name: name.trim(),
        number: number ? Number(number) : null,
        birth_date: toStoredBirth({ year: birthYear, exactDate: birth, useExact: useExactDate }),
        gender,
        is_goalkeeper: isGk,
        photo_path,
        guardian1_name: clean(guardians[0]!.name),
        guardian1_phone: clean(guardians[0]!.phone),
        guardian1_email: clean(guardians[0]!.email),
        guardian2_name: clean(guardians[1]!.name),
        guardian2_phone: clean(guardians[1]!.phone),
        guardian2_email: clean(guardians[1]!.email),
        has_allergy: hasAllergy,
        allergy_note: hasAllergy ? clean(allergyNote) : null,
      });

      await queryClient.invalidateQueries({ queryKey: ["team-players", teamId] });
      setOpen(false);
    } catch (error) {
      toast.error(friendlyError(error, "Kunde inte spara spelaren"));
    } finally {
      setBusy(false);
    }
  }

  const [duplicates, setDuplicates] = useState<{ id: string; name: string }[]>([]);

  const [approving, setApproving] = useState<{ id: string; role: string; who: string } | null>(
    null,
  );
  const [chosenPlayer, setChosenPlayer] = useState("");

  const approve = useMutation({
    mutationFn: (input: { id: string; playerId: string | null }) =>
      approveTeamJoinRequest(input.id, input.playerId),
    onSuccess: () => {
      toast.success("Ansökan godkänd.");
      setApproving(null);
      setChosenPlayer("");
      queryClient.invalidateQueries({ queryKey: ["team-members", teamId] });
      queryClient.invalidateQueries({ queryKey: ["team-players", teamId] });
    },
    onError: (error: Error) => toast.error(friendlyError(error, "Kunde inte godkänna ansökan")),
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
          <h2 className="font-display text-lg font-semibold">Ansökningar ({pending.length})</h2>
          <ul className="mt-3 space-y-2">
            {pending.map((member) => {
              const who =
                member.displayName ??
                (member.role === "coach"
                  ? "Ny ledare"
                  : member.role === "guardian"
                    ? "Ny vårdnadshavare"
                    : "Ny spelare");
              const roleText =
                member.role === "coach"
                  ? "vill bli ledare"
                  : member.role === "guardian"
                    ? "vårdnadshavare"
                    : "vill bli spelare";
              return (
                <li key={member.id} className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="min-w-0 flex-1">
                    <span className="font-medium">{who}</span>
                    <span className="block text-xs text-muted-foreground">
                      {roleText}
                      {member.role === "guardian" && member.guardianForName
                        ? ` till ${member.guardianForName}`
                        : ""}
                      {" · via "}
                      {joinSourceLabel(member.joined_via)}
                      {" · "}
                      {new Date(member.created_at).toLocaleDateString("sv-SE")}
                    </span>
                  </span>
                  <Button
                    size="sm"
                    aria-label={`Godkänn ${who}`}
                    disabled={approve.isPending}
                    onClick={() => {
                      if (needsPlayerCard(member.role)) {
                        setChosenPlayer("");
                        setApproving({ id: member.id, role: member.role, who });
                        return;
                      }
                      void confirm({
                        title: "Godkänn ansökan",
                        description: `${who} blir ledare i laget.`,
                        confirmLabel: "Godkänn",
                      }).then((ok) => ok && approve.mutate({ id: member.id, playerId: null }));
                    }}
                  >
                    <Check className="size-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    aria-label={`Neka ${who}`}
                    onClick={() => {
                      void confirm({
                        title: "Neka ansökan",
                        description: `${who} läggs inte till i laget.`,
                        confirmLabel: "Neka",
                      }).then((ok) => ok && reject.mutate(member.id));
                    }}
                  >
                    <X className="size-4" />
                  </Button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <div className="flex items-center justify-between">
        <h2 className="font-display text-2xl font-bold">Truppen</h2>
        {isCoach && (
          <Button size="sm" onClick={openNew}>
            <Plus className="size-4" /> Spelare
          </Button>
        )}
      </div>

      <ul className="mt-4 divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
        {players.data?.length === 0 && (
          <li className="p-6 text-center text-sm text-muted-foreground">
            Inga spelare i truppen än.
          </li>
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
            <Link
              to="/team/$teamId/player/$playerId"
              params={{ teamId, playerId: player.id }}
              className="min-w-0 flex-1 text-left"
            >
              <p className="truncate font-medium">
                {player.number != null && (
                  <span className="mr-2 text-primary">#{player.number}</span>
                )}
                {player.name}
              </p>
              <p className="text-xs text-muted-foreground">
                {[
                  player.is_goalkeeper ? "Målvakt" : null,
                  player.gender ? GENDER_LABELS[player.gender] : null,
                  birthLabel(player.birth_date),
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </Link>
            {isCoach && (
              <Button
                size="icon"
                variant="ghost"
                aria-label="Redigera spelare"
                onClick={() => openEdit(player)}
              >
                <Pencil className="size-4" />
              </Button>
            )}
            {isCoach && (
              <Button
                size="icon"
                variant="ghost"
                aria-label="Radera spelare"
                onClick={() => {
                  void confirm({
                    title: "Radera spelare",
                    description: `${player.name} tas bort från lagets trupp permanent.`,
                  }).then((ok) => ok && remove.mutate(player.id));
                }}
              >
                <Trash2 className="size-4" />
              </Button>
            )}
          </li>
        ))}
      </ul>

      <Dialog open={duplicates.length > 0} onOpenChange={(value) => !value && setDuplicates([])}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Det finns redan en spelare med samma namn</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {duplicates.map((player) => player.name).join(", ")} finns redan i truppen. Två spelare
            får heta likadant – välj hur du vill gå vidare.
          </p>
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            {duplicates[0] && (
              <Button asChild variant="outline">
                <Link
                  to="/team/$teamId/player/$playerId"
                  params={{ teamId, playerId: duplicates[0].id }}
                  onClick={() => {
                    setDuplicates([]);
                    setOpen(false);
                  }}
                >
                  Visa befintlig spelare
                </Link>
              </Button>
            )}
            <Button variant="ghost" onClick={() => setDuplicates([])}>
              Avbryt
            </Button>
            <Button
              onClick={() => {
                setDuplicates([]);
                void save(true);
              }}
            >
              Skapa ändå
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
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
                <Label htmlFor="p-number">Nummer (frivilligt)</Label>
                <Input
                  id="p-number"
                  type="number"
                  value={number}
                  onChange={(event) => setNumber(event.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="p-year">Födelseår (frivilligt)</Label>
                <Input
                  id="p-year"
                  type="number"
                  inputMode="numeric"
                  placeholder="2018"
                  value={birthYear}
                  onChange={(event) => setBirthYear(event.target.value)}
                />
              </div>
            </div>
            <label className="flex items-center gap-3 rounded-lg border border-border p-3 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={useExactDate}
                onChange={(event) => setUseExactDate(event.target.checked)}
                className="size-4 accent-[var(--color-primary)]"
              />
              Ange exakt födelsedatum (behövs sällan)
            </label>
            {useExactDate && (
              <div className="space-y-1.5">
                <Label htmlFor="p-birth">Födelsedatum</Label>
                <Input
                  id="p-birth"
                  type="date"
                  value={birth}
                  onChange={(event) => setBirth(event.target.value)}
                />
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Kön (frivilligt)</Label>
              <div className="grid grid-cols-3 gap-2">
                {GENDER_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setGender(option.value)}
                    className={`rounded-lg border px-2 py-2 text-xs ${
                      gender === option.value
                        ? "border-primary bg-primary/15"
                        : "border-border text-muted-foreground"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
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

            <fieldset className="space-y-3 rounded-lg border border-border p-3">
              <legend className="px-1 text-sm font-semibold">Vårdnadshavare (frivilligt)</legend>
              {guardians.map((guardian, index) => (
                <div key={index} className="space-y-1.5">
                  <Label htmlFor={`p-g${index}-name`}>Vårdnadshavare {index + 1}</Label>
                  <Input
                    id={`p-g${index}-name`}
                    placeholder="Namn"
                    value={guardian.name}
                    onChange={(event) => setGuardian(index, "name", event.target.value)}
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      type="tel"
                      aria-label={`Mobil vårdnadshavare ${index + 1}`}
                      placeholder="Mobil"
                      value={guardian.phone}
                      onChange={(event) => setGuardian(index, "phone", event.target.value)}
                    />
                    <Input
                      type="email"
                      aria-label={`E-post vårdnadshavare ${index + 1}`}
                      placeholder="E-post"
                      value={guardian.email}
                      onChange={(event) => setGuardian(index, "email", event.target.value)}
                    />
                  </div>
                </div>
              ))}
            </fieldset>

            <div className="space-y-2 rounded-lg border border-border p-3">
              <label className="flex items-center gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={hasAllergy}
                  onChange={(event) => setHasAllergy(event.target.checked)}
                  className="size-4 accent-[var(--color-primary)]"
                />
                Allergi finns
              </label>
              {hasAllergy && (
                <Input
                  aria-label="Vilken allergi"
                  placeholder="Vilken allergi? (frivilligt)"
                  value={allergyNote}
                  onChange={(event) => setAllergyNote(event.target.value)}
                />
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="p-photo">Bild (frivilligt)</Label>
              <Input
                id="p-photo"
                type="file"
                accept="image/*"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              />
              <p className="text-xs text-muted-foreground">{PHOTO_CONSENT_TEXT}</p>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => void save()} disabled={busy}>
              Spara
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={approving !== null}
        onOpenChange={(next) => {
          if (!next) setApproving(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Godkänn {approving?.who}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {approvalHelpText(approving?.role, players.data ?? [])}
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="approve-player">Spelarkort</Label>
            <select
              id="approve-player"
              value={chosenPlayer}
              onChange={(event) => setChosenPlayer(event.target.value)}
              className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">Välj spelare</option>
              {(players.data ?? []).map((player) => (
                <option key={player.id} value={player.id}>
                  {playerOptionLabel(player)}
                </option>
              ))}
            </select>
            {(players.data ?? []).length === 0 && (
              <p className="text-sm text-destructive">
                Truppen är tom. Lägg till spelaren i truppen först, sedan kan du godkänna ansökan.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button
              disabled={!chosenPlayer || approve.isPending}
              onClick={() =>
                approving && approve.mutate({ id: approving.id, playerId: chosenPlayer })
              }
            >
              Godkänn
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {confirmDialog}
    </section>
  );
}
