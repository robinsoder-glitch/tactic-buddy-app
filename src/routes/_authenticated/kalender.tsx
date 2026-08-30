import { createFileRoute, Link, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/kalender")({
  component: CalendarLayout,
});

const TABS = [
  { to: "/kalender", label: "Översikt", exact: true },
  { to: "/kalender/kallelser", label: "Mina kallelser", exact: false },
] as const;

function CalendarLayout() {
  return (
    <main className="mx-auto max-w-2xl px-4 pb-28 pt-8">
      <h1 className="font-display text-3xl font-bold">Kalender</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Alla dina träningar och matcher – och dina kallelser att svara på.
      </p>

      <nav aria-label="Kalenderns flikar" className="mt-4 flex gap-2 border-b border-border pb-2">
        {TABS.map((tab) => (
          <Link
            key={tab.to}
            to={tab.to}
            activeOptions={{ exact: tab.exact }}
            className="rounded-lg px-3 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-foreground data-[status=active]:bg-primary data-[status=active]:text-primary-foreground"
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      <Outlet />
    </main>
  );
}
