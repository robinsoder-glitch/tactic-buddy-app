import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAccount } from "@/hooks/useAccount";

/** Sidor som spelare och vårdnadshavare alltid kan öppna. */
export const PLAYER_HOME_LINKS = [
  { to: "/" as const, label: "Idag" },
  { to: "/kalender" as const, label: "Kalender" },
  { to: "/kallelser" as const, label: "Mina kallelser" },
  { to: "/spelarkunskap" as const, label: "Kunskap" },
];

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
        <Lock className="mx-auto size-6 text-muted-foreground" aria-hidden />
        <h1 className="mt-3 font-display text-2xl font-bold">Bara för tränare</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Den här sidan är till för lagets ledare, till exempel träningspass, planering och
          taktiktavlan. Ditt konto är ett spelar- eller vårdnadshavarkonto, så innehållet visas
          inte här.
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          Hör av dig till en ledare i laget om du tror att du borde ha tränarbehörighet.
        </p>
        <Button asChild className="mt-4">
          <Link to="/kallelser">Till mina kallelser</Link>
        </Button>
        <nav className="mt-4 flex flex-wrap justify-center gap-3 text-sm" aria-label="Dina sidor">
          {PLAYER_HOME_LINKS.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="text-primary underline-offset-4 hover:underline"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </main>
    );
  }

  return <>{children}</>;
}
