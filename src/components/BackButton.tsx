import { useRouter, useRouterState } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { MAIN_TABS, SECONDARY_TABS, parentPathFor } from "@/lib/navigation";

/**
 * Sidor som redan har en egen tillbaka-länk i sitt innehåll.
 * Där ska den globala pilen inte visas – annars får användaren dubbla pilar.
 */
const OWN_BACK_PREFIXES = [
  "/auth",
  "/skapa",
  "/traningspass",
  "/ovningsbank/",
  "/kunskapsbank/",
  "/taktikbank",
  "/team/",
  "/bank",
];

/**
 * En enda tillbaka-princip i hela appen:
 * huvudflikar och startsidan har ingen pil, detaljsidor går till sin
 * definierade föräldervy och först i sista hand tillbaka i historiken.
 */
export function BackButton() {
  const router = useRouter();
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  const isTabRoot = [...MAIN_TABS, ...SECONDARY_TABS].some((tab) => tab.to === pathname);
  if (pathname === "/" || isTabRoot) return null;
  if (OWN_BACK_PREFIXES.some((prefix) => pathname.startsWith(prefix))) return null;

  const parent = parentPathFor(pathname);

  const goBack = () => {
    if (parent) router.navigate({ to: parent });
    else if (typeof window !== "undefined" && window.history.length > 1) router.history.back();
    else router.navigate({ to: "/" });
  };

  return (
    <div className="mx-auto max-w-6xl px-4 pt-3">
      <button
        type="button"
        onClick={goBack}
        aria-label="Tillbaka"
        className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden /> Tillbaka
      </button>
    </div>
  );
}
