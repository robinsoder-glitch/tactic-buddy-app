import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

/**
 * Tidsval med två tydliga listor (timme och minut) i stället för ett
 * webbläsarfält där halvifyllda tider ser ifyllda ut men saknar värde.
 * Värdet är alltid "HH:MM" eller tom sträng. Halvifyllda val hålls kvar
 * lokalt och visas med en tydlig text om vad som saknas.
 */
const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0"));

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
  const parsed = split(value);
  const [draft, setDraft] = useState(parsed);

  // Håll fältet i synk när värdet ändras utifrån (t.ex. när matchen laddas).
  useEffect(() => {
    setDraft((prev) => {
      if (prev.hour === parsed.hour && prev.minute === parsed.minute) return prev;
      if (!parsed.hour && !parsed.minute && (prev.hour || prev.minute) && value === "") {
        // Behåll ett halvifyllt val i stället för att nolla det.
        return prev.hour && prev.minute ? { hour: "", minute: "" } : prev;
      }
      return parsed;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const hour = draft.hour;
  const minute = draft.minute;
  const incomplete = Boolean(hour) !== Boolean(minute);

  const selectClass = cn(
    "h-11 w-full rounded-lg border bg-background px-2 text-sm disabled:opacity-60",
    invalid || incomplete ? "border-destructive" : "border-border",
  );

  const emit = (nextHour: string, nextMinute: string) => {
    setDraft({ hour: nextHour, minute: nextMinute });
    if (nextHour && nextMinute) {
      onChange(`${nextHour}:${nextMinute}`);
      return;
    }
    // Ofullständig tid räknas som ingen tid alls.
    if (value !== "") onChange("");
  };

  return (
    <div className={cn("space-y-1", className)}>
      {/* Dolt fält med hela tiden så formulär som läser FormData får rätt värde
          (listorna heter annars bara "start-hour" och "start-minute"). */}
      {name ? (
        <input type="hidden" name={name} value={hour && minute ? `${hour}:${minute}` : ""} />
      ) : null}
      <div className="flex items-center gap-2">
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
          {MINUTES.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </div>
      {incomplete ? (
        <p className="text-xs font-medium text-destructive">
          {hour ? "Välj minuter också." : "Välj timme också."}
        </p>
      ) : null}
    </div>
  );
}
