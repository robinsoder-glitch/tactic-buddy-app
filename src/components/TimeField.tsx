import { cn } from "@/lib/utils";

/**
 * Tidsval med två tydliga listor (timme och minut) i stället för ett
 * webbläsarfält där halvifyllda tider ser ifyllda ut men saknar värde.
 * Värdet är alltid "HH:MM" eller tom sträng.
 */
const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const BASE_MINUTES = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, "0"));

function split(value: string): { hour: string; minute: string } {
  const match = /^(\d{1,2}):(\d{2})/.exec(value.trim());
  if (!match) return { hour: "", minute: "" };
  return { hour: match[1]!.padStart(2, "0"), minute: match[2]! };
}

export function TimeField({
  value,
  onChange,
  id,
  name,
  invalid,
  disabled,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  id?: string;
  name?: string;
  invalid?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  const { hour, minute } = split(value);
  const minutes = minute && !BASE_MINUTES.includes(minute)
    ? [...BASE_MINUTES, minute].sort()
    : BASE_MINUTES;

  const selectClass = cn(
    "h-11 w-full rounded-lg border bg-background px-2 text-sm disabled:opacity-60",
    invalid ? "border-destructive" : "border-border",
  );

  const emit = (nextHour: string, nextMinute: string) => {
    if (!nextHour && !nextMinute) {
      onChange("");
      return;
    }
    onChange(`${nextHour || "00"}:${nextMinute || "00"}`);
  };

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <select
        id={id}
        name={name ? `${name}-hour` : undefined}
        aria-label="Timme"
        className={selectClass}
        disabled={disabled}
        value={hour}
        onChange={(event) => emit(event.target.value, minute)}
      >
        <option value="">Tim</option>
        {HOURS.map((h) => (
          <option key={h} value={h}>
            {h}
          </option>
        ))}
      </select>
      <span aria-hidden className="text-muted-foreground">
        :
      </span>
      <select
        name={name ? `${name}-minute` : undefined}
        aria-label="Minut"
        className={selectClass}
        disabled={disabled}
        value={minute}
        onChange={(event) => emit(hour, event.target.value)}
      >
        <option value="">Min</option>
        {minutes.map((m) => (
          <option key={m} value={m}>
            {m}
          </option>
        ))}
      </select>
    </div>
  );
}
