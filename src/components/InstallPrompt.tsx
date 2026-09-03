import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<unknown> };

const DISMISS_KEY = "fr:install-dismissed";

/**
 * Diskret installationsförslag. Visas bara när webbläsaren själv erbjuder
 * installation och aldrig igen efter att användaren tackat nej.
 */
export function InstallPrompt() {
  const [event, setEvent] = useState<InstallEvent | null>(null);

  useEffect(() => {
    if (window.localStorage.getItem(DISMISS_KEY) === "1") return;
    const handler = (nativeEvent: Event) => {
      nativeEvent.preventDefault();
      setEvent(nativeEvent as InstallEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  if (!event) return null;

  const dismiss = () => {
    window.localStorage.setItem(DISMISS_KEY, "1");
    setEvent(null);
  };

  return (
    <div className="fixed inset-x-3 bottom-20 z-40 flex items-center gap-3 rounded-2xl border border-border bg-card p-3 shadow-lg md:left-auto md:right-4 md:w-80">
      <Download className="size-5 shrink-0 text-primary" aria-hidden />
      <div className="flex-1 text-sm">
        <p className="font-medium">Lägg till på hemskärmen</p>
        <p className="text-xs text-muted-foreground">Snabbare start och helskärm vid planen.</p>
      </div>
      <Button
        size="sm"
        onClick={async () => {
          await event.prompt();
          setEvent(null);
        }}
      >
        Installera
      </Button>
      <button type="button" onClick={dismiss} aria-label="Stäng" className="text-muted-foreground">
        <X className="size-4" />
      </button>
    </div>
  );
}
