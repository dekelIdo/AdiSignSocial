import { PDFDocument } from "pdf-lib";

const SIGNATURE_Y_OFFSET = -80;

export async function addSignatureToLastPage(pdfBytes: Uint8Array, signatureDataUrl: string) {
  const base64Signature = signatureDataUrl.split(",")[1];
  if (!base64Signature) {
    throw new Error("Signature image is missing");
  }

  const pdfDoc = await PDFDocument.load(pdfBytes);
  const signatureImage = await pdfDoc.embedPng(Buffer.from(base64Signature, "base64"));
  const pages = pdfDoc.getPages();
  const lastPage = pages[pages.length - 1];
  const { width, height } = lastPage.getSize();

  // Coordinates are PDF page units, not screen pixels. The signature is placed
  // above the lower-left signing line area and scaled relative to page size.
  const pageMarginX = width * 0.1;
  const pageMarginY = height * 0.08;
  const leftSignatureLineY = height * 0.12;
  const gapAboveLine = height * 0.015;
  const maxWidth = width * 0.32;
  const maxHeight = height * 0.085;
  const scale = Math.min(maxWidth / signatureImage.width, maxHeight / signatureImage.height);
  const signatureWidth = signatureImage.width * scale;
  const signatureHeight = signatureImage.height * scale;
  const moveSignatureUp = height * 0.2;
  const x = pageMarginX;
  const y = Math.min(
    height - signatureHeight - pageMarginY,
    Math.max(pageMarginY, leftSignatureLineY + gapAboveLine + moveSignatureUp - SIGNATURE_Y_OFFSET),
  );

  lastPage.drawImage(signatureImage, {
    x,
    y,
    width: signatureWidth,
    height: signatureHeight,
  });

  return pdfDoc.save();
}
