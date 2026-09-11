"use client";

import { RotateCcw, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import SignaturePad from "signature_pad";
import { exportTrimmedSignature, type ExportedSignature } from "@/lib/signature-export";

type SignaturePadSheetProps = {
  open: boolean;
  onClose: () => void;
  onConfirm: (signature: ExportedSignature) => void;
};

/** Backing resolution multiplier: at least 2x so the ink stays smooth in the PDF. */
const MIN_PIXEL_RATIO = 2;
const MAX_PIXEL_RATIO = 3;

export function SignaturePadSheet({ open, onClose, onConfirm }: SignaturePadSheetProps) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const padRef = useRef<SignaturePad | null>(null);
  const [started, setStarted] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }

    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const pad = new SignaturePad(canvas, {
      minWidth: 1.4,
      maxWidth: 3.4,
      penColor: "#1c1c24",
      velocityFilterWeight: 0.6,
      minDistance: 1,
      throttle: 8,
      backgroundColor: "rgba(0,0,0,0)",
    });
    padRef.current = pad;
    setStarted(false);
    setMessage("");

    const resize = () => {
      const ratio = Math.min(Math.max(window.devicePixelRatio || 1, MIN_PIXEL_RATIO), MAX_PIXEL_RATIO);
      const { width, height } = canvas.getBoundingClientRect();
      if (!width || !height) {
        return;
      }

      const strokes = pad.toData();
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      canvas.getContext("2d")?.scale(ratio, ratio);
      pad.clear();
      if (strokes.length) {
        pad.fromData(strokes);
      }
    };

    resize();
    const observer = new ResizeObserver(() => resize());
    observer.observe(canvas);

    const onBegin = () => {
      setStarted(true);
      setMessage("");
    };
    pad.addEventListener("beginStroke", onBegin);

    return () => {
      pad.removeEventListener("beginStroke", onBegin);
      pad.off();
      observer.disconnect();
      padRef.current = null;
    };
  }, [open]);

  const clear = () => {
    padRef.current?.clear();
    setStarted(false);
    setMessage("");
  };

  const confirm = () => {
    const canvas = canvasRef.current;
    const pad = padRef.current;
    if (!canvas || !pad || pad.isEmpty()) {
      setMessage("עדיין לא חתמת. חתמי בתוך המסגרת עם האצבע, ואז לחצי שוב.");
      return;
    }

    const exported = exportTrimmedSignature(canvas);
    if (!exported) {
      setMessage("החתימה יצאה ריקה. נסי לחתום שוב, קצת יותר גדול.");
      return;
    }

    onConfirm(exported);
  };

  return (
    <dialog
      ref={dialogRef}
      className="sheet"
      aria-labelledby="signature-sheet-title"
      onClose={onClose}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <div className="px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] pt-5 sm:px-7 sm:pb-7 sm:pt-6">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 id="signature-sheet-title" className="text-2xl font-semibold leading-tight text-ink">
              חתמי כאן עם האצבע
            </h2>
            <p className="mt-1 text-base text-muted">אפשר למחוק ולנסות שוב</p>
          </div>
          <button
            type="button"
            className="btn btn-secondary btn-round"
            onClick={onClose}
            aria-label="סגירה בלי לחתום"
          >
            <X className="size-5" aria-hidden />
          </button>
        </div>

        <div className="sig-pad">
          <canvas
            ref={canvasRef}
            aria-label="משטח חתימה. ציירי את החתימה שלך עם האצבע."
            role="img"
          />
          <div className="sig-pad__line" aria-hidden />
          {!started ? (
            <div className="sig-pad__hint" aria-hidden>
              ✍️ חתמי כאן
            </div>
          ) : null}
        </div>

        <p className="min-h-6 pt-3 text-base font-semibold text-danger" role="alert" aria-live="polite">
          {message}
        </p>

        <div className="mt-2 grid gap-3">
          <button type="button" className="btn btn-primary btn-lg btn-block" onClick={confirm}>
            החתימה שלי מוכנה
          </button>
          <button type="button" className="btn btn-secondary btn-block" onClick={clear}>
            <RotateCcw className="size-5" aria-hidden />
            ניקוי
          </button>
        </div>
      </div>
    </dialog>
  );
}
