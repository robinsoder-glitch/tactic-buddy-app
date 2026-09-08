import { createFileRoute, redirect } from "@tanstack/react-router";

/** Tränarsnack finns numera på en enda sida – laget följer med som parameter. */
export const Route = createFileRoute("/_authenticated/team/$teamId/tranarsnack")({
  beforeLoad: ({ params }) => {
    throw redirect({ to: "/tranarsnack", search: { team: params.teamId } });
  },
  component: () => null,
});
