/**
 * End-to-end coordinate regression: the placement chosen in the preview must be
 * the rectangle embedded in the PDF, at every viewport width, on the agreement's
 * real page geometry, and on rotated pages.
 */
import { existsSync, readFileSync } from "node:fs";
import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { embedSignatureInPdf } from "@/lib/pdf";
import { findInkBounds } from "@/lib/signature-image";
import {
  displayRectToPlacement,
  placementToDisplayRect,
  sizePlacement,
  type NormalizedPlacement,
} from "@/lib/signature-placement";
import { REAL_AGREEMENT, makeAgreementFixture, makeSinglePagePdf } from "./helpers/fixtures";
import { readImagePaints, readTextItems } from "./helpers/pdf-readback";
import { cropBitmap, encodePng, makeSignatureBitmap } from "./helpers/png";

/** Simulates the browser: the pad bitmap is trimmed to its ink before export. */
function makeTrimmedSignature() {
  const padded = makeSignatureBitmap(900, 300, { left: 120, top: 90, right: 780, bottom: 250 });
  const bounds = findInkBounds(padded.rgba, padded.width, padded.height);
  if (!bounds) throw new Error("fixture signature is empty");
  const trimmed = cropBitmap(padded, bounds);
  return {
    png: encodePng(trimmed.width, trimmed.height, trimmed.rgba),
    width: trimmed.width,
    height: trimmed.height,
    aspect: trimmed.width / trimmed.height,
  };
}

const VIEWPORT_WIDTHS = [320, 390, 768, 1280];
const PAGE = REAL_AGREEMENT.mediaBox;
const PAGE_ASPECT = PAGE.width / PAGE.height;
const LAST_PAGE_INDEX = REAL_AGREEMENT.pageCount - 1;

/** Named placements expressed in displayed points on the 750 × 1125 page. */
function scenarioPlacements(signatureAspect: number): Record<string, NormalizedPlacement> {
  const line = REAL_AGREEMENT.lines.client;
  const lineWidth = line.right - line.left;
  const onLine = sizePlacement(
    { pageIndex: LAST_PAGE_INDEX, x: line.left / PAGE.width, y: 0 },
    (lineWidth * 0.9) / PAGE.width,
    signatureAspect,
    PAGE_ASPECT,
  );
  // rest the ink 6 pt above the line, centred on it
  const onLineBottom = (line.y - 6) / PAGE.height;
  const onLineX = (line.left + (lineWidth - onLine.width * PAGE.width) / 2) / PAGE.width;

  return {
    "A: top-left": sizePlacement({ pageIndex: LAST_PAGE_INDEX, x: 0.05, y: 0.05 }, 0.22, signatureAspect, PAGE_ASPECT),
    "B: centre": sizePlacement({ pageIndex: LAST_PAGE_INDEX, x: 0.39, y: 0.47 }, 0.22, signatureAspect, PAGE_ASPECT),
    "C: bottom-right": sizePlacement({ pageIndex: LAST_PAGE_INDEX, x: 0.74, y: 0.9 }, 0.22, signatureAspect, PAGE_ASPECT),
    "D: on the client signature line": { ...onLine, x: onLineX, y: onLineBottom - onLine.height },
  };
}

function expectSameRect(
  actual: { x: number; y: number; width: number; height: number },
  expected: { x: number; y: number; width: number; height: number },
  digits = 9,
) {
  expect(actual.x).toBeCloseTo(expected.x, digits);
  expect(actual.y).toBeCloseTo(expected.y, digits);
  expect(actual.width).toBeCloseTo(expected.width, digits);
  expect(actual.height).toBeCloseTo(expected.height, digits);
}

describe("signed PDF matches the preview (sanitized agreement fixture)", () => {
  const signature = makeTrimmedSignature();
  const scenarios = scenarioPlacements(signature.aspect);

  for (const [name, target] of Object.entries(scenarios)) {
    for (const viewportWidth of VIEWPORT_WIDTHS) {
      it(`${name} placed at ${viewportWidth}px wide`, async () => {
        const original = await makeAgreementFixture();
        // What the browser shows: the page box in CSS pixels at this width.
        const displayedPage = { width: viewportWidth, height: viewportWidth / PAGE_ASPECT };
        const overlayRect = placementToDisplayRect(target, displayedPage);
        // What the browser sends: the overlay's CSS rectangle normalised to the page.
        const placement = displayRectToPlacement(overlayRect, displayedPage, LAST_PAGE_INDEX);

        const signed = await embedSignatureInPdf({
          pdfBytes: original,
          signaturePng: signature.png,
          placement,
        });

        const doc = await PDFDocument.load(signed);
        expect(doc.getPageCount()).toBe(REAL_AGREEMENT.pageCount);

        const paints = await readImagePaints(signed, REAL_AGREEMENT.pageCount);
        expect(paints).toHaveLength(1);
        expectSameRect(paints[0].normalized, target);

        // The embedded bitmap is the trimmed one, so its aspect ratio survives.
        const drawnAspect =
          (paints[0].normalized.width * PAGE.width) / (paints[0].normalized.height * PAGE.height);
        expect(drawnAspect).toBeCloseTo(signature.aspect, 6);

        // Nothing leaked onto other pages.
        for (const other of [1, Math.ceil(REAL_AGREEMENT.pageCount / 2)]) {
          expect(await readImagePaints(signed, other)).toHaveLength(0);
        }
      });
    }
  }

  it("D: the visible ink rests just above the client signature line, inside its extent", async () => {
    const original = await makeAgreementFixture();
    const target = scenarios["D: on the client signature line"];
    const signed = await embedSignatureInPdf({ pdfBytes: original, signaturePng: signature.png, placement: target });
    const [paint] = await readImagePaints(signed, REAL_AGREEMENT.pageCount);
    const line = REAL_AGREEMENT.lines.client;

    const inkBottom = (paint.normalized.y + paint.normalized.height) * PAGE.height;
    const inkLeft = paint.normalized.x * PAGE.width;
    const inkRight = inkLeft + paint.normalized.width * PAGE.width;

    expect(inkBottom).toBeLessThan(line.y);
    expect(line.y - inkBottom).toBeLessThan(12);
    expect(inkLeft).toBeGreaterThanOrEqual(line.left - 1);
    expect(inkRight).toBeLessThanOrEqual(line.right + 1);

    // and it sits above the label text rather than on top of it
    const labels = await readTextItems(signed, REAL_AGREEMENT.pageCount);
    const label = labels.find((item) => item.text === "Client signature");
    expect(label).toBeDefined();
    expect(inkBottom / PAGE.height).toBeLessThan(label!.baseline - label!.height);
  });

  it("is stable across viewport widths (fractions are width independent)", async () => {
    const original = await makeAgreementFixture();
    const target = scenarios["D: on the client signature line"];
    const results = [];
    for (const width of VIEWPORT_WIDTHS) {
      const displayedPage = { width, height: width / PAGE_ASPECT };
      const placement = displayRectToPlacement(
        placementToDisplayRect(target, displayedPage),
        displayedPage,
        LAST_PAGE_INDEX,
      );
      const signed = await embedSignatureInPdf({ pdfBytes: original, signaturePng: signature.png, placement });
      results.push((await readImagePaints(signed, REAL_AGREEMENT.pageCount))[0].pdfBounds);
    }
    for (const bounds of results.slice(1)) {
      expect(bounds.x0).toBeCloseTo(results[0].x0, 6);
      expect(bounds.y0).toBeCloseTo(results[0].y0, 6);
      expect(bounds.x1).toBeCloseTo(results[0].x1, 6);
      expect(bounds.y1).toBeCloseTo(results[0].y1, 6);
    }
  });
});

describe("rotated and differently sized pages", () => {
  const signature = makeTrimmedSignature();
  const cases = [
    { name: "A4 portrait", spec: { mediaBox: [0, 0, 595.28, 841.89] as [number, number, number, number] } },
    { name: "Letter rotated 90", spec: { mediaBox: [0, 0, 612, 792] as [number, number, number, number], rotation: 90 } },
    { name: "Letter rotated 180", spec: { mediaBox: [0, 0, 612, 792] as [number, number, number, number], rotation: 180 } },
    { name: "A4 rotated 270 with CropBox", spec: { mediaBox: [0, 0, 595, 842] as [number, number, number, number], cropBox: [30, 40, 565, 800] as [number, number, number, number], rotation: 270 } },
    { name: "landscape with offset origin", spec: { mediaBox: [15, 25, 857, 620] as [number, number, number, number] } },
  ];

  for (const { name, spec } of cases) {
    it(name, async () => {
      const original = await makeSinglePagePdf(spec);
      const target = { pageIndex: 0, x: 0.12, y: 0.63, width: 0.3, height: 0.08 };
      const signed = await embedSignatureInPdf({ pdfBytes: original, signaturePng: signature.png, placement: target });
      const paints = await readImagePaints(signed, 1);
      expect(paints).toHaveLength(1);
      expectSameRect(paints[0].normalized, target);
    });
  }
});

describe("real agreement (when available locally)", () => {
  const realPath = process.env.REAL_CONTRACT_PDF;
  const available = Boolean(realPath && existsSync(realPath));

  it.skipIf(!available)("embeds on the last page exactly where the preview showed it", async () => {
    const original = new Uint8Array(readFileSync(realPath as string));
    const signature = makeTrimmedSignature();
    const target = scenarioPlacements(signature.aspect)["D: on the client signature line"];

    const signed = await embedSignatureInPdf({ pdfBytes: original, signaturePng: signature.png, placement: target });
    const doc = await PDFDocument.load(signed);
    expect(doc.getPageCount()).toBe(REAL_AGREEMENT.pageCount);

    const paints = await readImagePaints(signed, REAL_AGREEMENT.pageCount);
    const ours = paints[paints.length - 1];
    expectSameRect(ours.normalized, target, 6);

    // The owner's pre-printed signature on the same page is the reference: our
    // ink must sit at the same height band, above the line, on the left line.
    const label = (await readTextItems(signed, REAL_AGREEMENT.pageCount)).find((item) =>
      item.text.includes("חתימת הלקוח/ה"),
    );
    expect(label).toBeDefined();
    const inkBottom = ours.normalized.y + ours.normalized.height;
    expect(inkBottom).toBeLessThan(label!.baseline - label!.height);
    expect(ours.normalized.x).toBeGreaterThanOrEqual(REAL_AGREEMENT.lines.client.left / PAGE.width - 0.005);
    expect(ours.normalized.x + ours.normalized.width).toBeLessThanOrEqual(REAL_AGREEMENT.lines.client.right / PAGE.width + 0.005);
  });
});
