import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { fetchDrill, fetchTacticCards, label, PHASE_LABELS } from "@/lib/taktikbank";
import { drillMeta } from "@/lib/ovningsbank";
import { formatLabelFor } from "@/lib/rules-presentation";
import { DrillDetails } from "@/components/DrillDetails";
import { AddToTrainingButton } from "@/components/AddToTrainingDialog";
import { Button } from "@/components/ui/button";
import { useAccount } from "@/hooks/useAccount";

export const Route = createFileRoute("/_authenticated/ovningsbank/$drillId")({
  head: () => ({
    meta: [
      { title: "Övning – Träningsbanken" },
      { name: "description", content: "Hela övningen: syfte, organisation, genomförande, coachpunkter och variation." },
      { property: "og:title", content: "Övning – Träningsbanken" },
      { property: "og:description", content: "Så genomför du övningen steg för steg." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DrillPage,
});

function DrillPage() {
  const { drillId } = Route.useParams();
  const { isCoach, isAdmin, loading } = useAccount();
  const allowed = isCoach || isAdmin;
  const drill = useQuery({ queryKey: ["tb-drill", drillId], queryFn: () => fetchDrill(drillId), enabled: allowed });
  const cards = useQuery({ queryKey: ["tb-tactics"], queryFn: fetchTacticCards, enabled: allowed });

  if (loading || drill.isLoading) {
    return <main className="grid min-h-screen place-items-center text-muted-foreground">Laddar…</main>;
  }

  if (!allowed) {
    return (
      <main className="mx-auto max-w-md px-4 py-16 text-center">
        <p className="text-sm text-muted-foreground">Träningsbanken är till för tränare och lagledare.</p>
        <Link to="/" className="mt-6 inline-block text-sm text-primary underline-offset-4 hover:underline">
          Till startsidan
        </Link>
      </main>
    );
  }

  if (!drill.data) {
    return (
      <main className="mx-auto max-w-md px-4 py-16 text-center">
        <p className="text-sm text-muted-foreground">Övningen hittades inte.</p>
        <Link to="/ovningsbank" className="mt-6 inline-block text-sm text-primary underline-offset-4 hover:underline">
          Till träningsbanken
        </Link>
      </main>
    );
  }

  const meta = drillMeta(drill.data, cards.data ?? []);

  return (
    <main className="mx-auto max-w-3xl px-4 pb-32 pt-6">
      <header className="flex items-center gap-2">
        <Button asChild variant="ghost" size="icon" aria-label="Tillbaka till träningsbanken">
          <Link to="/ovningsbank">
            <ArrowLeft className="size-5" />
          </Link>
        </Button>
        <div className="min-w-0">
          <p className="text-xs tracking-wide text-muted-foreground">
            {meta.formats.map(formatLabelFor).join(" · ") || "Alla spelformer"}
            {meta.areas.length ? ` · ${meta.areas.map((area) => label(PHASE_LABELS, area)).join(" · ")}` : ""}
          </p>
          <h1 className="font-display text-2xl font-bold">{drill.data.title}</h1>
        </div>
      </header>

      {drill.data.purpose && <p className="mt-3 text-sm text-muted-foreground">{drill.data.purpose}</p>}

      <DrillDetails drill={drill.data} showGaps={isAdmin} />

      <div className="mt-6">
<AddToTrainingButton
          kind="drill"
          resourceId={drill.data.id}
          title={drill.data.title}
          defaultMinutes={drill.data.default_minutes ?? 10}
        />
      </div>
    </main>
  );
}
