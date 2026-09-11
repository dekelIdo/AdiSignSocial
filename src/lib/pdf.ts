import { PDFDocument, degrees, toDegrees, type Rotation } from "pdf-lib";
import {
  placementToPdfDrawing,
  type NormalizedPlacement,
  type PageGeometry,
  type PdfBox,
} from "@/lib/signature-placement";

export type EmbedSignatureInput = {
  pdfBytes: Uint8Array;
  /** PNG bytes of the trimmed signature (transparent background). */
  signaturePng: Uint8Array;
  placement: NormalizedPlacement;
};

type PageLike = {
  getMediaBox: () => PdfBox;
  getCropBox: () => PdfBox;
  getRotation: () => Rotation;
};

/** Reads the geometry that pdf.js and pdf-lib agree on for a page. */
export function getPageGeometry(page: PageLike): PageGeometry {
  return {
    mediaBox: page.getMediaBox(),
    cropBox: page.getCropBox(),
    rotation: toDegrees(page.getRotation()),
  };
}

/**
 * Embeds the signature image on the page described by the placement. The
 * placement is expressed in fractions of the displayed page (see
 * `signature-placement.ts`), so the result matches the on-screen preview.
 */
export async function embedSignatureInPdf({
  pdfBytes,
  signaturePng,
  placement,
}: EmbedSignatureInput): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  const pages = pdfDoc.getPages();
  const page = pages[placement.pageIndex];

  if (!page) {
    throw new Error(`Page index ${placement.pageIndex} is outside the document`);
  }

  const image = await pdfDoc.embedPng(signaturePng);
  const drawing = placementToPdfDrawing(placement, getPageGeometry(page));

  page.drawImage(image, {
    x: drawing.x,
    y: drawing.y,
    width: drawing.width,
    height: drawing.height,
    rotate: degrees(drawing.rotate),
  });

  return pdfDoc.save();
}
