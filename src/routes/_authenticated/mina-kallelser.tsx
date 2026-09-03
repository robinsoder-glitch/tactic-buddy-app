import { createFileRoute, redirect } from "@tanstack/react-router";

/** Gammal adress – leder vidare till sidan med matchkallelser. */
export const Route = createFileRoute("/_authenticated/mina-kallelser")({
  beforeLoad: () => {
    throw redirect({ to: "/kallelser" });
  },
  component: () => null,
});
