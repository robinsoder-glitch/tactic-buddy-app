import { createFileRoute, Outlet } from "@tanstack/react-router";
import { CoachOnly } from "@/components/CoachOnly";

export const Route = createFileRoute("/_authenticated/traningspass/$id")({
  component: () => (
    <CoachOnly>
      <Outlet />
    </CoachOnly>
  ),
});
