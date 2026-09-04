import { useRef } from "react";
import { Calendar } from "lucide-react";
import { Input } from "@/components/ui/input";

/** Skriver dagens datum som åååå-mm-dd i lokal tid. */
export function todayValue(offsetDays = 0): string {
  const now = new Date();
  now.setDate(now.getDate() + offsetDays);
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 10);
}

const WEEKDAYS = ["söndag", "måndag", "tisdag", "onsdag", "torsdag", "fredag", "lördag"];

function readable(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  return `${WEEKDAYS[date.getDay()]} ${date.getDate()}/${date.getMonth() + 1}`;
}

/**
 * Enkelt datumfält: hela rutan öppnar kalendern, och snabbval finns för
 * dagens datum och nästa vecka så man slipper klicka runt i kalendern.
 */
export function DateField({
  id,
  name,
  value,
  onChange,
  quickPicks = true,
}: {
  id?: string;
  /** Fältnamn så att datumet följer med när formuläret läses av. */
  name?: string;
  value: string;
  onChange: (value: string) => void;
  quickPicks?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);

  function openPicker() {
    const el = ref.current as (HTMLInputElement & { showPicker?: () => void }) | null;
    try {
      el?.showPicker?.();
    } catch {
      // Vissa webbläsare tillåter inte showPicker – då används fältet som vanligt.
    }
  }

  const label = readable(value);

  return (
    <div className="space-y-1.5">
      <div className="relative">
        <Input
          id={id}
          ref={ref}
          type="date"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onFocus={openPicker}
          onClick={openPicker}
          className="h-12 pr-10 text-base"
        />
        <Calendar
          className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
      </div>
      {quickPicks && (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onChange(todayValue())}
            className="rounded-full border border-border px-3 py-1 text-xs hover:border-primary"
          >
            Idag
          </button>
          <button
            type="button"
            onClick={() => onChange(todayValue(1))}
            className="rounded-full border border-border px-3 py-1 text-xs hover:border-primary"
          >
            Imorgon
          </button>
          <button
            type="button"
            onClick={() => onChange(todayValue(7))}
            className="rounded-full border border-border px-3 py-1 text-xs hover:border-primary"
          >
            Om en vecka
          </button>
          {label && <span className="text-xs text-muted-foreground">{label}</span>}
        </div>
      )}
    </div>
  );
}
