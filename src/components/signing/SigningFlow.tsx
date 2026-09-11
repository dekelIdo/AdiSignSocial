"use client";

import { PenLine } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActionBar, type SigningPhase } from "@/components/signing/ActionBar";
import { DocumentViewer } from "@/components/signing/DocumentViewer";
import { JumpToSignature } from "@/components/signing/JumpToSignature";
import { SignatureOverlay, type OverlayMode } from "@/components/signing/SignatureOverlay";
import { SignaturePadSheet } from "@/components/signing/SignaturePadSheet";
import { SignaturePlaceholder } from "@/components/signing/SignaturePlaceholder";
import { ErrorScreen, LoadingScreen } from "@/components/signing/StatusScreens";
import { findSignatureAnchorInDocument, loadPdfDocument, type LoadedPdf } from "@/lib/pdf-client";
import type { ExportedSignature } from "@/lib/signature-export";
import {
  clampPlacementToPage,
  fallbackTarget,
  fitWithinTarget,
  scalePlacement,
  sizePlacement,
  targetFromAnchor,
  type NormalizedPlacement,
  type SignatureTarget,
} from "@/lib/signature-placement";

type SigningFlowProps = {
  contractId: string;
  clientName?: string;
  /** Owner-defined signature area, when the link was created with one. */
  signatureTarget?: SignatureTarget | null;
};

type LoadStatus =
  | { kind: "loading"; progress: number | null }
  | { kind: "error"; message: string }
  | { kind: "ready" };

const LOAD_ERROR = "לא הצלחנו לפתוח את ההסכם. נסי שוב, ואם הבעיה חוזרת אפשר לפנות לעדי.";
const SUBMIT_ERROR = "לא הצלחנו לסיים את החתימה. נסי שוב, ואם הבעיה חוזרת אפשר לפנות לעדי.";
const RESIZE_STEP = 1.15;
const FLASH_MS = 1800;
/** Height reserved for the sticky bar when centring the target on screen. */
const BAR_ALLOWANCE = 150;

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function SigningFlow({ contractId, clientName, signatureTarget }: SigningFlowProps) {
  const router = useRouter();
  const [status, setStatus] = useState<LoadStatus>({ kind: "loading", progress: null });
  const [loaded, setLoaded] = useState<LoadedPdf | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [target, setTarget] = useState<SignatureTarget | null>(null);
  const [phase, setPhase] = useState<SigningPhase>("reading");
  const [padOpen, setPadOpen] = useState(false);
  const [signature, setSignature] = useState<ExportedSignature | null>(null);
  const [placement, setPlacement] = useState<NormalizedPlacement | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [lastPageVisible, setLastPageVisible] = useState(false);
  const [targetInView, setTargetInView] = useState(false);
  const [inlineCtaVisible, setInlineCtaVisible] = useState(false);
  const [flashing, setFlashing] = useState(false);
  const [notice, setNotice] = useState("");
  const inlineCtaRef = useRef<HTMLButtonElement | null>(null);
  const headerRef = useRef<HTMLElement | null>(null);
  const pageElements = useRef(new Map<number, HTMLDivElement>());
  const overlayElement = useRef<HTMLDivElement | null>(null);
  const [placeholderElement, setPlaceholderElement] = useState<HTMLDivElement | null>(null);
  const flashTimer = useRef<number | null>(null);

  const retryLoad = () => {
    setStatus({ kind: "loading", progress: null });
    setLoaded(null);
    setAttempt((value) => value + 1);
  };

  useEffect(() => {
    let cancelled = false;
    let handle: LoadedPdf | null = null;

    loadPdfDocument(`/api/contracts/${contractId}/pdf`, (fraction) => {
      if (!cancelled) {
        setStatus((previous) =>
          previous.kind === "loading" ? { kind: "loading", progress: fraction } : previous,
        );
      }
    })
      .then(async (result) => {
        if (cancelled) {
          await result.destroy();
          return;
        }

        handle = result;
        setLoaded(result);
        setStatus({ kind: "ready" });

        const pageCount = result.pageSizes.length;
        const lastIndex = pageCount - 1;

        // 1. the owner's explicit target wins
        if (signatureTarget && signatureTarget.pageIndex < pageCount) {
          setTarget(signatureTarget);
          return;
        }

        // 2. a detected signature label, 3. a generic lower-left area
        let resolved: SignatureTarget;
        try {
          const detected = await findSignatureAnchorInDocument(result.pdf);
          if (detected) {
            const size = result.pageSizes[detected.pageIndex];
            resolved = {
              ...targetFromAnchor(detected.pageIndex, detected.anchor, size.width / size.height),
              locked: false,
              source: "detected",
            };
          } else {
            const size = result.pageSizes[lastIndex];
            resolved = { ...fallbackTarget(lastIndex, size.width / size.height), locked: false, source: "fallback" };
          }
        } catch {
          const size = result.pageSizes[lastIndex];
          resolved = { ...fallbackTarget(lastIndex, size.width / size.height), locked: false, source: "fallback" };
        }

        if (!cancelled) {
          setTarget(resolved);
        }
      })
      .catch((error: unknown) => {
        console.error("Failed to open the agreement", error);
        if (!cancelled) {
          setStatus({ kind: "error", message: LOAD_ERROR });
        }
      });

    return () => {
      cancelled = true;
      void handle?.destroy();
    };
  }, [contractId, attempt, signatureTarget]);

  // The sticky bar steps aside once the inline "sign" button is fully visible
  // above the bar's own zone, so the reader never sees the same button twice.
  useEffect(() => {
    const node = inlineCtaRef.current;
    if (!node || phase !== "reading" || !loaded) {
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => setInlineCtaVisible(entry.intersectionRatio >= 0.95),
      { rootMargin: "0px 0px -150px 0px", threshold: [0, 0.95, 1] },
    );
    observer.observe(node);
    return () => {
      observer.disconnect();
      setInlineCtaVisible(false);
    };
  }, [phase, loaded]);

  // Knowing whether the signature area is on screen drives the shortcut chip
  // and the "sign here" bar.
  useEffect(() => {
    if (!placeholderElement) {
      setTargetInView(false);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => setTargetInView(entry.intersectionRatio >= 0.6),
      { threshold: [0, 0.6, 1] },
    );
    observer.observe(placeholderElement);
    return () => observer.disconnect();
  }, [placeholderElement]);

  useEffect(
    () => () => {
      if (flashTimer.current) {
        window.clearTimeout(flashTimer.current);
      }
    },
    [],
  );

  const pageCount = loaded?.pageSizes.length ?? 0;
  const activeIndex = placement?.pageIndex ?? target?.pageIndex ?? pageCount - 1;
  const activePageSize = loaded?.pageSizes[activeIndex];

  const handleRenderError = useCallback((error: unknown) => {
    console.error("Page render failed", error);
    setStatus({ kind: "error", message: LOAD_ERROR });
  }, []);

  const handlePageElement = useCallback((pageIndex: number, element: HTMLDivElement | null) => {
    if (element) {
      pageElements.current.set(pageIndex, element);
    } else {
      pageElements.current.delete(pageIndex);
    }
  }, []);

  const getActivePageElement = useCallback(
    () => pageElements.current.get(activeIndex) ?? null,
    [activeIndex],
  );

  const scrollToSignature = useCallback(() => {
    window.requestAnimationFrame(() => {
      overlayElement.current?.scrollIntoView({
        block: "center",
        behavior: prefersReducedMotion() ? "auto" : "smooth",
      });
    });
  }, []);

  /** Scrolls the signature area into the middle of the usable screen and emphasises it. */
  const jumpToTarget = () => {
    if (!target) {
      return;
    }
    const pageElement = pageElements.current.get(target.pageIndex);
    if (!pageElement) {
      return;
    }

    const pageRect = pageElement.getBoundingClientRect();
    const headerHeight = headerRef.current?.offsetHeight ?? 0;
    const usable = Math.max(200, window.innerHeight - headerHeight - BAR_ALLOWANCE);
    const targetTop = window.scrollY + pageRect.top + target.y * pageRect.height;
    const targetHeight = target.height * pageRect.height;
    const top = Math.max(0, targetTop - headerHeight - (usable - targetHeight) / 2);

    window.scrollTo({ top, behavior: prefersReducedMotion() ? "auto" : "smooth" });

    setFlashing(true);
    if (flashTimer.current) {
      window.clearTimeout(flashTimer.current);
    }
    flashTimer.current = window.setTimeout(() => setFlashing(false), FLASH_MS);
  };

  const handleSignatureReady = (exported: ExportedSignature) => {
    if (!loaded || !target) {
      return;
    }

    const size = loaded.pageSizes[target.pageIndex];
    const pageAspect = size.width / size.height;
    setSignature(exported);
    setPlacement((previous) => {
      if (previous && !target.locked) {
        // Re-signing keeps the chosen spot: same width, ink stays on the line.
        const resized = sizePlacement(previous, previous.width, exported.aspect, pageAspect);
        return clampPlacementToPage({ ...resized, y: previous.y + previous.height - resized.height });
      }
      return fitWithinTarget(target, exported.aspect, pageAspect);
    });
    setPadOpen(false);
    setNotice("");
    setPhase(target.locked ? "reviewing" : "placing");
    scrollToSignature();
  };

  const resizeSignature = (factor: number) => {
    if (!signature || !placement || !activePageSize) {
      return;
    }
    setPlacement(
      scalePlacement(placement, factor, signature.aspect, activePageSize.width / activePageSize.height),
    );
  };

  const submit = async () => {
    if (!signature || !placement) {
      return;
    }

    setPhase("submitting");
    setNotice("");

    try {
      const response = await fetch(`/api/contracts/${contractId}/sign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signature: signature.dataUrl, placement }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        emailSent?: boolean;
        message?: string;
      };

      if (!response.ok || !payload.ok) {
        throw new Error(payload.message || SUBMIT_ERROR);
      }

      const query = new URLSearchParams({ id: contractId });
      if (payload.emailSent) {
        query.set("sent", "1");
      }
      router.push(`/success?${query.toString()}`);
    } catch (error) {
      setNotice(error instanceof Error && error.message ? error.message : SUBMIT_ERROR);
      setPhase("reviewing");
    }
  };

  if (status.kind === "error") {
    return (
      <ErrorScreen title="משהו השתבש בפתיחת ההסכם" message={status.message} onRetry={retryLoad} />
    );
  }

  if (status.kind === "loading" || !loaded) {
    return <LoadingScreen clientName={clientName} progress={status.kind === "loading" ? status.progress : null} />;
  }

  const locked = Boolean(target?.locked);
  const showPlaceholder = Boolean(target && target.source !== "fallback" && !signature);
  const overlayMode: OverlayMode =
    phase === "placing" ? "editing" : phase === "reviewing" ? "review" : "locked";
  const barReason: "target" | "end" = targetInView ? "target" : "end";
  const barVisible =
    phase !== "reading" || ((targetInView || lastPageVisible) && !inlineCtaVisible);
  const chipVisible = phase === "reading" && showPlaceholder && !targetInView && !barVisible && !padOpen;
  const stepIndex = phase === "reading" ? 0 : 1;
  const readingHint =
    target && target.source !== "fallback"
      ? `מקום החתימה מסומן בעמוד ${target.pageIndex + 1}.`
      : "בסוף ההסכם חותמים.";

  return (
    <div className="min-h-dvh">
      <header ref={headerRef} className="top-bar">
        <div className="mx-auto w-full max-w-[52rem] px-4 py-2 sm:px-6">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="brand-mark hidden shrink-0 min-[360px]:inline-flex" aria-hidden>
                ע
              </span>
              <h1 className="whitespace-nowrap text-[1.05rem] font-semibold leading-tight text-ink sm:text-xl">
                הסכם העבודה שלך
              </h1>
            </div>
            <div className="page-pill" aria-live="polite" aria-atomic="true">
              עמוד {currentPage} מתוך {pageCount}
            </div>
          </div>
          <ol className="steps mt-1" aria-label="שלבים">
            <li aria-current={stepIndex === 0 ? "step" : undefined}>1 קריאה</li>
            <li aria-current={stepIndex === 1 ? "step" : undefined}>2 חתימה</li>
            <li>3 סיום</li>
          </ol>
        </div>
      </header>

      <main className="fade-in mx-auto w-full max-w-[52rem] px-3 pb-[10.5rem] pt-3 sm:px-6 sm:pt-5">
        {phase === "reading" && !lastPageVisible && !targetInView ? (
          <p className="mb-3 text-center text-base text-muted">
            {clientName ? `שלום ${clientName}, ` : ""}
            גללי ועברי על ההסכם בנחת. {readingHint}
          </p>
        ) : null}

        <DocumentViewer
          pdf={loaded.pdf}
          pageSizes={loaded.pageSizes}
          onCurrentPageChange={setCurrentPage}
          onLastPageVisibleChange={setLastPageVisible}
          onRenderError={handleRenderError}
          onPageElement={handlePageElement}
          renderPageOverlay={(pageIndex) => {
            if (signature && placement && activePageSize && pageIndex === placement.pageIndex) {
              return (
                <SignatureOverlay
                  placement={placement}
                  signature={signature}
                  pageSize={activePageSize}
                  mode={overlayMode}
                  onChange={setPlacement}
                  getPageElement={getActivePageElement}
                  overlayRef={(element) => {
                    overlayElement.current = element;
                  }}
                />
              );
            }
            if (showPlaceholder && target && pageIndex === target.pageIndex) {
              return (
                <SignaturePlaceholder
                  target={target}
                  flashing={flashing}
                  placeholderRef={setPlaceholderElement}
                />
              );
            }
            return null;
          }}
        />

        {phase === "reading" ? (
          <section className="card mx-auto mt-5 max-w-[52rem] px-5 py-6 text-center sm:px-8">
            <h2 className="text-2xl font-semibold text-ink">סיימת לקרוא? עכשיו נשאר רק לחתום.</h2>
            <p className="mt-2 text-lg text-ink-soft">
              {locked
                ? "החתימה נכנסת אוטומטית למקום המסומן."
                : "החתימה מצטרפת להסכם במקום המסומן, ואפשר להזיז אותה אם צריך."}
            </p>
            <button
              ref={inlineCtaRef}
              type="button"
              className="btn btn-primary btn-lg btn-block mt-5 sm:w-auto sm:min-w-72"
              onClick={() => {
                setNotice("");
                setPadOpen(true);
              }}
            >
              <PenLine className="size-6" aria-hidden />
              לחתימה על ההסכם
            </button>
          </section>
        ) : null}
      </main>

      <JumpToSignature visible={chipVisible} onJump={jumpToTarget} />

      <ActionBar
        phase={phase}
        visible={barVisible}
        reason={barReason}
        locked={locked}
        notice={notice}
        onSign={() => {
          setNotice("");
          setPadOpen(true);
        }}
        onResign={() => setPadOpen(true)}
        onContinue={() => {
          setPhase("reviewing");
          scrollToSignature();
        }}
        onConfirm={() => void submit()}
        onAdjust={() => {
          setNotice("");
          setPhase("placing");
        }}
        onGrow={() => resizeSignature(RESIZE_STEP)}
        onShrink={() => resizeSignature(1 / RESIZE_STEP)}
      />

      <SignaturePadSheet open={padOpen} onClose={() => setPadOpen(false)} onConfirm={handleSignatureReady} />
    </div>
  );
}
