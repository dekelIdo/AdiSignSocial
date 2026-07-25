"use client";

import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";

type PdfPageProps = {
  pdf: PDFDocumentProxy;
  pageNumber: number;
};

export function PdfPage({ pdf, pageNumber }: PdfPageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(pageNumber <= 2);
  const [width, setWidth] = useState(0);

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

    async function renderPage() {
      if (!visible || !width || !canvasRef.current) {
        return;
      }

      const page = await pdf.getPage(pageNumber);
      if (cancelled) {
        return;
      }

      const baseViewport = page.getViewport({ scale: 1 });
      const scale = width / baseViewport.width;
      const viewport = page.getViewport({ scale });
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      const canvas = canvasRef.current;
      const context = canvas.getContext("2d");

      if (!context) {
        return;
      }

      canvas.width = Math.floor(viewport.width * pixelRatio);
      canvas.height = Math.floor(viewport.height * pixelRatio);
      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

      renderTask = page.render({ canvas, canvasContext: context, viewport });
      await renderTask.promise.catch((error: unknown) => {
        if (!cancelled && error instanceof Error && error.name !== "RenderingCancelledException") {
          throw error;
        }
      });
    }

    void renderPage();

    return () => {
      cancelled = true;
      renderTask?.cancel();
    };
  }, [pdf, pageNumber, visible, width]);

  return (
    <div ref={containerRef} className="mx-auto w-full max-w-4xl">
      <div className="overflow-hidden rounded-[1.35rem] bg-white shadow-[0_24px_80px_rgba(47,47,47,0.1)] ring-1 ring-[#ECE7E1]">
        {visible ? (
          <canvas ref={canvasRef} className="pdf-page-canvas" aria-label={`עמוד ${pageNumber}`} />
        ) : (
          <div className="h-[720px] animate-pulse bg-[#F3EEE8]" />
        )}
      </div>
      <div className="pt-4 text-center text-sm font-semibold text-[#A09890]">
        עמוד {pageNumber}
      </div>
    </div>
  );
}
