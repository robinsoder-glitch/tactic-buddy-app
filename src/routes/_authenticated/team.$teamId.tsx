import { createFileRoute, Link, Outlet, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  BarChart3,
  CalendarCheck,
  CalendarDays,
  Dumbbell,
  Images,
  Info,
  Shield,
  ShieldCheck,
  Trophy,
  Users,
} from "lucide-react";
import { fetchTeam, TEAM_GENDER_LABELS } from "@/lib/teams";
import { useTeamRole } from "@/hooks/useTeamRole";

export const Route = createFileRoute("/_authenticated/team/$teamId")({
  head: () => ({
    meta: [
      { title: "Laget – Taktiktavlan" },
      { name: "description", content: "Truppen, kalender, träningar och matcher för ditt lag." },
      { property: "og:title", content: "Laget – Taktiktavlan" },
      { property: "og:description", content: "Truppen, kalender, träningar och matcher." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TeamLayout,
});

const TABS = [
  { to: "/team/$teamId", label: "Truppen", icon: Users, exact: true },
  { to: "/team/$teamId/about", label: "Om laget", icon: Info, exact: false },
  { to: "/team/$teamId/calendar", label: "Kalender", icon: CalendarDays, exact: false },
  { to: "/team/$teamId/training", label: "Träning", icon: Dumbbell, exact: false },
  { to: "/team/$teamId/matches", label: "Matcher", icon: Trophy, exact: false },
  { to: "/team/$teamId/narvaro", label: "Närvaro", icon: CalendarCheck, exact: false },
  { to: "/team/$teamId/statistik", label: "Statistik", icon: BarChart3, exact: false },
  { to: "/team/$teamId/photos", label: "Bilder", icon: Images, exact: false },
  { to: "/team/$teamId/leaders", label: "Ledare", icon: ShieldCheck, exact: false },
] as const;


function TeamLayout() {
  const { teamId } = useParams({ from: "/_authenticated/team/$teamId" });
  const { status, isApproved, loading } = useTeamRole(teamId);
  const team = useQuery({ queryKey: ["team", teamId], queryFn: () => fetchTeam(teamId) });

  if (!loading && status === "pending") {
    return (
      <main className="mx-auto max-w-md px-4 py-16 text-center">
        <Shield className="mx-auto size-8 text-primary" />
        <h1 className="mt-3 font-display text-2xl font-bold">Väntar på godkännande</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Din tränare behöver godkänna dig innan du kommer åt laget.
        </p>
        <Link to="/" className="mt-6 inline-block text-sm text-primary underline-offset-4 hover:underline">
          Till startsidan
        </Link>
      </main>
    );
  }

  if (!loading && !isApproved) {
    return (
      <main className="mx-auto max-w-md px-4 py-16 text-center text-muted-foreground">
        Du har inte tillgång till det här laget.
      </main>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 pb-24 pt-6">
      <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground">
        <ArrowLeft className="size-4" /> Tillbaka
      </Link>

      <header className="mt-3 flex items-center gap-3">
        <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-secondary">
          {team.data?.photoUrl ? (
            <img src={team.data.photoUrl} alt={team.data.name} className="size-full object-cover" />
          ) : (
            <Shield className="size-6 text-muted-foreground" />
          )}
        </div>
        <div className="min-w-0">
          <h1 className="truncate font-display text-3xl font-bold">{team.data?.name ?? "Laget"}</h1>
          <p className="text-xs text-muted-foreground">
            {[team.data?.club?.name, team.data?.age_group, team.data && TEAM_GENDER_LABELS[team.data.gender]]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
      </header>

      <nav className="mt-5 -mx-4 flex gap-1 overflow-x-auto px-4 pb-2">
        {TABS.map((tab) => (
          <Link
            key={tab.to}
            to={tab.to}
            params={{ teamId }}
            activeOptions={{ exact: tab.exact }}
            className="flex shrink-0 items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-muted-foreground data-[status=active]:border-primary data-[status=active]:bg-primary/10 data-[status=active]:text-foreground"
          >
            <tab.icon className="size-4 text-primary" />
            {tab.label}
          </Link>
        ))}
      </nav>

      <div className="mt-5">
        <Outlet />
      </div>
    </div>
  );
}
