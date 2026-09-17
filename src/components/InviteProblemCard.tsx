import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isTeamCodeShape, type InviteProblemInfo } from "@/lib/invite-problem";
import { teamCodeToken } from "@/lib/invite-links";

/**
 * Visas när inbjudningslänken inte går att använda. Säger vad som är fel,
 * vad familjen ska göra, och ger en väg vidare direkt på sidan.
 */
export function InviteProblemCard({
  info,
  onRetry,
  retrying = false,
  attempts = 0,
}: {
  info: InviteProblemInfo;
  onRetry?: () => void;
  retrying?: boolean;
  attempts?: number;
}) {
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState<string | null>(null);

  function openCode() {
    const trimmed = code.trim();
    if (!isTeamCodeShape(trimmed)) {
      setCodeError("Lagkoden är sex tecken – bokstäver och siffror, utan mellanslag.");
      return;
    }
    setCodeError(null);
    void navigate({ to: "/inbjudan/$token", params: { token: teamCodeToken(trimmed) } });
  }

  return (
    <div className="mt-4 rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-left">
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 size-5 shrink-0 text-destructive" aria-hidden />
        <div>
          <p className="font-semibold text-destructive">{info.title}</p>
          <p className="mt-1 text-sm text-foreground">{info.message}</p>
          <p className="mt-2 text-sm text-muted-foreground">{info.hint}</p>
        </div>
      </div>

      {info.canRetry && onRetry && (
        <div className="mt-3">
          <Button variant="outline" onClick={onRetry} disabled={retrying}>
            <RefreshCw className={`size-4 ${retrying ? "animate-spin" : ""}`} aria-hidden />
            {retrying ? "Försöker igen…" : "Försök igen"}
          </Button>
          {attempts > 1 && !retrying && (
            <p className="mt-2 text-xs text-muted-foreground">
              Vi har försökt {attempts} gånger utan att lyckas. Be gärna tränaren skicka länken igen.
            </p>
          )}
        </div>
      )}

      {info.canEnterCode && (
        <div className="mt-4 space-y-1.5 border-t border-destructive/20 pt-4">
          <Label htmlFor="manual-team-code">Skriv in lagkoden i stället</Label>
          <div className="flex gap-2">
            <Input
              id="manual-team-code"
              value={code}
              onChange={(event) => {
                setCode(event.target.value);
                setCodeError(null);
              }}
              placeholder="t.ex. 191969"
              maxLength={6}
              autoComplete="off"
            />
            <Button onClick={openCode}>Öppna</Button>
          </div>
          {codeError ? (
            <p className="text-xs text-destructive">{codeError}</p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Koden står i meddelandet från tränaren, sex tecken.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
