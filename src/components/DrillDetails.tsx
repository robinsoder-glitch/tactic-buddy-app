import type { Drill } from "@/lib/taktikbank";
import { DRILL_FIELD_LABELS, missingDrillFields } from "@/lib/drill-quality";
import { drillDurationLabel } from "@/lib/drill-duration";

function Facts({ drill }: { drill: Drill }) {
  const facts: Array<[string, string]> = [];
  const data = drill.data;
  if (data.ageFit) facts.push(["Ålder", `${data.ageFit.min}–${data.ageFit.max} år`]);
  if (data.format) facts.push(["Spelform", data.format.replace("v", " mot ")]);
  if (data.players) facts.push(["Spelare", data.players]);
  if (data.area) facts.push(["Yta", data.area]);
  facts.push(["Tid", drillDurationLabel(drill)]);

  if (data.equipment?.length) facts.push(["Utrustning", data.equipment.join(", ")]);
  if (!facts.length) return null;
  return (
    <dl className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
      {facts.map(([term, value]) => (
        <div key={term} className="rounded-lg bg-secondary/60 px-3 py-2">
          <dt className="text-muted-foreground">{term}</dt>
          <dd className="font-medium text-foreground">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function List({ title, items }: { title: string; items: string[] | undefined }) {
  if (!items?.length) return null;
  return (
    <div className="mt-3">
      <h4 className="text-xs font-semibold text-muted-foreground">{title}</h4>
      <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-foreground">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

/** Visar hela övningsmallen för en övning i Träningsbanken. */
export function DrillDetails({ drill, showGaps = false }: { drill: Drill; showGaps?: boolean }) {
  const missing = missingDrillFields(drill);
  const data = drill.data;

  return (
    <div>
      <Facts drill={drill} />

      <section className="mt-3 rounded-lg border border-border px-3 pb-3 pt-2">
        <h3 className="text-sm font-semibold">Så gör du övningen</h3>
        <List title="Organisation" items={data.organisation} />
        <List title="Genomförande" items={data.execution} />
        <List title="Coachpunkter" items={data.coachingPoints} />
        <List title="Frågor till spelarna" items={data.coachQuestions} />
        <List title="Förenkla" items={data.simplify} />
        <List title="Utmana" items={data.challenge} />
        <List title="Det här vill du se" items={data.successSigns} />
        {data.safety && (
          <p className="mt-3 text-xs text-muted-foreground">Säkerhet: {data.safety}</p>
        )}
      </section>

      {showGaps && missing.length > 0 && (
        <p className="mt-2 text-xs text-muted-foreground">
          Ofullständig övning – saknar:{" "}
          {missing.map((field) => DRILL_FIELD_LABELS[field]).join(", ")}.
        </p>
      )}
    </div>
  );
}
