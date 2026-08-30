import { useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { QUALITY_PRESETS } from "@/lib/export-clip";
import type { ExportQuality } from "@/lib/export-clip";

export type ExportSettings = {
  format: "gif" | "video" | "pdf";
  fps: number;
  quality: ExportQuality;
};

const KEY = "taktiktavlan:export";
const FPS_CHOICES = [10, 15, 24, 30];

export function loadExportSettings(): ExportSettings {
  const fallback: ExportSettings = { format: "gif", fps: 15, quality: "medium" };
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return fallback;
    return { ...fallback, ...(JSON.parse(raw) as Partial<ExportSettings>) };
  } catch {
    return fallback;
  }
}

function saveExportSettings(value: ExportSettings) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(value));
}

type Props = {
  /** Number of steps in the tactic. */
  frameCount: number;
  /** Milliseconds per step at the current playback speed. */
  stepMs: number;
  busy: boolean;
  onExport: (settings: ExportSettings) => void | Promise<void>;
};

export function ExportDialog({ frameCount, stepMs, busy, onExport }: Props) {
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState<ExportSettings>(() => loadExportSettings());

  const seconds = (Math.max(frameCount - 1, 1) * stepMs) / 1000;
  const preset = QUALITY_PRESETS[settings.quality];
  const estimateMb =
    settings.format === "gif"
      ? (seconds * settings.fps * preset.width * preset.width * 0.6 * 0.12 * (preset.colors / 256)) / 1_000_000
      : (seconds * preset.bitrate) / 8 / 1_000_000;

  function update(patch: Partial<ExportSettings>) {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      saveExportSettings(next);
      return next;
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary" size="sm" disabled={busy}>
          <Download className="size-4" /> {busy ? "Exporterar…" : "Exportera"}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Exportera animation</DialogTitle>
          <DialogDescription>
            {frameCount} steg · ca {seconds.toFixed(1)} sekunder
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Format</Label>
            <div className="grid grid-cols-2 gap-2">
              {(["gif", "video"] as const).map((value) => (
                <Button
                  key={value}
                  type="button"
                  variant={settings.format === value ? "default" : "secondary"}
                  onClick={() => update({ format: value })}
                >
                  {value === "gif" ? "GIF" : "MP4 / WebM"}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Bildhastighet</Label>
            <div className="grid grid-cols-4 gap-2">
              {FPS_CHOICES.map((value) => (
                <Button
                  key={value}
                  type="button"
                  size="sm"
                  variant={settings.fps === value ? "default" : "secondary"}
                  onClick={() => update({ fps: value })}
                >
                  {value}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Kvalitet</Label>
            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(QUALITY_PRESETS) as ExportQuality[]).map((value) => (
                <Button
                  key={value}
                  type="button"
                  size="sm"
                  variant={settings.quality === value ? "default" : "secondary"}
                  onClick={() => update({ quality: value })}
                >
                  {QUALITY_PRESETS[value].label.split(" ")[0]}
                </Button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              {preset.width} px bred · uppskattad storlek ca {estimateMb < 1 ? "<1" : estimateMb.toFixed(0)} MB
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            disabled={busy}
            onClick={async () => {
              setOpen(false);
              await onExport(settings);
            }}
          >
            <Download className="size-4" /> Ladda ner
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
