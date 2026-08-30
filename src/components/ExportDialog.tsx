import { useEffect, useState } from "react";
import { Download, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
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
import type { PaperOrientation, PaperSize } from "@/lib/export-pdf";

export type ExportSettings = {
  format: "gif" | "video" | "pdf";
  fps: number;
  quality: ExportQuality;
  paper: PaperSize;
  orientation: PaperOrientation;
  /** Page margin in mm. */
  margin: number;
  /** Pitch image scale (0.4–1). */
  scale: number;
  cover: boolean;
};

const KEY = "taktiktavlan:export";
const FPS_CHOICES = [10, 15, 24, 30];

const FALLBACK: ExportSettings = {
  format: "gif",
  fps: 15,
  quality: "medium",
  paper: "a4",
  orientation: "landscape",
  margin: 14,
  scale: 1,
  cover: true,
};

export function loadExportSettings(): ExportSettings {
  if (typeof window === "undefined") return FALLBACK;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return FALLBACK;
    return { ...FALLBACK, ...(JSON.parse(raw) as Partial<ExportSettings>) };
  } catch {
    return FALLBACK;
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
  /** Builds a blob URL used for the PDF preview. */
  onPreviewPdf?: (settings: ExportSettings) => Promise<string>;
};

export function ExportDialog({ frameCount, stepMs, busy, onExport, onPreviewPdf }: Props) {
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState<ExportSettings>(() => loadExportSettings());
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  const seconds = (Math.max(frameCount - 1, 1) * stepMs) / 1000;
  const preset = QUALITY_PRESETS[settings.quality];
  const estimateMb =
    settings.format === "gif"
      ? (seconds * settings.fps * preset.width * preset.width * 0.6 * 0.12 * (preset.colors / 256)) / 1_000_000
      : (seconds * preset.bitrate) / 8 / 1_000_000;

  function clearPreview() {
    setPreviewUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return null;
    });
  }

  function update(patch: Partial<ExportSettings>) {
    clearPreview();
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      saveExportSettings(next);
      return next;
    });
  }

  async function showPreview() {
    if (!onPreviewPdf) return;
    setPreviewing(true);
    try {
      const url = await onPreviewPdf(settings);
      clearPreview();
      setPreviewUrl(url);
    } finally {
      setPreviewing(false);
    }
  }

  const isPdf = settings.format === "pdf";

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        setOpen(value);
        if (!value) clearPreview();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="secondary" size="sm" disabled={busy}>
          <Download className="size-4" /> {busy ? "Exporterar…" : "Exportera"}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Exportera animation</DialogTitle>
          <DialogDescription>
            {frameCount} steg · ca {seconds.toFixed(1)} sekunder
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Format</Label>
            <div className="grid grid-cols-3 gap-2">
              {(["gif", "video", "pdf"] as const).map((value) => (
                <Button
                  key={value}
                  type="button"
                  size="sm"
                  variant={settings.format === value ? "default" : "secondary"}
                  onClick={() => update({ format: value })}
                >
                  {value === "gif" ? "GIF" : value === "video" ? "MP4 / WebM" : "PDF"}
                </Button>
              ))}
            </div>
          </div>

          {!isPdf && (
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
          )}

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
              {isPdf
                ? `Planbilden renderas i ${Math.max(preset.width, 900)} px bredd`
                : `${preset.width} px bred · uppskattad storlek ca ${estimateMb < 1 ? "<1" : estimateMb.toFixed(0)} MB`}
            </p>
          </div>

          {isPdf && (
            <div className="space-y-4 rounded-lg border border-border p-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Pappersstorlek</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {(["a4", "a3"] as const).map((value) => (
                      <Button
                        key={value}
                        type="button"
                        size="sm"
                        variant={settings.paper === value ? "default" : "secondary"}
                        onClick={() => update({ paper: value })}
                      >
                        {value.toUpperCase()}
                      </Button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Orientering</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {(["portrait", "landscape"] as const).map((value) => (
                      <Button
                        key={value}
                        type="button"
                        size="sm"
                        variant={settings.orientation === value ? "default" : "secondary"}
                        onClick={() => update({ orientation: value })}
                      >
                        {value === "portrait" ? "Stående" : "Liggande"}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Marginal: {settings.margin} mm</Label>
                <Slider
                  value={[settings.margin]}
                  min={6}
                  max={30}
                  step={1}
                  onValueChange={([value]) => update({ margin: value })}
                />
              </div>

              <div className="space-y-2">
                <Label>Skalning av planbild: {Math.round(settings.scale * 100)} %</Label>
                <Slider
                  value={[Math.round(settings.scale * 100)]}
                  min={40}
                  max={100}
                  step={5}
                  onValueChange={([value]) => update({ scale: value / 100 })}
                />
              </div>

              <Button
                type="button"
                size="sm"
                variant={settings.cover ? "default" : "secondary"}
                onClick={() => update({ cover: !settings.cover })}
              >
                {settings.cover ? "Omslagssida: på" : "Omslagssida: av"}
              </Button>

              {onPreviewPdf && (
                <div className="space-y-2">
                  <Button type="button" size="sm" variant="secondary" onClick={showPreview} disabled={previewing}>
                    <Eye className="size-4" /> {previewing ? "Skapar förhandsvisning…" : "Förhandsgranska"}
                  </Button>
                  {previewUrl && (
                    <iframe
                      title="Förhandsvisning av PDF"
                      src={previewUrl}
                      className="h-72 w-full rounded-lg border border-border bg-muted"
                    />
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            disabled={busy}
            onClick={async () => {
              setOpen(false);
              clearPreview();
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
