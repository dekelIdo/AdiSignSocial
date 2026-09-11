"use client";

import { useCallback, useEffect, useRef, type ReactNode } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { PdfPage } from "@/components/signing/PdfPage";
import type { DisplaySize } from "@/lib/signature-placement";

type DocumentViewerProps = {
  pdf: PDFDocumentProxy;
  pageSizes: DisplaySize[];
  renderPageOverlay?: (pageIndex: number) => ReactNode;
  onCurrentPageChange?: (pageNumber: number) => void;
  onLastPageVisibleChange?: (visible: boolean) => void;
  onRenderError?: (error: unknown) => void;
  /** Receives page elements so overlays can measure the displayed page box. */
  onPageElement?: (pageIndex: number, element: HTMLDivElement | null) => void;
};

const THRESHOLDS = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1];

export function DocumentViewer({
  pdf,
  pageSizes,
  renderPageOverlay,
  onCurrentPageChange,
  onLastPageVisibleChange,
  onRenderError,
  onPageElement,
}: DocumentViewerProps) {
  const elements = useRef(new Map<number, HTMLDivElement>());
  const observerRef = useRef<IntersectionObserver | null>(null);
  const ratios = useRef(new Map<number, number>());
  const lastReported = useRef({ page: 0, lastVisible: false });
  const pageCount = pageSizes.length;

  useEffect(() => {
    ratios.current.clear();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const index = Number((entry.target as HTMLElement).dataset.page) - 1;
          ratios.current.set(index, entry.isIntersecting ? entry.intersectionRatio : 0);
        }

        let bestIndex = -1;
        let bestRatio = 0;
        ratios.current.forEach((ratio, index) => {
          if (ratio > bestRatio || (ratio === bestRatio && ratio > 0 && index < bestIndex)) {
            bestRatio = ratio;
            bestIndex = index;
          }
        });

        if (bestIndex >= 0 && lastReported.current.page !== bestIndex + 1) {
          lastReported.current.page = bestIndex + 1;
          onCurrentPageChange?.(bestIndex + 1);
        }

        const lastVisible = (ratios.current.get(pageCount - 1) ?? 0) > 0;
        if (lastReported.current.lastVisible !== lastVisible) {
          lastReported.current.lastVisible = lastVisible;
          onLastPageVisibleChange?.(lastVisible);
        }
      },
      { threshold: THRESHOLDS },
    );

    observerRef.current = observer;
    elements.current.forEach((element) => observer.observe(element));

    return () => {
      observer.disconnect();
      observerRef.current = null;
    };
  }, [pageCount, onCurrentPageChange, onLastPageVisibleChange]);

  const handleElement = useCallback(
    (pageIndex: number, element: HTMLDivElement | null) => {
      const previous = elements.current.get(pageIndex);
      if (previous && previous !== element) {
        observerRef.current?.unobserve(previous);
      }

      if (element) {
        elements.current.set(pageIndex, element);
        observerRef.current?.observe(element);
      } else {
        elements.current.delete(pageIndex);
      }

      onPageElement?.(pageIndex, element);
    },
    [onPageElement],
  );

  return (
    <div className="mx-auto flex w-full max-w-[52rem] flex-col gap-4 sm:gap-6">
      {pageSizes.map((size, index) => (
        <PdfPage
          key={index + 1}
          pdf={pdf}
          pageNumber={index + 1}
          pageCount={pageCount}
          size={size}
          eager={index < 2}
          onRenderError={onRenderError}
          onElement={handleElement}
        >
          {renderPageOverlay?.(index)}
        </PdfPage>
      ))}
    </div>
  );
}
