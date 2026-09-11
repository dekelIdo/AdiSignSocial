/**
 * Browser-side pdf.js helpers: loading, page geometry and signature label
 * detection. Everything here runs only in the browser.
 */
import type { PDFDocumentProxy, PDFPageProxy } from "pdfjs-dist";
import type { DisplaySize, SignatureAnchor } from "@/lib/signature-placement";

export type { SignatureAnchor };

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

export type DetectedAnchor = { pageIndex: number; anchor: SignatureAnchor };

/**
 * Scans the document from the last page backwards for a signature label.
 * Scanned PDFs without a text layer simply return null.
 */
export async function findSignatureAnchorInDocument(
  pdf: PDFDocumentProxy,
): Promise<DetectedAnchor | null> {
  for (let pageNumber = pdf.numPages; pageNumber >= 1; pageNumber -= 1) {
    try {
      const page = await pdf.getPage(pageNumber);
      const anchor = await findSignatureAnchor(page);
      if (anchor) {
        return { pageIndex: pageNumber - 1, anchor };
      }
    } catch {
      // A page without extractable text is not an error; keep looking.
    }
  }

  return null;
}
