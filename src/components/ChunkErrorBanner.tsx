import { useEffect, useRef, useState } from "react";
import { RefreshCw, AlertTriangle } from "lucide-react";
import {
  canAutoReload,
  checkBuildVersion,
  fetchDeployedSignature,
  hardReload,
  isChunkLoadError,
} from "@/lib/build-info";

export function ChunkErrorBanner() {
  const [detail, setDetail] = useState<string | null>(null);
  const [newVersion, setNewVersion] = useState(false);
  const [reloading, setReloading] = useState(false);
  const signature = useRef<string | null>(null);

  // Kontrollerar regelbundet om servern har en nyare version.
  useEffect(() => {
    if (import.meta.env.DEV) return;
    let stopped = false;

    const check = async () => {
      if (stopped || document.visibilityState !== "visible") return;
      const current = await fetchDeployedSignature();
      if (stopped || !current) return;
      if (signature.current === null) {
        signature.current = current;
        return;
      }
      if (current !== signature.current) setNewVersion(true);
    };

    void check();
    const timer = window.setInterval(() => void check(), 60000);
    const onVisible = () => void check();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      stopped = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, []);


  useEffect(() => {
    // New build deployed while this tab was open → refresh silently once.
    if (checkBuildVersion() && canAutoReload()) {
      void hardReload();
      return;
    }

    const trigger = (message: string) => {
      if (!isChunkLoadError(message)) return;
      setDetail(message);
      if (canAutoReload()) {
        setReloading(true);
        void hardReload();
      }
    };

    const onError = (e: ErrorEvent) => trigger(e.message ?? "");
    const onRejection = (e: PromiseRejectionEvent) => {
      const r = e.reason;
      trigger(typeof r === "string" ? r : (r?.message ?? ""));
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  if (!detail && !newVersion) return null;

  const isError = Boolean(detail);

  return (
    <div
      className={`fixed inset-x-0 top-0 z-[100] border-b px-3 py-2 shadow-lg ${
        isError
          ? "border-destructive/40 bg-destructive text-destructive-foreground"
          : "border-primary/40 bg-primary text-primary-foreground"
      }`}
    >
      <div className="mx-auto flex max-w-3xl items-center gap-3">
        <AlertTriangle className="size-5 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">
            {isError ? "Appen har uppdaterats" : "En ny version av appen finns"}
          </p>
          <p className="truncate text-xs opacity-90">
            {reloading
              ? "Laddar om automatiskt…"
              : isError
                ? "En del av appen kunde inte laddas (gammal version i cachen)."
                : "Ladda om för att se den senaste versionen."}
          </p>
        </div>

        <button
          onClick={() => {
            setReloading(true);
            void hardReload();
          }}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-background px-3 py-1.5 text-sm font-medium text-foreground"
        >
          <RefreshCw className={`size-4 ${reloading ? "animate-spin" : ""}`} />
          Ladda om
        </button>
      </div>
    </div>
  );
}
