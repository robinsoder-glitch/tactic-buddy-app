import { useState } from "react";
import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { acceptTeamInvite } from "@/lib/teams";

export const Route = createFileRoute("/_authenticated/inbjudan/$token")({
  head: () => ({
    meta: [
      { title: "Inbjudan till lag – Fotbollsrummet" },
      {
        name: "description",
        content: "Acceptera din personliga inbjudan att bli ledare i ett lag.",
      },
      { property: "og:title", content: "Inbjudan till lag – Fotbollsrummet" },
      { property: "og:description", content: "Acceptera din personliga inbjudan till laget." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: InvitePage,
});

function InvitePage() {
  const { token } = useParams({ from: "/_authenticated/inbjudan/$token" });
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function accept() {
    setBusy(true);
    setError(null);
    try {
      const teamId = await acceptTeamInvite(token);
      await queryClient.invalidateQueries();
      toast.success("Inbjudan accepterad. Välkommen till laget!");
      navigate({ to: "/team/$teamId", params: { teamId } });
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Något gick fel";
      setError(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-md px-4 py-16 text-center">
      <ShieldCheck className="mx-auto size-9 text-primary" aria-hidden />
      <h1 className="mt-4 text-2xl font-semibold">Inbjudan till laget</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Inbjudan är personlig, kan bara användas en gång och gäller den e-postadress du är inloggad
        med.
      </p>
      {error && (
        <p className="mt-4 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-foreground">
          {error}
        </p>
      )}
      <Button className="mt-6 w-full" onClick={accept} disabled={busy}>
        {busy ? "Accepterar…" : "Acceptera inbjudan"}
      </Button>
    </main>
  );
}
