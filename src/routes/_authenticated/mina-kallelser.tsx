import { createFileRoute, redirect } from "@tanstack/react-router";

/** Gammal adress – leder vidare till kalenderns underflik med kallelser. */
export const Route = createFileRoute("/_authenticated/mina-kallelser")({
  beforeLoad: () => {
    throw redirect({ to: "/kalender/kallelser" });
  },
  component: () => null,
});
