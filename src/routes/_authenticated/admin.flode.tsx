import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  buildFunnel,
  FLOW_EVENT_LABELS,
  type FlowEvent,
} from "@/lib/flow-tracking";
import { formatDateTime } from "@/lib/teams";

export const Route = createFileRoute("/_authenticated/admin/flode")({
  head: () => ({
    meta: [
      { title: "Inbjudningsflödet – Admin – Fotbollsrummet" },
      {
        name: "description",
        content: "Se var familjer och tränare fastnar i inbjudningsflödet.",
      },
      { property: "og:title", content: "Inbjudningsflödet – Admin" },
      { property: "og:description", content: "Tratt och senaste händelser i inbjudningsflödet." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: FlowStatsPage,
});

type EventRow = {
  id: string;
  event: string;
  team_code: string | null;
  role: string | null;
  created_at: string;
};

function FlowStatsPage() {
  const rows = useQuery({
    queryKey: ["invite-flow-events"],
    queryFn: async (): Promise<EventRow[]> => {
      const { data, error } = await supabase
        .from("invite_flow_events")
        .select("id, event, team_code, role, created_at")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data ?? [];
    },
  });

  const events = rows.data ?? [];
  const counts: Record<string, number> = {};
  for (const row of events) counts[row.event] = (counts[row.event] ?? 0) + 1;
  const funnel = buildFunnel(counts);
  const top = funnel.reduce(
    (worst, step) => (step.dropoff > worst.dropoff ? step : worst),
    funnel[0] ?? { label: "", dropoff: 0, count: 0, event: "invite_opened" as FlowEvent },
  );

  return (
    <section className="space-y-6">
      <div>
        <h2 className="font-display text-2xl font-bold">Inbjudningsflödet</h2>
        <p className="text-sm text-muted-foreground">
          De 500 senaste händelserna. Så här långt kommer familjerna.
        </p>
      </div>

      {rows.isLoading && <p className="text-sm text-muted-foreground">Hämtar…</p>}

      {!rows.isLoading && events.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Inga händelser ännu. De dyker upp när någon öppnar en inbjudningslänk.
        </p>
      )}

      {events.length > 0 && (
        <>
          <ol className="space-y-2">
            {funnel.map((step) => (
              <li key={step.event} className="rounded-xl border border-border bg-card p-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium">{step.label}</span>
                  <span className="text-sm font-semibold">{step.count}</span>
                </div>
                <div className="mt-2 h-2 rounded-full bg-muted">
                  <div
                    className="h-2 rounded-full bg-primary"
                    style={{
                      width: `${funnel[0] && funnel[0].count > 0 ? Math.round((step.count / funnel[0].count) * 100) : 0}%`,
                    }}
                  />
                </div>
                {step.dropoff > 0 && (
                  <p className="mt-1 text-xs text-destructive">
                    {step.dropoff} tappade bort sig före det här steget
                  </p>
                )}
              </li>
            ))}
          </ol>

          {top.dropoff > 0 && (
            <p className="rounded-xl bg-primary/10 p-3 text-sm font-semibold">
              Störst tapp: {top.label} ({top.dropoff} personer)
            </p>
          )}

          <div>
            <h3 className="font-display text-lg font-bold">Senaste händelser</h3>
            <ul className="mt-2 space-y-1 text-sm">
              {events.slice(0, 40).map((row) => (
                <li key={row.id} className="flex flex-wrap justify-between gap-2 border-b py-1">
                  <span>
                    {FLOW_EVENT_LABELS[row.event as FlowEvent] ?? row.event}
                    {row.team_code ? ` · ${row.team_code}` : ""}
                    {row.role ? ` · ${row.role}` : ""}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatDateTime(row.created_at)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </section>
  );
}
