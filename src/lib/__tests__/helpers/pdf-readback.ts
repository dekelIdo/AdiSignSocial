/**
 * Independent read-back of where an image ended up in a PDF, using pdf.js.
 *
 * pdf.js interprets the page content stream, tracks the current transformation
 * matrix and reports each image paint. Mapping the image's unit square through
 * that matrix and then through pdf.js's own viewport gives the rectangle pdf.js
 * would display, which is exactly what the recipient saw in the preview.
 */
import { getDocument, OPS } from "pdfjs-dist/legacy/build/pdf.mjs";
import type { PDFDocumentProxy } from "pdfjs-dist/legacy/build/pdf.mjs";
import type { PdfBounds } from "@/lib/signature-placement";

type Matrix = [number, number, number, number, number, number];

const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];

/** Row-vector product: apply `first`, then `second`. */
function multiply(first: Matrix, second: Matrix): Matrix {
  return [
    first[0] * second[0] + first[1] * second[2],
    first[0] * second[1] + first[1] * second[3],
    first[2] * second[0] + first[3] * second[2],
    first[2] * second[1] + first[3] * second[3],
    first[4] * second[0] + first[5] * second[2] + second[4],
    first[4] * second[1] + first[5] * second[3] + second[5],
  ];
}

function applyMatrix(matrix: Matrix, x: number, y: number): [number, number] {
  return [matrix[0] * x + matrix[2] * y + matrix[4], matrix[1] * x + matrix[3] * y + matrix[5]];
}

export type ImageReadback = {
  /** pdf.js object id of the painted image. */
  id: string;
  /** Axis-aligned bounds in PDF user space. */
  pdfBounds: PdfBounds;
  /** Where pdf.js displays it, as fractions of the displayed page (top-left origin). */
  normalized: { x: number; y: number; width: number; height: number };
  /** Displayed page size in points at scale 1 (rotation applied). */
  displayed: { width: number; height: number };
};

export async function withPdfjs<T>(
  bytes: Uint8Array,
  run: (pdf: PDFDocumentProxy) => Promise<T>,
): Promise<T> {
  const task = getDocument({
    data: bytes.slice(),
    isOffscreenCanvasSupported: false,
    useSystemFonts: true,
    verbosity: 0,
  });
  const pdf = await task.promise;
  try {
    return await run(pdf);
  } finally {
    await task.destroy();
  }
}

/** Lists every image painted on a page, in paint order. */
export async function readImagePaints(bytes: Uint8Array, pageNumber: number) {
  return withPdfjs(bytes, async (pdf) => {
    const page = await pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 1 });
    const operatorList = await page.getOperatorList();
    const results: ImageReadback[] = [];
    const stack: Matrix[] = [];
    let ctm: Matrix = IDENTITY;

    operatorList.fnArray.forEach((fn, index) => {
      const args = operatorList.argsArray[index] as unknown[];
      switch (fn) {
        case OPS.save:
          stack.push(ctm);
          break;
        case OPS.restore:
          ctm = stack.pop() ?? IDENTITY;
          break;
        case OPS.transform:
          ctm = multiply(args as Matrix, ctm);
          break;
        case OPS.paintFormXObjectBegin: {
          stack.push(ctm);
          const matrix = args[0] as Matrix | null;
          if (matrix) {
            ctm = multiply(matrix, ctm);
          }
          break;
        }
        case OPS.paintFormXObjectEnd:
          ctm = stack.pop() ?? IDENTITY;
          break;
        case OPS.paintImageXObject:
        case OPS.paintImageMaskXObject:
        case OPS.paintInlineImageXObject: {
          const corners = [
            applyMatrix(ctm, 0, 0),
            applyMatrix(ctm, 1, 0),
            applyMatrix(ctm, 0, 1),
            applyMatrix(ctm, 1, 1),
          ];
          const xs = corners.map((point) => point[0]);
          const ys = corners.map((point) => point[1]);
          const displayCorners = corners.map((point) =>
            viewport.convertToViewportPoint(point[0], point[1]),
          );
          const dxs = displayCorners.map((point) => point[0]);
          const dys = displayCorners.map((point) => point[1]);
          const left = Math.min(...dxs);
          const top = Math.min(...dys);

          results.push({
            id: typeof args[0] === "string" ? args[0] : "inline",
            pdfBounds: {
              x0: Math.min(...xs),
              y0: Math.min(...ys),
              x1: Math.max(...xs),
              y1: Math.max(...ys),
            },
            normalized: {
              x: left / viewport.width,
              y: top / viewport.height,
              width: (Math.max(...dxs) - left) / viewport.width,
              height: (Math.max(...dys) - top) / viewport.height,
            },
            displayed: { width: viewport.width, height: viewport.height },
          });
          break;
        }
        default:
          break;
      }
    });

    return results;
  });
}

/** Text items on a page with their displayed bounds (fractions of the page). */
export async function readTextItems(bytes: Uint8Array, pageNumber: number) {
  return withPdfjs(bytes, async (pdf) => {
    const page = await pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();

    return content.items.flatMap((item) => {
      if (!("str" in item) || !item.str.trim()) {
        return [];
      }
      const [, , , , originX, originY] = item.transform;
      const [x, baseline] = viewport.convertToViewportPoint(originX, originY);
      return [
        {
          text: item.str,
          x: x / viewport.width,
          baseline: baseline / viewport.height,
          width: item.width / viewport.width,
          height: item.height / viewport.height,
        },
      ];
    });
  });
}
