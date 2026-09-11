/**
 * Canonical coordinate layer for signature placement.
 *
 * The recipient positions the signature on a page exactly as pdf.js displays it.
 * That position is stored as fractions of the *displayed page box* with a
 * top-left origin. Fractions are independent of viewport width, CSS pixel size,
 * canvas backing resolution, devicePixelRatio, scroll position and zoom.
 *
 * At export time the fractions are converted into PDF user-space coordinates
 * (bottom-left origin) using the same rules pdf.js uses to pick the displayed
 * box (CropBox intersected with MediaBox) and to rotate the page (/Rotate).
 * The conversion accounts for the signature height, the box origin and the
 * page rotation, so the rectangle drawn by pdf-lib is the rectangle the
 * recipient saw.
 *
 * This module is pure and shared by the browser, the server and the tests.
 */

export type NormalizedPlacement = {
  /** Zero-based page index. */
  pageIndex: number;
  /** Left edge as a fraction of the displayed page width (0..1). */
  x: number;
  /** Top edge as a fraction of the displayed page height (0..1). */
  y: number;
  /** Width as a fraction of the displayed page width (0..1). */
  width: number;
  /** Height as a fraction of the displayed page height (0..1). */
  height: number;
};

/** Rectangle in pdf-lib style: lower-left corner plus size, PDF user space. */
export type PdfBox = { x: number; y: number; width: number; height: number };

export type PageGeometry = {
  mediaBox: PdfBox;
  /** Optional CropBox. When omitted the MediaBox is displayed. */
  cropBox?: PdfBox | null;
  /** The page's /Rotate value in degrees. */
  rotation?: number;
};

export type PageRotation = 0 | 90 | 180 | 270;

/** Axis-aligned bounds in PDF user space. */
export type PdfBounds = { x0: number; y0: number; x1: number; y1: number };

/** Arguments for pdf-lib's `page.drawImage`. */
export type PdfImageDrawing = {
  x: number;
  y: number;
  width: number;
  height: number;
  /** Counter-clockwise rotation about (x, y), in degrees. */
  rotate: PageRotation;
};

/** A rectangle in CSS pixels relative to the displayed page's top-left corner. */
export type DisplayRect = { left: number; top: number; width: number; height: number };

export type DisplaySize = { width: number; height: number };

/** Size limits for the signature, as fractions of the displayed page. */
export const PLACEMENT_LIMITS = {
  /** Minimum width as a fraction of the displayed page width. */
  minWidth: 0.12,
  /** Maximum width as a fraction of the displayed page width. */
  maxWidth: 0.6,
  /** Maximum height as a fraction of the displayed page height. */
  maxHeight: 0.25,
} as const;

const LETTER_BOUNDS: PdfBounds = { x0: 0, y0: 0, x1: 612, y1: 792 };

/** Mirrors pdf.js: only multiples of 90 are honoured, normalised into [0, 360). */
export function normalizeRotation(rotation: number | undefined | null): PageRotation {
  if (typeof rotation !== "number" || !Number.isFinite(rotation) || rotation % 90 !== 0) {
    return 0;
  }

  return (((rotation % 360) + 360) % 360) as PageRotation;
}

function toBounds(box: PdfBox): PdfBounds {
  const x0 = Math.min(box.x, box.x + box.width);
  const x1 = Math.max(box.x, box.x + box.width);
  const y0 = Math.min(box.y, box.y + box.height);
  const y1 = Math.max(box.y, box.y + box.height);
  return { x0, y0, x1, y1 };
}

function isValidBounds(bounds: PdfBounds) {
  return (
    [bounds.x0, bounds.y0, bounds.x1, bounds.y1].every(Number.isFinite) &&
    bounds.x1 - bounds.x0 > 0 &&
    bounds.y1 - bounds.y0 > 0
  );
}

function boundsEqual(a: PdfBounds, b: PdfBounds) {
  return a.x0 === b.x0 && a.y0 === b.y0 && a.x1 === b.x1 && a.y1 === b.y1;
}

/**
 * The box pdf.js displays (`PDFPageProxy.view`): the CropBox intersected with
 * the MediaBox when that intersection is non-empty, otherwise the MediaBox.
 * An invalid MediaBox falls back to US Letter, as pdf.js does.
 */
export function resolveVisibleBounds(geometry: PageGeometry): PdfBounds {
  const mediaBounds = toBounds(geometry.mediaBox);
  const media = isValidBounds(mediaBounds) ? mediaBounds : LETTER_BOUNDS;

  if (!geometry.cropBox) {
    return media;
  }

  const crop = toBounds(geometry.cropBox);
  if (!isValidBounds(crop) || boundsEqual(crop, media)) {
    return media;
  }

  const intersection: PdfBounds = {
    x0: Math.max(media.x0, crop.x0),
    y0: Math.max(media.y0, crop.y0),
    x1: Math.min(media.x1, crop.x1),
    y1: Math.min(media.y1, crop.y1),
  };

  return isValidBounds(intersection) ? intersection : media;
}

/** Size of the displayed (rotated) page in PDF points. */
export function displayedPageSize(geometry: PageGeometry): DisplaySize {
  const bounds = resolveVisibleBounds(geometry);
  const rotation = normalizeRotation(geometry.rotation);
  const width = bounds.x1 - bounds.x0;
  const height = bounds.y1 - bounds.y0;

  return rotation === 90 || rotation === 270 ? { width: height, height: width } : { width, height };
}

/**
 * Converts a normalized placement into the `drawImage` arguments that make
 * pdf-lib draw the signature exactly where pdf.js displayed it.
 *
 * pdf-lib draws an image by `translate(x, y) · rotate(θ) · scale(w, h)`, i.e.
 * the rotation is counter-clockwise about the image's bottom-left corner.
 * pdf.js maps display coordinates (top-left origin, rotated page) to PDF user
 * space through its viewport transform; the four cases below are the inverse
 * of that transform, one per rotation.
 */
export function placementToPdfDrawing(
  placement: NormalizedPlacement,
  geometry: PageGeometry,
): PdfImageDrawing {
  const bounds = resolveVisibleBounds(geometry);
  const rotation = normalizeRotation(geometry.rotation);
  const displayed = displayedPageSize(geometry);

  const left = placement.x * displayed.width;
  const top = placement.y * displayed.height;
  const width = placement.width * displayed.width;
  const height = placement.height * displayed.height;

  switch (rotation) {
    case 90:
      // display right → PDF +y, display down → PDF +x
      return { x: bounds.x0 + top + height, y: bounds.y0 + left, width, height, rotate: 90 };
    case 180:
      // display right → PDF -x, display down → PDF +y
      return { x: bounds.x1 - left, y: bounds.y0 + top + height, width, height, rotate: 180 };
    case 270:
      // display right → PDF -y, display down → PDF -x
      return { x: bounds.x1 - top - height, y: bounds.y1 - left, width, height, rotate: 270 };
    default:
      // display right → PDF +x, display down → PDF -y; `y` is the bottom edge,
      // so the signature height is subtracted as well as the top offset.
      return { x: bounds.x0 + left, y: bounds.y1 - top - height, width, height, rotate: 0 };
  }
}

/** The axis-aligned PDF user-space rectangle that a drawing covers. */
export function drawingToPdfBounds(drawing: PdfImageDrawing): PdfBounds {
  switch (drawing.rotate) {
    case 90:
      return {
        x0: drawing.x - drawing.height,
        y0: drawing.y,
        x1: drawing.x,
        y1: drawing.y + drawing.width,
      };
    case 180:
      return {
        x0: drawing.x - drawing.width,
        y0: drawing.y - drawing.height,
        x1: drawing.x,
        y1: drawing.y,
      };
    case 270:
      return {
        x0: drawing.x,
        y0: drawing.y - drawing.width,
        x1: drawing.x + drawing.height,
        y1: drawing.y,
      };
    default:
      return {
        x0: drawing.x,
        y0: drawing.y,
        x1: drawing.x + drawing.width,
        y1: drawing.y + drawing.height,
      };
  }
}

/** Browser side: a CSS-pixel rectangle inside the displayed page → fractions. */
export function displayRectToPlacement(
  rect: DisplayRect,
  page: DisplaySize,
  pageIndex: number,
): NormalizedPlacement {
  return {
    pageIndex,
    x: rect.left / page.width,
    y: rect.top / page.height,
    width: rect.width / page.width,
    height: rect.height / page.height,
  };
}

/** Browser side: fractions → CSS-pixel rectangle inside the displayed page. */
export function placementToDisplayRect(
  placement: NormalizedPlacement,
  page: DisplaySize,
): DisplayRect {
  return {
    left: placement.x * page.width,
    top: placement.y * page.height,
    width: placement.width * page.width,
    height: placement.height * page.height,
  };
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

/**
 * Builds a placement of a given width (fraction of page width) that keeps the
 * signature's aspect ratio, respects the size limits and stays on the page.
 * `pageAspect` is displayed width divided by displayed height.
 */
export function sizePlacement(
  base: Pick<NormalizedPlacement, "pageIndex" | "x" | "y">,
  desiredWidth: number,
  signatureAspect: number,
  pageAspect: number,
): NormalizedPlacement {
  const aspect = signatureAspect > 0 && Number.isFinite(signatureAspect) ? signatureAspect : 3;
  let width = clamp(desiredWidth, PLACEMENT_LIMITS.minWidth, PLACEMENT_LIMITS.maxWidth);
  // height fraction = (width fraction × page width ÷ aspect) ÷ page height
  let height = (width * pageAspect) / aspect;

  if (height > PLACEMENT_LIMITS.maxHeight) {
    height = PLACEMENT_LIMITS.maxHeight;
    width = (height * aspect) / pageAspect;
  }

  return clampPlacementToPage({ ...base, width, height });
}

/** Keeps the whole rectangle inside the page without changing its size. */
export function clampPlacementToPage(placement: NormalizedPlacement): NormalizedPlacement {
  const width = clamp(placement.width, 0, 1);
  const height = clamp(placement.height, 0, 1);

  return {
    pageIndex: placement.pageIndex,
    x: clamp(placement.x, 0, 1 - width),
    y: clamp(placement.y, 0, 1 - height),
    width,
    height,
  };
}

/**
 * Resizes around the bottom-left corner so a signature resting on a line keeps
 * resting on it. `factor` above 1 grows, below 1 shrinks.
 */
export function scalePlacement(
  placement: NormalizedPlacement,
  factor: number,
  signatureAspect: number,
  pageAspect: number,
): NormalizedPlacement {
  const resized = sizePlacement(placement, placement.width * factor, signatureAspect, pageAspect);
  const bottom = placement.y + placement.height;

  return clampPlacementToPage({ ...resized, y: bottom - resized.height });
}

/* ---------- Signature target (where the signature is expected) ---------- */

export type SignatureTargetSource = "owner" | "detected" | "fallback";

/**
 * The area where the customer's signature is expected, in the same
 * normalized convention as a placement. `locked` means the signature is
 * fitted into the box automatically and the recipient only reviews.
 */
export type SignatureTarget = NormalizedPlacement & {
  locked: boolean;
  source: SignatureTargetSource;
};

/** A text label found on a page, as fractions of the displayed page. */
export type SignatureAnchor = {
  x: number;
  width: number;
  /** Baseline of the label text, measured from the top. */
  baseline: number;
  /** Font height as a fraction of the page height. */
  height: number;
};

/** Accepted size range for an owner-defined target box (fractions of the page). */
export const TARGET_LIMITS = {
  minWidth: 0.06,
  maxWidth: 0.9,
  minHeight: 0.01,
  maxHeight: 0.5,
} as const;

/** Width ÷ height of a typical handwritten signature; shapes boxes drawn before any ink exists. */
export const TYPICAL_SIGNATURE_ASPECT = 3;

/**
 * Largest rectangle with the signature's aspect ratio that fits inside the
 * target box, resting on the box's bottom edge and centred horizontally, the
 * way ink sits on a signature line. Never stretches the signature.
 */
export function fitWithinTarget(
  target: NormalizedPlacement,
  signatureAspect: number,
  pageAspect: number,
): NormalizedPlacement {
  const aspect =
    signatureAspect > 0 && Number.isFinite(signatureAspect) ? signatureAspect : TYPICAL_SIGNATURE_ASPECT;
  // Work in display units where page height = 1 and page width = pageAspect.
  const boxWidth = target.width * pageAspect;
  const boxHeight = target.height;
  let width = boxWidth;
  let height = width / aspect;
  if (height > boxHeight) {
    height = boxHeight;
    width = height * aspect;
  }

  const widthFraction = width / pageAspect;
  return clampPlacementToPage({
    pageIndex: target.pageIndex,
    x: target.x + (target.width - widthFraction) / 2,
    y: target.y + target.height - height,
    width: widthFraction,
    height,
  });
}

/** True when `inner` lies inside `outer` (same page), with a small tolerance. */
export function isWithinTarget(
  inner: NormalizedPlacement,
  outer: NormalizedPlacement,
  tolerance = 1e-6,
): boolean {
  return (
    inner.pageIndex === outer.pageIndex &&
    inner.x >= outer.x - tolerance &&
    inner.y >= outer.y - tolerance &&
    inner.x + inner.width <= outer.x + outer.width + tolerance &&
    inner.y + inner.height <= outer.y + outer.height + tolerance
  );
}

/** A target box centred above a detected signature label. */
export function targetFromAnchor(
  pageIndex: number,
  anchor: SignatureAnchor,
  pageAspect: number,
): NormalizedPlacement {
  const width = clamp(anchor.width * 1.1, 0.18, 0.32);
  const height = (width * pageAspect) / TYPICAL_SIGNATURE_ASPECT;
  const centerX = anchor.x + anchor.width / 2;
  // Half a line above the label's top, which is where the ruled line usually is.
  const bottom = anchor.baseline - anchor.height * 1.5;

  return clampPlacementToPage({ pageIndex, x: centerX - width / 2, y: bottom - height, width, height });
}

/** Generic lower-left target for documents without any known signature line. */
export function fallbackTarget(pageIndex: number, pageAspect: number): NormalizedPlacement {
  const width = 0.28;
  const height = (width * pageAspect) / TYPICAL_SIGNATURE_ASPECT;
  return clampPlacementToPage({ pageIndex, x: 0.08, y: 0.86 - height, width, height });
}

/** A default-sized target box centred on the point the owner tapped. */
export function targetAtPoint(
  pageIndex: number,
  point: { x: number; y: number },
  pageAspect: number,
): NormalizedPlacement {
  const width = 0.26;
  const height = (width * pageAspect) / TYPICAL_SIGNATURE_ASPECT;
  return clampPlacementToPage({
    pageIndex,
    x: point.x - width / 2,
    y: point.y - height / 2,
    width,
    height,
  });
}

/**
 * Validates an owner-submitted target. Returns null for anything malformed,
 * off-page, on a missing page, or absurdly small or large.
 */
export function parseSignatureTarget(value: unknown, pageCount: number): SignatureTarget | null {
  const placement = parsePlacement(value, pageCount);
  if (!placement) {
    return null;
  }

  if (
    placement.width < TARGET_LIMITS.minWidth ||
    placement.width > TARGET_LIMITS.maxWidth ||
    placement.height < TARGET_LIMITS.minHeight ||
    placement.height > TARGET_LIMITS.maxHeight
  ) {
    return null;
  }

  const { locked, source } = value as Record<string, unknown>;
  if (typeof locked !== "boolean") {
    return null;
  }

  const parsedSource: SignatureTargetSource =
    source === "detected" || source === "fallback" ? source : "owner";

  return { ...placement, locked, source: parsedSource };
}

const isFraction = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1;

/** Validates untrusted JSON from the client. Returns null when invalid. */
export function parsePlacement(value: unknown, pageCount: number): NormalizedPlacement | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const { pageIndex, x, y, width, height } = value as Record<string, unknown>;

  if (
    typeof pageIndex !== "number" ||
    !Number.isInteger(pageIndex) ||
    pageIndex < 0 ||
    pageIndex >= pageCount
  ) {
    return null;
  }

  if (!isFraction(x) || !isFraction(y) || !isFraction(width) || !isFraction(height)) {
    return null;
  }

  if (width <= 0 || height <= 0 || x + width > 1 + 1e-6 || y + height > 1 + 1e-6) {
    return null;
  }

  return { pageIndex, x, y, width, height };
}
