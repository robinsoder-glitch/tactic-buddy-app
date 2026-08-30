import { GIFEncoder, quantize, applyPalette } from "gifenc";
import { PITCH_SIZES } from "./tactics";
import type { Frame, PitchType } from "./tactics";
import { drawScene, loadPhotos, sceneAt } from "./render-canvas";

export type ExportOptions = {
  frames: Frame[];
  pitchType: PitchType;
  stepMs?: number;
  fps?: number;
  width?: number;
  hideNames?: boolean;
  tokenScale?: number;
  showPhotos?: boolean;
  /** Colour count for GIF palette (32-256). Lower = smaller file. */
  colors?: number;
  /** Video bitrate in bits per second. */
  bitrate?: number;
};

export type ExportQuality = "low" | "medium" | "high";

export const QUALITY_PRESETS: Record<ExportQuality, { label: string; width: number; colors: number; bitrate: number }> = {
  low: { label: "Låg (480p)", width: 480, colors: 64, bitrate: 1_500_000 },
  medium: { label: "Mellan (720p)", width: 720, colors: 128, bitrate: 4_000_000 },
  high: { label: "Hög (1080p)", width: 1080, colors: 256, bitrate: 8_000_000 },
};


function setup(pitchType: PitchType, width: number) {
  const { w, h } = PITCH_SIZES[pitchType];
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = Math.round((width * h) / w);
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas stöds inte i den här webbläsaren");
  return { canvas, ctx };
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export async function exportGif(options: ExportOptions, filename: string) {
  const { frames, pitchType } = options;
  const stepMs = options.stepMs ?? 1400;
  const fps = options.fps ?? 12;
  const width = options.width ?? 640;
  const { canvas, ctx } = setup(pitchType, width);
  const photos = await loadPhotos(frames);

  const segments = Math.max(frames.length - 1, 0);
  const totalFrames = Math.max(Math.round((segments * stepMs * fps) / 1000), 1);
  const delay = Math.round(1000 / fps);
  const encoder = GIFEncoder();

  for (let i = 0; i <= totalFrames; i += 1) {
    const progress = segments === 0 ? 0 : (i / totalFrames) * segments;
    const scene = sceneAt(frames, progress);
    drawScene(ctx, {
      pitchType,
      ...scene,
      hideNames: options.hideNames ?? false,
      tokenScale: options.tokenScale ?? 1,
      showPhotos: options.showPhotos ?? true,
      photos,
      width: canvas.width,
      height: canvas.height,
    });
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const palette = quantize(data, options.colors ?? 256);
    const index = applyPalette(data, palette);
    encoder.writeFrame(index, canvas.width, canvas.height, { palette, delay });
    if (segments === 0) break;
  }

  encoder.finish();
  download(new Blob([encoder.bytesView() as unknown as BlobPart], { type: "image/gif" }), `${filename}.gif`);
}

function pickVideoType() {
  const candidates = [
    "video/mp4;codecs=avc1.42E01E",
    "video/mp4",
    "video/webm;codecs=vp9",
    "video/webm",
  ];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type));
}

export async function exportVideo(options: ExportOptions, filename: string) {
  const { frames, pitchType } = options;
  const stepMs = options.stepMs ?? 1400;
  const fps = options.fps ?? 30;
  const width = options.width ?? 960;
  const mimeType = pickVideoType();
  if (typeof MediaRecorder === "undefined" || !mimeType) {
    throw new Error("Videoexport stöds inte i den här webbläsaren – prova GIF");
  }

  const { canvas, ctx } = setup(pitchType, width);
  const photos = await loadPhotos(frames);
  const stream = canvas.captureStream(fps);
  const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: options.bitrate ?? 4_000_000 });
  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) chunks.push(event.data);
  };

  const done = new Promise<void>((resolve) => {
    recorder.onstop = () => resolve();
  });

  recorder.start();

  const segments = Math.max(frames.length - 1, 0);
  const totalFrames = Math.max(Math.round((segments * stepMs * fps) / 1000), fps);
  const frameDelay = 1000 / fps;

  for (let i = 0; i <= totalFrames; i += 1) {
    const progress = segments === 0 ? 0 : (i / totalFrames) * segments;
    const scene = sceneAt(frames, progress);
    drawScene(ctx, {
      pitchType,
      ...scene,
      hideNames: options.hideNames ?? false,
      tokenScale: options.tokenScale ?? 1,
      showPhotos: options.showPhotos ?? true,
      photos,
      width: canvas.width,
      height: canvas.height,
    });
    await new Promise((resolve) => setTimeout(resolve, frameDelay));
  }

  recorder.stop();
  await done;
  const extension = mimeType.startsWith("video/mp4") ? "mp4" : "webm";
  download(new Blob(chunks, { type: mimeType }), `${filename}.${extension}`);
  return extension;
}
