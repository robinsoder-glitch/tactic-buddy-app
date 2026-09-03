import { useEffect, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { findTeamByCode, type TeamCodeMatch } from "@/lib/teams";
import {
  SETUP_ERRORS,
  TEAM_CODE_LENGTH,
  codeKindError,
  normalizeTeamCode,
  type AccountSetup,
} from "@/lib/account-setup";

/** Status för lagkoden – används för att stänga av registreringsknappen. */
export type CodeStatus = {
  /** Krävs en kod för det här valet? */
  required: boolean;
  /** Är koden kontrollerad och giltig för kontotypen? */
  ready: boolean;
  error: string | null;
};

type Props = {
  setup: AccountSetup;
  onChange: (patch: Partial<AccountSetup>) => void;
  /** Visa fältet för lag-/tränarkod. */
  showCode?: boolean;
  /** Dölj namnfältet när namnet redan är ifyllt någon annanstans. */
  hideName?: boolean;
  /** Rapporterar om koden är kontrollerad och giltig. */
  onCodeStatus?: (status: CodeStatus) => void;
};

export function AccountSetupFields({
  setup,
  onChange,
  showCode = true,
  hideName = false,
  onCodeStatus,
}: Props) {
  const [match, setMatch] = useState<TeamCodeMatch | null>(null);
  const [checking, setChecking] = useState(false);
  // Sant när kontrollen misslyckades tekniskt – då är det inte samma sak som fel kod.
  const [lookupFailed, setLookupFailed] = useState(false);
  // Tränare: startar man ett nytt lag eller går man med i ett befintligt via tränarkod?
  const [coachJoins, setCoachJoins] = useState(() => !!setup.code?.trim());
  const code = normalizeTeamCode(setup.code);
  const isCoach = setup.role === "coach";
  const showCodeField = showCode && (!isCoach || coachJoins);
  const complete = code.length === TEAM_CODE_LENGTH;

  useEffect(() => {
    // Kontrollera aldrig innan sex tecken är ifyllda – annars visas fel i onödan.
    if (!showCodeField || !complete) {
      setMatch(null);
      setLookupFailed(false);
      setChecking(false);
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
  }, [code, showCodeField, complete]);

  const kindError = codeKindError(
    setup,
    match ? (match.join_role === "coach" ? "coach" : "player") : null,
  );
  const codeError = !showCodeField
    ? null
    : !complete
      ? null
      : checking
        ? null
        : lookupFailed
          ? SETUP_ERRORS.codeLookupFailed
          : !match
            ? SETUP_ERRORS.codeInvalid
            : kindError;

  useEffect(() => {
    onCodeStatus?.({
      required: showCodeField,
      ready: !showCodeField || (complete && !checking && !!match && !kindError && !lookupFailed),
      error: codeError,
    });
  }, [showCodeField, complete, checking, match, kindError, lookupFailed, codeError, onCodeStatus]);

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

      {showCode && isCoach && (
        <div className="space-y-2">
          <p className="text-sm font-medium">Lag</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => {
                setCoachJoins(false);
                onChange({ code: "" });
              }}
              aria-pressed={!coachJoins}
              className={`rounded-lg border p-3 text-left text-sm transition-colors ${
                !coachJoins ? "border-primary bg-primary/10" : "border-border bg-card"
              }`}
            >
              <span className="font-medium">Jag startar ett nytt lag</span>
              <span className="block text-xs text-muted-foreground">
                Du skapar laget direkt efter registreringen
              </span>
            </button>
            <button
              type="button"
              onClick={() => setCoachJoins(true)}
              aria-pressed={coachJoins}
              className={`rounded-lg border p-3 text-left text-sm transition-colors ${
                coachJoins ? "border-primary bg-primary/10" : "border-border bg-card"
              }`}
            >
              <span className="font-medium">Jag går med i ett befintligt lag</span>
              <span className="block text-xs text-muted-foreground">Du har fått en tränarkod</span>
            </button>
          </div>
          {!coachJoins && (
            <p className="text-xs text-muted-foreground">
              Ingen kod behövs. När kontot är klart skapar du laget och får en spelarkod och en
              tränarkod att dela ut.
            </p>
          )}
        </div>
      )}

      {showCodeField && (
        <div className="space-y-1.5">
          <Label htmlFor="setup-code">{isCoach ? "Tränarkod" : "Spelarkod"}</Label>
          <Input
            id="setup-code"
            value={setup.code ?? ""}
            onChange={(event) =>
              onChange({ code: normalizeTeamCode(event.target.value).slice(0, TEAM_CODE_LENGTH) })
            }
            // Lite marginal så att inklistrade koder med blanksteg inte kapas.
            maxLength={TEAM_CODE_LENGTH + 6}
            inputMode="text"
            autoCapitalize="characters"
            placeholder="T.ex. A1B2C3"
            className="font-mono tracking-widest"
          />
          {checking && (
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="size-3 animate-spin" aria-hidden /> Letar efter laget…
            </p>
          )}
          {!checking && match && !kindError && (
            <p className="flex items-center gap-2 text-xs text-primary">
              <Check className="size-3" aria-hidden />
              {match.name}
              {match.age_group ? ` ${match.age_group}` : ""}
              {match.club_name ? ` · ${match.club_name}` : ""} ·{" "}
              {match.join_role === "coach" ? "tränarkod" : "spelarkod"}
            </p>
          )}
          {!complete && code.length > 0 && (
            <p className="text-xs text-muted-foreground">Koden är sex tecken.</p>
          )}
          {codeError && <p className="text-xs text-destructive">{codeError}</p>}
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
