import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useAccount } from "@/hooks/useAccount";
import { BackButton } from "@/components/BackButton";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Admin – Fotbollsrummet" },
      { name: "description", content: "Administrera alla klubbar, lag, konton och innehåll i Fotbollsrummet." },
      { property: "og:title", content: "Admin – Fotbollsrummet" },
      { property: "og:description", content: "Administrera klubbar, lag, konton och innehåll." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminLayout,
});

const TABS = [
  { to: "/admin", label: "Översikt", exact: true },
  { to: "/admin/konton", label: "Konton", exact: false },
  { to: "/admin/lag", label: "Lag & klubbar", exact: false },
  { to: "/admin/innehall", label: "Innehåll", exact: false },
  { to: "/admin/logg", label: "Logg", exact: false },
] as const;

function AdminLayout() {
  const { isAdmin, loading } = useAccount();
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  if (loading) return <p className="p-8 text-center text-muted-foreground">Laddar…</p>;
  if (!isAdmin) {
    return <p className="p-8 text-center text-muted-foreground">Du har inte behörighet till adminvyn.</p>;
  }

  return (
    <main className="mx-auto max-w-5xl px-4 pb-28 pt-8">
      <BackButton />
      <h1 className="mt-3 font-display text-4xl font-bold">Admin</h1>
      <p className="text-sm text-muted-foreground">Du ser och kan ändra allt i hela plattformen.</p>

      <nav aria-label="Adminflikar" className="mt-5 flex flex-wrap gap-2">
        {TABS.map((tab) => {
          const active = tab.exact ? pathname === tab.to : pathname.startsWith(tab.to);
          return (
            <Link
              key={tab.to}
              to={tab.to}
              className={`rounded-lg border border-border px-3 py-2 text-sm font-semibold ${
                active ? "bg-primary text-primary-foreground" : "bg-card text-foreground hover:bg-accent"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-6">
        <Outlet />
      </div>
    </main>
  );
}
