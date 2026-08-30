import { useEffect, useRef } from "react";
import { drawScene } from "@/lib/render-canvas";
import { PITCH_SIZES } from "@/lib/tactics";
import type { Frame, PitchType } from "@/lib/tactics";

type Props = {
  pitchType: PitchType;
  frame?: Frame | null;
  width?: number;
  className?: string;
};

/** Small static canvas preview of the first frame of a tactic. */
export function TacticThumb({ pitchType, frame, width = 320, className }: Props) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const { w, h } = PITCH_SIZES[pitchType];
  const height = Math.round((width * h) / w);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    drawScene(ctx, {
      pitchType,
      objects: frame?.objects ?? [],
      drawings: frame?.drawings ?? [],
      passT: null,
      hideNames: true,
      tokenScale: 1.6,
      showPhotos: false,
      width: canvas.width,
      height: canvas.height,
    });
  }, [pitchType, frame, width, height]);

  return (
    <canvas
      ref={ref}
      width={width}
      height={height}
      aria-hidden="true"
      className={className}
      style={{ width: "100%", height: "auto", display: "block" }}
    />
  );
}
