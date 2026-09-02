import { useRouter, useRouterState } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

/** Sidor där en global tillbakaknapp inte behövs. */
const HIDDEN_PATHS = ["/"];

/**
 * Global tillbakaknapp som visas på alla sidor utom startsidan.
 * Går tillbaka i historiken när det finns något att gå tillbaka till,
 * annars till startsidan så att man aldrig fastnar (t.ex. på inloggningen).
 */
export function BackButton() {
  const router = useRouter();
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  if (HIDDEN_PATHS.includes(pathname)) return null;

  const goBack = () => {
    const canGoBack = typeof window !== "undefined" && window.history.length > 1;
    if (canGoBack) router.history.back();
    else router.navigate({ to: "/" });
  };

  return (
    <div className="mx-auto max-w-6xl px-4 pt-3">
      <button
        type="button"
        onClick={goBack}
        aria-label="Tillbaka till föregående sida"
        className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden /> Tillbaka
      </button>
    </div>
  );
}
