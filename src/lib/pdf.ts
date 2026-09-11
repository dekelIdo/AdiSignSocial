import { PDFDocument, degrees, toDegrees, type Rotation } from "pdf-lib";
import {
  displayedPageSize,
  fitWithinTarget,
  placementToPdfDrawing,
  type NormalizedPlacement,
  type PageGeometry,
  type PdfBox,
} from "@/lib/signature-placement";

export type EmbedSignatureInput = {
  pdfBytes: Uint8Array;
  /** PNG bytes of the trimmed signature (transparent background). */
  signaturePng: Uint8Array;
  /** Where the recipient placed the signature (fractions of the displayed page). */
  placement: NormalizedPlacement;
  /**
   * When the owner locked the position, the server ignores the client's
   * placement and fits the actual bitmap into this box instead.
   */
  fitInto?: NormalizedPlacement | null;
};

export type EmbedSignatureResult = {
  bytes: Uint8Array;
  /** The placement that was actually embedded. */
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
  fitInto,
}: EmbedSignatureInput): Promise<EmbedSignatureResult> {
  const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  const pages = pdfDoc.getPages();
  const image = await pdfDoc.embedPng(signaturePng);

  let finalPlacement = placement;
  if (fitInto) {
    const targetPage = pages[fitInto.pageIndex];
    if (!targetPage) {
      throw new Error(`Target page index ${fitInto.pageIndex} is outside the document`);
    }
    const displayed = displayedPageSize(getPageGeometry(targetPage));
    finalPlacement = fitWithinTarget(
      fitInto,
      image.width / image.height,
      displayed.width / displayed.height,
    );
  }

  const page = pages[finalPlacement.pageIndex];
  if (!page) {
    throw new Error(`Page index ${finalPlacement.pageIndex} is outside the document`);
  }

  const drawing = placementToPdfDrawing(finalPlacement, getPageGeometry(page));

  page.drawImage(image, {
    x: drawing.x,
    y: drawing.y,
    width: drawing.width,
    height: drawing.height,
    rotate: degrees(drawing.rotate),
  });

  return { bytes: await pdfDoc.save(), placement: finalPlacement };
}
