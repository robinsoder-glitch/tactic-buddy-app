import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Lock } from "lucide-react";
import { useTeamRole } from "@/hooks/useTeamRole";

/**
 * Sidor som bara lagets ledare ska se. Spelare och vårdnadshavare möts av en
 * vänlig förklaring i stället för lagets statistik, periodplan eller bilder.
 */
export function CoachOnly({ teamId, children }: { teamId: string; children: ReactNode }) {
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
          Du ser din egen statistik på din spelarsida.
        </p>
        <Link
          to="/team/$teamId"
          params={{ teamId }}
          className="mt-4 inline-block text-sm text-primary underline-offset-4 hover:underline"
        >
          Till laget
        </Link>
      </section>
    );
  }

  return <>{children}</>;
}
