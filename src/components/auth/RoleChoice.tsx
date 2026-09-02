import { ClipboardList, Users } from "lucide-react";
import type { AccountRole } from "@/lib/account-setup";

type Props = {
  value: AccountRole | null;
  onChange: (role: AccountRole) => void;
};

export function RoleChoice({ value, onChange }: Props) {
  return (
    <div className="grid gap-3">
      <button
        type="button"
        onClick={() => onChange("coach")}
        aria-pressed={value === "coach"}
        className={`rounded-xl border p-4 text-left transition-colors ${
          value === "coach" ? "border-primary bg-primary/10" : "border-border bg-card hover:bg-secondary/50"
        }`}
      >
        <ClipboardList className="mb-2 size-5 text-primary" aria-hidden />
        <h2 className="font-display text-xl font-semibold">Jag är tränare eller ledare</h2>
        <p className="text-sm text-muted-foreground">
          Skapa lag, planera träning och match, bjud in spelare. Kräver 18 år.
        </p>
      </button>

      <button
        type="button"
        onClick={() => onChange("player")}
        aria-pressed={value === "player"}
        className={`rounded-xl border p-4 text-left transition-colors ${
          value === "player" ? "border-primary bg-primary/10" : "border-border bg-card hover:bg-secondary/50"
        }`}
      >
        <Users className="mb-2 size-5 text-primary" aria-hidden />
        <h2 className="font-display text-xl font-semibold">Jag är spelare eller förälder</h2>
        <p className="text-sm text-muted-foreground">
          Gå med i ditt lag med lagkoden du fått av tränaren och se kallelser och kalender.
        </p>
      </button>
    </div>
  );
}
