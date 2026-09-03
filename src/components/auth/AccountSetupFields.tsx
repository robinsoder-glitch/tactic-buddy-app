import { useEffect, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { findTeamByCode, type TeamCodeMatch } from "@/lib/teams";
import type { AccountSetup } from "@/lib/account-setup";

type Props = {
  setup: AccountSetup;
  onChange: (patch: Partial<AccountSetup>) => void;
  /** Visa fältet för lag-/tränarkod. */
  showCode?: boolean;
  /** Dölj namnfältet när namnet redan är ifyllt någon annanstans. */
  hideName?: boolean;
};

export function AccountSetupFields({ setup, onChange, showCode = true, hideName = false }: Props) {
  const [match, setMatch] = useState<TeamCodeMatch | null>(null);
  const [checking, setChecking] = useState(false);
  // Sant när kontrollen misslyckades tekniskt – då är det inte samma sak som fel kod.
  const [lookupFailed, setLookupFailed] = useState(false);
  const code = setup.code?.trim() ?? "";

  useEffect(() => {
    if (!showCode || code.length < 4) {
      setMatch(null);
      setLookupFailed(false);
      return;
    }
    let active = true;
    setChecking(true);
    const timer = setTimeout(() => {
      findTeamByCode(code)
        .then((row) => {
          if (!active) return;
          setMatch(row);
          setLookupFailed(false);
        })
        .catch(() => {
          if (!active) return;
          setMatch(null);
          setLookupFailed(true);
        })
        .finally(() => {
          if (active) setChecking(false);
        });
    }, 350);
    return () => {
      active = false;
      clearTimeout(timer);
      setChecking(false);
    };
  }, [code, showCode]);

  return (
    <div className="space-y-4">
      {!hideName && (
        <div className="space-y-1.5">
          <Label htmlFor="setup-name">{setup.role === "coach" ? "Ditt namn" : "Ditt namn"}</Label>
          <Input
            id="setup-name"
            value={setup.name}
            onChange={(event) => onChange({ name: event.target.value })}
            placeholder={setup.role === "coach" ? "T.ex. Anna Svensson" : "T.ex. Maria Ek"}
          />
        </div>
      )}

      {setup.role === "coach" ? (
        <>
          <div className="space-y-1.5">
            <Label htmlFor="setup-birth">Födelsedatum</Label>
            <Input
              id="setup-birth"
              type="date"
              value={setup.birth ?? ""}
              onChange={(event) => onChange({ birth: event.target.value })}
            />
          </div>
          <label className="flex items-start gap-3 text-sm text-muted-foreground">
            <Checkbox
              checked={!!setup.adultConfirmed}
              onCheckedChange={(value) => onChange({ adultConfirmed: value === true })}
            />
            <span>Jag intygar att uppgiften stämmer och att jag är minst 18 år.</span>
          </label>
        </>
      ) : (
        <div className="space-y-2">
          <p className="text-sm font-medium">Vem gäller kontot?</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => onChange({ isGuardian: false })}
              aria-pressed={!setup.isGuardian}
              className={`rounded-lg border p-3 text-left text-sm transition-colors ${
                !setup.isGuardian ? "border-primary bg-primary/10" : "border-border bg-card"
              }`}
            >
              <span className="font-medium">Jag är spelaren</span>
              <span className="block text-xs text-muted-foreground">13 år eller äldre</span>
            </button>
            <button
              type="button"
              onClick={() => onChange({ isGuardian: true })}
              aria-pressed={!!setup.isGuardian}
              className={`rounded-lg border p-3 text-left text-sm transition-colors ${
                setup.isGuardian ? "border-primary bg-primary/10" : "border-border bg-card"
              }`}
            >
              <span className="font-medium">Jag är vårdnadshavare</span>
              <span className="block text-xs text-muted-foreground">Kontot gäller mitt barn</span>
            </button>
          </div>
          {setup.isGuardian ? (
            <div className="space-y-1.5 pt-1">
              <Label htmlFor="setup-player">Spelarens namn</Label>
              <Input
                id="setup-player"
                value={setup.playerName ?? ""}
                onChange={(event) => onChange({ playerName: event.target.value })}
                placeholder="T.ex. Elias"
              />
            </div>
          ) : (
            <div className="space-y-1.5 pt-1">
              <Label htmlFor="setup-birth">Ditt födelsedatum</Label>
              <Input
                id="setup-birth"
                type="date"
                value={setup.birth ?? ""}
                onChange={(event) => onChange({ birth: event.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                Är spelaren under 13 år ska en vårdnadshavare skapa kontot.
              </p>
            </div>
          )}
        </div>
      )}

      {showCode && (
        <div className="space-y-1.5">
          <Label htmlFor="setup-code">
            {setup.role === "coach" ? "Tränarkod (om du har en)" : "Lagkod"}
          </Label>
          <Input
            id="setup-code"
            value={setup.code ?? ""}
            onChange={(event) => onChange({ code: event.target.value.toUpperCase() })}
            placeholder="T.ex. A1B2C3"
            className="font-mono tracking-widest"
          />
          {checking && (
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="size-3 animate-spin" aria-hidden /> Letar efter laget…
            </p>
          )}
          {!checking && match && (
            <p className="flex items-center gap-2 text-xs text-primary">
              <Check className="size-3" aria-hidden />
              {match.name}
              {match.age_group ? ` ${match.age_group}` : ""}
              {match.club_name ? ` · ${match.club_name}` : ""} ·{" "}
              {match.join_role === "coach" ? "tränarkod" : "spelarkod"}
            </p>
          )}
          {!checking && code.length >= 4 && !match && !lookupFailed && (
            <p className="text-xs text-destructive">Ingen lag hittades med den koden.</p>
          )}
          {!checking && lookupFailed && (
            <p className="text-xs text-destructive">
              Koden kunde inte kontrolleras just nu. Kontrollera din uppkoppling och försök igen.
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            {setup.role === "coach"
              ? "Tränarkoden får du av en befintlig tränare i laget. En tränare i laget godkänner dig."
              : "Koden får du av din tränare. Tränaren godkänner dig innan du kommer in i laget."}
          </p>
        </div>
      )}
    </div>
  );
}
