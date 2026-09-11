"use client";

import { Loader2, Minus, Plus } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState, type MouseEvent } from "react";
import { DocumentViewer } from "@/components/signing/DocumentViewer";
import { SignatureOverlay } from "@/components/signing/SignatureOverlay";
import { DEMO_SIGNATURE } from "@/lib/demo-signature";
import { findSignatureAnchorInDocument, loadPdfDocument, type LoadedPdf } from "@/lib/pdf-client";
import {
  clampPlacementToPage,
  scalePlacement,
  targetAtPoint,
  targetFromAnchor,
  type NormalizedPlacement,
  type SignatureTarget,
} from "@/lib/signature-placement";

type TargetEditorProps = {
  contractId: string;
  onSaved: (target: SignatureTarget) => void;
  onSkip: () => void;
};

type LoadStatus = { kind: "loading" } | { kind: "error" } | { kind: "ready" };

const RESIZE_STEP = 1.15;

/**
 * Owner step: mark where the customer signs. The box uses the same overlay,
 * the same fractions and the same fitting rules as the recipient's signature,
 * so the preview is exactly what the signed PDF will show.
 */
export function TargetEditor({ contractId, onSaved, onSkip }: TargetEditorProps) {
  const lockId = useId();
  const [status, setStatus] = useState<LoadStatus>({ kind: "loading" });
  const [loaded, setLoaded] = useState<LoadedPdf | null>(null);
  const [target, setTarget] = useState<NormalizedPlacement | null>(null);
  const [suggested, setSuggested] = useState(false);
  const [locked, setLocked] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const pageElements = useRef(new Map<number, HTMLDivElement>());

  useEffect(() => {
    let cancelled = false;
    let handle: LoadedPdf | null = null;

    loadPdfDocument(`/api/contracts/${contractId}/pdf`)
      .then(async (result) => {
        if (cancelled) {
          await result.destroy();
          return;
        }
        handle = result;
        setLoaded(result);
        setStatus({ kind: "ready" });

        try {
          const detected = await findSignatureAnchorInDocument(result.pdf);
          if (detected && !cancelled) {
            const size = result.pageSizes[detected.pageIndex];
            setTarget((current) =>
              current ?? targetFromAnchor(detected.pageIndex, detected.anchor, size.width / size.height),
            );
            setSuggested(true);
          }
        } catch {
          // Detection is only a suggestion.
        }
      })
      .catch((error: unknown) => {
        console.error("Owner preview failed to load", error);
        if (!cancelled) {
          setStatus({ kind: "error" });
        }
      });

    return () => {
      cancelled = true;
      void handle?.destroy();
    };
  }, [contractId]);

  const handlePageElement = useCallback((pageIndex: number, element: HTMLDivElement | null) => {
    if (element) {
      pageElements.current.set(pageIndex, element);
    } else {
      pageElements.current.delete(pageIndex);
    }
  }, []);

  const placeAt = (pageIndex: number, event: MouseEvent<HTMLDivElement>) => {
    const pageElement = pageElements.current.get(pageIndex);
    if (!pageElement || !loaded) {
      return;
    }

    const rect = pageElement.getBoundingClientRect();
    const point = {
      x: (event.clientX - rect.left) / rect.width,
      y: (event.clientY - rect.top) / rect.height,
    };
    const size = loaded.pageSizes[pageIndex];
    const pageAspect = size.width / size.height;

    setSuggested(false);
    setMessage("");
    setTarget((current) =>
      current
        ? clampPlacementToPage({
            ...current,
            pageIndex,
            x: point.x - current.width / 2,
            y: point.y - current.height / 2,
          })
        : targetAtPoint(pageIndex, point, pageAspect),
    );
  };

  const resize = (factor: number) => {
    if (!target || !loaded) {
      return;
    }
    const size = loaded.pageSizes[target.pageIndex];
    setTarget(scalePlacement(target, factor, DEMO_SIGNATURE.aspect, size.width / size.height));
  };

  const save = async () => {
    if (!target) {
      setMessage("לחצי על ההסכם במקום שבו הלקוחה חותמת, ואז המשיכי.");
      return;
    }

    setSaving(true);
    setMessage("");
    try {
      const response = await fetch(`/api/contracts/${contractId}/target`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...target, locked }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        signatureTarget?: SignatureTarget;
        message?: string;
      };
      if (!response.ok || !payload.signatureTarget) {
        throw new Error(payload.message || "לא הצלחנו לשמור את מיקום החתימה. נסי שוב.");
      }
      onSaved(payload.signatureTarget);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "לא הצלחנו לשמור את מיקום החתימה. נסי שוב.");
      setSaving(false);
    }
  };

  if (status.kind === "error") {
    return (
      <div className="card p-6 text-center" role="alert">
        <p className="text-xl font-semibold text-ink">לא הצלחנו להציג את ההסכם.</p>
        <p className="mt-2 text-lg text-ink-soft">אפשר לדלג על סימון המיקום, והלקוחה תמקם את החתימה בעצמה.</p>
        <button type="button" className="btn btn-secondary mt-5" onClick={onSkip}>
          המשך בלי לסמן מיקום
        </button>
      </div>
    );
  }

  if (status.kind === "loading" || !loaded) {
    return (
      <div className="card flex flex-col items-center p-10 text-center" aria-live="polite">
        <Loader2 className="mb-4 size-8 animate-spin text-accent-deep" aria-hidden />
        <p className="text-xl font-semibold text-ink">מכינה את התצוגה של ההסכם…</p>
      </div>
    );
  }

  const instruction = !target
    ? "לחצי על ההסכם במקום שבו הלקוחה חותמת."
    : suggested
      ? "מצאנו את שורת החתימה וסימנו אותה. אפשר לגרור את התיבה או ללחוץ במקום אחר."
      : "אפשר לגרור את התיבה, לשנות גודל, או ללחוץ במקום אחר בהסכם.";

  return (
    <div className="pb-[15rem]">
      <div className="top-bar -mx-3 mb-4 px-3 py-3 sm:-mx-6 sm:px-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-xl font-semibold leading-tight text-ink sm:text-2xl">
              סמני איפה הלקוחה צריכה לחתום
            </h2>
            <p className="mt-1 text-base text-ink-soft">{instruction}</p>
          </div>
          <div className="page-pill" aria-live="polite">
            עמוד {currentPage} מתוך {loaded.pageSizes.length}
          </div>
        </div>
      </div>

      <DocumentViewer
        pdf={loaded.pdf}
        pageSizes={loaded.pageSizes}
        onCurrentPageChange={setCurrentPage}
        onPageElement={handlePageElement}
        renderPageOverlay={(pageIndex) => (
          <>
            <div
              className="target-click-layer"
              onClick={(event) => placeAt(pageIndex, event)}
              aria-hidden
            />
            {target && target.pageIndex === pageIndex ? (
              <SignatureOverlay
                variant="target"
                label="חתימת הלקוחה"
                placement={target}
                signature={DEMO_SIGNATURE}
                pageSize={loaded.pageSizes[pageIndex]}
                mode="editing"
                onChange={(next) => {
                  setSuggested(false);
                  setTarget(next);
                }}
                getPageElement={() => pageElements.current.get(pageIndex) ?? null}
              />
            ) : null}
          </>
        )}
      />

      <div className="action-bar">
        <div className="mx-auto grid w-full max-w-[44rem] gap-2.5">
          {message ? (
            <p className="rounded-xl bg-danger-soft px-4 py-2 text-center text-base font-semibold text-danger" role="alert">
              {message}
            </p>
          ) : null}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2" role="group" aria-label="גודל התיבה">
              <button type="button" className="btn btn-secondary btn-round" onClick={() => resize(1 / RESIZE_STEP)} disabled={!target} aria-label="להקטין את התיבה">
                <Minus className="size-5" aria-hidden />
                <span>קטן</span>
              </button>
              <button type="button" className="btn btn-secondary btn-round" onClick={() => resize(RESIZE_STEP)} disabled={!target} aria-label="להגדיל את התיבה">
                <Plus className="size-5" aria-hidden />
                <span>גדול</span>
              </button>
            </div>
            <label htmlFor={lockId} className="toggle">
              <input
                id={lockId}
                type="checkbox"
                checked={locked}
                onChange={(event) => setLocked(event.target.checked)}
              />
              <span>נעילת מיקום החתימה</span>
            </label>
          </div>
          <p className="text-center text-sm text-muted">
            {locked
              ? "הלקוחה רק חותמת ומאשרת. החתימה נכנסת אוטומטית לתיבה."
              : "הלקוחה תוכל להזיז את החתימה לפני האישור."}
          </p>
          <button type="button" className="btn btn-primary btn-lg btn-block" onClick={() => void save()} disabled={saving}>
            {saving ? <Loader2 className="size-6 animate-spin" aria-hidden /> : null}
            המשך ליצירת קישור
          </button>
          <button type="button" className="btn btn-quiet" onClick={onSkip} disabled={saving}>
            דילוג, בלי מיקום קבוע
          </button>
        </div>
      </div>
    </div>
  );
}
