import { describe, expect, it } from "vitest";
import { decodePngDataUrl, findInkBounds } from "@/lib/signature-image";
import { encodePng, makeSignatureBitmap } from "./helpers/png";

describe("findInkBounds", () => {
  it("returns the tight bounds of visible ink inside transparent padding", () => {
    const ink = { left: 40, top: 65, right: 320, bottom: 190 };
    const bitmap = makeSignatureBitmap(400, 280, ink);
    expect(findInkBounds(bitmap.rgba, bitmap.width, bitmap.height)).toEqual(ink);
  });

  it("returns null for an empty canvas", () => {
    expect(findInkBounds(new Uint8Array(100 * 50 * 4), 100, 50)).toBeNull();
  });

  it("ignores nearly invisible anti-aliasing haze below the threshold", () => {
    const rgba = new Uint8Array(20 * 20 * 4);
    rgba[(2 * 20 + 2) * 4 + 3] = 4; // faint pixel at (2,2)
    rgba[(10 * 20 + 10) * 4 + 3] = 255; // real ink at (10,10)
    expect(findInkBounds(rgba, 20, 20)).toEqual({ left: 10, top: 10, right: 11, bottom: 11 });
  });
});

describe("decodePngDataUrl", () => {
  it("decodes a PNG data URL", () => {
    const bitmap = makeSignatureBitmap(30, 10, { left: 0, top: 0, right: 30, bottom: 10 });
    const png = encodePng(bitmap.width, bitmap.height, bitmap.rgba);
    const dataUrl = `data:image/png;base64,${Buffer.from(png).toString("base64")}`;
    const decoded = decodePngDataUrl(dataUrl);
    expect(decoded).not.toBeNull();
    expect(decoded?.length).toBe(png.length);
  });

  it("rejects non-PNG payloads", () => {
    expect(decodePngDataUrl("data:image/jpeg;base64,AAAA")).toBeNull();
    expect(decodePngDataUrl(`data:image/png;base64,${Buffer.from("not a png at all").toString("base64")}`)).toBeNull();
    expect(decodePngDataUrl(42)).toBeNull();
    expect(decodePngDataUrl("data:image/png;base64,***")).toBeNull();
  });
});
