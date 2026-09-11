import { deflateSync } from "node:zlib";

const CRC_TABLE = new Int32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  return c;
});

function crc32(bytes: Uint8Array) {
  let crc = -1;
  for (const byte of bytes) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ -1) >>> 0;
}

function chunk(type: string, data: Uint8Array) {
  const typeBytes = Buffer.from(type, "ascii");
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBytes, data])));
  return Buffer.concat([length, typeBytes, data, crc]);
}

/** Minimal RGBA PNG encoder for tests (no external dependencies). */
export function encodePng(width: number, height: number, rgba: Uint8Array): Uint8Array {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (stride + 1)] = 0; // filter: none
    raw.set(rgba.subarray(y * stride, (y + 1) * stride), y * (stride + 1) + 1);
  }

  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8; // bit depth
  header[9] = 6; // colour type RGBA
  header[10] = 0;
  header[11] = 0;
  header[12] = 0;

  return new Uint8Array(
    Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      chunk("IHDR", header),
      chunk("IDAT", deflateSync(raw)),
      chunk("IEND", new Uint8Array(0)),
    ]),
  );
}

export type TestBitmap = { width: number; height: number; rgba: Uint8Array };

/**
 * Draws a signature-like stroke into a transparent bitmap. The ink occupies the
 * sub-rectangle described by `ink`; everything else stays fully transparent so
 * tests can exercise trimming.
 */
export function makeSignatureBitmap(
  width: number,
  height: number,
  ink: { left: number; top: number; right: number; bottom: number },
): TestBitmap {
  const rgba = new Uint8Array(width * height * 4);
  const setPixel = (x: number, y: number) => {
    if (x < ink.left || x >= ink.right || y < ink.top || y >= ink.bottom) return;
    const offset = (y * width + x) * 4;
    rgba[offset] = 30;
    rgba[offset + 1] = 30;
    rgba[offset + 2] = 40;
    rgba[offset + 3] = 255;
  };

  const inkWidth = ink.right - ink.left;
  const inkHeight = ink.bottom - ink.top;
  // A diagonal stroke plus a flourish, thick enough to be visible when embedded.
  for (let i = 0; i < inkWidth; i += 1) {
    const yCenter = ink.top + inkHeight - 1 - Math.round((i / (inkWidth - 1)) * (inkHeight - 1));
    for (let t = -3; t <= 3; t += 1) setPixel(ink.left + i, yCenter + t);
  }
  for (let x = ink.left; x < ink.right; x += 1) {
    for (let t = 0; t < 4; t += 1) setPixel(x, ink.bottom - 1 - t);
  }
  // Corner marks make the extreme pixels unambiguous.
  setPixel(ink.left, ink.top);
  setPixel(ink.right - 1, ink.top);
  setPixel(ink.left, ink.bottom - 1);
  setPixel(ink.right - 1, ink.bottom - 1);

  return { width, height, rgba };
}

/** Copies a sub-rectangle out of a bitmap. */
export function cropBitmap(
  bitmap: TestBitmap,
  bounds: { left: number; top: number; right: number; bottom: number },
): TestBitmap {
  const width = bounds.right - bounds.left;
  const height = bounds.bottom - bounds.top;
  const rgba = new Uint8Array(width * height * 4);

  for (let y = 0; y < height; y += 1) {
    const sourceOffset = ((bounds.top + y) * bitmap.width + bounds.left) * 4;
    rgba.set(bitmap.rgba.subarray(sourceOffset, sourceOffset + width * 4), y * width * 4);
  }

  return { width, height, rgba };
}
