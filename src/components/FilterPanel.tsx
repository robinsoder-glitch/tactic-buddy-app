import { useState, type ReactNode } from "react";
import { ChevronDown, SlidersHorizontal, X } from "lucide-react";

type FilterPanelProps = {
  /** Antal aktiva filter (utom fritextsökning). */
  activeCount: number;
  onClear: () => void;
  /** Filter som alltid syns. */
  primary?: ReactNode;
  /** Filter som visas när panelen öppnas. */
  children: ReactNode;
  label?: string;
};

export function FilterPanel({ activeCount, onClear, primary, children, label = "Fler filter" }: FilterPanelProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="mt-3">
      <div className="flex flex-wrap items-center gap-2">
        {primary}
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs ${
            open || activeCount > 0
              ? "border-primary bg-primary/15 text-foreground"
              : "border-border text-muted-foreground"
          }`}
        >
          <SlidersHorizontal className="size-3.5" />
          {label}
          {activeCount > 0 && (
            <span className="ml-0.5 rounded-full bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground">
              {activeCount}
            </span>
          )}
          <ChevronDown className={`size-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
        {activeCount > 0 && (
          <button
            type="button"
            onClick={onClear}
            className="flex items-center gap-1 rounded-full border border-border px-3 py-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <X className="size-3.5" /> Rensa filter
          </button>
        )}
      </div>

      {open && (
        <div className="mt-3 space-y-3 rounded-xl border border-border bg-card/60 p-3">
          {children}
        </div>
      )}
    </div>
  );
}

export function FilterRow({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <p className="mb-1 text-xs font-medium text-muted-foreground">{title}</p>
      {children}
    </div>
  );
}
