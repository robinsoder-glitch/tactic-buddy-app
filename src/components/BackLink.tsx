import { useRouter } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { canGoBackInApp } from "@/lib/back-navigation";

/**
 * En gemensam tillbaka-princip: gå tillbaka i historiken när användaren kom
 * hit inifrån appen, annars till den definierade föräldervyn. Då hamnar man
 * alltid på föregående sida i stället för på en slumpmässig annan sida.
 */
function useSmartBack(fallback: string) {
  const router = useRouter();
  return () => {
    if (canGoBackInApp()) router.history.back();
    else router.navigate({ to: fallback });
  };
}

type BackLinkProps = {
  /** Vart vi går när det inte finns någon tidigare sida i appen. */
  fallback: string;
  children?: ReactNode;
  className?: string;
};

/** Textlänk med pil, för sidor som visar "Tillbaka till …". */
export function BackLink({ fallback, children = "Tillbaka", className }: BackLinkProps) {
  const goBack = useSmartBack(fallback);
  return (
    <button
      type="button"
      onClick={goBack}
      className={
        className ??
        "inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      }
    >
      <ArrowLeft className="size-4" aria-hidden /> {children}
    </button>
  );
}

/** Rund ikonknapp med pil, för sidhuvuden. */
export function BackIconButton({
  fallback,
  label = "Tillbaka",
}: {
  fallback: string;
  label?: string;
}) {
  const goBack = useSmartBack(label ? fallback : fallback);
  return (
    <Button type="button" variant="ghost" size="icon" aria-label={label} onClick={goBack}>
      <ArrowLeft className="size-5" />
    </Button>
  );
}
