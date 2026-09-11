"use client";

import { useCallback, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import type { ExportedSignature } from "@/lib/signature-export";
import {
  clampPlacementToPage,
  scalePlacement,
  sizePlacement,
  type DisplaySize,
  type NormalizedPlacement,
} from "@/lib/signature-placement";

export type OverlayMode = "editing" | "review" | "locked";

type SignatureOverlayProps = {
  placement: NormalizedPlacement;
  signature: ExportedSignature;
  /** Displayed page size in points, for aspect-ratio math. */
  pageSize: DisplaySize;
  mode: OverlayMode;
  onChange: (placement: NormalizedPlacement) => void;
  onDragStateChange?: (dragging: boolean) => void;
  /** The element whose box is the displayed page. */
  getPageElement: () => HTMLElement | null;
  overlayRef?: (element: HTMLDivElement | null) => void;
};

type Gesture = {
  type: "move" | "resize";
  pointerId: number;
  startClientX: number;
  startClientY: number;
  start: NormalizedPlacement;
  pageRect: DOMRect;
};

const NUDGE = 0.01;
const NUDGE_LARGE = 0.05;

/**
 * The signature as the recipient sees it on the page. Positioned with
 * percentages of the page box so the same fractions drive the preview and the
 * export; pointer deltas are converted with the live page rectangle, which
 * makes the maths immune to scroll offsets, zoom and layout changes.
 */
export function SignatureOverlay({
  placement,
  signature,
  pageSize,
  mode,
  onChange,
  onDragStateChange,
  getPageElement,
  overlayRef,
}: SignatureOverlayProps) {
  const boxRef = useRef<HTMLDivElement | null>(null);
  const gestureRef = useRef<Gesture | null>(null);
  const draftRef = useRef<NormalizedPlacement | null>(null);
  const [draft, setDraft] = useState<NormalizedPlacement | null>(null);
  const [dragging, setDragging] = useState(false);

  const current = draft ?? placement;
  const pageAspect = pageSize.width / pageSize.height;
  const editable = mode === "editing";

  const updateDraft = (next: NormalizedPlacement) => {
    draftRef.current = next;
    setDraft(next);
  };

  const beginGesture = useCallback(
    (event: PointerEvent<HTMLElement>, type: Gesture["type"]) => {
      if (!editable) {
        return;
      }
      if (event.pointerType === "mouse" && event.button !== 0) {
        return;
      }

      const pageRect = getPageElement()?.getBoundingClientRect();
      const box = boxRef.current;
      if (!pageRect || !box) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      box.setPointerCapture(event.pointerId);
      box.focus({ preventScroll: true });
      gestureRef.current = {
        type,
        pointerId: event.pointerId,
        startClientX: event.clientX,
        startClientY: event.clientY,
        start: placement,
        pageRect,
      };
      setDragging(true);
      onDragStateChange?.(true);
    },
    [editable, getPageElement, placement, onDragStateChange],
  );

  const moveGesture = (event: PointerEvent<HTMLElement>) => {
    const gesture = gestureRef.current;
    if (!gesture || event.pointerId !== gesture.pointerId) {
      return;
    }

    event.preventDefault();
    const pageRect = getPageElement()?.getBoundingClientRect() ?? gesture.pageRect;
    const deltaX = (event.clientX - gesture.startClientX) / pageRect.width;
    const deltaY = (event.clientY - gesture.startClientY) / pageRect.height;

    if (gesture.type === "move") {
      updateDraft(
        clampPlacementToPage({
          ...gesture.start,
          x: gesture.start.x + deltaX,
          y: gesture.start.y + deltaY,
        }),
      );
      return;
    }

    // Resize from the top-right handle; the bottom-left corner stays put so
    // ink resting on a line keeps resting on it.
    const resized = sizePlacement(
      { pageIndex: gesture.start.pageIndex, x: gesture.start.x, y: gesture.start.y },
      gesture.start.width + deltaX,
      signature.aspect,
      pageAspect,
    );
    const bottom = gesture.start.y + gesture.start.height;
    updateDraft(clampPlacementToPage({ ...resized, y: bottom - resized.height }));
  };

  const endGesture = (event: PointerEvent<HTMLElement>) => {
    const gesture = gestureRef.current;
    if (!gesture || event.pointerId !== gesture.pointerId) {
      return;
    }

    gestureRef.current = null;
    const finalPlacement = draftRef.current;
    draftRef.current = null;
    setDraft(null);
    setDragging(false);
    onDragStateChange?.(false);

    if (finalPlacement) {
      onChange(finalPlacement);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!editable) {
      return;
    }

    const step = event.shiftKey ? NUDGE_LARGE : NUDGE;
    let next: NormalizedPlacement | null = null;

    switch (event.key) {
      case "ArrowLeft":
        next = { ...placement, x: placement.x - step };
        break;
      case "ArrowRight":
        next = { ...placement, x: placement.x + step };
        break;
      case "ArrowUp":
        next = { ...placement, y: placement.y - step };
        break;
      case "ArrowDown":
        next = { ...placement, y: placement.y + step };
        break;
      case "+":
      case "=":
        next = scalePlacement(placement, 1.1, signature.aspect, pageAspect);
        break;
      case "-":
      case "_":
        next = scalePlacement(placement, 1 / 1.1, signature.aspect, pageAspect);
        break;
      default:
        return;
    }

    event.preventDefault();
    onChange(clampPlacementToPage(next));
  };

  const className = [
    "sig-overlay",
    mode === "editing" && (dragging ? "sig-overlay--dragging" : "sig-overlay--editing"),
    mode === "review" && "sig-overlay--review",
    mode === "locked" && "sig-overlay--locked",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <>
      {dragging ? (
        <div
          className="sig-guide"
          style={{ top: `${(current.y + current.height) * 100}%` }}
          aria-hidden
        />
      ) : null}
      <div
        ref={(node) => {
          boxRef.current = node;
          overlayRef?.(node);
        }}
        className={className}
        style={{
          left: `${current.x * 100}%`,
          top: `${current.y * 100}%`,
          width: `${current.width * 100}%`,
          height: `${current.height * 100}%`,
        }}
        role="group"
        tabIndex={editable ? 0 : -1}
        aria-roledescription="חתימה ניתנת להזזה"
        aria-label={
          editable
            ? "החתימה שלך. גררי אותה למקום המסומן, או הזיזי עם החיצים במקלדת. פלוס ומינוס משנים גודל."
            : "החתימה שלך במקומה על ההסכם."
        }
        onPointerDown={(event) => beginGesture(event, "move")}
        onPointerMove={moveGesture}
        onPointerUp={endGesture}
        onPointerCancel={endGesture}
        onLostPointerCapture={endGesture}
        onKeyDown={handleKeyDown}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- the recipient's own signature bitmap */}
        <img src={signature.dataUrl} alt="" draggable={false} />
        {editable ? (
          <div
            className="sig-handle"
            aria-hidden
            onPointerDown={(event) => beginGesture(event, "resize")}
          />
        ) : null}
      </div>
    </>
  );
}
