import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { TRAINING_FOCUS_AREAS, toggleFocus } from "@/lib/training-outcomes";

export function TrainingFocusSelector({
  value,
  onChange,
}: {
  value: string[];
  onChange: (value: string[]) => void;
}) {
  return (
    <fieldset className="space-y-2">
      <Label asChild>
        <legend>Vad ska spelarna utveckla?</legend>
      </Label>
      <div className="flex flex-wrap gap-2">
        {TRAINING_FOCUS_AREAS.map((area) => {
          const selected = value.includes(area);
          return (
            <Button
              key={area}
              type="button"
              size="sm"
              variant={selected ? "default" : "outline"}
              aria-pressed={selected}
              onClick={() => onChange(toggleFocus(value, area))}
            >
              {selected && <Check className="size-4" />} {area}
            </Button>
          );
        })}
      </div>
      {value.length === 0 && (
        <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm font-semibold text-destructive">
          Välj minst ett fokusområde för träningen.
        </p>
      )}
    </fieldset>
  );
}

export function TrainingFocusSummary({ areas }: { areas: string[] }) {
  if (areas.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2" aria-label="Träningens fokus">
      {areas.map((area) => (
        <span key={area} className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-sm font-semibold text-primary">
          {area}
        </span>
      ))}
    </div>
  );
}