import { describe, expect, it } from "vitest";
import {
  TARGET_LIMITS,
  fallbackTarget,
  fitWithinTarget,
  isWithinTarget,
  parseSignatureTarget,
  targetAtPoint,
  targetFromAnchor,
} from "@/lib/signature-placement";

const PAGE_ASPECT = 750 / 1125;
const TARGET = { pageIndex: 7, x: 0.1, y: 0.35, width: 0.24, height: 0.0533 };

describe("fitWithinTarget", () => {
  it("fills the width for a wide signature and rests on the bottom edge", () => {
    const fitted = fitWithinTarget(TARGET, 5, PAGE_ASPECT);
    expect(fitted.width).toBeCloseTo(TARGET.width, 9);
    expect(fitted.x).toBeCloseTo(TARGET.x, 9);
    expect(fitted.y + fitted.height).toBeCloseTo(TARGET.y + TARGET.height, 9);
    expect((fitted.width * 750) / (fitted.height * 1125)).toBeCloseTo(5, 9);
    expect(isWithinTarget(fitted, TARGET)).toBe(true);
  });

  it("fills the height for a tall signature and centres it horizontally", () => {
    const fitted = fitWithinTarget(TARGET, 1.2, PAGE_ASPECT);
    expect(fitted.height).toBeCloseTo(TARGET.height, 9);
    expect(fitted.x + fitted.width / 2).toBeCloseTo(TARGET.x + TARGET.width / 2, 9);
    expect((fitted.width * 750) / (fitted.height * 1125)).toBeCloseTo(1.2, 9);
    expect(isWithinTarget(fitted, TARGET)).toBe(true);
  });

  it("never stretches: aspect ratio is preserved for any input", () => {
    for (const aspect of [0.5, 1, 2, 3, 4.5, 8]) {
      const fitted = fitWithinTarget(TARGET, aspect, PAGE_ASPECT);
      expect((fitted.width * 750) / (fitted.height * 1125)).toBeCloseTo(aspect, 9);
      expect(isWithinTarget(fitted, TARGET)).toBe(true);
    }
  });

  it("works on landscape pages and with a bad aspect input", () => {
    const fitted = fitWithinTarget({ ...TARGET, pageIndex: 0 }, Number.NaN, 842 / 595);
    expect(isWithinTarget(fitted, { ...TARGET, pageIndex: 0 })).toBe(true);
  });
});

describe("target builders stay on the page", () => {
  it("targetFromAnchor sits above the label", () => {
    const anchor = { x: 80.2 / 750, width: 164 / 750, baseline: 488.5 / 1125, height: 25 / 1125 };
    const target = targetFromAnchor(7, anchor, PAGE_ASPECT);
    const bottom = (target.y + target.height) * 1125;
    expect(bottom).toBeLessThan(488.5 - 25);
    expect(bottom).toBeGreaterThan(430);
    expect(target.x + target.width / 2).toBeCloseTo(anchor.x + anchor.width / 2, 6);
  });

  it("fallbackTarget and targetAtPoint are clamped and sized within limits", () => {
    for (const target of [
      fallbackTarget(0, PAGE_ASPECT),
      targetAtPoint(2, { x: 0.98, y: 0.99 }, PAGE_ASPECT),
      targetAtPoint(2, { x: 0, y: 0 }, 1.6),
    ]) {
      expect(target.x).toBeGreaterThanOrEqual(0);
      expect(target.y).toBeGreaterThanOrEqual(0);
      expect(target.x + target.width).toBeLessThanOrEqual(1 + 1e-9);
      expect(target.y + target.height).toBeLessThanOrEqual(1 + 1e-9);
      expect(target.width).toBeGreaterThanOrEqual(TARGET_LIMITS.minWidth);
      expect(target.height).toBeGreaterThanOrEqual(TARGET_LIMITS.minHeight);
    }
  });
});

describe("parseSignatureTarget", () => {
  const valid = { pageIndex: 2, x: 0.5, y: 0.6, width: 0.25, height: 0.05, locked: true };

  it("accepts a valid owner target and forces the source", () => {
    expect(parseSignatureTarget(valid, 5)).toEqual({ ...valid, source: "owner" });
    expect(parseSignatureTarget({ ...valid, source: "detected" }, 5)?.source).toBe("detected");
    expect(parseSignatureTarget({ ...valid, source: "hacker" }, 5)?.source).toBe("owner");
  });

  it("rejects bad pages, NaN, negatives, off-page boxes and absurd sizes", () => {
    expect(parseSignatureTarget({ ...valid, pageIndex: 5 }, 5)).toBeNull();
    expect(parseSignatureTarget({ ...valid, pageIndex: -1 }, 5)).toBeNull();
    expect(parseSignatureTarget({ ...valid, x: Number.NaN }, 5)).toBeNull();
    expect(parseSignatureTarget({ ...valid, width: -0.2 }, 5)).toBeNull();
    expect(parseSignatureTarget({ ...valid, x: 0.9 }, 5)).toBeNull();
    expect(parseSignatureTarget({ ...valid, width: 0.01 }, 5)).toBeNull();
    expect(parseSignatureTarget({ ...valid, width: 0.95, x: 0 }, 5)).toBeNull();
    expect(parseSignatureTarget({ ...valid, height: 0.6, y: 0 }, 5)).toBeNull();
    expect(parseSignatureTarget({ ...valid, locked: "yes" }, 5)).toBeNull();
    expect(parseSignatureTarget(null, 5)).toBeNull();
  });
});
