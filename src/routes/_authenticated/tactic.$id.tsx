import { createFileRoute } from "@tanstack/react-router";
import { TacticEditor } from "@/components/TacticEditor";

export const Route = createFileRoute("/_authenticated/tactic/$id")({
  head: () => ({
    meta: [
      { title: "Taktiktavla – bygg och animera spelmoment" },
      {
        name: "description",
        content:
          "Placera spelare på planen, rita löpningar och passningar och animera taktiken steg för steg.",
      },
      { property: "og:title", content: "Taktiktavla – bygg och animera spelmoment" },
      {
        property: "og:description",
        content: "Placera spelare, rita löpningar och animera taktiken.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TacticRoutePage,
  errorComponent: ({ reset }) => (
    <div role="alert" className="mx-auto max-w-md p-8 text-center">
      <h1 className="text-lg font-semibold">Taktiken kunde inte öppnas</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Något gick fel när tavlan skulle laddas. Försök igen om en stund.
      </p>
      <button
        onClick={reset}
        className="mt-5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
      >
        Försök igen
      </button>
    </div>
  ),

  notFoundComponent: () => <div className="p-8 text-center">Taktiken hittades inte.</div>,
});

function TacticRoutePage() {
  const { id } = Route.useParams();
  return <TacticEditor id={id} />;
}
