import { useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";
import { useAccount } from "@/hooks/useAccount";
import { BRAND_DESCRIPTION, BRAND_TITLE, brandMeta } from "@/lib/brand";
import { Landing } from "@/components/home/Landing";
import { PlayerHome } from "@/components/home/PlayerHome";
import { CoachStart } from "@/components/home/CoachStart";
import { TacticsDashboard } from "@/components/home/TacticsDashboard";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: brandMeta(BRAND_TITLE, BRAND_DESCRIPTION),
  }),
  component: HomePage,
});

function HomePage() {
  const { user, loading } = useAuth();
  const account = useAccount();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user && !account.loading && account.accountReady && account.needsOnboarding) {
      navigate({ to: "/onboarding", replace: true });
    }
  }, [loading, user, account.loading, account.accountReady, account.needsOnboarding, navigate]);

  if (loading || (user && account.loading)) {
    return (
      <div className="flex min-h-dvh items-center justify-center text-muted-foreground">
        Laddar…
      </div>
    );
  }

  if (!user) return <Landing />;
  if (account.isPlayer && !account.isCoach && !account.isAdmin) return <PlayerHome />;
  // En tränare utan lag ska först skapa sitt lag eller ange tränarkoden.
  if (
    account.isCoach &&
    !account.isAdmin &&
    account.accountReady &&
    account.memberships.length === 0
  ) {
    return <CoachStart userId={user.id} />;
  }
  return <TacticsDashboard userId={user.id} />;
}
