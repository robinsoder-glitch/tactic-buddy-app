import { useRef, useState } from "react";
import { PITCH_SIZES, clamp01, initials } from "@/lib/tactics";
import type { Drawing, FieldObject, PitchType } from "@/lib/tactics";

export type Tool = "select" | "run" | "pass" | "zone" | "circle" | "erase";

export const PASS_COLOR = "oklch(0.9 0.16 90)";

type Props = {
  pitchType: PitchType;
  objects: FieldObject[];
  drawings: Drawing[];
  tool?: Tool;
  selectedId?: string | null;
  interactive?: boolean;
  drawColor?: string | undefined;
  /** hide player names on the pitch (numbers/initials still shown) */
  hideNames?: boolean;
  /** show a snap grid overlay, value is grid step in 0..1 units */
  gridStep?: number | null;
  /** 0..1 progress of the current animation segment, used for the pass ball */
  passT?: number | null;
  onMoveObject?: (id: string, x: number, y: number) => void;
  onMoveEnd?: () => void;
  /** called when an object was dragged with the run/pass tool: draw a trail from start to end */
  onObjectTrail?: (objectId: string, type: "run" | "pass", from: { x: number; y: number }) => void;
  onSelectObject?: (id: string | null) => void;
  onAddDrawing?: (drawing: Omit<Drawing, "id">) => void;
  onRemoveDrawing?: (id: string) => void;
};

function pentagonPath(cx: number, cy: number, r: number, rotation = 0) {
  const points = Array.from({ length: 5 }, (_, i) => {
    const angle = rotation + (-Math.PI / 2 + (i * 2 * Math.PI) / 5);
    return `${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`;
  });
  return `M ${points.join(" L ")} Z`;
}

/** Classic black & white football */
export function SoccerBall({ r, strokeWidth }: { r: number; strokeWidth: number }) {
  const outer = Array.from({ length: 5 }, (_, i) => {
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / 5 + Math.PI / 5;
    return { x: r * 0.68 * Math.cos(angle), y: r * 0.68 * Math.sin(angle), a: angle };
  });
  return (
    <g>
      <circle r={r} fill="#ffffff" stroke="#141414" strokeWidth={strokeWidth} />
      <path d={pentagonPath(0, 0, r * 0.38)} fill="#141414" />
      {outer.map((point, index) => (
        <path
          key={index}
          d={pentagonPath(point.x, point.y, r * 0.3, point.a + Math.PI / 2)}
          fill="#141414"
        />
      ))}
    </g>
  );
}

export function tokenFill(object: FieldObject) {
  if (object.gk) {
    return object.team === "home" ? "var(--color-team-gk)" : "var(--color-team-gk-away)";
  }
  return object.team === "home" ? "var(--color-team-home)" : "var(--color-team-away)";
}


function tokenText(object: FieldObject) {
  if (object.gk) return "var(--color-team-gk-foreground)";
  return object.team === "home"
    ? "var(--color-team-home-foreground)"
    : "var(--color-team-away-foreground)";
}

export function Pitch({
  pitchType,
  objects,
  drawings,
  tool = "select",
  selectedId = null,
  interactive = true,
  drawColor,
  hideNames = false,
  gridStep = null,
  passT = null,
  onMoveObject,
  onMoveEnd,
  onObjectTrail,
  onSelectObject,
  onAddDrawing,
  onRemoveDrawing,
}: Props) {
  const { w, h } = PITCH_SIZES[pitchType];
  const svgRef = useRef<SVGSVGElement | null>(null);
  const dragId = useRef<string | null>(null);
  const dragStart = useRef<{ x: number; y: number } | null>(null);
  const [pending, setPending] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);

  // Spelarsymbolen motsvarar en spelares armspännvidd (~1,4 m) i förhållande till planmåtten (koordinater = meter)
  const tokenR = 0.7;
  const isShapeTool = tool === "run" || tool === "pass" || tool === "zone" || tool === "circle";


  function toNormalized(event: React.PointerEvent) {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: clamp01((event.clientX - rect.left) / rect.width),
      y: clamp01((event.clientY - rect.top) / rect.height),
    };
  }

  function handlePointerDown(event: React.PointerEvent) {
    if (!interactive) return;
    if (isShapeTool) {
      const point = toNormalized(event);
      svgRef.current?.setPointerCapture?.(event.pointerId);
      setPending({ x1: point.x, y1: point.y, x2: point.x, y2: point.y });
      event.preventDefault();
    } else if (tool === "select") {
      onSelectObject?.(null);
    }
  }

  function handlePointerMove(event: React.PointerEvent) {
    if (!interactive) return;
    if (pending) {
      const point = toNormalized(event);
      setPending((prev) => (prev ? { ...prev, x2: point.x, y2: point.y } : prev));
      return;
    }
    if (dragId.current) {
      const point = toNormalized(event);
      onMoveObject?.(dragId.current, point.x, point.y);
    }
  }

  function handlePointerUp() {
    if (pending) {
      const distance = Math.hypot(pending.x2 - pending.x1, pending.y2 - pending.y1);
      if (distance > 0.02 && isShapeTool) {
        onAddDrawing?.({ type: tool, color: drawColor ?? null, ...pending });
      }
      setPending(null);
    }
    if (dragId.current) onMoveEnd?.();
    dragId.current = null;
  }

  const markLine = "var(--color-pitch-line)";
  const boxDepth = pitchType === "full" ? 16.5 : 9;
  const boxWidth = pitchType === "full" ? 40.3 : 20;
  const goalDepth = pitchType === "full" ? 5.5 : 3;
  const goalWidth = pitchType === "full" ? 18.3 : 9;
  const circleR = pitchType === "full" ? 9.15 : 6;

  function shapeColor(drawing: Pick<Drawing, "type" | "color">) {
    if (drawing.color) return drawing.color;
    return drawing.type === "pass" ? PASS_COLOR : markLine;
  }

  function renderShape(drawing: Drawing, key: string, preview = false) {
    const color = shapeColor(drawing);
    const x1 = drawing.x1 * w;
    const y1 = drawing.y1 * h;
    const x2 = drawing.x2 * w;
    const y2 = drawing.y2 * h;
    const erasable = !preview && tool === "erase";
    const common = {
      style: { cursor: erasable ? "pointer" : "default" },
      onPointerDown: (event: React.PointerEvent) => {
        if (erasable) {
          event.stopPropagation();
          onRemoveDrawing?.(drawing.id);
        }
      },
      opacity: preview ? 0.8 : 1,
    };

    if (drawing.type === "zone") {
      return (
        <rect
          key={key}
          x={Math.min(x1, x2)}
          y={Math.min(y1, y2)}
          width={Math.abs(x2 - x1)}
          height={Math.abs(y2 - y1)}
          fill={color}
          fillOpacity={0.18}
          stroke={color}
          strokeWidth={w * 0.004}
          strokeDasharray={`${w * 0.012} ${w * 0.01}`}
          rx={w * 0.006}
          {...common}
        />
      );
    }

    if (drawing.type === "circle") {
      return (
        <ellipse
          key={key}
          cx={(x1 + x2) / 2}
          cy={(y1 + y2) / 2}
          rx={Math.abs(x2 - x1) / 2}
          ry={Math.abs(y2 - y1) / 2}
          fill={color}
          fillOpacity={0.14}
          stroke={color}
          strokeWidth={w * 0.004}
          {...common}
        />
      );
    }

    return (
      <line
        key={key}
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke={color}
        strokeWidth={w * 0.005}
        strokeLinecap="round"
        strokeDasharray={drawing.type === "pass" ? `${w * 0.015} ${w * 0.012}` : undefined}
        markerEnd={preview ? undefined : drawing.type === "run" ? "url(#arrow-run)" : "url(#arrow-pass)"}
        {...common}
      />
    );
  }

  const passBalls =
    passT == null
      ? []
      : drawings
          .filter((drawing) => drawing.type === "pass")
          .map((drawing) => ({
            id: drawing.id,
            x: (drawing.x1 + (drawing.x2 - drawing.x1) * passT) * w,
            y: (drawing.y1 + (drawing.y2 - drawing.y1) * passT) * h,
          }));


  return (
    <div
      className="w-full overflow-hidden rounded-xl border border-border bg-pitch shadow-lg"
      style={{ aspectRatio: `${w} / ${h}`, touchAction: "none" }}
    >
      <svg
        ref={svgRef}
        viewBox={`0 0 ${w} ${h}`}
        preserveAspectRatio="none"
        className="h-full w-full select-none"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <defs>
          <marker id="arrow-run" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill={markLine} />
          </marker>
          <marker id="arrow-pass" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="oklch(0.9 0.16 90)" />
          </marker>
          <pattern id="stripes" width={w / 10} height={h} patternUnits="userSpaceOnUse">
            <rect width={w / 20} height={h} fill="rgba(255,255,255,0.035)" />
          </pattern>
          {objects
            .filter((object) => object.photoUrl)
            .map((object) => (
              <clipPath key={`clip-${object.id}`} id={`clip-${object.id}`}>
                <circle cx={0} cy={0} r={tokenR} />
              </clipPath>
            ))}
        </defs>

        <rect width={w} height={h} fill="var(--color-pitch)" />
        <rect width={w} height={h} fill="url(#stripes)" />

        <g fill="none" stroke={markLine} strokeWidth={w * 0.0025}>
          <rect x={1} y={1} width={w - 2} height={h - 2} />
          <line x1={w / 2} y1={1} x2={w / 2} y2={h - 1} />
          <circle cx={w / 2} cy={h / 2} r={circleR} />
          <circle cx={w / 2} cy={h / 2} r={w * 0.004} fill={markLine} />
          <rect x={1} y={(h - boxWidth) / 2} width={boxDepth} height={boxWidth} />
          <rect x={w - 1 - boxDepth} y={(h - boxWidth) / 2} width={boxDepth} height={boxWidth} />
          <rect x={1} y={(h - goalWidth) / 2} width={goalDepth} height={goalWidth} />
          <rect x={w - 1 - goalDepth} y={(h - goalWidth) / 2} width={goalDepth} height={goalWidth} />
        </g>

        {gridStep ? (
          <g stroke="rgba(255,255,255,0.13)" strokeWidth={w * 0.0012}>
            {Array.from({ length: Math.round(1 / gridStep) - 1 }, (_, i) => (
              <line key={`gx-${i}`} x1={(i + 1) * gridStep * w} y1={0} x2={(i + 1) * gridStep * w} y2={h} />
            ))}
            {Array.from({ length: Math.round(1 / gridStep) - 1 }, (_, i) => (
              <line key={`gy-${i}`} x1={0} y1={(i + 1) * gridStep * h} x2={w} y2={(i + 1) * gridStep * h} />
            ))}
          </g>
        ) : null}

        {drawings
          .filter((drawing) => drawing.type === "zone" || drawing.type === "circle")
          .map((drawing) => renderShape(drawing, drawing.id))}

        {drawings
          .filter((drawing) => drawing.type === "run" || drawing.type === "pass")
          .map((drawing) => renderShape(drawing, drawing.id))}

        {pending &&
          isShapeTool &&
          renderShape(
            { id: "pending", type: tool as Drawing["type"], color: drawColor ?? null, ...pending },
            "pending",
            true,
          )}

        {passBalls.map((ball) => (
          <g key={`ball-${ball.id}`} transform={`translate(${ball.x} ${ball.y})`}>
            <SoccerBall r={tokenR * 0.62} strokeWidth={w * 0.0016} />
          </g>
        ))}



        {objects.map((object) => {
          const cx = object.x * w;
          const cy = object.y * h;
          const isSelected = selectedId === object.id;

          if (object.kind === "ball") {
            return (
              <g
                key={object.id}
                transform={`translate(${cx} ${cy})`}
                style={{ cursor: interactive ? "grab" : "default" }}
                onPointerDown={(event) => {
                  if (!interactive || tool !== "select") return;
                  event.stopPropagation();
                  svgRef.current?.setPointerCapture?.(event.pointerId);
                  dragId.current = object.id;
                  onSelectObject?.(object.id);
                }}
              >
                <SoccerBall r={tokenR * 0.62} strokeWidth={w * 0.0016} />

              </g>
            );
          }

          return (
            <g
              key={object.id}
              transform={`translate(${cx} ${cy})`}
              style={{ cursor: interactive ? "grab" : "default" }}
              onPointerDown={(event) => {
                if (!interactive || tool !== "select") return;
                event.stopPropagation();
                svgRef.current?.setPointerCapture?.(event.pointerId);
                dragId.current = object.id;
                onSelectObject?.(object.id);
              }}
            >
              <circle
                r={tokenR}
                fill={tokenFill(object)}
                stroke={isSelected ? "white" : object.gk ? "rgba(255,255,255,0.8)" : "rgba(0,0,0,0.35)"}
                strokeWidth={isSelected ? w * 0.005 : object.gk ? w * 0.004 : w * 0.002}
              />
              {object.photoUrl && !hideNames ? (
                <image
                  href={object.photoUrl}
                  x={-tokenR}
                  y={-tokenR}
                  width={tokenR * 2}
                  height={tokenR * 2}
                  preserveAspectRatio="xMidYMid slice"
                  clipPath={`url(#clip-${object.id})`}
                />
              ) : (
                <text
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={tokenR}
                  fontWeight={700}
                  fill={tokenText(object)}
                >
                  {object.gk && object.number == null
                    ? "MV"
                    : object.number != null
                      ? object.number
                      : hideNames
                        ? ""
                        : initials(object.label)}
                </text>
              )}
              {!hideNames && (
                <text
                  y={tokenR * 2}
                  textAnchor="middle"
                  fontSize={tokenR * 0.85}
                  fill="white"
                  stroke="rgba(0,0,0,0.5)"
                  strokeWidth={w * 0.0008}
                  paintOrder="stroke"
                >
                  {object.label}
                </text>
              )}

            </g>
          );
        })}
      </svg>
    </div>
  );
}
