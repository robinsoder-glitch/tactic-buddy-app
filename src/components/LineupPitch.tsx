import type { LineupSlot } from "@/lib/match-plan";

export type LineupPlayerInfo = { name: string; number: number | null };

/**
 * Skrivskyddad plan som visar laguppställningen.
 * Används i läsläge och på delningssidan.
 */
export function LineupPitch({
  slots,
  players,
  showNames = true,
}: {
  slots: LineupSlot[];
  /** player_id -> namn/tröjnummer. Saknad spelare visas som Tom plats. */
  players: Map<string, LineupPlayerInfo>;
  showNames?: boolean;
}) {
  return (
    <svg viewBox="0 0 100 68" className="w-full rounded-lg border border-border bg-primary/10" role="img" aria-label="Laguppställning">
      <rect x="1" y="1" width="98" height="66" rx="2" fill="none" stroke="currentColor" strokeOpacity="0.4" strokeWidth="0.6" />
      <line x1="50" y1="1" x2="50" y2="67" stroke="currentColor" strokeOpacity="0.4" strokeWidth="0.6" />
      <circle cx="50" cy="34" r="8" fill="none" stroke="currentColor" strokeOpacity="0.4" strokeWidth="0.6" />
      <rect x="1" y="20" width="10" height="28" fill="none" stroke="currentColor" strokeOpacity="0.4" strokeWidth="0.6" />
      <rect x="89" y="20" width="10" height="28" fill="none" stroke="currentColor" strokeOpacity="0.4" strokeWidth="0.6" />
      {slots.map((slot, i) => {
        const cx = slot.x * 100;
        const cy = slot.y * 68;
        const player = slot.player_id ? players.get(slot.player_id) : undefined;
        return (
          <g key={slot.slot ?? i}>
            <circle
              cx={cx}
              cy={cy}
              r="4.4"
              fill={player ? "hsl(var(--primary))" : "transparent"}
              stroke="currentColor"
              strokeOpacity="0.7"
              strokeWidth="0.6"
              strokeDasharray={player ? undefined : "1.2 1.2"}
            />
            <text
              x={cx}
              y={cy + 1.4}
              textAnchor="middle"
              fontSize="3.6"
              fontWeight="700"
              fill={player ? "hsl(var(--primary-foreground))" : "currentColor"}
              fillOpacity={player ? 1 : 0.6}
            >
              {player ? (player.number ?? "") : "?"}
            </text>
            {showNames && (
              <text x={cx} y={cy + 7.4} textAnchor="middle" fontSize="2.7" fill="currentColor" fillOpacity="0.85">
                {player ? player.name.split(" ")[0] : "Tom plats"}
                {slot.gk ? " (MV)" : ""}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
