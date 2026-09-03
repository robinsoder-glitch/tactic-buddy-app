import { useEffect, useState } from "react";
import { BellRing, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  DEFAULT_SETTINGS,
  IMPORTANT_KINDS,
  KIND_HINTS,
  KIND_LABELS,
  type NotificationKind,
  type NotificationPreference,
  type NotificationSettings,
  defaultPreferences,
  fetchNotificationConfig,
  registerPushDevice,
  revokePushDevices,
  saveNotificationPreference,
  saveNotificationSettings,
} from "@/lib/notifications";

/** Inställningar för notiser. Push begärs aldrig automatiskt – bara på knapptryck. */
export function NotificationSettingsCard({ userId }: { userId: string | null }) {
  const [prefs, setPrefs] = useState<NotificationPreference[]>(defaultPreferences());
  const [settings, setSettings] = useState<NotificationSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    if (!userId) {
      setLoading(false);
      return;
    }
    fetchNotificationConfig(userId)
      .then((config) => {
        if (!active) return;
        setPrefs(config.preferences);
        setSettings(config.settings);
      })
      .catch(() => toast.error("Kunde inte hämta notisinställningar."))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [userId]);

  async function patchPreference(kind: NotificationKind, patch: Partial<NotificationPreference>) {
    if (!userId) return;
    const next = prefs.map((item) => (item.kind === kind ? { ...item, ...patch } : item));
    setPrefs(next);
    const updated = next.find((item) => item.kind === kind)!;
    try {
      await saveNotificationPreference(userId, updated);
    } catch {
      toast.error("Kunde inte spara valet.");
    }
  }

  async function patchSettings(patch: Partial<NotificationSettings>) {
    if (!userId) return;
    const next = { ...settings, ...patch };
    setSettings(next);
    try {
      await saveNotificationSettings(userId, patch);
    } catch {
      toast.error("Kunde inte spara inställningen.");
    }
  }

  async function enablePush() {
    if (!userId) return;
    if (typeof Notification === "undefined") {
      toast.error("Den här enheten stöder inte notiser.");
      return;
    }
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        toast.message("Notiser är avstängda i webbläsaren.");
        return;
      }
      const registration = await navigator.serviceWorker?.ready;
      const endpoint = registration?.scope ?? window.location.origin;
      await registerPushDevice(
        userId,
        `${endpoint}#${navigator.userAgent.slice(0, 40)}`,
        "Den här enheten",
      );
      await patchSettings({ push_enabled: true });
      toast.success("Push aktiverat på den här enheten.");
    } catch {
      toast.error("Kunde inte aktivera push.");
    } finally {
      setBusy(false);
    }
  }

  async function disablePush() {
    if (!userId) return;
    setBusy(true);
    try {
      await revokePushDevices(userId);
      await patchSettings({ push_enabled: false });
      toast.success("Push avstängt.");
    } catch {
      toast.error("Kunde inte stänga av push.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-6 space-y-4 rounded-2xl border border-border bg-card p-4">
      <h2 className="flex items-center gap-2 font-display text-lg font-bold">
        <BellRing className="size-4 text-primary" /> Notiser
      </h2>

      {loading ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden /> Hämtar dina val …
        </p>
      ) : (
        <>
          <div className="space-y-3 rounded-xl border border-border bg-background p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <Label htmlFor="quiet">Tyst tid</Label>
                <p className="text-xs text-muted-foreground">
                  Inga notiser stör mellan tiderna (svensk tid).
                </p>
              </div>
              <Switch
                id="quiet"
                checked={settings.quiet_enabled}
                onCheckedChange={(value) => patchSettings({ quiet_enabled: value })}
              />
            </div>
            {settings.quiet_enabled && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="quiet-start">Från</Label>
                  <Input
                    id="quiet-start"
                    type="time"
                    value={settings.quiet_start.slice(0, 5)}
                    onChange={(event) => patchSettings({ quiet_start: event.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="quiet-end">Till</Label>
                  <Input
                    id="quiet-end"
                    type="time"
                    value={settings.quiet_end.slice(0, 5)}
                    onChange={(event) => patchSettings({ quiet_end: event.target.value })}
                  />
                </div>
              </div>
            )}
            <div className="flex items-center justify-between gap-3">
              <div>
                <Label htmlFor="bypass">Släpp igenom viktigt</Label>
                <p className="text-xs text-muted-foreground">
                  Inställda och ändrade aktiviteter når dig även under tyst tid.
                </p>
              </div>
              <Switch
                id="bypass"
                checked={settings.important_bypass_quiet}
                onCheckedChange={(value) => patchSettings({ important_bypass_quiet: value })}
              />
            </div>
          </div>

          <div className="space-y-3 rounded-xl border border-border bg-background p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">Push på den här enheten</p>
                <p className="text-xs text-muted-foreground">
                  {settings.push_enabled
                    ? "Aktiverat."
                    : "Avstängt tills du väljer att slå på det."}
                </p>
              </div>
              <Button
                size="sm"
                variant={settings.push_enabled ? "outline" : "default"}
                disabled={busy}
                onClick={settings.push_enabled ? disablePush : enablePush}
              >
                {settings.push_enabled ? "Stäng av" : "Slå på"}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            {prefs.map((preference) => (
              <div
                key={preference.kind}
                className="rounded-xl border border-border bg-background p-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">{KIND_LABELS[preference.kind]}</p>
                    <p className="text-xs text-muted-foreground">{KIND_HINTS[preference.kind]}</p>
                  </div>
                  <Switch
                    aria-label={`Notis i appen: ${KIND_LABELS[preference.kind]}`}
                    checked={preference.in_app}
                    onCheckedChange={(value) => patchPreference(preference.kind, { in_app: value })}
                  />
                </div>
                {preference.in_app && !IMPORTANT_KINDS.includes(preference.kind) && (
                  <div className="mt-2 flex gap-2" role="radiogroup" aria-label="Leverans">
                    {(["instant", "daily"] as const).map((digest) => (
                      <button
                        key={digest}
                        type="button"
                        role="radio"
                        aria-checked={preference.digest === digest}
                        onClick={() => patchPreference(preference.kind, { digest })}
                        className={`rounded-lg border px-3 py-1 text-xs font-medium ${
                          preference.digest === digest
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border bg-background hover:bg-accent"
                        }`}
                      >
                        {digest === "instant" ? "Direkt" : "Daglig sammanfattning"}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          <p className="text-xs text-muted-foreground">
            E-post och SMS visas när vi kopplat på en leverantör. Fram till dess levereras notiser i
            appen och som push på enheter du själv slagit på.
          </p>
        </>
      )}
    </section>
  );
}
