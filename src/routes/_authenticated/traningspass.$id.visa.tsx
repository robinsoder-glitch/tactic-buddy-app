import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Pencil, Printer } from "lucide-react";
import {
  fetchCoachSession,
  fetchSessionItems,
  ITEM_KIND_LABELS,
  minutesLabel,
  totalMinutes,
  type ItemKind,
} from "@/lib/coach-sessions";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/traningspass/$id/visa")({
  head: () => ({
    meta: [
      { title: "Visa träningspass – körschema" },
      {
        name: "description",
        content: "Kör träningspasset steg för steg med tider, anteckningar och möjlighet att skriva ut som PDF.",
      },
      { property: "og:title", content: "Visa träningspass" },
      { property: "og:description", content: "Körschema för träningen med tider och coachpunkter." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SessionView,
});

function SessionView() {
  const { id } = Route.useParams();
  const session = useQuery({ queryKey: ["coach-session", id], queryFn: () => fetchCoachSession(id) });
  const items = useQuery({ queryKey: ["coach-session-items", id], queryFn: () => fetchSessionItems(id) });

  if (session.isLoading) {
    return <main className="mx-auto max-w-3xl px-4 py-10 text-sm text-muted-foreground">Laddar träningspasset…</main>;
  }

  if (!session.data) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        <p className="text-sm text-muted-foreground">Träningspasset kunde inte hittas.</p>
        <Button asChild className="mt-4" variant="outline">
          <Link to="/traningspass">Tillbaka till Mina träningspass</Link>
        </Button>
      </main>
    );
  }

  const list = items.data ?? [];
  let elapsed = 0;

  return (
    <main className="mx-auto max-w-3xl px-4 pb-32 pt-6 print:pt-0">
      <header className="flex items-center gap-2 print:hidden">
        <Button asChild variant="ghost" size="icon" aria-label="Tillbaka till Mina träningspass">
          <Link to="/traningspass">
            <ArrowLeft className="size-5" />
          </Link>
        </Button>
        <div className="flex-1" />
        <Button asChild variant="outline" size="sm">
          <Link to="/traningspass/$id" params={{ id }}>
            <Pencil className="size-4" /> Redigera
          </Link>
        </Button>
        <Button variant="outline" size="sm" onClick={() => window.print()} aria-label="Skriv ut eller spara som PDF">
          <Printer className="size-4" /> Skriv ut / PDF
        </Button>
      </header>

      <section className="mt-4">
        <h1 className="font-display text-3xl font-bold uppercase">{session.data.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {[
            session.data.session_date,
            session.data.age_group,
            session.data.game_format,
            session.data.theme,
            `Total tid: ${minutesLabel(totalMinutes(list))}`,
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
            <li key={item.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-display text-lg font-semibold">
                  {index + 1}. {item.title}
                </p>
                <p className="text-xs text-muted-foreground">
                  {start}–{elapsed} min · {minutesLabel(item.minutes)}
                </p>
              </div>
              <p className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">
                {ITEM_KIND_LABELS[item.kind as ItemKind] ?? "Egen aktivitet"}
              </p>
              {item.note && <p className="mt-2 text-sm">{item.note}</p>}
            </li>
          );
        })}
      </ol>

      {session.data.notes && (
        <section className="mt-6 rounded-xl border border-border bg-card p-4">
          <h2 className="font-display text-lg font-semibold">Tränarens anteckningar</h2>
          <p className="mt-2 whitespace-pre-wrap text-sm">{session.data.notes}</p>
        </section>
      )}
    </main>
  );
}
