import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Plus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createTeam, joinTeamWithCode } from "@/lib/teams";
import { GAME_FORMATS, type GameFormatId } from "@/lib/game-format";
import { TEAM_CODE_LENGTH, normalizeTeamCode } from "@/lib/account-setup";
import { friendlyError } from "@/lib/user-errors";

/**
 * Första sidan för en tränare utan lag: skapa laget direkt, eller gå med i ett
 * befintligt lag med tränarkoden. Inga andra val innan tränaren har ett lag.
 */
export function CoachStart({ userId }: { userId: string }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<"create" | "join">("create");

  const [name, setName] = useState("");
  const [clubName, setClubName] = useState("");
  const [ageGroup, setAgeGroup] = useState("");
  const [gameFormat, setGameFormat] = useState<GameFormatId>("5v5");
  const [gender, setGender] = useState("mixed");
  const [code, setCode] = useState("");

  const create = useMutation({
    mutationFn: () => {
      if (!name.trim()) throw new Error("Ange ett lagnamn");
      return createTeam({
        userId,
        name,
        clubId: null,
        clubName,
        ageGroup,
        gender,
        gameFormat,
        homeGround: null,
      });
    },
    onSuccess: async (id) => {
      await queryClient.invalidateQueries();
      navigate({ to: "/team/$teamId/kom-igang", params: { teamId: id } });
    },
    onError: (error) => toast.error(friendlyError(error, "Kunde inte skapa laget")),
  });

  const join = useMutation({
    mutationFn: () => {
      const clean = normalizeTeamCode(code);
      if (clean.length !== TEAM_CODE_LENGTH) {
        throw new Error("Tränarkoden har sex tecken. Kontrollera koden med laget.");
      }
      return joinTeamWithCode(clean, "coach");
    },
    onSuccess: async (result) => {
      await queryClient.invalidateQueries();
      toast.success(
        result.status === "approved"
          ? `Du är med i ${result.teamName}.`
          : `Ansökan skickad till ${result.teamName}. En ledare godkänner dig inom kort.`,
      );
      navigate({ to: "/teams" });
    },
    onError: (error) => toast.error(friendlyError(error, "Kunde inte gå med i laget")),
  });

  const busy = create.isPending || join.isPending;

  return (
    <main className="mx-auto max-w-md px-4 pb-24 pt-10">
      <p className="font-display text-xs tracking-[0.3em] text-primary">Kom igång</p>
      <h1 className="mt-2 font-display text-4xl font-bold">Ditt första lag</h1>
      <p className="mt-3 text-sm text-muted-foreground">
        Skapa laget du är tränare för, eller gå med i ett lag som redan finns med tränarkoden du
        fått.
      </p>

      <div className="mt-6 grid grid-cols-2 gap-2">
        <Button
          variant={mode === "create" ? "default" : "outline"}
          className="min-h-11"
          onClick={() => setMode("create")}
        >
          <Plus className="size-4" aria-hidden /> Skapa lag
        </Button>
        <Button
          variant={mode === "join" ? "default" : "outline"}
          className="min-h-11"
          onClick={() => setMode("join")}
        >
          <Users className="size-4" aria-hidden /> Tränarkod
        </Button>
      </div>

      {mode === "create" ? (
        <section className="mt-5 space-y-3 rounded-xl border border-border bg-card p-4">
          <div className="space-y-1.5">
            <Label htmlFor="start-club">Klubb</Label>
            <Input
              id="start-club"
              value={clubName}
              onChange={(event) => setClubName(event.target.value)}
              placeholder="Till exempel Höga Liv IF"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="start-name">Lagnamn</Label>
            <Input
              id="start-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Till exempel P2015"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="start-age">Åldersgrupp</Label>
            <Input
              id="start-age"
              value={ageGroup}
              onChange={(event) => setAgeGroup(event.target.value)}
              placeholder="Till exempel P2015"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="start-format">Spelform</Label>
            <select
              id="start-format"
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={gameFormat}
              onChange={(event) => setGameFormat(event.target.value as GameFormatId)}
            >
              {GAME_FORMATS.map((format) => (
                <option key={format.id} value={format.id}>
                  {format.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="start-gender">Kön</Label>
            <select
              id="start-gender"
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={gender}
              onChange={(event) => setGender(event.target.value)}
            >
              <option value="mixed">Blandat</option>
              <option value="boys">Pojkar</option>
              <option value="girls">Flickor</option>
            </select>
          </div>
          <Button className="w-full" disabled={busy} onClick={() => create.mutate()}>
            {create.isPending ? "Skapar laget…" : "Skapa laget"}
          </Button>
        </section>
      ) : (
        <section className="mt-5 space-y-3 rounded-xl border border-border bg-card p-4">
          <div className="space-y-1.5">
            <Label htmlFor="start-code">Tränarkod</Label>
            <Input
              id="start-code"
              value={code}
              autoCapitalize="characters"
              onChange={(event) => setCode(normalizeTeamCode(event.target.value))}
              placeholder="Sex tecken"
            />
            <p className="text-xs text-muted-foreground">
              Koden får du av en tränare i laget. Lagkoden fungerar inte här.
            </p>
          </div>
          <Button className="w-full" disabled={busy} onClick={() => join.mutate()}>
            {join.isPending ? "Skickar…" : "Gå med i laget"}
          </Button>
        </section>
      )}
    </main>
  );
}
