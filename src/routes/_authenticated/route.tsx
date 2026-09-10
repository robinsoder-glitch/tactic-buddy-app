import { useEffect } from "react";
import {
  createFileRoute,
  Outlet,
  redirect,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAccount } from "@/hooks/useAccount";
import { ONBOARDING_PATH, shouldRedirectToOnboarding } from "@/lib/onboarding-routing";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AuthenticatedLayout,
});

/**
 * Halvfärdiga konton ska alltid till "Välj kontotyp", även när de öppnar en
 * skyddad sida direkt via en länk. Adressen de ville åt följer med tillbaka.
 */
function AuthenticatedLayout() {
  const account = useAccount();
  const navigate = useNavigate();
  const location = useRouterState({ select: (state) => state.location });

  const needsRedirect =
    account.accountReady && shouldRedirectToOnboarding(location.pathname, account.needsOnboarding);

  useEffect(() => {
    if (!needsRedirect) return;
    void navigate({
      to: ONBOARDING_PATH,
      search: { next: `${location.pathname}${location.searchStr ?? ""}` },
      replace: true,
    });
  }, [needsRedirect, navigate, location.pathname, location.searchStr]);

  if (needsRedirect) {
    return (
      <div className="flex min-h-dvh items-center justify-center text-muted-foreground">
        Laddar…
      </div>
    );
  }

  return <Outlet />;
}
