"use client";

import { Loader2, Minus, PenLine, Plus } from "lucide-react";

export type SigningPhase = "reading" | "placing" | "reviewing" | "submitting";

type ActionBarProps = {
  phase: SigningPhase;
  visible: boolean;
  /** Why the bar surfaced while reading: the signature area or the document end. */
  reason: "target" | "end";
  /** Owner locked the position: no dragging, review only. */
  locked: boolean;
  notice?: string;
  onSign: () => void;
  onResign: () => void;
  onContinue: () => void;
  onConfirm: () => void;
  onAdjust: () => void;
  onGrow: () => void;
  onShrink: () => void;
};

export function ActionBar({
  phase,
  visible,
  reason,
  locked,
  notice,
  onSign,
  onResign,
  onContinue,
  onConfirm,
  onAdjust,
  onGrow,
  onShrink,
}: ActionBarProps) {
  return (
    <div className={`action-bar ${visible ? "" : "action-bar--hidden"}`} aria-hidden={!visible}>
      <div className="mx-auto grid w-full max-w-[44rem] gap-2.5">
        {notice ? (
          <p
            className="rounded-xl bg-danger-soft px-4 py-2.5 text-center text-base font-semibold text-danger"
            role="alert"
          >
            {notice}
          </p>
        ) : null}

        {phase === "reading" ? (
          <>
            <p className="text-center text-base text-ink-soft">
              {reason === "target"
                ? "כאן חותמים. אפשר לחתום עכשיו, או להמשיך לקרוא."
                : "הגעת לסוף ההסכם. עכשיו נשאר רק לחתום."}
            </p>
            <button type="button" className="btn btn-primary btn-lg btn-block" onClick={onSign}>
              <PenLine className="size-6" aria-hidden />
              לחתימה על ההסכם
            </button>
          </>
        ) : null}

        {phase === "placing" ? (
          <>
            <p className="text-center text-base text-ink-soft">מקמי את החתימה במקום המסומן</p>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2" role="group" aria-label="גודל החתימה">
                <button
                  type="button"
                  className="btn btn-secondary btn-round"
                  onClick={onShrink}
                  aria-label="להקטין את החתימה"
                >
                  <Minus className="size-5" aria-hidden />
                  <span>קטן</span>
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-round"
                  onClick={onGrow}
                  aria-label="להגדיל את החתימה"
                >
                  <Plus className="size-5" aria-hidden />
                  <span>גדול</span>
                </button>
              </div>
              <button type="button" className="btn btn-quiet" onClick={onResign}>
                לחתום מחדש
              </button>
            </div>
            <button type="button" className="btn btn-primary btn-lg btn-block" onClick={onContinue}>
              אישור ושליחת ההסכם
            </button>
          </>
        ) : null}

        {phase === "reviewing" && locked ? (
          <>
            <p className="text-center text-base text-ink-soft">
              <strong className="text-ink">החתימה במקומה.</strong> הכול נראה טוב?
            </p>
            <button type="button" className="btn btn-primary btn-lg btn-block" onClick={onConfirm}>
              אישור ושליחת ההסכם
            </button>
            <button type="button" className="btn btn-secondary btn-block" onClick={onResign}>
              לחתום מחדש
            </button>
          </>
        ) : null}

        {phase === "reviewing" && !locked ? (
          <>
            <p className="text-center text-base text-ink-soft">
              <strong className="text-ink">כך ייראה ההסכם החתום.</strong> הכול במקום?
            </p>
            <button type="button" className="btn btn-primary btn-lg btn-block" onClick={onConfirm}>
              לאשר ולחתום
            </button>
            <button type="button" className="btn btn-secondary btn-block" onClick={onAdjust}>
              לשנות מיקום
            </button>
          </>
        ) : null}

        {phase === "submitting" ? (
          <>
            <p className="text-center text-base text-ink-soft" aria-live="polite">
              עוד רגע קטן, מכינה את ההסכם החתום.
            </p>
            <button type="button" className="btn btn-primary btn-lg btn-block" disabled>
              <Loader2 className="size-6 animate-spin" aria-hidden />
              חותמת על ההסכם…
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
}
