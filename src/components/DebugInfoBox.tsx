import { useEffect, useState } from "react";
import { Bug, Copy, X } from "lucide-react";
import { toast } from "sonner";
import { BUILD_ID, BUILD_MODE, latestChunk } from "@/lib/build-info";

/**
 * Felsökningsruta. Visas aldrig för vanliga användare i den publicerade appen –
 * bara i utvecklingsläge eller när någon uttryckligen öppnar appen med ?debug=1.
 */
export function DebugInfoBox() {
  const [visible, setVisible] = useState(false);
  const [open, setOpen] = useState(false);
  const [chunk, setChunk] = useState<{ name: string; hash: string } | null>(null);

  useEffect(() => {
    if (BUILD_MODE !== "production") {
      setVisible(true);
      return;
    }
    try {
      if (new URLSearchParams(window.location.search).has("debug")) {
        window.sessionStorage.setItem("taktik:debug", "1");
      }
      setVisible(window.sessionStorage.getItem("taktik:debug") === "1");
    } catch {
      setVisible(false);
    }
  }, []);


  useEffect(() => {
    if (!open) return;
    setChunk(latestChunk());
    const id = window.setInterval(() => setChunk(latestChunk()), 2000);
    return () => window.clearInterval(id);
  }, [open]);

  const rows = [
    ["Build", BUILD_ID],
    ["Läge", BUILD_MODE],
    ["Chunk", chunk?.name ?? "—"],
    ["Hash", chunk?.hash ?? "—"],
    ["URL", typeof window !== "undefined" ? window.location.pathname : "—"],
    ["User agent", typeof navigator !== "undefined" ? navigator.userAgent : "—"],
  ] as const;

  if (!open) {
    return (
      <button
        aria-label="Visa felsökningsinfo"
        onClick={() => setOpen(true)}
        className="fixed bottom-[84px] right-2 z-40 rounded-full border border-border bg-card/80 p-2 text-muted-foreground backdrop-blur transition-colors hover:text-foreground"
      >
        <Bug className="size-4" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-[84px] right-2 z-40 w-[min(20rem,calc(100vw-1rem))] rounded-lg border border-border bg-card/95 p-3 text-xs shadow-xl backdrop-blur">
      <div className="mb-2 flex items-center justify-between">
        <span className="font-semibold text-foreground">Felsökning</span>
        <div className="flex items-center gap-1">
          <button
            aria-label="Kopiera"
            onClick={() => {
              void navigator.clipboard
                .writeText(rows.map(([k, v]) => `${k}: ${v}`).join("\n"))
                .then(() => toast.success("Felsökningsinfo kopierad"));
            }}
            className="rounded p-1 text-muted-foreground hover:text-foreground"
          >
            <Copy className="size-3.5" />
          </button>
          <button
            aria-label="Stäng"
            onClick={() => setOpen(false)}
            className="rounded p-1 text-muted-foreground hover:text-foreground"
          >
            <X className="size-3.5" />
          </button>
        </div>
      </div>
      <dl className="space-y-1">
        {rows.map(([k, v]) => (
          <div key={k} className="flex gap-2">
            <dt className="w-20 shrink-0 text-muted-foreground">{k}</dt>
            <dd className="min-w-0 flex-1 break-all font-mono text-foreground">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
