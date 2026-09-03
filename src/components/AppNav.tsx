import { useEffect, useRef, useState } from "react";
import { Link, useRouter, useRouterState } from "@tanstack/react-router";
import {
  BookOpen,
  CalendarCheck,
  CalendarDays,
  ClipboardList,
  Dumbbell,
  GraduationCap,
  Menu,
  Mail,
  MessagesSquare,
  Settings,
  Shield,
  ShieldCheck,
  Trophy,
  UserPlus,
  LogOut,
} from "lucide-react";
import { MOBILE_MAIN_LIMIT, SECONDARY_LABEL, isTabActive, tabsForRole } from "@/lib/navigation";
import { useAccount } from "@/hooks/useAccount";
import { useUnreadChat } from "@/hooks/useUnreadChat";
import { useUnreadInbox } from "@/hooks/useUnreadInbox";
import { useOpenInvites } from "@/hooks/useOpenInvites";
import { usePendingJoins } from "@/hooks/usePendingJoins";
import { BrandLogo } from "@/components/BrandLogo";
import { supabase } from "@/integrations/supabase/client";

/** Sidor där huvudmenyn ska vara dold. */
const HIDDEN_PREFIXES = ["/auth", "/t/", "/onboarding"];

const ICONS: Record<string, typeof Menu> = {
  "/planera-traning": ClipboardList,
  "/planera-match": Trophy,
  "/taktik": BookOpen,
  "/kunskapsbank": GraduationCap,
  "/ovningsbank": Dumbbell,
  "/kalender": CalendarDays,
  "/narvaro": CalendarCheck,
  "/spelare": UserPlus,
  "/meddelanden": Mail,
  "/tranarsnack": MessagesSquare,
  "/teams": Shield,
  "/installningar": Settings,
  "/kallelser": MailQuestion,
};

export function AppNav() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const { user, isAdmin, isCoach } = useAccount();
  const unread = useUnreadChat();
  const unreadInbox = useUnreadInbox();
  const { total: pendingJoins } = usePendingJoins();
  const openInvites = useOpenInvites();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLLIElement>(null);
  const deskRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMenuOpen(false), [pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const onPointer = (event: PointerEvent) => {
      const node = event.target as Node;
      if (!menuRef.current?.contains(node) && !deskRef.current?.contains(node)) setMenuOpen(false);
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
  if (HIDDEN_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(prefix)))
    return null;

  const { main: primary, secondary } = tabsForRole(isCoach || isAdmin);
  const mobilePrimary = primary.slice(0, MOBILE_MAIN_LIMIT);
  const mobileSecondary = [...primary.slice(MOBILE_MAIN_LIMIT), ...secondary];

  const secondaryActive =
    secondary.some((tab) => isTabActive(pathname, tab)) || pathname.startsWith("/admin");
  const secondaryBadge =
    (secondary.some((tab) => tab.to === "/meddelanden") ? unreadInbox : 0) +
    (secondary.some((tab) => tab.to === "/tranarsnack") ? unread : 0) +
    (isCoach && secondary.some((tab) => tab.to === "/teams") ? pendingJoins : 0);

  const signOut = async () => {
    setMenuOpen(false);
    await supabase.auth.signOut();
    await router.navigate({ to: "/auth" });
  };

  const barLink =
    "relative flex min-h-[4rem] w-full flex-col items-center justify-center gap-1 px-1 py-2 text-center text-[11px] font-semibold leading-tight text-muted-foreground transition-colors";

  const renderIcon = (to: string, size: string) => {
    const Icon = ICONS[to] ?? Menu;
    const count =
      to === "/kallelser"
        ? openInvites
        : to === "/meddelanden"
        ? unreadInbox
        : to === "/tranarsnack"
          ? unread
          : to === "/teams" && isCoach
            ? pendingJoins
            : 0;
    const label =
      to === "/kallelser"
        ? `${count} obesvarade kallelser`
        : to === "/meddelanden"
        ? `${count} olästa viktiga meddelanden`
        : to === "/tranarsnack"
          ? `${count} olästa meddelanden`
          : `${count} nya ansökningar till laget`;
    return (
      <span className="relative z-10 inline-flex">
        <Icon className={size} aria-hidden />
        {count > 0 && (
          <span
            aria-label={label}
            className="absolute -right-2 -top-1.5 flex size-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold leading-none text-destructive-foreground"
          >
            {count > 9 ? "9+" : count}
          </span>
        )}
      </span>
    );
  };

  return (
    <>
      {/* Dator: fem arbetsområden plus Lag och verktyg. */}
      <nav
        aria-label="Huvudmeny"
        data-testid="app-nav-top"
        className="fixed inset-x-0 top-0 z-40 hidden border-b border-border bg-background/95 backdrop-blur md:block supports-[backdrop-filter]:bg-background/85"
      >
        <div className="mx-auto flex h-14 max-w-6xl flex-nowrap items-stretch gap-3 px-4">
          <Link to="/" className="flex shrink-0 items-center">
            <BrandLogo size={32} />
          </Link>
          <ul className="flex min-w-0 flex-1 flex-nowrap items-stretch gap-1 overflow-x-auto">
            {primary.map((tab) => {
              const active = isTabActive(pathname, tab);
              return (
                <li key={tab.to} className="shrink-0">
                  <Link
                    to={tab.to}
                    aria-current={active ? "page" : undefined}
                    className={`flex h-full items-center whitespace-nowrap border-b-2 px-3 text-sm font-semibold transition-colors ${
                      active
                        ? "border-primary text-foreground"
                        : "border-transparent text-muted-foreground hover:border-border hover:text-foreground"
                    }`}
                  >
                    {tab.label}
                  </Link>
                </li>
              );
            })}
          </ul>

          <div className="relative flex shrink-0 items-center" ref={deskRef}>
            <button
              type="button"
              aria-expanded={menuOpen}
              aria-haspopup="menu"
              onClick={() => setMenuOpen((value) => !value)}
              className={`flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-semibold transition-colors hover:bg-accent ${
                menuOpen || secondaryActive ? "bg-accent text-foreground" : "text-muted-foreground"
              }`}
            >
              <span className="relative inline-flex">
                <Menu className="size-4" aria-hidden />
                {secondaryBadge > 0 && (
                  <span
                    aria-label={`${secondaryBadge} nya notiser`}
                    className="absolute -right-2 -top-1.5 flex size-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold leading-none text-destructive-foreground"
                  >
                    {secondaryBadge > 9 ? "9+" : secondaryBadge}
                  </span>
                )}
              </span>
              <span>{SECONDARY_LABEL}</span>
            </button>
            {menuOpen && (
              <ul
                role="menu"
                aria-label={SECONDARY_LABEL}
                className="absolute right-0 top-[calc(100%+0.25rem)] w-60 overflow-hidden rounded-xl border border-border bg-card shadow-lg"
              >
                {secondary.map((tab) => {
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
                {isAdmin && (
                  <li role="none" className="border-t border-border">
                    <Link
                      role="menuitem"
                      to="/admin"
                      aria-current={pathname.startsWith("/admin") ? "page" : undefined}
                      className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold hover:bg-accent ${pathname.startsWith("/admin") ? "text-primary" : "text-foreground"}`}
                    >
                      <ShieldCheck className="size-4" aria-hidden />
                      Admin
                    </Link>
                  </li>
                )}
                <li role="none" className="border-t border-border">
                  <button
                    role="menuitem"
                    type="button"
                    onClick={() => void signOut()}
                    className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-semibold text-foreground hover:bg-accent"
                  >
                    <LogOut className="size-4" aria-hidden />
                    Logga ut
                  </button>
                </li>
              </ul>
            )}
          </div>
        </div>
      </nav>

      {/* Mobil: fem arbetsområden plus menyn Lag och verktyg. */}
      <nav
        aria-label="Huvudmeny"
        data-testid="app-nav"
        className="fixed inset-x-0 bottom-0 z-40 border-t-2 border-primary bg-background/95 backdrop-blur md:hidden supports-[backdrop-filter]:bg-background/85"
      >
        <ul className="mx-auto flex max-w-3xl items-stretch">
          {mobilePrimary.map((tab) => {
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
              <span className="relative z-10">Lag</span>
            </button>
            {menuOpen && (
              <ul
                role="menu"
                aria-label="Meny"
                className="absolute bottom-[calc(100%+0.5rem)] right-1 w-60 overflow-hidden rounded-xl border border-border bg-card shadow-lg"
              >
                <li role="none" className="border-b border-border px-4 py-3">
                  <span className="text-sm font-bold">{SECONDARY_LABEL}</span>
                </li>
                {mobileSecondary.map((tab) => {
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
                {isAdmin && (
                  <li role="none" className="border-t border-border">
                    <Link
                      role="menuitem"
                      to="/admin"
                      className="flex items-center gap-2 px-4 py-3 text-sm font-semibold text-foreground hover:bg-accent"
                    >
                      <ShieldCheck className="size-4" aria-hidden />
                      Admin
                    </Link>
                  </li>
                )}
                <li role="none" className="border-t border-border">
                  <button
                    role="menuitem"
                    type="button"
                    onClick={() => void signOut()}
                    className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-semibold text-foreground hover:bg-accent"
                  >
                    <LogOut className="size-4" aria-hidden />
                    Logga ut
                  </button>
                </li>
              </ul>
            )}
          </li>
        </ul>
        <div className="h-[env(safe-area-inset-bottom)]" />
      </nav>
    </>
  );
}
