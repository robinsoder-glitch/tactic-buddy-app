import { jsPDF } from "jspdf";
import { PITCH_SIZES } from "./tactics";
import type { Frame, PitchType } from "./tactics";
import { drawScene, loadPhotos } from "./render-canvas";

export type PdfExportOptions = {
  frames: Frame[];
  pitchType: PitchType;
  title: string;
  hideNames?: boolean;
  tokenScale?: number;
  showPhotos?: boolean;
  /** Render width in pixels for each pitch image. */
  width?: number;
};

const PAGE_W = 297; // A4 landscape (mm)
const PAGE_H = 210;
const MARGIN = 14;

function renderFrame(frame: Frame, options: PdfExportOptions, width: number) {
  const { w, h } = PITCH_SIZES[options.pitchType];
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = Math.round((width * h) / w);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas stöds inte i den här webbläsaren");
  return { canvas, ctx };
}

function playerRows(frame: Frame) {
  const teamName = (team: string) => (team === "home" ? "Eget lag" : "Motståndare");
  return frame.objects
    .filter((object) => object.kind !== "ball")
    .map((object) => {
      const number = object.number != null ? `#${object.number} ` : "";
      const gk = object.gk ? " (MV)" : "";
      return `${teamName(object.team)}: ${number}${object.label || "Spelare"}${gk}`;
    });
}

/** Export the tactic as a printable PDF with one page per step. */
export async function exportPdf(options: PdfExportOptions, filename: string) {
  const { frames, pitchType } = options;
  if (frames.length === 0) throw new Error("Taktiken saknar steg");
  const width = options.width ?? 1200;
  const photos = await loadPhotos(frames);
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const { w, h } = PITCH_SIZES[pitchType];

  frames.forEach((frame, index) => {
    if (index > 0) doc.addPage();
    const { canvas, ctx } = renderFrame(frame, options, width);
    drawScene(ctx, {
      pitchType,
      objects: frame.objects,
      drawings: frame.drawings,
      passT: null,
      hideNames: options.hideNames ?? false,
      tokenScale: options.tokenScale ?? 1,
      showPhotos: options.showPhotos ?? true,
      photos,
      width: canvas.width,
      height: canvas.height,
    });

    doc.setFontSize(16);
    doc.text(options.title, MARGIN, MARGIN);
    doc.setFontSize(10);
    doc.text(
      `Steg ${index + 1} av ${frames.length}${frame.name ? ` · ${frame.name}` : ""}`,
      MARGIN,
      MARGIN + 6,
    );

    const listWidth = 72;
    const imgMaxW = PAGE_W - MARGIN * 2 - listWidth - 6;
    const imgMaxH = PAGE_H - MARGIN - 34;
    const ratio = h / w;
    let imgW = imgMaxW;
    let imgH = imgW * ratio;
    if (imgH > imgMaxH) {
      imgH = imgMaxH;
      imgW = imgH / ratio;
    }
    doc.addImage(canvas.toDataURL("image/jpeg", 0.92), "JPEG", MARGIN, MARGIN + 12, imgW, imgH);

    const listX = MARGIN + imgMaxW + 6;
    let y = MARGIN + 14;
    doc.setFontSize(11);
    doc.text("Spelare", listX, y);
    doc.setFontSize(9);
    y += 5;
    const rows = playerRows(frame);
    if (rows.length === 0) {
      doc.text("Inga spelare i detta steg", listX, y);
      y += 5;
    }
    for (const row of rows) {
      if (y > PAGE_H - MARGIN) break;
      for (const line of doc.splitTextToSize(row, listWidth) as string[]) {
        doc.text(line, listX, y);
        y += 4.2;
      }
    }

    if (frame.note) {
      y += 4;
      doc.setFontSize(11);
      doc.text("Anteckning", listX, y);
      y += 5;
      doc.setFontSize(9);
      for (const line of doc.splitTextToSize(frame.note, listWidth) as string[]) {
        if (y > PAGE_H - MARGIN) break;
        doc.text(line, listX, y);
        y += 4.2;
      }
    }

    doc.setFontSize(8);
    doc.text(`Sida ${index + 1} / ${frames.length}`, PAGE_W - MARGIN, PAGE_H - 6, { align: "right" });
  });

  doc.save(`${filename}.pdf`);
}
