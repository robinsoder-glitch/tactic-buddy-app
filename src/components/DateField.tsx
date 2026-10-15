import { useState } from "react";
import { Calendar as CalendarIcon } from "lucide-react";
import { sv } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { dayKey } from "@/lib/month-grid";

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
  disabled = false,
}: {
  id?: string;
  /** Fältnamn så att datumet följer med när formuläret läses av. */
  name?: string;
  value: string;
  onChange: (value: string) => void;
  quickPicks?: boolean;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const selected = value ? new Date(`${value}T12:00:00`) : undefined;
  const validSelected = selected && !Number.isNaN(selected.getTime()) ? selected : undefined;
  const label = readable(value);

  return (
    <div className="space-y-1.5">
      {name && <input type="hidden" name={name} value={value} />}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            disabled={disabled}
            id={id}
            type="button"
            variant="outline"
            className="h-12 w-full justify-between gap-2 text-base font-normal"
            aria-label={validSelected ? `Datum: ${value}` : "Välj datum"}
          >
            <span className="min-w-0 truncate">
              {validSelected
                ? validSelected.toLocaleDateString("sv-SE", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })
                : "Välj datum"}
            </span>
            <CalendarIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto max-w-[calc(100vw-2rem)] p-0">
          <Calendar
            mode="single"
            locale={sv}
            weekStartsOn={1}
            captionLayout="dropdown"
            startMonth={new Date(1900, 0)}
            endMonth={new Date(2100, 11)}
            defaultMonth={validSelected ?? new Date()}
            selected={validSelected}
            required
            className="[--cell-size:2.5rem]"
            onSelect={(date) => {
              if (!date) return;
              onChange(dayKey(date));
              setOpen(false);
            }}
          />
        </PopoverContent>
      </Popover>
      {quickPicks && (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            disabled={disabled}
            onClick={() => onChange(todayValue())}
            variant="outline"
            size="sm"
            className="h-8 px-3 text-xs"
          >
            Idag
          </Button>
          <Button
            type="button"
            disabled={disabled}
            onClick={() => onChange(todayValue(1))}
            variant="outline"
            size="sm"
            className="h-8 px-3 text-xs"
          >
            Imorgon
          </Button>
          <Button
            type="button"
            disabled={disabled}
            onClick={() => onChange(todayValue(7))}
            variant="outline"
            size="sm"
            className="h-8 px-3 text-xs"
          >
            Om en vecka
          </Button>
          {label && <span className="text-xs text-muted-foreground">{label}</span>}
        </div>
      )}
    </div>
  );
}
