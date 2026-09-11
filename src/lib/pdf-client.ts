/**
 * Browser-side pdf.js helpers: loading, page geometry and the initial
 * signature anchor. Everything here runs only in the browser.
 */
import type { PDFDocumentProxy, PDFPageProxy } from "pdfjs-dist";
import {
  clampPlacementToPage,
  sizePlacement,
  type DisplaySize,
  type NormalizedPlacement,
} from "@/lib/signature-placement";

type PdfjsModule = typeof import("pdfjs-dist");

let pdfjsPromise: Promise<PdfjsModule> | null = null;

export function loadPdfjs(): Promise<PdfjsModule> {
  if (!pdfjsPromise) {
    pdfjsPromise = import("pdfjs-dist").then((pdfjs) => {
      pdfjs.GlobalWorkerOptions.workerSrc = new URL(
        "pdfjs-dist/build/pdf.worker.mjs",
        import.meta.url,
      ).toString();
      return pdfjs;
    });
  }

  return pdfjsPromise;
}

export type LoadedPdf = {
  pdf: PDFDocumentProxy;
  /** Displayed page sizes in PDF points (rotation applied), one per page. */
  pageSizes: DisplaySize[];
  destroy: () => Promise<void>;
};

/**
 * Loads a PDF by URL so the browser streams it and reports progress.
 * `onProgress` receives 0..1, or null when the total size is unknown.
 */
export async function loadPdfDocument(
  url: string,
  onProgress?: (fraction: number | null) => void,
): Promise<LoadedPdf> {
  const pdfjs = await loadPdfjs();
  const task = pdfjs.getDocument({
    url,
    // pdf.js uses embedded fonts when present; system fonts are the fallback
    // for PDFs that did not embed theirs.
    disableFontFace: false,
    useSystemFonts: true,
  });

  task.onProgress = ({ loaded, total }: { loaded: number; total?: number }) => {
    onProgress?.(total ? Math.min(loaded / total, 1) : null);
  };

  const pdf = await task.promise;
  const pageSizes: DisplaySize[] = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 1 });
    pageSizes.push({ width: viewport.width, height: viewport.height });
  }

  return {
    pdf,
    pageSizes,
    destroy: () => task.destroy(),
  };
}

/** A text label on the page, as fractions of the displayed page. */
export type SignatureAnchor = {
  x: number;
  width: number;
  /** Baseline of the label text, measured from the top. */
  baseline: number;
  /** Font height as a fraction of the page height. */
  height: number;
};

const ANCHOR_PATTERNS = [/חתימת\s*הלקוח/, /חתימה/, /signature/i];

/**
 * Finds the customer's signature label on a page (e.g. "חתימת הלקוח/ה").
 * When several candidates match, the lowest one on the page wins because the
 * signing line is usually at the end of the document.
 */
export async function findSignatureAnchor(page: PDFPageProxy): Promise<SignatureAnchor | null> {
  const viewport = page.getViewport({ scale: 1 });
  const content = await page.getTextContent();

  for (const pattern of ANCHOR_PATTERNS) {
    let best: SignatureAnchor | null = null;

    for (const item of content.items) {
      if (!("str" in item) || !pattern.test(item.str)) {
        continue;
      }

      const [, , , , originX, originY] = item.transform;
      const [x, baseline] = viewport.convertToViewportPoint(originX, originY);
      const candidate: SignatureAnchor = {
        x: x / viewport.width,
        width: item.width / viewport.width,
        baseline: baseline / viewport.height,
        height: item.height / viewport.height,
      };

      if (!best || candidate.baseline > best.baseline) {
        best = candidate;
      }
    }

    if (best) {
      return best;
    }
  }

  return null;
}

/**
 * Chooses where a freshly drawn signature first appears: centred above the
 * signature label when one exists, otherwise in the lower-left area of the page.
 */
export function initialPlacement(
  pageIndex: number,
  pageSize: DisplaySize,
  signatureAspect: number,
  anchor: SignatureAnchor | null,
): NormalizedPlacement {
  const pageAspect = pageSize.width / pageSize.height;

  if (anchor && anchor.width > 0.05 && anchor.height > 0) {
    const sized = sizePlacement(
      { pageIndex, x: 0, y: 0 },
      Math.min(Math.max(anchor.width * 1.05, 0.18), 0.3),
      signatureAspect,
      pageAspect,
    );
    const centerX = anchor.x + anchor.width / 2;
    // Rest the ink above the label with a gap of half a line, which lands it on
    // the ruled line that typically sits between the label and the signature.
    const bottom = anchor.baseline - anchor.height * 1.5;

    return clampPlacementToPage({
      ...sized,
      x: centerX - sized.width / 2,
      y: bottom - sized.height,
    });
  }

  const sized = sizePlacement({ pageIndex, x: 0.08, y: 0 }, 0.26, signatureAspect, pageAspect);
  return clampPlacementToPage({ ...sized, y: 0.86 - sized.height });
}
