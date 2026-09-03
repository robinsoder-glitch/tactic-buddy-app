import { useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Camera, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { deletePlayer, fetchPlayers, savePlayer, uploadPlayerPhoto } from "@/lib/db";
import { initials } from "@/lib/tactics";
import type { PlayerWithPhoto } from "@/lib/tactics";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ConfirmDelete";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/bank")({
  head: () => ({
    meta: [
      { title: "Spelarbank – Fotbollsrummet" },
      {
        name: "description",
        content: "Hantera din spelarbank med namn, tröjnummer, lagfärg och bilder på spelarna.",
      },
      { property: "og:title", content: "Spelarbank – Fotbollsrummet" },
      { property: "og:description", content: "Namn, nummer och bilder på dina spelare." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: BankPage,
});

type EditState = {
  id?: string;
  name: string;
  number: string;
  team: "home" | "away";
  photo_path: string | null;
  photoUrl: string | null;
};

const emptyPlayer: EditState = {
  name: "",
  number: "",
  team: "home",
  photo_path: null,
  photoUrl: null,
};

function BankPage() {
  const { confirm, confirmDialog } = useConfirm();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<EditState | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const players = useQuery({ queryKey: ["players"], queryFn: fetchPlayers });

  const save = useMutation({
    mutationFn: async (state: EditState) => {
      if (!user) throw new Error("Inte inloggad");
      if (!state.name.trim()) throw new Error("Ange ett namn");
      return savePlayer({
        id: state.id,
        userId: user.id,
        name: state.name.trim(),
        number: state.number === "" ? null : Number(state.number),
        team: state.team,
        photo_path: state.photo_path,
      });
    },
    onSuccess: () => {
      setEditing(null);
      queryClient.invalidateQueries({ queryKey: ["players"] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Kunde inte spara"),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deletePlayer(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["players"] }),
  });

  async function handleFile(file: File) {
    if (!user || !editing) return;
    setUploading(true);
    try {
      const path = await uploadPlayerPhoto(user.id, file);
      setEditing({ ...editing, photo_path: path, photoUrl: URL.createObjectURL(file) });
    } catch {
      toast.error("Kunde inte ladda upp bilden");
    } finally {
      setUploading(false);
    }
  }

  const filtered = (players.data ?? []).filter((player) =>
    player.name.toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <main className="mx-auto max-w-2xl px-4 pb-24 pt-6">
      <header className="flex items-center gap-2">
        <Button asChild variant="ghost" size="icon" aria-label="Tillbaka">
          <Link to="/">
            <ArrowLeft className="size-5" />
          </Link>
        </Button>
        <h1 className="font-display text-3xl font-bold">Spelarbank</h1>
      </header>

      <p className="mt-2 text-sm text-muted-foreground">
        Spelarbanken är dina egna figurer för taktiktavlan – den är skild från lagets trupp.
        Trupplistan med registrerade spelare, närvaro och statistik finns under Mina lag.
      </p>

      <div className="mt-4 flex gap-2">
        <Input
          placeholder="Sök spelare"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <Button onClick={() => setEditing({ ...emptyPlayer })}>
          <Plus className="size-4" /> Ny
        </Button>
      </div>

      <section className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {filtered.map((player) => (
          <PlayerCard
            key={player.id}
            player={player}
            onEdit={() =>
              setEditing({
                id: player.id,
                name: player.name,
                number: player.number?.toString() ?? "",
                team: player.team === "away" ? "away" : "home",
                photo_path: player.photo_path,
                photoUrl: player.photoUrl,
              })
            }
            onDelete={() => {
              void confirm({
                title: "Radera spelare",
                description: `${player.name} tas bort från din spelarbank permanent.`,
              }).then((ok) => ok && remove.mutate(player.id));
            }}
          />
        ))}
        {players.data?.length === 0 && (
          <p className="col-span-full rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            Banken är tom. Lägg till din första spelare så kan du dra ut den på taktiktavlan.
          </p>
        )}
      </section>

      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Redigera spelare" : "Ny spelare"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="grid size-20 place-items-center overflow-hidden rounded-full border border-border bg-secondary"
                >
                  {editing.photoUrl ? (
                    <img
                      src={editing.photoUrl}
                      alt={editing.name}
                      className="size-full object-cover"
                    />
                  ) : (
                    <Camera className="size-6 text-muted-foreground" />
                  )}
                </button>
                <p className="text-xs text-muted-foreground">
                  {uploading ? "Laddar upp…" : "Tryck för att välja eller ta ett foto"}
                </p>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void handleFile(file);
                    event.target.value = "";
                  }}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="player-name">Namn</Label>
                <Input
                  id="player-name"
                  value={editing.name}
                  onChange={(event) => setEditing({ ...editing, name: event.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="player-number">Nummer</Label>
                  <Input
                    id="player-number"
                    inputMode="numeric"
                    value={editing.number}
                    onChange={(event) =>
                      setEditing({ ...editing, number: event.target.value.replace(/\D/g, "") })
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Symbolfärg</Label>
                  <div className="flex gap-2">
                    {(["home", "away"] as const).map((team) => (
                      <button
                        key={team}
                        type="button"
                        aria-pressed={editing.team === team}
                        onClick={() => setEditing({ ...editing, team })}
                        className={`flex-1 rounded-md border px-2 py-2 text-sm ${
                          editing.team === team
                            ? "border-primary bg-primary/15"
                            : "border-border text-muted-foreground"
                        }`}
                      >
                        {team === "home" ? "Eget lag" : "Motståndare"}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Styr bara färgen på symbolen på taktiktavlan.
                  </p>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => editing && save.mutate(editing)} disabled={save.isPending}>
              Spara
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {confirmDialog}
    </main>
  );
}

function PlayerCard({
  player,
  onEdit,
  onDelete,
}: {
  player: PlayerWithPhoto;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <article className="relative rounded-xl border border-border bg-card p-3 text-center">
      <button type="button" onClick={onEdit} className="w-full">
        <div
          className="mx-auto grid size-16 place-items-center overflow-hidden rounded-full"
          style={{
            background:
              player.team === "away" ? "var(--color-team-away)" : "var(--color-team-home)",
            color:
              player.team === "away"
                ? "var(--color-team-away-foreground)"
                : "var(--color-team-home-foreground)",
          }}
        >
          {player.photoUrl ? (
            <img src={player.photoUrl} alt={player.name} className="size-full object-cover" />
          ) : (
            <span className="font-display text-xl font-bold">
              {player.number ?? initials(player.name)}
            </span>
          )}
        </div>
        <p className="mt-2 truncate text-sm font-medium">{player.name}</p>
        <p className="text-xs text-muted-foreground">
          {player.number != null ? `#${player.number} · ` : ""}
          {player.team === "away" ? "Motståndare" : "Eget lag"}
        </p>
      </button>
      <button
        type="button"
        aria-label={`Ta bort ${player.name}`}
        onClick={onDelete}
        className="absolute right-1 top-1 rounded-md p-1 text-muted-foreground hover:text-destructive"
      >
        <Trash2 className="size-4" />
      </button>
    </article>
  );
}
