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
  drawColor?: string;
  /** 0..1 progress of the current animation segment, used for the pass ball */
  passT?: number | null;
  onMoveObject?: (id: string, x: number, y: number) => void;
  onSelectObject?: (id: string | null) => void;
  onAddDrawing?: (drawing: Omit<Drawing, "id">) => void;
  onRemoveDrawing?: (id: string) => void;
};


export function Pitch({
  pitchType,
  objects,
  drawings,
  tool = "select",
  selectedId = null,
  interactive = true,
  drawColor,
  passT = null,
  onMoveObject,
  onSelectObject,
  onAddDrawing,
  onRemoveDrawing,
}: Props) {
  const { w, h } = PITCH_SIZES[pitchType];
  const svgRef = useRef<SVGSVGElement | null>(null);
  const dragId = useRef<string | null>(null);
  const [pending, setPending] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);

  const tokenR = w * 0.031;
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
            <circle r={tokenR * 0.55} fill="white" stroke="oklch(0.2 0 0)" strokeWidth={w * 0.002} />
            <circle r={tokenR * 0.22} fill="oklch(0.2 0 0)" />
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
                <circle r={tokenR * 0.5} fill="white" stroke="oklch(0.2 0 0)" strokeWidth={w * 0.002} />
                <circle r={tokenR * 0.2} fill="oklch(0.2 0 0)" />
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
                fill={object.team === "home" ? "var(--color-team-home)" : "var(--color-team-away)"}
                stroke={isSelected ? "white" : "rgba(0,0,0,0.35)"}
                strokeWidth={isSelected ? w * 0.005 : w * 0.002}
              />
              {object.photoUrl ? (
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
                  fill={object.team === "home" ? "var(--color-team-home-foreground)" : "var(--color-team-away-foreground)"}
                >
                  {object.number != null ? object.number : initials(object.label)}
                </text>
              )}
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
            </g>
          );
        })}
      </svg>
    </div>
  );
}
