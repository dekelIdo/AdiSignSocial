"use client";

import { Check, Download, MailCheck } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";

type ContractStatus = {
  signed: boolean;
  emailSent: boolean;
  clientName: string;
  fileName: string;
};

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className="size-5 fill-current">
      <path d="M16.03 4.5A11.35 11.35 0 0 0 6.3 21.7L5 27.5l5.93-1.25A11.35 11.35 0 1 0 16.03 4.5Zm0 2.1a9.25 9.25 0 0 1 0 18.5 9.1 9.1 0 0 1-4.43-1.14l-.36-.2-3.4.72.74-3.3-.24-.38A9.25 9.25 0 0 1 16.03 6.6Zm-3.1 4.8c-.22-.01-.58.08-.88.42-.3.34-1.16 1.13-1.16 2.76 0 1.62 1.19 3.2 1.36 3.42.17.22 2.3 3.68 5.68 5.02 2.8 1.1 3.38.88 3.99.82.61-.06 1.98-.8 2.26-1.58.28-.78.28-1.45.2-1.59-.09-.14-.31-.22-.65-.39-.34-.17-1.98-.98-2.29-1.09-.3-.11-.53-.17-.75.17-.22.34-.86 1.08-1.06 1.3-.2.22-.39.25-.73.08-.34-.17-1.43-.53-2.73-1.68-1.01-.9-1.7-2.02-1.9-2.36-.2-.34-.02-.52.15-.69.15-.15.34-.39.5-.58.17-.2.22-.34.34-.56.11-.22.06-.42-.03-.59-.08-.17-.75-1.82-1.03-2.49-.27-.65-.55-.56-.75-.57h-.58Z" />
    </svg>
  );
}

function SuccessContent() {
  const searchParams = useSearchParams();
  const contractId = useMemo(() => {
    const id = searchParams.get("id");
    return id && /^[A-Za-z0-9_-]{8,32}$/.test(id) ? id : "";
  }, [searchParams]);
  const [status, setStatus] = useState<ContractStatus | null>(null);
  const [shareNote, setShareNote] = useState("");
  const emailSent = status ? status.emailSent : searchParams.get("sent") === "1";
  const signedUrl = contractId ? `/api/contracts/${contractId}/signed` : "";
  const fileName = status?.fileName || "הסכם-חתום.pdf";

  useEffect(() => {
    if (!contractId) {
      return;
    }

    let cancelled = false;
    fetch(`/api/contracts/${contractId}/status`)
      .then((response) => (response.ok ? (response.json() as Promise<ContractStatus>) : null))
      .then((payload) => {
        if (!cancelled && payload) {
          setStatus(payload);
        }
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [contractId]);

  async function shareSignedPdf() {
    if (!signedUrl) {
      return;
    }

    const absoluteUrl = `${window.location.origin}${signedUrl}`;
    const fallbackToWhatsApp = () => {
      const message = `ההסכם החתום מוכן להורדה: ${absoluteUrl}`;
      window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer");
    };

    if (!navigator.share) {
      fallbackToWhatsApp();
      return;
    }

    try {
      const response = await fetch(signedUrl);
      const blob = await response.blob();
      const file = new File([blob], fileName, { type: "application/pdf" });

      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: "ההסכם החתום" });
        return;
      }

      await navigator.share({ title: "ההסכם החתום", url: absoluteUrl });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        return;
      }
      setShareNote("לא הצלחנו לפתוח את השיתוף. אפשר להוריד את הקובץ ולשלוח אותו ידנית.");
      fallbackToWhatsApp();
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center px-5 py-10">
      <section className="card fade-in w-full max-w-[30rem] px-6 py-10 text-center sm:px-10 sm:py-12">
        <span
          className="mx-auto mb-6 flex size-16 items-center justify-center rounded-2xl bg-sage text-sage-ink"
          aria-hidden
        >
          <Check className="size-9" />
        </span>
        <h1 className="text-4xl font-semibold leading-tight tracking-[-0.02em] text-ink">
          ההסכם נחתם בהצלחה 🌿
        </h1>
        <p className="mx-auto mt-4 max-w-sm text-xl leading-relaxed text-ink-soft" aria-live="polite">
          זהו, סיימנו. ההסכם מוכן ונשמר בהצלחה.
        </p>

        {emailSent ? (
          <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-sage/40 px-4 py-1.5 text-base font-semibold text-sage-ink">
            <MailCheck className="size-5" aria-hidden />
            עותק נשלח לעדי במייל
          </p>
        ) : null}

        {signedUrl ? (
          <div className="mt-9 grid gap-3">
            <a href={signedUrl} download={fileName} className="btn btn-primary btn-lg btn-block">
              <Download className="size-6" aria-hidden />
              הורדת ההסכם החתום
            </a>
            <button type="button" className="btn btn-secondary btn-block" onClick={() => void shareSignedPdf()}>
              <WhatsAppIcon />
              שליחה ב-WhatsApp
            </button>
            {!emailSent ? (
              <p className="text-base text-muted">
                אם נוח לך, אפשר לשלוח את ההסכם החתום לעדי גם ב-WhatsApp.
              </p>
            ) : null}
            {shareNote ? (
              <p className="text-base font-semibold text-danger" role="status">
                {shareNote}
              </p>
            ) : null}
          </div>
        ) : null}
      </section>
    </main>
  );
}

function SuccessFallback() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-5 py-10">
      <section className="card w-full max-w-[30rem] px-6 py-10 text-center sm:px-10 sm:py-12">
        <h1 className="text-4xl font-semibold leading-tight tracking-[-0.02em] text-ink">
          ההסכם נחתם בהצלחה 🌿
        </h1>
        <p className="mx-auto mt-4 max-w-sm text-xl leading-relaxed text-ink-soft">
          זהו, סיימנו. ההסכם מוכן ונשמר בהצלחה.
        </p>
      </section>
    </main>
  );
}

export default function SuccessPage() {
  return (
    <Suspense fallback={<SuccessFallback />}>
      <SuccessContent />
    </Suspense>
  );
}
