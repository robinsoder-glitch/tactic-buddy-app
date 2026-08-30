import { jsPDF } from "jspdf";
import { PITCH_SIZES } from "./tactics";
import type { Frame, PitchType } from "./tactics";
import { drawScene, loadPhotos } from "./render-canvas";

export type PaperSize = "a4" | "a3";
export type PaperOrientation = "portrait" | "landscape";

export type PdfExportOptions = {
  frames: Frame[];
  pitchType: PitchType;
  title: string;
  /** Team name printed on the cover. */
  teamName?: string | null;
  /** Free-text notes printed on the cover. */
  coverNotes?: string | null;
  /** Include a cover page. */
  cover?: boolean;
  paper?: PaperSize;
  orientation?: PaperOrientation;
  /** Page margin in mm. */
  margin?: number;
  /** Pitch image scale, 0.5–1 of the available area. */
  scale?: number;
  hideNames?: boolean;
  tokenScale?: number;
  showPhotos?: boolean;
  /** Render width in pixels for each pitch image. */
  width?: number;
};

const PAPER_MM: Record<PaperSize, { w: number; h: number }> = {
  a4: { w: 210, h: 297 },
  a3: { w: 297, h: 420 },
};

export const PAPER_LABELS: Record<PaperSize, string> = { a4: "A4", a3: "A3" };

function pageSize(options: PdfExportOptions) {
  const paper = PAPER_MM[options.paper ?? "a4"];
  return (options.orientation ?? "landscape") === "landscape"
    ? { w: paper.h, h: paper.w }
    : { w: paper.w, h: paper.h };
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

/** Build the PDF document for a tactic (one page per step, optional cover). */
export async function buildTacticPdf(options: PdfExportOptions) {
  const { frames, pitchType } = options;
  if (frames.length === 0) throw new Error("Taktiken saknar steg");
  const orientation = options.orientation ?? "landscape";
  const paper = options.paper ?? "a4";
  const margin = options.margin ?? 14;
  const scale = Math.min(Math.max(options.scale ?? 1, 0.4), 1);
  const width = options.width ?? 1200;
  const photos = await loadPhotos(frames);
  const doc = new jsPDF({ orientation, unit: "mm", format: paper });
  const page = pageSize(options);
  const { w, h } = PITCH_SIZES[pitchType];

  if (options.cover !== false) {
    doc.setFontSize(11);
    doc.text("Taktiktavlan", margin, margin + 4);
    doc.setFontSize(orientation === "landscape" ? 30 : 24);
    doc.text(doc.splitTextToSize(options.title, page.w - margin * 2) as string[], margin, margin + 22);
    doc.setFontSize(12);
    let y = margin + 44;
    const meta = [
      `Datum: ${new Date().toLocaleDateString("sv-SE")}`,
      options.teamName ? `Lag: ${options.teamName}` : null,
      `Plan: ${PITCH_SIZES[pitchType].label}`,
      `Antal steg: ${frames.length}`,
    ].filter(Boolean) as string[];
    for (const line of meta) {
      doc.text(line, margin, y);
      y += 7;
    }
    const notes = [options.coverNotes, ...frames.map((frame) => frame.note).filter(Boolean)]
      .filter(Boolean)
      .join("\n");
    if (notes) {
      y += 6;
      doc.setFontSize(13);
      doc.text("Anteckningar", margin, y);
      y += 7;
      doc.setFontSize(10);
      for (const line of doc.splitTextToSize(notes, page.w - margin * 2) as string[]) {
        if (y > page.h - margin) break;
        doc.text(line, margin, y);
        y += 5;
      }
    }
  }

  frames.forEach((frame, index) => {
    if (index > 0 || options.cover !== false) doc.addPage(paper, orientation);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = Math.round((width * h) / w);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas stöds inte i den här webbläsaren");
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
    doc.text(options.title, margin, margin);
    doc.setFontSize(10);
    doc.text(
      `Steg ${index + 1} av ${frames.length}${frame.name ? ` · ${frame.name}` : ""}`,
      margin,
      margin + 6,
    );

    const sideBySide = orientation === "landscape";
    const listWidth = sideBySide ? Math.min(78, page.w * 0.28) : page.w - margin * 2;
    const areaW = (sideBySide ? page.w - margin * 2 - listWidth - 6 : page.w - margin * 2) * scale;
    const areaH = (sideBySide ? page.h - margin - 24 : (page.h - margin * 2 - 26) * 0.62) * scale;
    const ratio = h / w;
    let imgW = areaW;
    let imgH = imgW * ratio;
    if (imgH > areaH) {
      imgH = areaH;
      imgW = imgH / ratio;
    }
    const imgY = margin + 12;
    doc.addImage(canvas.toDataURL("image/jpeg", 0.92), "JPEG", margin, imgY, imgW, imgH);

    const listX = sideBySide ? page.w - margin - listWidth : margin;
    let y = sideBySide ? margin + 14 : imgY + imgH + 10;
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
      if (y > page.h - margin) break;
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
        if (y > page.h - margin) break;
        doc.text(line, listX, y);
        y += 4.2;
      }
    }

    doc.setFontSize(8);
    doc.text(`Steg ${index + 1} / ${frames.length}`, page.w - margin, page.h - 6, { align: "right" });
  });

  return doc;
}

/** Export the tactic as a printable PDF file. */
export async function exportPdf(options: PdfExportOptions, filename: string) {
  const doc = await buildTacticPdf(options);
  doc.save(`${filename}.pdf`);
}

/** Build a blob URL for previewing the PDF in an iframe. Caller must revoke it. */
export async function previewPdfUrl(options: PdfExportOptions) {
  const doc = await buildTacticPdf(options);
  return URL.createObjectURL(doc.output("blob"));
}
