import { useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { cn } from "@/lib/utils";
import { assignPlayerToSlot, moveSlotToBench, type LineupSlot } from "@/lib/match-plan";
import type { LineupPlayerInfo } from "@/components/LineupPitch";

/**
 * Redigerbar laguppställning: tryck (eller dra) en spelare från bänken till en
 * planposition. Tryck på en spelare på planen för att flytta tillbaka till bänken.
 */
export function MatchLineupEditor({
  slots,
  bench,
  players,
  onChange,
}: {
  slots: LineupSlot[];
  bench: string[];
  players: Map<string, LineupPlayerInfo>;
  onChange: (slots: LineupSlot[], bench: string[]) => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [dragPos, setDragPos] = useState<{ playerId: string; x: number; y: number } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  function place(playerId: string, slotIndex: number) {
    const next = assignPlayerToSlot(slots, bench, playerId, slotIndex);
    onChange(next.slots, next.bench);
    setSelected(null);
  }

  function handleSlotTap(index: number) {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    if (selected) {
      place(selected, index);
      return;
    }
    if (slots[index]?.player_id) {
      const next = moveSlotToBench(slots, bench, index);
      onChange(next.slots, next.bench);
    }
  }

  const suppressClickRef = useRef(false);

  function startDrag(e: ReactPointerEvent, playerId: string) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    const startX = e.clientX;
    const startY = e.clientY;
    let dragging = false;
    const move = (ev: PointerEvent) => {
      if (!dragging && Math.hypot(ev.clientX - startX, ev.clientY - startY) < 6) return;
      dragging = true;
      setDragPos({ playerId, x: ev.clientX, y: ev.clientY });
      setSelected(playerId);
    };
    const up = (ev: PointerEvent) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      setDragPos(null);
      if (!dragging) return; // vanlig tryckning – låt onClick sköta markeringen
      suppressClickRef.current = true;
      const el = document.elementFromPoint(ev.clientX, ev.clientY)?.closest("[data-slot-index]");
      if (el) place(playerId, Number(el.getAttribute("data-slot-index")));
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  const benchPlayers = bench.map((id) => ({ id, info: players.get(id) })).filter((p) => p.info);

  return (
    <div ref={rootRef} className="space-y-3">
      <svg
        viewBox="0 0 100 68"
        className="w-full touch-none rounded-lg border border-border bg-primary/10"
        role="application"
        aria-label="Redigera laguppställning"
      >
        <rect
          x="1"
          y="1"
          width="98"
          height="66"
          rx="2"
          fill="none"
          stroke="currentColor"
          strokeOpacity="0.4"
          strokeWidth="0.6"
        />
        <line
          x1="50"
          y1="1"
          x2="50"
          y2="67"
          stroke="currentColor"
          strokeOpacity="0.4"
          strokeWidth="0.6"
        />
        <circle
          cx="50"
          cy="34"
          r="8"
          fill="none"
          stroke="currentColor"
          strokeOpacity="0.4"
          strokeWidth="0.6"
        />
        <rect
          x="1"
          y="20"
          width="10"
          height="28"
          fill="none"
          stroke="currentColor"
          strokeOpacity="0.4"
          strokeWidth="0.6"
        />
        <rect
          x="89"
          y="20"
          width="10"
          height="28"
          fill="none"
          stroke="currentColor"
          strokeOpacity="0.4"
          strokeWidth="0.6"
        />
        {slots.map((slot, i) => {
          const cx = slot.x * 100;
          const cy = slot.y * 68;
          const player = slot.player_id ? players.get(slot.player_id) : undefined;
          return (
            <g
              key={slot.slot}
              data-slot-index={i}
              className="cursor-pointer"
              onClick={() => handleSlotTap(i)}
              onPointerDown={(e) => slot.player_id && startDrag(e, slot.player_id)}
            >
              <circle cx={cx} cy={cy} r="6.5" fill="transparent" />
              <circle
                cx={cx}
                cy={cy}
                r="4.4"
                fill={player ? "hsl(var(--primary))" : "hsl(var(--background))"}
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
                pointerEvents="none"
              >
                {player ? (player.number ?? "") : "+"}
              </text>
              <text
                x={cx}
                y={cy + 7.4}
                textAnchor="middle"
                fontSize="2.7"
                fill="currentColor"
                fillOpacity="0.85"
                pointerEvents="none"
              >
                {player ? player.name.split(" ")[0] : "Tom plats"}
                {slot.gk ? " (MV)" : ""}
              </text>
            </g>
          );
        })}
      </svg>

      <div>
        <p className="mb-1.5 text-xs font-medium text-muted-foreground">
          Bänken ({benchPlayers.length}) – tryck på en spelare och sedan på en plats, eller dra
          spelaren dit.
        </p>
        <div className="flex flex-wrap gap-2" data-bench>
          {benchPlayers.map(({ id, info }) => (
            <button
              key={id}
              type="button"
              onClick={() => {
                if (suppressClickRef.current) {
                  suppressClickRef.current = false;
                  return;
                }
                setSelected(selected === id ? null : id);
              }}
              onPointerDown={(e) => startDrag(e, id)}
              className={cn(
                "touch-none rounded-full border px-3 py-2 text-sm font-medium transition-colors",
                selected === id
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card hover:bg-accent",
              )}
            >
              {info!.number != null && (
                <span className="mr-1 text-muted-foreground">{info!.number}</span>
              )}
              {info!.name}
            </button>
          ))}
          {benchPlayers.length === 0 && (
            <span className="text-sm text-muted-foreground">
              Alla uttagna spelare är placerade.
            </span>
          )}
        </div>
      </div>

      {dragPos && (
        <div
          className="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-lg"
          style={{ left: dragPos.x, top: dragPos.y }}
        >
          {players.get(dragPos.playerId)?.name}
        </div>
      )}
    </div>
  );
}
