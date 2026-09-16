import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Lock } from "lucide-react";
import { useTeamRole } from "@/hooks/useTeamRole";

/**
 * Lagsidor som bara lagets ledare ska se – statistik, periodplan, bilder och
 * uppföljning. Spelare och vårdnadshavare möts av en vänlig förklaring.
 */
export function TeamCoachOnly({ teamId, children }: { teamId: string; children: ReactNode }) {
  const { isCoach, loading } = useTeamRole(teamId);

  if (loading) {
    return <p className="py-8 text-center text-sm text-muted-foreground">Hämtar…</p>;
  }

  if (!isCoach) {
    return (
      <section className="rounded-2xl border border-border bg-card p-6 text-center">
        <Lock className="mx-auto size-6 text-muted-foreground" aria-hidden />
        <h2 className="mt-3 font-display text-lg font-bold">Den här sidan är för lagets ledare</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Statistik för hela laget, periodplan, bilder och uppföljning visas bara för ledare. Din
          egen statistik och närvaro hittar du på din spelarsida.
        </p>
        <div className="mt-4 flex flex-wrap justify-center gap-3 text-sm">
          <Link
            to="/team/$teamId"
            params={{ teamId }}
            className="text-primary underline-offset-4 hover:underline"
          >
            Till laget
          </Link>
          <Link to="/kallelser" className="text-primary underline-offset-4 hover:underline">
            Mina kallelser
          </Link>
          <Link to="/kalender" className="text-primary underline-offset-4 hover:underline">
            Kalender
          </Link>
        </div>
      </section>
    );
  }

  return <>{children}</>;
}
