import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Pencil, Printer } from "lucide-react";
import {
  fetchCoachSession,
  fetchSessionItems,
  ITEM_KIND_LABELS,
  minutesLabel,
  SESSION_STATUS_LABELS,
  totalMinutes,
  type CoachSessionItem,
  type ItemKind,
} from "@/lib/coach-sessions";
import { BackIconButton } from "@/components/BackLink";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/traningspass/$id/visa")({
  head: () => ({
    meta: [
      { title: "Visa träningspass – körschema" },
      {
        name: "description",
        content:
          "Kör träningspasset steg för steg med tider, anteckningar och möjlighet att skriva ut som PDF.",
      },
      { property: "og:title", content: "Visa träningspass" },
      {
        property: "og:description",
        content: "Körschema för träningen med tider och coachpunkter.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SessionView,
});

/** Länk tillbaka till innehållets ursprung i bankerna, när en referens finns. */
function SourceLink({ item }: { item: CoachSessionItem }) {
  if (!item.resource_id) return null;
  const label = "Öppna i banken";
  const className =
    "mt-2 inline-block text-sm text-primary underline-offset-4 hover:underline print:hidden";

  if (item.kind === "tactic") {
    return (
      <Link to="/taktikbank/$cardId" params={{ cardId: item.resource_id }} className={className}>
        {label}: Taktikbanken
      </Link>
    );
  }
  if (item.kind === "article") {
    return (
      <Link to="/kunskapsbank/$slug" params={{ slug: item.resource_id }} className={className}>
        {label}: Kunskapsbanken
      </Link>
    );
  }
  if (item.kind === "drill" || item.kind === "goalkeeper") {
    return (
      <Link
        to="/ovningsbank"
        search={{ flik: item.kind === "drill" ? "ovningar" : "malvakt", markera: item.resource_id }}
        className={className}
      >
        {label}: Träningsbanken
      </Link>
    );
  }
  return null;
}

function SessionView() {
  const { id } = Route.useParams();
  const session = useQuery({
    queryKey: ["coach-session", id],
    queryFn: () => fetchCoachSession(id),
  });
  const items = useQuery({
    queryKey: ["coach-session-items", id],
    queryFn: () => fetchSessionItems(id),
  });

  if (session.isLoading) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10 text-sm text-muted-foreground">
        Laddar träningspasset…
      </main>
    );
  }

  if (!session.data) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        <p className="text-sm text-muted-foreground">Träningspasset kunde inte hittas.</p>
        <Button asChild className="mt-4" variant="outline">
          <Link to="/traningspass">Tillbaka till Mina träningar</Link>
        </Button>
      </main>
    );
  }

  const list = items.data ?? [];
  let elapsed = 0;

  return (
    <main className="print-area mx-auto max-w-3xl px-4 pb-32 pt-6 print:pt-0">
      <header className="flex items-center gap-2 print:hidden">
        <BackIconButton fallback="/traningspass" label="Tillbaka till Mina träningar" />
        <div className="flex-1" />
        <Button asChild variant="outline" size="sm">
          <Link to="/traningspass/$id" params={{ id }} aria-label="Redigera träningspass">
            <Pencil className="size-4" /> Redigera träningspass
          </Link>
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => window.print()}
          aria-label="Skriv ut eller spara som PDF"
        >
          <Printer className="size-4" /> Skriv ut eller spara som PDF
        </Button>
      </header>

      <section className="mt-4">
        <h1 className="font-display text-3xl font-bold">{session.data.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {[
            session.data.session_date,
            session.data.age_group,
            session.data.game_format,
            session.data.theme,
            `Status: ${SESSION_STATUS_LABELS[session.data.status] ?? "Utkast"}`,
            minutesLabel(totalMinutes(list)),
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
        {session.data.goal && (
          <p className="mt-3 rounded-lg border border-border bg-card p-3 text-sm">
            <span className="font-semibold">Målsättning: </span>
            {session.data.goal}
          </p>
        )}
      </section>

      {list.length === 0 && (
        <p className="mt-6 text-sm text-muted-foreground">
          Träningspasset har inga delar ännu. Lägg till innehåll i redigeringsläget.
        </p>
      )}

      <ol className="mt-5 space-y-3">
        {list.map((item, index) => {
          const start = elapsed;
          elapsed += item.minutes;
          return (
            <li key={item.id} className="print-block rounded-xl border border-border bg-card p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-display text-lg font-semibold">
                  {index + 1}. {item.title}
                </p>
                <p className="text-xs text-muted-foreground">
                  {start}–{elapsed} min · {item.minutes} minuter
                </p>
              </div>
              <p className="mt-1 text-xs tracking-wide text-muted-foreground">
                {ITEM_KIND_LABELS[item.kind as ItemKind] ?? "Egen aktivitet"}
              </p>
              {item.note && <p className="mt-2 text-sm">{item.note}</p>}
              <SourceLink item={item} />
            </li>
          );
        })}
      </ol>

      <p className="mt-5 font-display text-base font-semibold">
        {minutesLabel(totalMinutes(list))}
      </p>

      {session.data.notes && (
        <section className="print-block mt-6 rounded-xl border border-border bg-card p-4">
          <h2 className="font-display text-lg font-semibold">Tränarens anteckningar</h2>
          <p className="mt-2 whitespace-pre-wrap text-sm">{session.data.notes}</p>
        </section>
      )}
    </main>
  );
}
