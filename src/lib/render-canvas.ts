import { PITCH_SIZES, initials, interpolateFrames } from "./tactics";
import type { Drawing, FieldObject, Frame, PitchType } from "./tactics";

const COLORS = {
  pitch: "#2f6a45",
  line: "rgba(244,250,242,0.72)",
  home: "#a8dd3a",
  homeText: "#1d2a17",
  away: "#ef6f52",
  awayText: "#fdfcfa",
  gkHome: "#d98bf0",
  gkAway: "#6fa8e8",
  gkText: "#20142a",
  pass: "#f2c14b",
};


function safeColor(ctx: CanvasRenderingContext2D, color: string, fallback: string) {
  try {
    const previous = ctx.fillStyle;
    ctx.fillStyle = color;
    const applied = ctx.fillStyle;
    ctx.fillStyle = previous;
    return applied ? color : fallback;
  } catch {
    return fallback;
  }
}

function shapeColor(ctx: CanvasRenderingContext2D, drawing: Drawing) {
  if (drawing.color) return safeColor(ctx, drawing.color, COLORS.line);
  return drawing.type === "pass" ? COLORS.pass : COLORS.line;
}

function arrowHead(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, size: number) {
  const angle = Math.atan2(y2 - y1, x2 - x1);
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - size * Math.cos(angle - Math.PI / 7), y2 - size * Math.sin(angle - Math.PI / 7));
  ctx.lineTo(x2 - size * Math.cos(angle + Math.PI / 7), y2 - size * Math.sin(angle + Math.PI / 7));
  ctx.closePath();
  ctx.fill();
}

export type PhotoMap = Map<string, CanvasImageSource>;

export async function loadPhotos(frames: Frame[]): Promise<PhotoMap> {
  const urls = new Set<string>();
  for (const frame of frames) {
    for (const object of frame.objects) if (object.photoUrl) urls.add(object.photoUrl);
  }
  const map: PhotoMap = new Map();
  await Promise.all(
    [...urls].map(
      (url) =>
        new Promise<void>((resolve) => {
          const image = new Image();
          image.crossOrigin = "anonymous";
          image.onload = () => {
            map.set(url, image);
            resolve();
          };
          image.onerror = () => resolve();
          image.src = url;
        }),
    ),
  );
  return map;
}

export function drawScene(
  ctx: CanvasRenderingContext2D,
  options: {
    pitchType: PitchType;
    objects: FieldObject[];
    drawings: Drawing[];
    passT: number | null;
    note?: string | null;
    hideNames?: boolean;
    photos?: PhotoMap;

    width: number;
    height: number;
  },
) {
  const { w, h } = PITCH_SIZES[options.pitchType];
  const scale = options.width / w;
  ctx.save();
  ctx.clearRect(0, 0, options.width, options.height);
  ctx.scale(scale, scale);

  // pitch
  ctx.fillStyle = COLORS.pitch;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "rgba(255,255,255,0.035)";
  for (let i = 0; i < 10; i += 1) ctx.fillRect((i * w) / 10, 0, w / 20, h);

  const boxDepth = options.pitchType === "full" ? 16.5 : 9;
  const boxWidth = options.pitchType === "full" ? 40.3 : 20;
  const goalDepth = options.pitchType === "full" ? 5.5 : 3;
  const goalWidth = options.pitchType === "full" ? 18.3 : 9;
  const circleR = options.pitchType === "full" ? 9.15 : 6;

  ctx.strokeStyle = COLORS.line;
  ctx.lineWidth = w * 0.0025;
  ctx.strokeRect(1, 1, w - 2, h - 2);
  ctx.beginPath();
  ctx.moveTo(w / 2, 1);
  ctx.lineTo(w / 2, h - 1);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(w / 2, h / 2, circleR, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeRect(1, (h - boxWidth) / 2, boxDepth, boxWidth);
  ctx.strokeRect(w - 1 - boxDepth, (h - boxWidth) / 2, boxDepth, boxWidth);
  ctx.strokeRect(1, (h - goalWidth) / 2, goalDepth, goalWidth);
  ctx.strokeRect(w - 1 - goalDepth, (h - goalWidth) / 2, goalDepth, goalWidth);

  // drawings
  for (const drawing of options.drawings) {
    const color = shapeColor(ctx, drawing);
    const x1 = drawing.x1 * w;
    const y1 = drawing.y1 * h;
    const x2 = drawing.x2 * w;
    const y2 = drawing.y2 * h;
    ctx.strokeStyle = color;
    ctx.fillStyle = color;

    if (drawing.type === "zone") {
      ctx.globalAlpha = 0.18;
      ctx.fillRect(Math.min(x1, x2), Math.min(y1, y2), Math.abs(x2 - x1), Math.abs(y2 - y1));
      ctx.globalAlpha = 1;
      ctx.lineWidth = w * 0.004;
      ctx.setLineDash([w * 0.012, w * 0.01]);
      ctx.strokeRect(Math.min(x1, x2), Math.min(y1, y2), Math.abs(x2 - x1), Math.abs(y2 - y1));
      ctx.setLineDash([]);
      continue;
    }

    if (drawing.type === "circle") {
      ctx.beginPath();
      ctx.ellipse((x1 + x2) / 2, (y1 + y2) / 2, Math.abs(x2 - x1) / 2, Math.abs(y2 - y1) / 2, 0, 0, Math.PI * 2);
      ctx.globalAlpha = 0.14;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.lineWidth = w * 0.004;
      ctx.stroke();
      continue;
    }

    ctx.lineWidth = w * 0.005;
    ctx.lineCap = "round";
    ctx.setLineDash(drawing.type === "pass" ? [w * 0.015, w * 0.012] : []);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.setLineDash([]);
    arrowHead(ctx, x1, y1, x2, y2, w * 0.018);
  }

  const tokenR = w * 0.031;

  // pass balls
  if (options.passT != null) {
    for (const drawing of options.drawings.filter((item) => item.type === "pass")) {
      const bx = (drawing.x1 + (drawing.x2 - drawing.x1) * options.passT) * w;
      const by = (drawing.y1 + (drawing.y2 - drawing.y1) * options.passT) * h;
      ctx.beginPath();
      ctx.arc(bx, by, tokenR * 0.55, 0, Math.PI * 2);
      ctx.fillStyle = "#ffffff";
      ctx.fill();
      ctx.lineWidth = w * 0.002;
      ctx.strokeStyle = "#222";
      ctx.stroke();
    }
  }

  // objects
  for (const object of options.objects) {
    const cx = object.x * w;
    const cy = object.y * h;
    if (object.kind === "ball") {
      ctx.beginPath();
      ctx.arc(cx, cy, tokenR * 0.5, 0, Math.PI * 2);
      ctx.fillStyle = "#ffffff";
      ctx.fill();
      ctx.lineWidth = w * 0.002;
      ctx.strokeStyle = "#222";
      ctx.stroke();
      continue;
    }

    ctx.beginPath();
    ctx.arc(cx, cy, tokenR, 0, Math.PI * 2);
    ctx.fillStyle = object.team === "home" ? COLORS.home : COLORS.away;
    ctx.fill();
    ctx.lineWidth = w * 0.002;
    ctx.strokeStyle = "rgba(0,0,0,0.35)";
    ctx.stroke();

    const photo = object.photoUrl ? options.photos?.get(object.photoUrl) : undefined;
    if (photo) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, tokenR, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(photo, cx - tokenR, cy - tokenR, tokenR * 2, tokenR * 2);
      ctx.restore();
    } else {
      ctx.fillStyle = object.team === "home" ? COLORS.homeText : COLORS.awayText;
      ctx.font = `700 ${tokenR}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(object.number != null ? String(object.number) : initials(object.label), cx, cy);
    }

    if (object.label) {
      ctx.font = `600 ${tokenR * 0.85}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "alphabetic";
      ctx.lineWidth = w * 0.0016;
      ctx.strokeStyle = "rgba(0,0,0,0.55)";
      ctx.strokeText(object.label, cx, cy + tokenR * 2);
      ctx.fillStyle = "#ffffff";
      ctx.fillText(object.label, cx, cy + tokenR * 2);
    }
  }

  if (options.note) {
    const pad = w * 0.012;
    ctx.font = `600 ${w * 0.026}px sans-serif`;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    const text = options.note.slice(0, 90);
    const textWidth = ctx.measureText(text).width;
    const boxH = w * 0.05;
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(pad, h - boxH - pad, textWidth + pad * 2, boxH);
    ctx.fillStyle = "#ffffff";
    ctx.fillText(text, pad * 2, h - boxH / 2 - pad);
  }

  ctx.restore();
}

export function sceneAt(frames: Frame[], progress: number) {
  const segmentIndex = Math.min(Math.floor(progress), Math.max(frames.length - 2, 0));
  const frame = frames[segmentIndex] ?? frames[0];
  return {
    objects: interpolateFrames(frames, progress),
    drawings: frame?.drawings ?? [],
    passT: frames.length > 1 ? Math.min(Math.max(progress - segmentIndex, 0), 1) : null,
    note: frame?.note ?? null,
  };
}
