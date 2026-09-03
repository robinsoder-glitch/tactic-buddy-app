import { ExternalLink, AlertTriangle, Info } from "lucide-react";
import {
  buildRulesPresentation,
  type DistrictDeviation,
  type RulesPresentation,
  type VerificationLabel,
} from "@/lib/rules-presentation";

type RulesetInput = {
  id: string;
  format: string;
  season: string | null;
  data: Record<string, unknown>;
};
type DistrictInput = { id: string; name: string; data: Record<string, unknown> };

const STATUS_STYLE: Record<VerificationLabel, string> = {
  Verifierad: "border-primary/50 bg-primary/15 text-foreground",
  "Behöver kontrolleras": "border-amber-500/60 bg-amber-500/15 text-foreground",
  "Ej verifierad": "border-destructive/60 bg-destructive/15 text-foreground",
};

export function StatusBadge({ status }: { status: VerificationLabel }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${STATUS_STYLE[status]}`}
      aria-label={`Status: ${status}`}
    >
      {status}
    </span>
  );
}

function Lines({ text }: { text: string }) {
  return (
    <>
      {text.split("\n").map((line) => (
        <span key={line} className="block">
          {line}
        </span>
      ))}
    </>
  );
}

function DistrictBlock({ district }: { district: DistrictDeviation }) {
  const unverified = district.adminOnly;
  return (
    <div
      className={`rounded-lg border p-3 ${unverified ? "border-destructive/50 bg-destructive/5" : "border-border bg-muted/30"}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-sm font-semibold">{district.name}</h4>
        <StatusBadge status={district.status} />
      </div>
      {district.season && (
        <p className="mt-1 text-xs text-muted-foreground">Säsong {district.season}</p>
      )}
      {unverified && (
        <p className="mt-2 flex gap-2 text-xs text-destructive">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          Den här distriktsuppgiften är inte verifierad och får inte användas som gällande regel.
        </p>
      )}
      {district.lines.length > 0 && (
        <ul className="mt-2 space-y-1 text-sm">
          {district.lines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      )}
      {district.notes.length > 0 && (
        <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
          {district.notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      )}
      {district.source?.url && (
        <a
          href={district.source.url}
          target="_blank"
          rel="noreferrer"
          className="mt-2 inline-flex items-center gap-1 rounded text-xs text-primary underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
        >
          Öppna källa
          <ExternalLink className="h-3 w-3" aria-hidden="true" />
        </a>
      )}
    </div>
  );
}

export function RulesetView({
  view,
  isAdmin = false,
}: {
  view: RulesPresentation;
  isAdmin?: boolean;
}) {
  const publicDistricts = view.districts.filter((district) => !district.adminOnly);
  const adminDistricts = view.districts.filter((district) => district.adminOnly);

  return (
    <article className="rounded-xl border border-border bg-card p-4 sm:p-6">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 sm:flex sm:flex-wrap sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 className="font-display text-2xl font-bold">{view.formatLabel}</h2>
          <p className="text-sm text-muted-foreground">{view.rulesetName}</p>
          <dl className="mt-2 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
            <div className="flex gap-2">
              <dt className="text-muted-foreground">Säsong:</dt>
              <dd className="font-medium">{view.seasonLabel}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-muted-foreground">Senast granskad:</dt>
              <dd className="font-medium">{view.reviewedLabel}</dd>
            </div>
          </dl>
        </div>
        <StatusBadge status={view.status} />
      </header>

      {view.source && (
        <p className="mt-3 text-sm">
          <span className="text-muted-foreground">Källa: </span>
          {view.source.url ? (
            <a
              href={view.source.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 rounded font-medium text-primary underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
              aria-label={`Öppna källa: ${view.source.title}`}
            >
              Öppna källa
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            </a>
          ) : (
            <span>{view.source.title}</span>
          )}
        </p>
      )}

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {view.sections.map((item) => (
          <section
            key={item.key}
            className="rounded-lg border border-border bg-background/60 p-3"
            aria-label={item.title}
          >
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-display text-base font-semibold">{item.title}</h3>
              {item.missing && <StatusBadge status="Behöver kontrolleras" />}
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">{item.intro}</p>
            <p className="mt-2 text-sm font-medium leading-relaxed">
              <Lines text={item.value} />
            </p>
            {item.help && (
              <p className="mt-2 flex gap-2 text-xs text-muted-foreground">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                {item.help}
              </p>
            )}
          </section>
        ))}
      </div>

      {publicDistricts.length > 0 && (
        <div className="mt-5">
          <h3 className="font-display text-lg font-semibold">Distrikt med egna regler</h3>
          <p className="text-xs text-muted-foreground">
            Den nationella regeln gäller om inget annat står här.
          </p>
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            {publicDistricts.map((district) => (
              <DistrictBlock key={district.id} district={district} />
            ))}
          </div>
        </div>
      )}

      {isAdmin && adminDistricts.length > 0 && (
        <div className="mt-5 rounded-lg border border-dashed border-destructive/50 p-3">
          <h3 className="font-display text-base font-semibold">
            Endast admin: ej verifierade distriktsuppgifter
          </h3>
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            {adminDistricts.map((district) => (
              <DistrictBlock key={district.id} district={district} />
            ))}
          </div>
        </div>
      )}
    </article>
  );
}

export function RulesView({
  rulesets,
  districts,
  isAdmin = false,
}: {
  rulesets: RulesetInput[];
  districts: DistrictInput[];
  isAdmin?: boolean;
}) {
  if (rulesets.length === 0) {
    return <p className="text-sm text-muted-foreground">Inga regelverk finns att visa just nu.</p>;
  }
  return (
    <div className="space-y-4 pb-24">
      {rulesets.map((ruleset) => (
        <RulesetView
          key={ruleset.id}
          view={buildRulesPresentation(ruleset, districts)}
          isAdmin={isAdmin}
        />
      ))}
    </div>
  );
}
