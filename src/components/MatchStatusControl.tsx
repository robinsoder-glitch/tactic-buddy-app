import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAccount } from "@/hooks/useAccount";
import {
  MATCH_STATUS_LABELS,
  MATCH_STATUS_ORDER,
  isMatchStatus,
  matchStatusClasses,
  setMatchStatus,
  type MatchStatus,
} from "@/lib/match-status";

type Props = {
  eventId: string;
  teamId: string;
  status: MatchStatus;
  /** Kompakt variant för listor och kalenderdagar. */
  size?: "sm" | "md";
};

/** Visar matchens status. Tränare i laget kan byta status direkt. */
export function MatchStatusControl({ eventId, teamId, status, size = "md" }: Props) {
  const { memberships } = useAccount();
  const queryClient = useQueryClient();
  const [current, setCurrent] = useState<MatchStatus>(status);
  const [busy, setBusy] = useState(false);

  const isCoach = memberships.some(
    (membership) =>
      membership.team_id === teamId &&
      membership.status === "approved" &&
      ["coach", "head_coach", "club_admin"].includes(membership.role as string),
  );

  const text = size === "sm" ? "text-[11px]" : "text-xs";
  const badge = `inline-flex shrink-0 items-center rounded-full px-2.5 py-1 font-semibold ${text} ${matchStatusClasses(current)}`;

  if (!isCoach) {
    return <span className={badge}>{MATCH_STATUS_LABELS[current]}</span>;
  }

  async function change(next: string) {
    if (!isMatchStatus(next)) return;
    const previous = current;
    setCurrent(next);
    setBusy(true);
    try {
      await setMatchStatus(eventId, next);
      await queryClient.invalidateQueries({ queryKey: ["month-events"] });
      await queryClient.invalidateQueries({ queryKey: ["upcoming-events"] });
      toast.success(`Status ändrad till ${MATCH_STATUS_LABELS[next].toLowerCase()}.`);
    } catch (error) {
      setCurrent(previous);
      toast.error(error instanceof Error ? error.message : "Kunde inte ändra statusen.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <select
      value={current}
      disabled={busy}
      aria-label="Matchens status"
      onClick={(event) => event.stopPropagation()}
      onChange={(event) => {
        event.stopPropagation();
        void change(event.target.value);
      }}
      className={`${badge} h-8 appearance-none border-0 pr-6 disabled:opacity-60`}
    >
      {MATCH_STATUS_ORDER.map((value) => (
        <option key={value} value={value}>
          {MATCH_STATUS_LABELS[value]}
        </option>
      ))}
    </select>
  );
}
