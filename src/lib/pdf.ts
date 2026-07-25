import { PDFDocument } from "pdf-lib";

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

  const maxWidth = Math.min(210, width * 0.36);
  const maxHeight = 82;
  const scale = Math.min(maxWidth / signatureImage.width, maxHeight / signatureImage.height);
  const signatureWidth = signatureImage.width * scale;
  const signatureHeight = signatureImage.height * scale;
  const margin = Math.min(48, width * 0.08);

  lastPage.drawImage(signatureImage, {
    x: width - signatureWidth - margin,
    y: Math.max(margin, height * 0.08),
    width: signatureWidth,
    height: signatureHeight,
  });

  return pdfDoc.save();
}
