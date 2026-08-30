import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { LINK_TYPE_LABELS, type RelatedItem, type RelatedSection } from "@/lib/content-links";

function ItemCard({ item }: { item: RelatedItem }) {
  const inner = (
    <>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{LINK_TYPE_LABELS[item.type]}</p>
      <p className="mt-1 font-display text-sm font-semibold">{item.title}</p>
      {item.note && <p className="mt-1 text-xs text-muted-foreground">{item.note}</p>}
      <span className="mt-2 inline-flex items-center gap-1 text-xs text-primary">
        Öppna <ArrowRight className="size-3.5" />
      </span>
    </>
  );
  const className = "block rounded-xl border border-border bg-card p-3 transition hover:border-primary";
  const aria = `${LINK_TYPE_LABELS[item.type]}: ${item.title}`;

  if (item.type === "article") {
    return (
      <Link to="/kunskapsbank/$slug" params={{ slug: item.id }} aria-label={aria} className={className}>
        {inner}
      </Link>
    );
  }
  if (item.type === "tactic") {
    return (
      <Link to="/taktikbank/$cardId" params={{ cardId: item.id }} aria-label={aria} className={className}>
        {inner}
      </Link>
    );
  }
  const flik = item.type === "goalkeeper" ? "malvakt" : item.type === "session" ? "pass" : "ovningar";
  return (
    <Link to="/ovningsbank" search={{ flik, markera: item.id }} aria-label={aria} className={className}>
      {inner}
    </Link>
  );
}

export function RelatedContent({ sections }: { sections: RelatedSection[] }) {
  if (!sections.length) return null;
  return (
    <div className="mt-6 space-y-5">
      {sections.map((section) => (
        <section key={section.title} aria-label={section.title}>
          <h2 className="font-display text-sm uppercase tracking-[0.2em] text-muted-foreground">{section.title}</h2>
          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {section.items.map((item) => (
              <ItemCard key={`${item.type}:${item.id}`} item={item} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
