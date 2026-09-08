import { createFileRoute, Link } from "@tanstack/react-router";
import { BookOpen, CalendarCheck, ClipboardList, Dumbbell, Trophy, UserPlus } from "lucide-react";
import { CoachOnly } from "@/components/CoachOnly";

export const Route = createFileRoute("/_authenticated/planera")({
  head: () => ({
    meta: [
      { title: "Planera – träning, match och trupp | Fotbollsrummet" },
      {
        name: "description",
        content:
          "Samlad ingång för tränare: planera träning och match, följ närvaro, hantera truppen och hämta övningar och taktik.",
      },
      { property: "og:title", content: "Planera – träning, match och trupp" },
      {
        property: "og:description",
        content: "Allt tränaren planerar samlat på ett ställe.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <CoachOnly>
      <PlanHubPage />
    </CoachOnly>
  ),
});

const CARDS = [
  {
    to: "/planera-traning",
    label: "Planera träning",
    text: "Bygg passet med övningar, tider och mål.",
    icon: ClipboardList,
  },
  {
    to: "/planera-match",
    label: "Matcher",
    text: "Uttagning, laguppställning och matchplan.",
    icon: Trophy,
  },
  {
    to: "/narvaro",
    label: "Närvaro",
    text: "Se vilka som varit med och följ upp frånvaro.",
    icon: CalendarCheck,
  },
  {
    to: "/spelare",
    label: "Spelare",
    text: "Lägg till spelare och bjud in familjen.",
    icon: UserPlus,
  },
  {
    to: "/ovningsbank",
    label: "Träningsbank",
    text: "Färdiga övningar att lägga in i passet.",
    icon: Dumbbell,
  },
  {
    to: "/taktik",
    label: "Taktik",
    text: "Rita och spara taktik till matchen.",
    icon: BookOpen,
  },
] as const;

function PlanHubPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 pb-28 pt-8 md:pt-20">
      <header>
        <h1 className="font-display text-3xl font-bold">Planera</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Allt du planerar som tränare – träning, match, trupp och material.
        </p>
      </header>

      <ul className="mt-6 grid gap-3 sm:grid-cols-2">
        {CARDS.map((card) => (
          <li key={card.to}>
            <Link
              to={card.to}
              className="flex h-full items-start gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary hover:bg-accent"
            >
              <card.icon className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
              <span>
                <span className="block font-semibold">{card.label}</span>
                <span className="mt-0.5 block text-sm text-muted-foreground">{card.text}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
