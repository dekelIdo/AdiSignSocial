import { describe, expect, it } from "vitest";
import {
  PLACEMENT_LIMITS,
  clampPlacementToPage,
  displayRectToPlacement,
  displayedPageSize,
  drawingToPdfBounds,
  normalizeRotation,
  parsePlacement,
  placementToDisplayRect,
  placementToPdfDrawing,
  resolveVisibleBounds,
  scalePlacement,
  sizePlacement,
  type NormalizedPlacement,
  type PageGeometry,
} from "@/lib/signature-placement";
import { makeSinglePagePdf, type SimplePageSpec } from "./helpers/fixtures";
import { withPdfjs } from "./helpers/pdf-readback";

const SAMPLE_PLACEMENTS: Array<Omit<NormalizedPlacement, "pageIndex">> = [
  { x: 0.05, y: 0.05, width: 0.22, height: 0.06 }, // top-left
  { x: 0.39, y: 0.47, width: 0.22, height: 0.06 }, // centre
  { x: 0.72, y: 0.88, width: 0.22, height: 0.06 }, // bottom-right
  { x: 0, y: 0, width: 1, height: 1 }, // whole page
  { x: 0.1, y: 0.35, width: 0.2, height: 0.09 }, // signature line area
];

const BOX_SPECS: Array<{ name: string; spec: SimplePageSpec }> = [
  { name: "A4 at origin", spec: { mediaBox: [0, 0, 595.28, 841.89] } },
  { name: "real agreement box (y origin 8.04)", spec: { mediaBox: [0, 8.03995, 750, 1133.0399] } },
  { name: "letter with inset CropBox", spec: { mediaBox: [0, 0, 612, 792], cropBox: [36, 48, 576, 760] } },
  { name: "offset MediaBox, larger CropBox", spec: { mediaBox: [20, 30, 620, 822], cropBox: [0, 0, 700, 900] } },
  { name: "landscape", spec: { mediaBox: [0, 0, 842, 595] } },
];

function specToGeometry(spec: SimplePageSpec): PageGeometry {
  const [x0, y0, x1, y1] = spec.mediaBox;
  const cropBox = spec.cropBox
    ? { x: spec.cropBox[0], y: spec.cropBox[1], width: spec.cropBox[2] - spec.cropBox[0], height: spec.cropBox[3] - spec.cropBox[1] }
    : null;
  return { mediaBox: { x: x0, y: y0, width: x1 - x0, height: y1 - y0 }, cropBox, rotation: spec.rotation };
}

describe("normalizeRotation", () => {
  it("mirrors pdf.js rules", () => {
    expect(normalizeRotation(undefined)).toBe(0);
    expect(normalizeRotation(0)).toBe(0);
    expect(normalizeRotation(90)).toBe(90);
    expect(normalizeRotation(-90)).toBe(270);
    expect(normalizeRotation(450)).toBe(90);
    expect(normalizeRotation(45)).toBe(0);
    expect(normalizeRotation(Number.NaN)).toBe(0);
  });
});

describe("resolveVisibleBounds", () => {
  it("intersects CropBox with MediaBox like pdf.js", () => {
    expect(
      resolveVisibleBounds({
        mediaBox: { x: 0, y: 0, width: 612, height: 792 },
        cropBox: { x: 36, y: 48, width: 540, height: 712 },
      }),
    ).toEqual({ x0: 36, y0: 48, x1: 576, y1: 760 });
  });

  it("falls back to the MediaBox when the intersection is empty", () => {
    expect(
      resolveVisibleBounds({
        mediaBox: { x: 0, y: 0, width: 612, height: 792 },
        cropBox: { x: 700, y: 900, width: 100, height: 100 },
      }),
    ).toEqual({ x0: 0, y0: 0, x1: 612, y1: 792 });
  });

  it("normalises boxes with negative sizes", () => {
    expect(
      resolveVisibleBounds({ mediaBox: { x: 612, y: 792, width: -612, height: -792 } }),
    ).toEqual({ x0: 0, y0: 0, x1: 612, y1: 792 });
  });
});

describe("placementToPdfDrawing (pure)", () => {
  it("subtracts the signature height and honours the box origin for unrotated pages", () => {
    const drawing = placementToPdfDrawing(
      { pageIndex: 0, x: 0.1, y: 0.4, width: 0.2, height: 0.05 },
      { mediaBox: { x: 0, y: 8.04, width: 750, height: 1125 }, rotation: 0 },
    );
    expect(drawing.rotate).toBe(0);
    expect(drawing.x).toBeCloseTo(75, 9);
    expect(drawing.width).toBeCloseTo(150, 9);
    expect(drawing.height).toBeCloseTo(56.25, 9);
    // top edge at 40% of 1125 = 450 from the top → bottom edge 56.25 lower →
    // PDF y = (8.04 + 1125) − 450 − 56.25
    expect(drawing.y).toBeCloseTo(8.04 + 1125 - 450 - 56.25, 9);
  });

  it("round-trips display rect ↔ placement", () => {
    const page = { width: 390, height: 585 };
    const rect = { left: 39, top: 234, width: 85.8, height: 35.1 };
    const placement = displayRectToPlacement(rect, page, 7);
    const back = placementToDisplayRect(placement, page);
    expect(back.left).toBeCloseTo(rect.left, 9);
    expect(back.top).toBeCloseTo(rect.top, 9);
    expect(back.width).toBeCloseTo(rect.width, 9);
    expect(back.height).toBeCloseTo(rect.height, 9);
    expect(placement.pageIndex).toBe(7);
  });

  it("produces identical fractions from any viewport width", () => {
    const widths = [320, 360, 375, 390, 412, 430, 768, 1024, 1280];
    const reference = displayRectToPlacement(
      { left: 32, top: 156, width: 70.4, height: 24 },
      { width: 320, height: 480 },
      0,
    );
    for (const width of widths) {
      const page = { width, height: width * 1.5 };
      const rect = placementToDisplayRect(reference, page);
      const placement = displayRectToPlacement(rect, page, 0);
      expect(placement.x).toBeCloseTo(reference.x, 12);
      expect(placement.y).toBeCloseTo(reference.y, 12);
      expect(placement.width).toBeCloseTo(reference.width, 12);
      expect(placement.height).toBeCloseTo(reference.height, 12);
    }
  });
});

describe("placementToPdfDrawing agrees with the pdf.js viewport transform", () => {
  for (const rotation of [0, 90, 180, 270, -90, 360]) {
    for (const { name, spec } of BOX_SPECS) {
      it(`${name}, /Rotate ${rotation}`, async () => {
        const fullSpec = { ...spec, rotation };
        const bytes = await makeSinglePagePdf(fullSpec);
        const geometry = specToGeometry(fullSpec);

        await withPdfjs(bytes, async (pdf) => {
          const page = await pdf.getPage(1);
          const viewport = page.getViewport({ scale: 1 });
          const displayed = displayedPageSize(geometry);

          expect(normalizeRotation(rotation)).toBe(page.rotate);
          expect(displayed.width).toBeCloseTo(viewport.width, 6);
          expect(displayed.height).toBeCloseTo(viewport.height, 6);

          for (const sample of SAMPLE_PLACEMENTS) {
            const placement = { pageIndex: 0, ...sample };
            const drawing = placementToPdfDrawing(placement, geometry);
            const bounds = drawingToPdfBounds(drawing);
            const corners = [
              viewport.convertToViewportPoint(bounds.x0, bounds.y0),
              viewport.convertToViewportPoint(bounds.x1, bounds.y0),
              viewport.convertToViewportPoint(bounds.x0, bounds.y1),
              viewport.convertToViewportPoint(bounds.x1, bounds.y1),
            ];
            const left = Math.min(...corners.map((point) => point[0]));
            const top = Math.min(...corners.map((point) => point[1]));
            const right = Math.max(...corners.map((point) => point[0]));
            const bottom = Math.max(...corners.map((point) => point[1]));

            expect(left / viewport.width).toBeCloseTo(placement.x, 9);
            expect(top / viewport.height).toBeCloseTo(placement.y, 9);
            expect((right - left) / viewport.width).toBeCloseTo(placement.width, 9);
            expect((bottom - top) / viewport.height).toBeCloseTo(placement.height, 9);
          }
        });
      });
    }
  }
});

describe("sizing helpers", () => {
  const pageAspect = 750 / 1125;

  it("keeps the aspect ratio and respects limits", () => {
    const placement = sizePlacement({ pageIndex: 0, x: 0.1, y: 0.4 }, 0.22, 2.7, pageAspect);
    expect(placement.width).toBeCloseTo(0.22, 9);
    // height fraction = width × pageWidth / aspect / pageHeight
    expect(placement.height).toBeCloseTo((0.22 * 750) / 2.7 / 1125, 9);

    const tooSmall = sizePlacement({ pageIndex: 0, x: 0, y: 0 }, 0.01, 3, pageAspect);
    expect(tooSmall.width).toBeCloseTo(PLACEMENT_LIMITS.minWidth, 9);

    const tooLarge = sizePlacement({ pageIndex: 0, x: 0, y: 0 }, 5, 3, pageAspect);
    expect(tooLarge.width).toBeLessThanOrEqual(PLACEMENT_LIMITS.maxWidth + 1e-9);

    const tall = sizePlacement({ pageIndex: 0, x: 0, y: 0 }, 0.6, 0.5, pageAspect);
    expect(tall.height).toBeLessThanOrEqual(PLACEMENT_LIMITS.maxHeight + 1e-9);
  });

  it("scales around the bottom-left corner so the ink stays on the line", () => {
    const start = sizePlacement({ pageIndex: 0, x: 0.1, y: 0.4 }, 0.2, 3, pageAspect);
    const bottom = start.y + start.height;
    const bigger = scalePlacement(start, 1.25, 3, pageAspect);
    expect(bigger.width).toBeCloseTo(0.25, 9);
    expect(bigger.x).toBeCloseTo(start.x, 9);
    expect(bigger.y + bigger.height).toBeCloseTo(bottom, 9);
  });

  it("clamps to the page", () => {
    expect(clampPlacementToPage({ pageIndex: 0, x: 0.95, y: -0.2, width: 0.2, height: 0.1 })).toEqual({
      pageIndex: 0,
      x: 0.8,
      y: 0,
      width: 0.2,
      height: 0.1,
    });
  });
});

describe("parsePlacement", () => {
  it("accepts valid input", () => {
    expect(parsePlacement({ pageIndex: 7, x: 0.1, y: 0.4, width: 0.2, height: 0.05 }, 8)).toEqual({
      pageIndex: 7,
      x: 0.1,
      y: 0.4,
      width: 0.2,
      height: 0.05,
    });
  });

  it("rejects malformed, out-of-range and off-page input", () => {
    expect(parsePlacement(null, 8)).toBeNull();
    expect(parsePlacement("x", 8)).toBeNull();
    expect(parsePlacement({ pageIndex: 8, x: 0.1, y: 0.1, width: 0.1, height: 0.1 }, 8)).toBeNull();
    expect(parsePlacement({ pageIndex: 1.5, x: 0.1, y: 0.1, width: 0.1, height: 0.1 }, 8)).toBeNull();
    expect(parsePlacement({ pageIndex: 0, x: 0.95, y: 0.1, width: 0.1, height: 0.1 }, 8)).toBeNull();
    expect(parsePlacement({ pageIndex: 0, x: 0.1, y: 0.1, width: 0, height: 0.1 }, 8)).toBeNull();
    expect(parsePlacement({ pageIndex: 0, x: "0.1", y: 0.1, width: 0.1, height: 0.1 }, 8)).toBeNull();
    expect(parsePlacement({ pageIndex: 0, x: Number.NaN, y: 0.1, width: 0.1, height: 0.1 }, 8)).toBeNull();
  });
});
