declare module "gifenc" {
  export function GIFEncoder(): {
    writeFrame(
      index: Uint8Array,
      width: number,
      height: number,
      options?: { palette?: number[][]; delay?: number; transparent?: boolean },
    ): void;
    finish(): void;
    bytes(): Uint8Array;
    bytesView(): Uint8Array;
  };
  export function quantize(data: Uint8Array | Uint8ClampedArray, maxColors: number): number[][];
  export function applyPalette(
    data: Uint8Array | Uint8ClampedArray,
    palette: number[][],
    format?: string,
  ): Uint8Array;
}
