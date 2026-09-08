import { useState } from "react";
import { toast } from "sonner";
import { Share2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { createMatchShare, revokeMatchShare, type MatchShare } from "@/lib/match-plan";
import { dateLabel } from "@/lib/datetime-format";

export function ShareDialog({
  open,
  onOpenChange,
  eventId,
  teamId,
  share,
  onChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: string;
  teamId: string;
  share: MatchShare | null;
  onChange: (share: MatchShare | null) => void;
}) {
  const [expires, setExpires] = useState("");
  const [busy, setBusy] = useState(false);
  const url = share ? `${window.location.origin}/delad-match/${share.token}` : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Dela laguppställning</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Länken är skrivskyddad och visar bara matchinfo, formation, tröjnummer och namn – aldrig
          kontaktuppgifter eller anteckningar.
        </p>
        {share ? (
          <div className="space-y-3">
            <Input
              aria-label="Delningslänk"
              readOnly
              value={url ?? ""}
              onFocus={(e) => e.target.select()}
            />
            {share.expires_at && (
              <p className="text-xs text-muted-foreground">
                Slutar gälla: {dateLabel(share.expires_at)}
              </p>
            )}
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  void navigator.clipboard?.writeText(url ?? "");
                  toast.success("Länken är kopierad");
                }}
              >
                Kopiera länk
              </Button>
              <Button
                variant="destructive"
                disabled={busy}
                onClick={() => {
                  void (async () => {
                    setBusy(true);
                    try {
                      await revokeMatchShare(share.id);
                      onChange(null);
                      toast.success("Delningslänken är återkallad");
                    } catch (e) {
                      toast.error(e instanceof Error ? e.message : "Kunde inte återkalla länken");
                    } finally {
                      setBusy(false);
                    }
                  })();
                }}
              >
                <Trash2 className="size-4" /> Återkalla
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="share-expires">
                Slutdatum (frivilligt)
              </label>
              <Input
                id="share-expires"
                type="date"
                value={expires}
                onChange={(e) => setExpires(e.target.value)}
              />
            </div>
            <Button
              disabled={busy}
              onClick={() => {
                void (async () => {
                  setBusy(true);
                  try {
                    const created = await createMatchShare({
                      eventId,
                      teamId,
                      expiresAt: expires ? new Date(`${expires}T23:59:59`).toISOString() : null,
                    });
                    onChange(created);
                    toast.success("Delningslänken är skapad");
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : "Kunde inte skapa länken");
                  } finally {
                    setBusy(false);
                  }
                })();
              }}
            >
              <Share2 className="size-4" /> Skapa länk
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
