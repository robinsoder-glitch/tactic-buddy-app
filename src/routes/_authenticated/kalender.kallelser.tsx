import { createFileRoute, redirect } from "@tanstack/react-router";

/** Kallelser har flyttat till en egen sida – kalendern visar bara aktiviteter. */
export const Route = createFileRoute("/_authenticated/kalender/kallelser")({
  beforeLoad: () => {
    throw redirect({ to: "/kallelser" });
  },
  component: () => null,
});
