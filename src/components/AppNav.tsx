import { useEffect, useRef, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  BookOpen,
  CalendarDays,
  ClipboardList,
  Dumbbell,
  GraduationCap,
  Menu,
  MessagesSquare,
  Settings,
  Shield,
  Trophy,
} from "lucide-react";
import { MAIN_TABS, MOBILE_PRIMARY, isTabActive } from "@/lib/navigation";
import { useAccount } from "@/hooks/useAccount";
import { useUnreadChat } from "@/hooks/useUnreadChat";
import { BrandLogo } from "@/components/BrandLogo";

/** Sidor där huvudmenyn ska vara dold. */
const HIDDEN_PREFIXES = ["/auth", "/t/", "/onboarding"];

const ICONS: Record<string, typeof Menu> = {
  "/planera-traning": ClipboardList,
  "/planera-match": Trophy,
  "/taktik": BookOpen,
  "/kunskapsbank": GraduationCap,
  "/ovningsbank": Dumbbell,
  "/kalender": CalendarDays,
  "/tranarsnack": MessagesSquare,
  "/teams": Shield,
  "/installningar": Settings,
};

export function AppNav() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const { user } = useAccount();
  const unread = useUnreadChat();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLLIElement>(null);

  useEffect(() => setMenuOpen(false), [pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const onPointer = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setMenuOpen(false);
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  if (!user) return null;
  if (HIDDEN_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(prefix))) return null;

  const primary = MAIN_TABS.filter((tab) => MOBILE_PRIMARY.includes(tab.to));

  const topLink =
    "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-foreground";

  const barLink =
    "relative flex min-h-[4rem] w-full flex-col items-center justify-center gap-1 px-1 py-2 text-center text-[11px] font-semibold leading-tight text-muted-foreground transition-colors";

  const renderIcon = (to: string, size: string) => {
    const Icon = ICONS[to] ?? Menu;
    const badge = to === "/tranarsnack" && unread > 0;
    return (
      <span className="relative z-10 inline-flex">
        <Icon className={size} aria-hidden />
        {badge && (
          <span
            aria-label={`${unread} olästa meddelanden`}
            className="absolute -right-2 -top-1.5 flex size-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold leading-none text-destructive-foreground"
          >
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </span>
    );
  };

  return (
    <>
      {/* Dator: alla åtta flikar i toppen. */}
      <nav
        aria-label="Huvudmeny"
        data-testid="app-nav-top"
        className="fixed inset-x-0 top-0 z-40 hidden border-b border-border bg-background/95 backdrop-blur md:block supports-[backdrop-filter]:bg-background/85"
      >
        <div className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-2">
          <Link to="/" className="mr-2 shrink-0">
            <BrandLogo size={36} />
          </Link>
          <ul className="flex flex-1 flex-wrap items-center gap-1">
            {MAIN_TABS.map((tab) => {
              const active = isTabActive(pathname, tab);
              return (
                <li key={tab.to}>
                  <Link
                    to={tab.to}
                    aria-current={active ? "page" : undefined}
                    className={`${topLink} ${active ? "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground" : ""}`}
                  >
                    {renderIcon(tab.to, "size-4")}
                    <span>{tab.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </nav>

      {/* Mobil: fyra val plus en meny med alla åtta. */}
      <nav
        aria-label="Huvudmeny"
        data-testid="app-nav"
        className="fixed inset-x-0 bottom-0 z-40 border-t-2 border-primary bg-background/95 backdrop-blur md:hidden supports-[backdrop-filter]:bg-background/85"
      >
        <ul className="mx-auto flex max-w-3xl items-stretch">
          {primary.map((tab) => {
            const active = isTabActive(pathname, tab);
            return (
              <li key={tab.to} className="min-w-0 flex-1">
                <Link
                  to={tab.to}
                  aria-current={active ? "page" : undefined}
                  className={`${barLink} ${active ? "bg-primary text-primary-foreground" : ""}`}
                >
                  {renderIcon(tab.to, "size-5")}
                  <span className="relative z-10">{tab.label}</span>
                </Link>
              </li>
            );
          })}
          <li className="relative min-w-0 flex-1" ref={menuRef}>
            <button
              type="button"
              aria-expanded={menuOpen}
              aria-haspopup="menu"
              onClick={() => setMenuOpen((value) => !value)}
              className={`${barLink} ${menuOpen ? "text-primary" : ""}`}
            >
              <Menu className="relative z-10 size-5" aria-hidden />
              <span className="relative z-10">Meny</span>
            </button>
            {menuOpen && (
              <ul
                role="menu"
                aria-label="Meny"
                className="absolute bottom-[calc(100%+0.5rem)] right-1 w-60 overflow-hidden rounded-xl border border-border bg-card shadow-lg"
              >
                <li role="none" className="border-b border-border px-4 py-3">
                  <BrandLogo size={32} nameClassName="font-display text-sm font-bold" />
                </li>
                {MAIN_TABS.map((tab) => {
                  const active = isTabActive(pathname, tab);
                  return (
                    <li key={tab.to} role="none">
                      <Link
                        role="menuitem"
                        to={tab.to}
                        aria-current={active ? "page" : undefined}
                        className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold hover:bg-accent ${active ? "text-primary" : "text-foreground"}`}
                      >
                        {renderIcon(tab.to, "size-4")}
                        {tab.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </li>
        </ul>
        <div className="h-[env(safe-area-inset-bottom)]" />
      </nav>
    </>
  );
}
