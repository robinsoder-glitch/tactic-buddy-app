import type { ExerciseGuideData } from "@/lib/training-outcomes";
import { guideHasContent } from "@/lib/training-outcomes";

function GuideList({ title, items }: { title: string; items?: string[] }) {
  if (!items?.length) return null;
  return (
    <section>
      <h4 className="font-semibold text-foreground">{title}</h4>
      <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
        {items.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}
      </ul>
    </section>
  );
}

export function ExerciseGuide({ guide, compact = false }: { guide?: ExerciseGuideData | null; compact?: boolean }) {
  if (!guideHasContent(guide)) return null;
  const facts = [
    guide?.area ? ["Yta", guide.area] : null,
    guide?.players ? ["Spelare", guide.players] : null,
    guide?.equipment?.length ? ["Utrustning", guide.equipment.join(", ")] : null,
  ].filter(Boolean) as [string, string][];

  return (
    <div className={compact ? "mt-3 space-y-3" : "mt-4 space-y-4"}>
      {guide?.purpose && <p className="text-sm"><span className="font-semibold">Syfte: </span>{guide.purpose}</p>}
      {facts.length > 0 && (
        <dl className="grid gap-2 text-sm sm:grid-cols-3">
          {facts.map(([term, value]) => (
            <div key={term} className="rounded-lg bg-secondary/60 px-3 py-2">
              <dt className="text-xs text-muted-foreground">{term}</dt><dd className="font-medium">{value}</dd>
            </div>
          ))}
        </dl>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <GuideList title="Uppställning" items={guide?.organisation} />
        <GuideList title="Genomförande" items={guide?.execution} />
        <GuideList title="Tränarpunkter" items={guide?.coachingPoints} />
        <GuideList title="Frågor till spelarna" items={guide?.coachQuestions} />
        <GuideList title="Förenkla" items={guide?.simplify} />
        <GuideList title="Försvåra" items={guide?.challenge} />
        <GuideList title="Tecken på att övningen fungerar" items={guide?.successSigns} />
      </div>
      {guide?.safety && <p className="rounded-lg border border-border p-3 text-sm"><span className="font-semibold">Säkerhet: </span>{guide.safety}</p>}
    </div>
  );
}