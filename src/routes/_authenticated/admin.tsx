import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { useAccount } from "@/hooks/useAccount";
import { fetchAdminOverview, TEAM_GENDER_LABELS } from "@/lib/teams";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Admin – Taktiktavlan" },
      { name: "description", content: "Översikt över alla klubbar, lag, tränare och spelare i Taktiktavlan." },
      { property: "og:title", content: "Admin – Taktiktavlan" },
      { property: "og:description", content: "Översikt över klubbar, lag och medlemmar." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  const { isAdmin, loading } = useAccount();
  const overview = useQuery({ queryKey: ["admin-overview"], queryFn: fetchAdminOverview, enabled: isAdmin });

  if (loading) return <p className="p-8 text-center text-muted-foreground">Laddar…</p>;
  if (!isAdmin) {
    return <p className="p-8 text-center text-muted-foreground">Du har inte behörighet till adminvyn.</p>;
  }

  const data = overview.data;

  return (
    <main className="mx-auto max-w-3xl px-4 pb-24 pt-8">
      <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground">
        <ArrowLeft className="size-4" /> Tillbaka
      </Link>
      <h1 className="mt-3 font-display text-4xl font-bold">Admin</h1>

      <div className="mt-5 grid grid-cols-3 gap-3">
        {[
          { label: "Klubbar", value: data?.clubs.length ?? 0 },
          { label: "Lag", value: data?.teams.length ?? 0 },
          { label: "Medlemmar", value: data?.members.length ?? 0 },
        ].map((item) => (
          <div key={item.label} className="rounded-xl border border-border bg-card p-4 text-center">
            <p className="font-display text-3xl font-bold">{item.value}</p>
            <p className="text-xs text-muted-foreground">{item.label}</p>
          </div>
        ))}
      </div>

      <section className="mt-6 space-y-3">
        <h2 className="font-display text-2xl font-bold">Alla lag</h2>
        {data?.teams.map((team) => {
          const club = data.clubs.find((item) => item.id === team.club_id);
          const members = data.members.filter((item) => item.team_id === team.id);
          const squad = data.players.filter((item) => item.team_id === team.id);
          return (
            <article key={team.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="truncate font-display text-xl font-semibold">{team.name}</h3>
                  <p className="text-xs text-muted-foreground">
                    {[club?.name, team.age_group, TEAM_GENDER_LABELS[team.gender]].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <span className="rounded-md bg-secondary px-2 py-1 font-mono text-xs">{team.join_code}</span>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {members.filter((item) => item.role === "coach").length} tränare ·{" "}
                {members.filter((item) => item.role === "player" && item.status === "approved").length} anslutna spelare ·{" "}
                {squad.length} i truppen
              </p>
            </article>
          );
        })}
      </section>
    </main>
  );
}
