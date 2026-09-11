"use client";

import { memo, useEffect, useRef, useState, type ReactNode } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import type { DisplaySize } from "@/lib/signature-placement";

type PdfPageProps = {
  pdf: PDFDocumentProxy;
  pageNumber: number;
  pageCount: number;
  /** Displayed page size in PDF points; reserves the box before rendering. */
  size: DisplaySize;
  /** Render immediately instead of waiting to scroll near the page. */
  eager?: boolean;
  onRenderError?: (error: unknown) => void;
  /** Receives the page element so overlays can measure it. */
  onElement?: (pageIndex: number, element: HTMLDivElement | null) => void;
  children?: ReactNode;
};

type PageImage = { url: string; width: number; height: number };

/** Upper bound for the backing bitmap width, keeps memory sane on phones. */
const MAX_BACKING_WIDTH = 2400;

function PdfPageComponent({
  pdf,
  pageNumber,
  pageCount,
  size,
  eager = false,
  onRenderError,
  onElement,
  children,
}: PdfPageProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(eager);
  const [width, setWidth] = useState(0);
  const [image, setImage] = useState<PageImage | null>(null);
  const imageUrlRef = useRef("");

  useEffect(() => {
    if (visible) {
      return;
    }

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
      { rootMargin: "1200px 0px" },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [visible]);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) {
      return;
    }

    let frame = 0;
    const update = (measured: number) => {
      const next = Math.floor(measured);
      if (next > 0) {
        setWidth((previous) => (previous === next ? previous : next));
      }
    };

    const observer = new ResizeObserver(([entry]) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => update(entry.contentRect.width));
    });

    observer.observe(node);
    update(node.clientWidth);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!visible || !width) {
      return;
    }

    let cancelled = false;
    let renderTask: { cancel: () => void; promise: Promise<void> } | null = null;

    async function render() {
      try {
        const page = await pdf.getPage(pageNumber);
        if (cancelled) {
          return;
        }

        const baseViewport = page.getViewport({ scale: 1 });
        const cssScale = width / baseViewport.width;
        // Render at device resolution (at least 2x) for crisp Hebrew text,
        // capped so an 8-page document stays comfortable on a phone.
        const pixelRatio = Math.min(Math.max(window.devicePixelRatio || 1, 2), 3);
        const backingScale = Math.min(cssScale * pixelRatio, MAX_BACKING_WIDTH / baseViewport.width);
        const viewport = page.getViewport({ scale: backingScale });

        const canvas = document.createElement("canvas");
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        const context = canvas.getContext("2d", { alpha: false });
        if (!context) {
          throw new Error("Canvas 2D context unavailable");
        }

        renderTask = page.render({
          canvas,
          canvasContext: context,
          viewport,
          intent: "display",
          background: "rgb(255,255,255)",
        });
        await renderTask.promise;
        if (cancelled) {
          return;
        }

        const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
        // Release the canvas backing store right away.
        canvas.width = 0;
        canvas.height = 0;
        if (!blob || cancelled) {
          return;
        }

        const url = URL.createObjectURL(blob);
        imageUrlRef.current = url;
        setImage((previous) => {
          if (previous) {
            URL.revokeObjectURL(previous.url);
          }
          return { url, width: Math.ceil(viewport.width), height: Math.ceil(viewport.height) };
        });
      } catch (error) {
        const isCancellation = error instanceof Error && error.name === "RenderingCancelledException";
        if (!cancelled && !isCancellation) {
          onRenderError?.(error);
        }
      }
    }

    void render();

    return () => {
      cancelled = true;
      renderTask?.cancel();
    };
  }, [pdf, pageNumber, visible, width, onRenderError]);

  useEffect(
    () => () => {
      if (imageUrlRef.current) {
        URL.revokeObjectURL(imageUrlRef.current);
        imageUrlRef.current = "";
      }
    },
    [],
  );

  return (
    <div
      ref={(node) => {
        containerRef.current = node;
        onElement?.(pageNumber - 1, node);
      }}
      className="pdf-page"
      style={{ aspectRatio: `${size.width} / ${size.height}` }}
      data-page={pageNumber}
    >
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element -- client-rendered PDF page bitmap
        <img
          src={image.url}
          width={image.width}
          height={image.height}
          alt={`עמוד ${pageNumber} מתוך ${pageCount}`}
          draggable={false}
          decoding="async"
        />
      ) : (
        <div className="pdf-page__skeleton" aria-hidden />
      )}
      {children}
    </div>
  );
}

export const PdfPage = memo(PdfPageComponent);
