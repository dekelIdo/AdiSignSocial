/**
 * Turns the signature pad canvas into the bitmap that is both previewed on the
 * document and embedded in the PDF. Transparent margins are trimmed so the
 * rectangle the recipient positions is the rectangle of visible ink.
 */
import { findInkBounds } from "@/lib/signature-image";

export type ExportedSignature = {
  /** PNG data URL with a transparent background. */
  dataUrl: string;
  /** Bitmap size in device pixels. */
  width: number;
  height: number;
  /** width / height, used to keep the overlay and the export in proportion. */
  aspect: number;
};

/**
 * Exports the visible ink of a canvas as a trimmed, lossless PNG.
 * `padding` (device pixels) keeps anti-aliased edges intact.
 * Returns null when nothing was drawn.
 */
export function exportTrimmedSignature(
  source: HTMLCanvasElement,
  padding = 1,
): ExportedSignature | null {
  const context = source.getContext("2d", { willReadFrequently: true });
  if (!context || source.width === 0 || source.height === 0) {
    return null;
  }

  const pixels = context.getImageData(0, 0, source.width, source.height);
  const bounds = findInkBounds(pixels.data, source.width, source.height);
  if (!bounds) {
    return null;
  }

  const left = Math.max(0, bounds.left - padding);
  const top = Math.max(0, bounds.top - padding);
  const right = Math.min(source.width, bounds.right + padding);
  const bottom = Math.min(source.height, bounds.bottom + padding);
  const width = right - left;
  const height = bottom - top;

  const output = document.createElement("canvas");
  output.width = width;
  output.height = height;
  const outputContext = output.getContext("2d");
  if (!outputContext) {
    return null;
  }

  outputContext.drawImage(source, left, top, width, height, 0, 0, width, height);

  return {
    dataUrl: output.toDataURL("image/png"),
    width,
    height,
    aspect: width / height,
  };
}
