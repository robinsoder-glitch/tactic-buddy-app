import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { useAccount } from "@/hooks/useAccount";

/**
 * Spärr för sidor som bara tränare (och admin) ska nå. Menyn döljer redan
 * länkarna – det här stoppar även den som skriver in adressen direkt.
 */
export function CoachOnly({ children }: { children: ReactNode }) {
  const { isCoach, isAdmin, loading } = useAccount();

  if (loading) {
    return <p className="mx-auto max-w-md px-4 py-16 text-center text-muted-foreground">Laddar…</p>;
  }

  if (!isCoach && !isAdmin) {
    return (
      <main className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="font-display text-2xl font-bold">Bara för tränare</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Den här sidan är till för lagets ledare. Som spelare eller vårdnadshavare hittar du
          kalender, kallelser och ditt lag i menyn.
        </p>
        <Button asChild variant="secondary" className="mt-4">
          <Link to="/">Till startsidan</Link>
        </Button>
      </main>
    );
  }

  return <>{children}</>;
}
