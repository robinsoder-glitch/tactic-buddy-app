import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ShieldCheck } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { RoleChoice } from "@/components/auth/RoleChoice";
import { AccountSetupFields } from "@/components/auth/AccountSetupFields";
import {
  CLEARED_SETUP_METADATA,
  SETUP_ERRORS,
  applyAccountSetup,
  clearSetup,
  readSetup,
  setupFromMetadata,
  validateSetup,
  type AccountRole,
  type AccountSetup,
} from "@/lib/account-setup";
import { friendlyError } from "@/lib/user-errors";
import { supabase } from "@/integrations/supabase/client";
import type { CodeStatus } from "@/components/auth/AccountSetupFields";

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({
    meta: [
      { title: "Välj kontotyp – Fotbollsrummet" },
      {
        name: "description",
        content: "Skapa ett tränarkonto eller gå med i ett lag som spelare med lagkoden.",
      },
      { property: "og:title", content: "Välj kontotyp – Fotbollsrummet" },
      {
        property: "og:description",
        content: "Tränare eller spelare – välj hur du vill använda Fotbollsrummet.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: OnboardingPage,
});

function OnboardingPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [role, setRole] = useState<AccountRole | null>(null);
  const [setup, setSetup] = useState<AccountSetup>({ role: "coach", name: "" });
  const [busy, setBusy] = useState(false);
  const [codeStatus, setCodeStatus] = useState<CodeStatus>({
    required: false,
    ready: true,
    error: null,
  });

  // Fyll i det användaren redan valde när kontot skapades.
  useEffect(() => {
    // Auth-metadata först: då fungerar det även på en annan enhet.
    const stored = setupFromMetadata(user?.user_metadata) ?? readSetup();
    if (stored) {
      setSetup(stored);
      setRole(stored.role);
    } else if (user?.user_metadata?.["display_name"]) {
      setSetup((current) => ({ ...current, name: String(user.user_metadata["display_name"]) }));
    }
  }, [user]);

  function chooseRole(next: AccountRole) {
    setRole(next);
    setSetup((current) => ({ ...current, role: next }));
  }

  async function save() {
    if (!user || !role) return;
    const problem = validateSetup(setup, { requireCode: codeStatus.required });
    if (problem) {
      toast.error(problem);
      return;
    }
    if (codeStatus.required && !codeStatus.ready) {
      toast.error(codeStatus.error ?? SETUP_ERRORS.codeInvalid);
      return;
    }
    setBusy(true);
    try {
      const result = await applyAccountSetup(user.id, setup);
      clearSetup();
      await supabase.auth.updateUser({ data: CLEARED_SETUP_METADATA });
      await queryClient.invalidateQueries();
      if (result.teamName && result.status === "pending") {
        toast.success(`Ansökan skickad till ${result.teamName}. Tränaren godkänner dig inom kort.`);
        navigate({ to: "/" });
        return;
      }
      if (result.teamId) {
        navigate({ to: "/team/$teamId", params: { teamId: result.teamId } });
        return;
      }
      navigate({ to: result.role === "coach" ? "/teams" : "/" });
    } catch (error) {
      toast.error(friendlyError(error, "Något gick fel"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-md px-4 py-10">
      <p className="font-display text-xs tracking-[0.3em] text-primary">Kom igång</p>
      <h1 className="mt-2 font-display text-4xl font-bold">Välj kontotyp</h1>

      <div className="mt-6">
        <RoleChoice value={role} onChange={chooseRole} />
      </div>

      {role && (
        <section className="mt-6 space-y-4 rounded-xl border border-border bg-card p-4">
          <AccountSetupFields
            setup={setup}
            onChange={(patch) => setSetup((c) => ({ ...c, ...patch }))}
          />
          {role === "coach" && (
            <p className="text-xs text-muted-foreground">
              Har du ingen tränarkod? Lämna fältet tomt – då skapar du ditt eget lag i nästa steg.
            </p>
          )}
          <Button className="w-full" onClick={save} disabled={busy}>
            <ShieldCheck className="size-4" aria-hidden />
            {role === "coach" ? "Skapa tränarkonto" : "Gå med i laget"}
          </Button>
        </section>
      )}
    </main>
  );
}
