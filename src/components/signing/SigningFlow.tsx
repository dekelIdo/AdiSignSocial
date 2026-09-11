"use client";

import { PenLine } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActionBar, type SigningPhase } from "@/components/signing/ActionBar";
import { DocumentViewer } from "@/components/signing/DocumentViewer";
import { SignatureOverlay, type OverlayMode } from "@/components/signing/SignatureOverlay";
import { SignaturePadSheet } from "@/components/signing/SignaturePadSheet";
import { ErrorScreen, LoadingScreen } from "@/components/signing/StatusScreens";
import {
  findSignatureAnchor,
  initialPlacement,
  loadPdfDocument,
  type LoadedPdf,
  type SignatureAnchor,
} from "@/lib/pdf-client";
import type { ExportedSignature } from "@/lib/signature-export";
import {
  clampPlacementToPage,
  scalePlacement,
  sizePlacement,
  type NormalizedPlacement,
} from "@/lib/signature-placement";

type SigningFlowProps = {
  contractId: string;
  clientName?: string;
};

type LoadStatus =
  | { kind: "loading"; progress: number | null }
  | { kind: "error"; message: string }
  | { kind: "ready" };

const LOAD_ERROR = "לא הצלחנו לפתוח את ההסכם. נסי שוב, ואם הבעיה חוזרת אפשר לפנות לעדי.";
const SUBMIT_ERROR = "לא הצלחנו לסיים את החתימה. נסי שוב, ואם הבעיה חוזרת אפשר לפנות לעדי.";
const RESIZE_STEP = 1.15;

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function SigningFlow({ contractId, clientName }: SigningFlowProps) {
  const router = useRouter();
  const [status, setStatus] = useState<LoadStatus>({ kind: "loading", progress: null });
  const [loaded, setLoaded] = useState<LoadedPdf | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [phase, setPhase] = useState<SigningPhase>("reading");
  const [padOpen, setPadOpen] = useState(false);
  const [signature, setSignature] = useState<ExportedSignature | null>(null);
  const [placement, setPlacement] = useState<NormalizedPlacement | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [lastPageVisible, setLastPageVisible] = useState(false);
  const [inlineCtaVisible, setInlineCtaVisible] = useState(false);
  const [notice, setNotice] = useState("");
  const inlineCtaRef = useRef<HTMLButtonElement | null>(null);
  const anchorRef = useRef<SignatureAnchor | null>(null);
  const pageElements = useRef(new Map<number, HTMLDivElement>());
  const overlayElement = useRef<HTMLDivElement | null>(null);

  const retryLoad = () => {
    setStatus({ kind: "loading", progress: null });
    setLoaded(null);
    setAttempt((value) => value + 1);
  };

  useEffect(() => {
    let cancelled = false;
    let handle: LoadedPdf | null = null;
    anchorRef.current = null;

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

        // Find the signature label on the last page in the background; it
        // only decides where the signature first appears.
        try {
          const lastPage = await result.pdf.getPage(result.pdf.numPages);
          const anchor = await findSignatureAnchor(lastPage);
          if (!cancelled) {
            anchorRef.current = anchor;
          }
        } catch (anchorError) {
          console.warn("Signature anchor detection skipped", anchorError);
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
  }, [contractId, attempt]);

  // The sticky bar steps aside once the inline "sign" button is fully visible
  // above the bar's own zone, so the reader never sees the same button twice
  // and never sees only a sliver of it.
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

  const pageCount = loaded?.pageSizes.length ?? 0;
  const lastPageIndex = pageCount - 1;
  const lastPageSize = loaded?.pageSizes[lastPageIndex];

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

  const getLastPageElement = useCallback(
    () => pageElements.current.get(lastPageIndex) ?? null,
    [lastPageIndex],
  );

  const scrollToSignature = useCallback(() => {
    window.requestAnimationFrame(() => {
      overlayElement.current?.scrollIntoView({
        block: "center",
        behavior: prefersReducedMotion() ? "auto" : "smooth",
      });
    });
  }, []);

  const handleSignatureReady = (exported: ExportedSignature) => {
    if (!lastPageSize) {
      return;
    }

    const pageAspect = lastPageSize.width / lastPageSize.height;
    setSignature(exported);
    setPlacement((previous) => {
      if (previous) {
        // Re-signing keeps the chosen spot: same width, ink stays on the line.
        const resized = sizePlacement(previous, previous.width, exported.aspect, pageAspect);
        return clampPlacementToPage({ ...resized, y: previous.y + previous.height - resized.height });
      }
      return initialPlacement(lastPageIndex, lastPageSize, exported.aspect, anchorRef.current);
    });
    setPadOpen(false);
    setNotice("");
    setPhase("placing");
    scrollToSignature();
  };

  const resizeSignature = (factor: number) => {
    if (!signature || !placement || !lastPageSize) {
      return;
    }
    setPlacement(
      scalePlacement(placement, factor, signature.aspect, lastPageSize.width / lastPageSize.height),
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

  if (status.kind === "loading" || !loaded) {
    if (status.kind === "error") {
      return (
        <ErrorScreen
          title="משהו השתבש בפתיחת ההסכם"
          message={status.message}
          onRetry={retryLoad}
        />
      );
    }
    return (
      <LoadingScreen clientName={clientName} progress={status.kind === "loading" ? status.progress : null} />
    );
  }

  if (status.kind === "error") {
    return (
      <ErrorScreen
        title="משהו השתבש בפתיחת ההסכם"
        message={status.message}
        onRetry={() => setAttempt((value) => value + 1)}
      />
    );
  }

  const overlayMode: OverlayMode =
    phase === "placing" ? "editing" : phase === "reviewing" ? "review" : "locked";
  const barVisible = phase !== "reading" || (lastPageVisible && !inlineCtaVisible);
  const stepIndex = phase === "reading" ? 0 : 1;

  return (
    <div className="min-h-dvh">
      <header className="top-bar">
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

      <main className="fade-in mx-auto w-full max-w-[52rem] px-3 pb-[10.5rem] pt-4 sm:px-6 sm:pt-6">
        {phase === "reading" && !lastPageVisible ? (
          <p className="mb-4 text-center text-base text-muted">
            {clientName ? `שלום ${clientName}, ` : ""}
            גללי למטה ועברי על ההסכם. בסוף ההסכם חותמים.
          </p>
        ) : null}

        <DocumentViewer
          pdf={loaded.pdf}
          pageSizes={loaded.pageSizes}
          onCurrentPageChange={setCurrentPage}
          onLastPageVisibleChange={setLastPageVisible}
          onRenderError={handleRenderError}
          onPageElement={handlePageElement}
          renderPageOverlay={(pageIndex) =>
            pageIndex === lastPageIndex && signature && placement && lastPageSize ? (
              <SignatureOverlay
                placement={placement}
                signature={signature}
                pageSize={lastPageSize}
                mode={overlayMode}
                onChange={setPlacement}
                getPageElement={getLastPageElement}
                overlayRef={(element) => {
                  overlayElement.current = element;
                }}
              />
            ) : null
          }
        />

        {phase === "reading" ? (
          <section className="card mx-auto mt-6 max-w-[52rem] px-5 py-7 text-center sm:px-8">
            <h2 className="text-2xl font-semibold text-ink">סיימת לקרוא? עכשיו נשאר רק לחתום.</h2>
            <p className="mt-2 text-lg text-ink-soft">
              החתימה מצטרפת לעמוד האחרון, בדיוק במקום שתבחרי.
            </p>
            <button
              ref={inlineCtaRef}
              type="button"
              className="btn btn-primary btn-lg btn-block mt-6 sm:w-auto sm:min-w-72"
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

      <ActionBar
        phase={phase}
        visible={barVisible}
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

      <SignaturePadSheet
        open={padOpen}
        onClose={() => setPadOpen(false)}
        onConfirm={handleSignatureReady}
      />
    </div>
  );
}
