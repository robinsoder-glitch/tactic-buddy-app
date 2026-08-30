import { useEffect, useRef, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  BookOpen,
  Dumbbell,
  GraduationCap,
  Home,
  MoreHorizontal,
  Settings,
  Shield,
  Users,
} from "lucide-react";
import { useAccount } from "@/hooks/useAccount";

/** Paths where the global navigation should stay hidden. */
const HIDDEN_PREFIXES = ["/auth", "/t/", "/onboarding"];

type NavItem = {
  to: string;
  label: string;
  icon: typeof Home;
  exact: boolean;
  teamId?: string;
};

export function AppNav() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const { user, isCoach, isAdmin, memberships } = useAccount();
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLLIElement>(null);

  useEffect(() => setMoreOpen(false), [pathname]);

  useEffect(() => {
    if (!moreOpen) return;
    const onPointer = (event: PointerEvent) => {
      if (!moreRef.current?.contains(event.target as Node)) setMoreOpen(false);
    };
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setMoreOpen(false);
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [moreOpen]);

  if (!user) return null;
  if (HIDDEN_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(prefix))) return null;

  const approved = memberships.filter((item) => item.status === "approved");
  const firstTeam = approved[0]?.team_id ?? null;

  const teamItem: NavItem = isCoach
    ? { to: "/teams", label: "Mina lag", icon: Shield, exact: false }
    : firstTeam
      ? { to: "/team/$teamId", label: "Mitt lag", icon: Users, exact: false, teamId: firstTeam }
      : { to: "/onboarding", label: "Gå med", icon: Users, exact: false };

  const settingsItem: NavItem = { to: "/installningar", label: "Inställningar", icon: Settings, exact: false };

  const primary: NavItem[] = [
    { to: "/", label: "Hem", icon: Home, exact: true },
    ...(isCoach || isAdmin
      ? [
          { to: "/taktikbank", label: "Taktikbank", icon: BookOpen, exact: false },
          { to: "/ovningsbank", label: "Övningsbank", icon: Dumbbell, exact: false },
        ]
      : []),
    { to: "/kunskapsbank", label: "Kunskapsbank", icon: GraduationCap, exact: false },
  ];

  const secondary: NavItem[] = [
    ...(isCoach || isAdmin
      ? [{ to: "/traningspass", label: "Mina träningspass", icon: ClipboardList, exact: false }]
      : []),
    teamItem,
    settingsItem,
  ];

  const linkClass =
    "relative flex min-h-[4rem] flex-col items-center justify-center gap-1 px-1 py-2 text-center text-[11px] font-semibold leading-tight text-muted-foreground transition-colors before:absolute before:inset-x-1 before:top-1 before:bottom-1 before:-z-10 before:rounded-xl before:bg-transparent before:transition-colors hover:before:bg-accent data-[status=active]:text-primary-foreground data-[status=active]:before:bg-primary";

  const renderLink = (item: NavItem) => (
    <Link
      to={item.to}
      {...(item.teamId ? { params: { teamId: item.teamId } } : {})}
      activeOptions={{ exact: item.exact }}
      className={linkClass}
    >
      <item.icon className="relative z-10 size-5" aria-hidden />
      <span className="relative z-10">{item.label}</span>
    </Link>
  );

  return (
    <nav
      aria-label="Huvudmeny"
      data-testid="app-nav"
      className="fixed inset-x-0 bottom-0 z-40 border-t-2 border-primary bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/85"
    >
      {/* Mobil: fem val där sista är "Mer". */}
      <ul className="mx-auto flex max-w-3xl items-stretch md:hidden">
        {primary.map((item) => (
          <li key={item.label} className="min-w-0 flex-1">
            {renderLink(item)}
          </li>
        ))}
        <li className="relative min-w-0 flex-1" ref={moreRef}>
          <button
            type="button"
            aria-expanded={moreOpen}
            aria-haspopup="menu"
            onClick={() => setMoreOpen((value) => !value)}
            className={`${linkClass} w-full ${moreOpen ? "text-primary" : ""}`}
          >
            <MoreHorizontal className="relative z-10 size-5" aria-hidden />
            <span className="relative z-10">Mer</span>
          </button>
          {moreOpen && (
            <ul
              role="menu"
              aria-label="Mer"
              className="absolute bottom-[calc(100%+0.5rem)] right-1 w-48 overflow-hidden rounded-xl border border-border bg-card shadow-lg"
            >
              {secondary.map((item) => (
                <li key={item.label} role="none">
                  <Link
                    role="menuitem"
                    to={item.to}
                    {...(item.teamId ? { params: { teamId: item.teamId } } : {})}
                    activeOptions={{ exact: item.exact }}
                    className="flex items-center gap-2 px-4 py-3 text-sm font-semibold text-foreground hover:bg-accent data-[status=active]:text-primary"
                  >
                    <item.icon className="size-4" aria-hidden />
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </li>
      </ul>

      {/* Dator: hela navigationen syns direkt. */}
      <ul className="mx-auto hidden max-w-3xl items-stretch md:flex">
        {[...primary, ...secondary].map((item) => (
          <li key={item.label} className="min-w-0 flex-1">
            {renderLink(item)}
          </li>
        ))}
      </ul>
      <div className="h-[env(safe-area-inset-bottom)]" />
    </nav>
  );
}
