"use client";

import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";

type PdfPageProps = {
  pdf: PDFDocumentProxy;
  pageNumber: number;
};

export function PdfPage({ pdf, pageNumber }: PdfPageProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(pageNumber <= 2);
  const [width, setWidth] = useState(0);
  const [pageImage, setPageImage] = useState<{
    url: string;
    width: number;
    height: number;
  } | null>(null);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) {
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "900px 0px" },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) {
      return;
    }

    const resizeObserver = new ResizeObserver(([entry]) => {
      setWidth(entry.contentRect.width);
    });
    resizeObserver.observe(node);
    setWidth(node.clientWidth);

    return () => resizeObserver.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;
    let renderTask: { cancel: () => void; promise: Promise<void> } | undefined;
    let objectUrl = "";

    async function renderPage() {
      if (!visible || !width) {
        return;
      }

      const page = await pdf.getPage(pageNumber);
      if (cancelled) {
        return;
      }

      const baseViewport = page.getViewport({ scale: 1 });
      const displayWidth = Math.max(1, Math.floor(width));
      const scale = displayWidth / baseViewport.width;
      const viewport = page.getViewport({ scale });
      const displayHeight = Math.ceil(viewport.height);
      // Render the uploaded PDF page into a high-resolution canvas image.
      // This keeps the PDF itself as the source of truth and avoids HTML/CSS text recreation.
      const pixelRatio = Math.min(Math.max(window.devicePixelRatio || 1, 2), 3);
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d", { alpha: false });

      if (!context) {
        return;
      }

      canvas.width = Math.ceil(displayWidth * pixelRatio);
      canvas.height = Math.ceil(displayHeight * pixelRatio);
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      const renderViewport = page.getViewport({ scale: scale * pixelRatio });

      renderTask = page.render({
        canvas,
        canvasContext: context,
        viewport: renderViewport,
        intent: "display",
        background: "rgb(255,255,255)",
      });
      await renderTask.promise.catch((error: unknown) => {
        if (!cancelled && error instanceof Error && error.name !== "RenderingCancelledException") {
          throw error;
        }
      });

      if (cancelled) {
        return;
      }

      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob(resolve, "image/png");
      });

      if (!blob || cancelled) {
        return;
      }

      objectUrl = URL.createObjectURL(blob);
      setPageImage((previousImage) => {
        if (previousImage) {
          URL.revokeObjectURL(previousImage.url);
        }

        return {
          url: objectUrl,
          width: displayWidth,
          height: displayHeight,
        };
      });
    }

    void renderPage();

    return () => {
      cancelled = true;
      renderTask?.cancel();
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [pdf, pageNumber, visible, width]);

  return (
    <div ref={containerRef} className="mx-auto w-full max-w-[760px]">
      <div className="overflow-hidden rounded-[1.35rem] bg-white shadow-[0_24px_80px_rgba(47,47,47,0.1)] ring-1 ring-[#ECE7E1]">
        {visible && pageImage ? (
          // eslint-disable-next-line @next/next/no-img-element -- The source is a client-generated PNG blob from the uploaded PDF.
          <img
            src={pageImage.url}
            width={pageImage.width}
            height={pageImage.height}
            className="block h-auto w-full select-none"
            alt={`עמוד ${pageNumber}`}
            draggable={false}
          />
        ) : (
          <div className="h-[720px] animate-pulse bg-[#F3EEE8]" />
        )}
      </div>
      <div className="pt-4 text-center text-base font-semibold text-[#A09890]">
        עמוד {pageNumber}
      </div>
    </div>
  );
}
