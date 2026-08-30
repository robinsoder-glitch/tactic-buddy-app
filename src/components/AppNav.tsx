import { Link, useRouterState } from "@tanstack/react-router";
import { BookOpen, Home, Settings, Shield, Users } from "lucide-react";
import { useAccount } from "@/hooks/useAccount";

/** Paths where the global navigation should stay hidden. */
const HIDDEN_PREFIXES = ["/auth", "/t/", "/onboarding"];

export function AppNav() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const { user, isCoach, isAdmin, memberships } = useAccount();

  if (!user) return null;
  if (HIDDEN_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(prefix))) return null;

  const approved = memberships.filter((item) => item.status === "approved");
  const firstTeam = approved[0]?.team_id ?? null;

  const items = [
    { to: "/", label: "Hem", icon: Home, exact: true as const },
    ...(isCoach || isAdmin
      ? [{ to: "/taktikbank", label: "Taktikbank", icon: BookOpen, exact: false as const }]
      : []),
    isCoach
      ? { to: "/teams", label: "Mina lag", icon: Shield, exact: false as const }
      : firstTeam
        ? { to: "/team/$teamId", label: "Mitt lag", icon: Users, exact: false as const, teamId: firstTeam }
        : { to: "/onboarding", label: "Gå med", icon: Users, exact: false as const },
    { to: "/installningar", label: "Inställningar", icon: Settings, exact: false as const },
  ];

  return (
    <nav
      aria-label="Huvudmeny"
      className="fixed inset-x-0 bottom-0 z-40 border-t-2 border-primary bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/85"
    >
      <ul className="mx-auto flex max-w-3xl items-stretch">
        {items.map((item) => (
          <li key={item.label} className="flex-1">
            <Link
              to={item.to}
              {...("teamId" in item ? { params: { teamId: item.teamId as string } } : {})}
              activeOptions={{ exact: item.exact }}
              className="group relative flex min-h-[4.25rem] flex-col items-center justify-center gap-1 px-1 py-2 text-[13px] font-semibold text-muted-foreground transition-colors data-[status=active]:text-primary-foreground"
            >
              <span className="absolute inset-x-1 top-1 bottom-1 -z-10 rounded-xl bg-transparent transition-colors group-hover:bg-accent data-[status=active]:bg-primary" />
              <span className="absolute inset-x-0 top-0 h-1 rounded-b-sm bg-transparent transition-colors data-[status=active]:bg-primary" />
              <item.icon className="size-6" aria-hidden />
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
      <div className="h-[env(safe-area-inset-bottom)]" />
    </nav>
  );
}
