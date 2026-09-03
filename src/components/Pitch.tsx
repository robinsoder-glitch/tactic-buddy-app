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
  /** scale factor for the player tokens (1 = default) */
  tokenScale?: number;
  /** render player photos inside the tokens when available */
  showPhotos?: boolean;
  /** show a snap grid overlay, value is grid step in 0..1 units */
  gridStep?: number | null;
  /** 0..1 progress of the current animation segment, used for the pass ball */
  passT?: number | null;
  /** placeringsläge: varje tryck på planen lägger ut ett nytt objekt */
  onPlaceAt?: (x: number, y: number) => void;
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

/** Klassisk svartvit fotboll med sömmar. */
export function SoccerBall({ r, strokeWidth }: { r: number; strokeWidth: number }) {
  const outer = Array.from({ length: 5 }, (_, i) => {
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
    return { x: r * 0.66 * Math.cos(angle), y: r * 0.66 * Math.sin(angle), a: angle };
  });
  const seam = Math.max(strokeWidth * 0.9, r * 0.05);
  return (
    <g>
      <circle r={r} fill="#f7f7f5" stroke="#12181f" strokeWidth={strokeWidth * 1.4} />
      {/* mjuk skuggning ger bollen volym */}
      <circle r={r * 0.98} fill="url(#ballShade)" opacity={0.35} />
      <path d={pentagonPath(0, 0, r * 0.34)} fill="#12181f" />
      {outer.map((point, index) => (
        <g key={index}>
          <line
            x1={point.x * 0.52}
            y1={point.y * 0.52}
            x2={point.x * 1.35}
            y2={point.y * 1.35}
            stroke="#12181f"
            strokeWidth={seam}
            strokeLinecap="round"
          />
          <path
            d={pentagonPath(point.x * 1.28, point.y * 1.28, r * 0.3, point.a + Math.PI)}
            fill="#12181f"
          />
        </g>
      ))}
      <circle r={r} fill="none" stroke="#12181f" strokeWidth={strokeWidth * 1.4} />
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
  tokenScale = 1,
  showPhotos = true,
  gridStep = null,
  passT = null,
  onPlaceAt,
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
  const dragKind = useRef<FieldObject["kind"] | null>(null);
  const dragOffset = useRef<{ x: number; y: number } | null>(null);
  const capturedRef = useRef<Element | null>(null);

  const [pending, setPending] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);

  // Spelarsymbolen motsvarar en spelares armspännvidd (~1,4 m) i förhållande till planmåtten (koordinater = meter)
  const tokenR = 0.7 * (tokenScale || 1);
  const isShapeTool = tool === "run" || tool === "pass" || tool === "zone" || tool === "circle";


  /** Skärmkoordinater -> plankoordinater 0..1 via SVG:ns egen matris. */
  function toNormalized(event: React.PointerEvent) {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const matrix = svg.getScreenCTM?.();
    if (matrix) {
      const point = svg.createSVGPoint();
      point.x = event.clientX;
      point.y = event.clientY;
      const local = point.matrixTransform(matrix.inverse());
      return { x: clamp01(local.x / w), y: clamp01(local.y / h) };
    }
    const rect = svg.getBoundingClientRect();
    return {
      x: clamp01((event.clientX - rect.left) / rect.width),
      y: clamp01((event.clientY - rect.top) / rect.height),
    };
  }

  function handlePointerDown(event: React.PointerEvent) {
    if (!interactive) return;
    if (onPlaceAt) {
      const point = toNormalized(event);
      onPlaceAt(point.x, point.y);
      event.preventDefault();
      return;
    }
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
      event.preventDefault();
      const point = toNormalized(event);
      const offset = dragOffset.current ?? { x: 0, y: 0 };
      onMoveObject?.(dragId.current, clamp01(point.x + offset.x), clamp01(point.y + offset.y));
    }
  }

  function handlePointerUp(event?: React.PointerEvent) {
    if (event && capturedRef.current) {
      try {
        capturedRef.current.releasePointerCapture?.(event.pointerId);
      } catch {
        /* capture kan redan vara släppt */
      }
    }
    if (pending) {
      const distance = Math.hypot(pending.x2 - pending.x1, pending.y2 - pending.y1);
      if (distance > 0.02 && isShapeTool) {
        onAddDrawing?.({ type: tool, color: drawColor ?? null, ...pending });
      }
      setPending(null);
    }
    if (dragId.current) {
      // Att dra ett objekt är i sig rörelsen: pilarna härleds ur bildernas positioner.
      if (dragStart.current && dragKind.current) {
        onObjectTrail?.(
          dragId.current,
          dragKind.current === "ball" ? "pass" : "run",
          dragStart.current,
        );
      }
      onMoveEnd?.();
    }
    dragId.current = null;
    dragStart.current = null;
    dragKind.current = null;
    dragOffset.current = null;
    capturedRef.current = null;
  }

  /** Alla objekt går att dra direkt – inga verktyg behövs. */
  function canDragObject(_object: FieldObject) {
    return !isShapeTool;
  }

  function startObjectDrag(event: React.PointerEvent, object: FieldObject) {
    if (!interactive || !canDragObject(object)) return;
    event.stopPropagation();
    // Hindrar att webbläsaren startar egen bild-/textdragning som annars avbryter pointer-flödet.
    event.preventDefault();
    const target = event.currentTarget as unknown as SVGGElement;
    try {
      target.setPointerCapture?.(event.pointerId);
      capturedRef.current = target;
    } catch {
      svgRef.current?.setPointerCapture?.(event.pointerId);
      capturedRef.current = svgRef.current;
    }
    const point = toNormalized(event);
    dragId.current = object.id;
    dragStart.current = { x: object.x, y: object.y };
    dragKind.current = object.kind;
    dragOffset.current = { x: object.x - point.x, y: object.y - point.y };
    onSelectObject?.(object.id);
  }



  const markLine = "var(--color-pitch-line)";
  const partial = pitchType === "half" || pitchType === "third";
  const boxDepth = pitchType === "small" ? 9 : 16.5;
  const boxWidth = pitchType === "small" ? 20 : 40.3;
  const goalDepth = pitchType === "small" ? 3 : 5.5;
  const goalWidth = pitchType === "small" ? 9 : 18.3;
  const circleR = pitchType === "small" ? 6 : 9.15;

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

  // Exakt en boll ska synas. Finns ett bollobjekt på planen är det den som rör sig –
  // då ritas ingen extra boll längs passningslinjen.
  const hasBallObject = objects.some((object) => object.kind === "ball");
  const passBalls =
    passT == null || hasBallObject
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
          <radialGradient id="ballShade" cx="35%" cy="30%" r="75%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0" />
            <stop offset="70%" stopColor="#8a949e" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#2b333c" stopOpacity="0.75" />
          </radialGradient>
        </defs>

        <rect width={w} height={h} fill="var(--color-pitch)" />
        <rect width={w} height={h} fill="url(#stripes)" />

        <g fill="none" stroke={markLine} strokeWidth={w * 0.0025}>
          <rect x={1} y={1} width={w - 2} height={h - 2} />
          {partial ? (
            <>
              {pitchType === "half" && (
                <path d={`M 1 ${h / 2 - circleR} A ${circleR} ${circleR} 0 0 1 1 ${h / 2 + circleR}`} />
              )}
              <rect x={w - 1 - boxDepth} y={(h - boxWidth) / 2} width={boxDepth} height={boxWidth} />
              <rect x={w - 1 - goalDepth} y={(h - goalWidth) / 2} width={goalDepth} height={goalWidth} />
            </>
          ) : (
            <>
              <line x1={w / 2} y1={1} x2={w / 2} y2={h - 1} />
              <circle cx={w / 2} cy={h / 2} r={circleR} />
              <circle cx={w / 2} cy={h / 2} r={w * 0.004} fill={markLine} />
              <rect x={1} y={(h - boxWidth) / 2} width={boxDepth} height={boxWidth} />
              <rect x={w - 1 - boxDepth} y={(h - boxWidth) / 2} width={boxDepth} height={boxWidth} />
              <rect x={1} y={(h - goalWidth) / 2} width={goalDepth} height={goalWidth} />
              <rect x={w - 1 - goalDepth} y={(h - goalWidth) / 2} width={goalDepth} height={goalWidth} />
            </>
          )}
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
            <SoccerBall r={tokenR * 0.82} strokeWidth={w * 0.0016} />
          </g>
        ))}



        {objects.map((object) => {
          const cx = object.x * w;
          const cy = object.y * h;
          const isSelected = selectedId === object.id;

          if (object.kind === "cone") {
            const size = tokenR * 1.1;
            return (
              <g
                key={object.id}
                transform={`translate(${cx} ${cy})`}
                style={{ cursor: interactive ? "grab" : "default" }}
                onPointerDown={(event) => startObjectDrag(event, object)}
              >
                <path
                  d={`M 0 ${-size} L ${size * 0.7} ${size * 0.55} L ${-size * 0.7} ${size * 0.55} Z`}
                  fill="oklch(0.75 0.19 55)"
                  stroke="rgba(0,0,0,0.4)"
                  strokeWidth={w * 0.0015}
                />
              </g>
            );
          }

          if (object.kind === "goal") {
            const gw = tokenR * 3.2;
            const gh = tokenR * 1.2;
            return (
              <g
                key={object.id}
                transform={`translate(${cx} ${cy})`}
                style={{ cursor: interactive ? "grab" : "default" }}
                onPointerDown={(event) => startObjectDrag(event, object)}
              >
                <rect
                  x={-gw / 2}
                  y={-gh / 2}
                  width={gw}
                  height={gh}
                  fill="rgba(255,255,255,0.14)"
                  stroke="#ffffff"
                  strokeWidth={w * 0.003}
                  rx={w * 0.002}
                />
              </g>
            );
          }

          if (object.kind === "ball") {
            return (
              <g
                key={object.id}
                transform={`translate(${cx} ${cy})`}
                style={{ cursor: interactive ? "grab" : "default" }}
                onPointerDown={(event) => startObjectDrag(event, object)}
              >
                <SoccerBall r={tokenR * 0.82} strokeWidth={w * 0.0016} />

              </g>
            );
          }

          return (
            <g
              key={object.id}
              transform={`translate(${cx} ${cy})`}
              style={{ cursor: interactive ? "grab" : "default" }}
              onPointerDown={(event) => startObjectDrag(event, object)}
            >
              <circle
                r={tokenR}
                fill={tokenFill(object)}
                stroke={isSelected ? "white" : object.gk ? "rgba(255,255,255,0.8)" : "rgba(0,0,0,0.35)"}
                strokeWidth={isSelected ? w * 0.005 : object.gk ? w * 0.004 : w * 0.002}
              />
              {object.photoUrl && showPhotos ? (
                <image
                  style={{ pointerEvents: "none" }}
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
                  style={{ pointerEvents: "none" }}
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
                  style={{ pointerEvents: "none" }}
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
