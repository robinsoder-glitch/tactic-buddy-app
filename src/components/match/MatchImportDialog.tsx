import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { invalidateCalendar } from "@/lib/calendar-cache";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { parseMatchSource } from "@/lib/match-import.functions";
import {
  normalizeImportedMatches,
  toIsoStart,
  withoutExisting,
  type ImportedMatch,
} from "@/lib/match-import";
import { saveEvent } from "@/lib/teams";
import { supabase } from "@/integrations/supabase/client";
import { Upload } from "lucide-react";

type Props = {
  teamId: string;
  teamName: string;
  userId: string | null;
  onCreated: () => void;
};

async function readAsBase64(file: File): Promise<string> {
  const buffer = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  for (let index = 0; index < buffer.length; index += 1) {
    binary += String.fromCharCode(buffer[index]!);
  }
  return btoa(binary);
}

export function MatchImportDialog({ teamId, teamName, userId, onCreated }: Props) {
  const parse = useServerFn(parseMatchSource);
  const queryClient = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [rows, setRows] = useState<ImportedMatch[] | null>(null);
  const [chosen, setChosen] = useState<Set<number>>(new Set());
  const [skipped, setSkipped] = useState(0);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setRows(null);
    setChosen(new Set());
    setSkipped(0);
    setError(null);
    setUrl("");
    if (fileInput.current) fileInput.current.value = "";
  }

  async function run(source: { file?: File; url?: string }) {
    setBusy(true);
    setError(null);
    try {
      const payload = {
        fileBase64: source.file ? await readAsBase64(source.file) : null,
        fileMime: source.file?.type ?? null,
        fileName: source.file?.name ?? null,
        url: source.url ?? null,
        teamName,
      };
      const result = await parse({ data: payload });
      const normalized = normalizeImportedMatches(result.matches, { teamName });
      const { data: existing, error: existingError } = await supabase
        .from("events")
        .select("starts_at")
        .eq("team_id", teamId)
        .eq("type", "match");
      // Går dubblettkontrollen inte att göra stoppar vi – annars riskerar
      // tränaren att lägga in samma matcher två gånger.
      if (existingError) {
        throw new Error(
          "Kunde inte kontrollera vilka matcher som redan finns. Försök igen om en stund.",
        );
      }
      const fresh = withoutExisting(normalized, existing ?? []);
      setSkipped(normalized.length - fresh.length);
      setRows(fresh);
      setChosen(new Set(fresh.map((_, index) => index)));
      if (fresh.length === 0) {
        setError(
          normalized.length === 0
            ? "Inga matcher hittades i källan."
            : "Alla matcher fanns redan i kalendern.",
        );
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Kunde inte läsa källan.");
    } finally {
      setBusy(false);
    }
  }

  function update(index: number, patch: Partial<ImportedMatch>) {
    setRows((current) =>
      (current ?? []).map((row, position) => (position === index ? { ...row, ...patch } : row)),
    );
  }

  function toggle(index: number) {
    setChosen((current) => {
      const next = new Set(current);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  async function create() {
    if (!userId || !rows) return;
    const pickedIndexes = rows.map((_, index) => index).filter((index) => chosen.has(index));
    if (pickedIndexes.length === 0) return;
    setSaving(true);
    // Raderna sparas en i taget. Stannar det halvvägs behåller vi de rader som
    // inte kom med, så tränaren kan spara resten utan att skapa dubbletter.
    const savedIndexes = new Set<number>();
    const invalidIndexes = new Set<number>();
    let failure: string | null = null;
    for (const index of pickedIndexes) {
      const row = rows[index]!;
      const startsAt = toIsoStart(row);
      if (!startsAt) {
        invalidIndexes.add(index);
        continue;
      }
      try {
        await saveEvent({
          teamId,
          userId,
          type: "match",
          title: null,
          starts_at: startsAt,
          home_team: row.home_team || null,
          away_team: row.away_team || null,
          location: row.location || null,
          notes: null,
        });
        savedIndexes.add(index);
      } catch (cause) {
        failure = cause instanceof Error ? cause.message : "Kunde inte spara matcherna.";
        break;
      }
    }

    if (savedIndexes.size > 0) await invalidateCalendar(queryClient);
    setSaving(false);

    if (!failure && invalidIndexes.size === 0) {
      toast.success(`${savedIndexes.size} matcher lades till i kalendern.`);
      setOpen(false);
      reset();
      onCreated();
      return;
    }

    // Ta bort det som faktiskt sparades och låt resten ligga kvar i listan.
    const remaining = rows.filter((_, index) => !savedIndexes.has(index));
    const remainingChosen = new Set<number>();
    let position = 0;
    rows.forEach((_, index) => {
      if (savedIndexes.has(index)) return;
      if (chosen.has(index)) remainingChosen.add(position);
      position += 1;
    });
    setRows(remaining);
    setChosen(remainingChosen);
    setError(
      [
        savedIndexes.size > 0 ? `${savedIndexes.size} matcher sparades.` : null,
        invalidIndexes.size > 0
          ? `${invalidIndexes.size} rader har ogiltigt datum eller tid – rätta dem och spara igen.`
          : null,
        failure,
      ]
        .filter(Boolean)
        .join(" "),
    );
    if (savedIndexes.size > 0) onCreated();
    if (failure) toast.error(failure);
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        className="w-full sm:w-auto"
        onClick={() => setOpen(true)}
      >
        <Upload className="mr-2 h-4 w-4" aria-hidden="true" />
        Importera matcher
      </Button>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) reset();
        }}
      >
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Importera matcher</DialogTitle>
            <DialogDescription>
              Ladda upp spelschemat som PDF eller bild, eller klistra in en länk till en öppen sida.
              Inget sparas förrän du bekräftar, och inga kallelser skickas.
            </DialogDescription>
          </DialogHeader>

          {/* Hittades inga nya matcher visas inläsningen igen med meddelandet,
              så en ny fil eller länk kan väljas utan att stänga rutan. */}
          {(!rows || rows.length === 0) && (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="match-import-file">
                  Fil (PDF, PNG eller JPG)
                </label>
                <input
                  id="match-import-file"
                  ref={fileInput}
                  type="file"
                  accept="application/pdf,image/png,image/jpeg,image/webp"
                  className="block w-full text-sm"
                  disabled={busy}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void run({ file });
                  }}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="match-import-url">
                  Eller länk till spelschema
                </label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input
                    id="match-import-url"
                    value={url}
                    inputMode="url"
                    placeholder="https://…"
                    onChange={(event) => setUrl(event.target.value)}
                    disabled={busy}
                  />
                  <Button
                    type="button"
                    disabled={busy || url.trim().length < 8}
                    onClick={() => void run({ url: url.trim() })}
                  >
                    Läs in
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Sidor som kräver inloggning går inte att läsa in – ladda upp en PDF i stället.
                </p>
              </div>
              <p className="rounded-lg bg-muted p-3 text-xs text-muted-foreground">
                Filen eller sidans text skickas till en AI-tjänst som tolkar spelschemat. Ladda bara
                upp spelscheman – inga personuppgifter om barn. Texten sparas inte hos oss, bara de
                matcher du väljer att lägga till.
              </p>
              {busy && <p className="text-sm text-muted-foreground">Läser schemat…</p>}
              {error && <p className="text-sm text-destructive">{error}</p>}
            </div>
          )}

          {rows && rows.length > 0 && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Kontrollera matcherna innan du sparar. Rader markerade med “Kontrollera” var svåra
                att tolka.
                {skipped > 0 ? ` ${skipped} matcher hoppades över – de finns redan.` : ""}
              </p>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <ul className="space-y-3">
                {rows.map((row, index) => (
                  <li
                    key={`${row.date}-${row.time}-${index}`}
                    className="space-y-2 rounded-lg border border-border p-3"
                  >
                    <div className="flex items-start gap-3">
                      <Checkbox
                        checked={chosen.has(index)}
                        onCheckedChange={() => toggle(index)}
                        aria-label={`Ta med matchen ${row.date}`}
                      />
                      <div className="grid w-full gap-2 sm:grid-cols-2">
                        <Input
                          type="date"
                          value={row.date}
                          aria-label="Datum"
                          onChange={(event) => update(index, { date: event.target.value })}
                        />
                        <Input
                          type="time"
                          value={row.time}
                          aria-label="Tid"
                          onChange={(event) => update(index, { time: event.target.value })}
                        />
                        <Input
                          value={row.home_team}
                          aria-label="Hemmalag"
                          placeholder="Hemmalag"
                          onChange={(event) => update(index, { home_team: event.target.value })}
                        />
                        <Input
                          value={row.away_team}
                          aria-label="Bortalag"
                          placeholder="Bortalag"
                          onChange={(event) => update(index, { away_team: event.target.value })}
                        />
                        <Input
                          className="sm:col-span-2"
                          value={row.location}
                          aria-label="Plats"
                          placeholder="Plats"
                          onChange={(event) => update(index, { location: event.target.value })}
                        />
                      </div>
                    </div>
                    {row.needsReview && (
                      <p className="text-xs font-medium text-amber-600 dark:text-amber-400">
                        Kontrollera datum, tid och lagnamn.
                      </p>
                    )}
                  </li>
                ))}
              </ul>
              <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                <Button type="button" variant="ghost" onClick={reset} disabled={saving}>
                  Börja om
                </Button>
                <Button
                  type="button"
                  onClick={() => void create()}
                  disabled={saving || chosen.size === 0}
                >
                  {saving ? "Sparar…" : `Skapa ${chosen.size} matcher`}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
