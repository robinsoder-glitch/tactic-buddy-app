import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/kalender")({
  component: CalendarLayout,
});

function CalendarLayout() {
  return (
    <main className="mx-auto max-w-2xl px-4 pb-28 pt-8">
      <h1 className="font-display text-3xl font-bold">Kalender</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Alla lagets träningar och matcher. Kallelser till matcher hittar du under Mina kallelser.
      </p>

      <Outlet />
    </main>
  );
}
