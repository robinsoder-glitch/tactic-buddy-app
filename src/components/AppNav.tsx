import { useEffect, useRef, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  BookOpen,
  CalendarDays,
  ClipboardList,
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
  const canCoach = isCoach || isAdmin;

  const teamItem: NavItem = isCoach
    ? { to: "/teams", label: "Mina lag", icon: Shield, exact: false }
    : firstTeam
      ? { to: "/team/$teamId", label: "Mitt lag", icon: Users, exact: false, teamId: firstTeam }
      : { to: "/onboarding", label: "Gå med", icon: Users, exact: false };

  const settingsItem: NavItem = { to: "/installningar", label: "Inställningar", icon: Settings, exact: false };

  /** Mobil: Hem, Taktik, Träning, Kunskap, Mer. */
  const primary: NavItem[] = [
    { to: "/", label: "Hem", icon: Home, exact: true },
    ...(canCoach ? [{ to: "/taktikbank", label: "Taktik", icon: BookOpen, exact: false }] : []),
    canCoach
      ? { to: "/traningspass", label: "Träning", icon: ClipboardList, exact: false }
      : teamItem,
    { to: "/kunskapsbank", label: "Kunskap", icon: GraduationCap, exact: false },
  ];

  const secondary: NavItem[] = [
    { to: "/mina-kallelser", label: "Mina kallelser", icon: CalendarDays, exact: false },
    ...(canCoach ? [{ to: "/ovningsbank", label: "Träningsbank", icon: Dumbbell, exact: false }] : []),
    ...(canCoach ? [teamItem] : []),
    settingsItem,
  ];

  const barLink =
    "relative flex min-h-[4rem] flex-col items-center justify-center gap-1 px-1 py-2 text-center text-[11px] font-semibold leading-tight text-muted-foreground transition-colors before:absolute before:inset-x-1 before:top-1 before:bottom-1 before:-z-10 before:rounded-xl before:bg-transparent before:transition-colors hover:before:bg-accent data-[status=active]:text-primary-foreground data-[status=active]:before:bg-primary";

  const topLink =
    "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-foreground data-[status=active]:bg-primary data-[status=active]:text-primary-foreground";

  const renderLink = (item: NavItem, className: string, iconSize: string) => (
    <Link
      to={item.to}
      {...(item.teamId ? { params: { teamId: item.teamId } } : {})}
      activeOptions={{ exact: item.exact }}
      className={className}
    >
      <item.icon className={`relative z-10 ${iconSize}`} aria-hidden />
      <span className="relative z-10">{item.label}</span>
    </Link>
  );

  return (
    <>
      {/* Dator: toppnavigation. */}
      <nav
        aria-label="Huvudmeny"
        data-testid="app-nav-top"
        className="fixed inset-x-0 top-0 z-40 hidden border-b border-border bg-background/95 backdrop-blur md:block supports-[backdrop-filter]:bg-background/85"
      >
        <div className="mx-auto flex max-w-5xl items-center gap-2 px-4 py-2">
          <Link to="/" className="mr-2 font-display text-base font-bold text-foreground">
            Taktiktavlan
          </Link>
          <ul className="flex flex-1 items-center gap-1">
            {[...primary, ...secondary].map((item) => (
              <li key={item.label}>{renderLink(item, topLink, "size-4")}</li>
            ))}
          </ul>
        </div>
      </nav>

      {/* Mobil: bottenmeny med fem val där sista är "Mer". */}
      <nav
        aria-label="Huvudmeny"
        data-testid="app-nav"
        className="fixed inset-x-0 bottom-0 z-40 border-t-2 border-primary bg-background/95 backdrop-blur md:hidden supports-[backdrop-filter]:bg-background/85"
      >
        <ul className="mx-auto flex max-w-3xl items-stretch">
          {primary.map((item) => (
            <li key={item.label} className="min-w-0 flex-1">
              {renderLink(item, barLink, "size-5")}
            </li>
          ))}
          <li className="relative min-w-0 flex-1" ref={moreRef}>
            <button
              type="button"
              aria-expanded={moreOpen}
              aria-haspopup="menu"
              aria-label="Fler sidor"
              onClick={() => setMoreOpen((value) => !value)}
              className={`${barLink} w-full ${moreOpen ? "text-primary" : ""}`}
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
        <div className="h-[env(safe-area-inset-bottom)]" />
      </nav>
    </>
  );
}
