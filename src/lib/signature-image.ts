/**
 * Pixel-level helpers for the signature bitmap. Pure, shared with tests.
 */

/** Half-open pixel bounds: [left, right) × [top, bottom). */
export type PixelBounds = { left: number; top: number; right: number; bottom: number };

/**
 * Finds the bounding box of visible ink in an RGBA buffer. Pixels whose alpha is
 * at or below `alphaThreshold` count as transparent. Returns null for an empty
 * image so callers can treat "nothing drawn" explicitly.
 */
export function findInkBounds(
  rgba: Uint8ClampedArray | Uint8Array,
  width: number,
  height: number,
  alphaThreshold = 8,
): PixelBounds | null {
  if (width <= 0 || height <= 0 || rgba.length < width * height * 4) {
    return null;
  }

  let left = width;
  let right = -1;
  let top = height;
  let bottom = -1;

  for (let y = 0; y < height; y += 1) {
    const rowOffset = y * width * 4;
    for (let x = 0; x < width; x += 1) {
      if (rgba[rowOffset + x * 4 + 3] > alphaThreshold) {
        if (x < left) left = x;
        if (x > right) right = x;
        if (y < top) top = y;
        if (y > bottom) bottom = y;
      }
    }
  }

  if (right < 0) {
    return null;
  }

  return { left, top, right: right + 1, bottom: bottom + 1 };
}

/** Maximum signature payload accepted by the server (base64 PNG). */
export const MAX_SIGNATURE_DATA_URL_LENGTH = 2 * 1024 * 1024;

const PNG_DATA_URL_PREFIX = "data:image/png;base64,";

/** Extracts PNG bytes from a data URL, or returns null when it is not a PNG data URL. */
export function decodePngDataUrl(dataUrl: unknown): Uint8Array | null {
  if (
    typeof dataUrl !== "string" ||
    !dataUrl.startsWith(PNG_DATA_URL_PREFIX) ||
    dataUrl.length > MAX_SIGNATURE_DATA_URL_LENGTH
  ) {
    return null;
  }

  const base64 = dataUrl.slice(PNG_DATA_URL_PREFIX.length);
  if (!/^[A-Za-z0-9+/]+=*$/.test(base64)) {
    return null;
  }

  const bytes = Buffer.from(base64, "base64");
  // PNG signature starts with 0x89 'P' 'N' 'G'
  const isPng =
    bytes.length > 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47;

  return isPng ? new Uint8Array(bytes) : null;
}
