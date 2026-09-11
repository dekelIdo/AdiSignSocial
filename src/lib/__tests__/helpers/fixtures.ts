/**
 * Sanitized PDF fixtures generated at test time (no customer data committed).
 */
import { PDFDocument, StandardFonts, degrees, rgb } from "pdf-lib";

/**
 * Geometry of the real Adi agreement (measured with pdf.js):
 * 8 pages, 750 × 1125 pt displayed, MediaBox with a non-zero y origin.
 */
export const REAL_AGREEMENT = {
  pageCount: 8,
  mediaBox: { x: 0, y: 8.03995, width: 750, height: 1125 },
  /** Signature lines on the last page, in displayed points from the top-left. */
  lines: {
    client: { left: 68, right: 248, y: 458 },
    clientName: { left: 282, right: 468, y: 458 },
    owner: { left: 498, right: 683, y: 458 },
  },
  /** Baseline of the "client signature" label under the line (displayed points). */
  clientLabel: { x: 80.2, baseline: 488.5, width: 164, fontSize: 25 },
} as const;

/**
 * Builds an agreement-shaped fixture: same page count, page box and signature
 * line positions as the real agreement, with Latin placeholder text.
 */
export async function makeAgreementFixture(): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const { mediaBox, lines, clientLabel, pageCount } = REAL_AGREEMENT;
  const toPdfY = (displayedY: number) => mediaBox.y + mediaBox.height - displayedY;

  for (let index = 0; index < pageCount; index += 1) {
    const page = pdf.addPage([mediaBox.width, mediaBox.height]);
    page.setMediaBox(mediaBox.x, mediaBox.y, mediaBox.width, mediaBox.height);
    page.drawText(`Sanitized agreement fixture - page ${index + 1} of ${pageCount}`, {
      x: 60,
      y: toPdfY(120),
      size: 18,
      font,
    });

    if (index === pageCount - 1) {
      for (const [key, line] of Object.entries(lines)) {
        page.drawLine({
          start: { x: line.left, y: toPdfY(line.y) },
          end: { x: line.right, y: toPdfY(line.y) },
          thickness: 1.5,
          color: rgb(0.75, 0.75, 0.75),
        });
        page.drawText(key, { x: line.left + 10, y: toPdfY(line.y + 26), size: 16, font });
      }
      page.drawText("Client signature", {
        x: clientLabel.x,
        y: toPdfY(clientLabel.baseline),
        size: clientLabel.fontSize,
        font,
      });
    }
  }

  return pdf.save();
}

export type SimplePageSpec = {
  mediaBox: [number, number, number, number];
  cropBox?: [number, number, number, number];
  rotation?: number;
};

/** A one-page PDF with explicit boxes and rotation, for coordinate tests. */
export async function makeSinglePagePdf(spec: SimplePageSpec): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const [x0, y0, x1, y1] = spec.mediaBox;
  const page = pdf.addPage([x1 - x0, y1 - y0]);
  page.setMediaBox(x0, y0, x1 - x0, y1 - y0);
  if (spec.cropBox) {
    const [cx0, cy0, cx1, cy1] = spec.cropBox;
    page.setCropBox(cx0, cy0, cx1 - cx0, cy1 - cy0);
  }
  if (spec.rotation) {
    page.setRotation(degrees(spec.rotation));
  }
  return pdf.save();
}
