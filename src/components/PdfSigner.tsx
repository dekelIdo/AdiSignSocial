"use client";

import { motion } from "framer-motion";
import { CheckCircle2, Loader2, PenLine, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import SignatureCanvas from "react-signature-canvas";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { PdfPage } from "@/components/PdfPage";

type PdfSignerProps = {
  contractId: string;
};

export function PdfSigner({ contractId }: PdfSignerProps) {
  const router = useRouter();
  const signatureRef = useRef<SignatureCanvas | null>(null);
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    let loadedPdf: PDFDocumentProxy | null = null;

    async function loadPdf() {
      try {
        const response = await fetch(`/api/contracts/${contractId}/pdf`);
        if (!response.ok) {
          throw new Error("missing");
        }

        const data = new Uint8Array(await response.arrayBuffer());
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = new URL(
          "pdfjs-dist/build/pdf.worker.mjs",
          import.meta.url,
        ).toString();
        loadedPdf = await pdfjs.getDocument({ data }).promise;

        if (!cancelled) {
          setPdf(loadedPdf);
          setPageCount(loadedPdf.numPages);
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          setMessage("הקישור לחתימה כבר לא זמין.");
          setLoading(false);
        }
      }
    }

    void loadPdf();

    return () => {
      cancelled = true;
      void loadedPdf?.cleanup();
    };
  }, [contractId]);

  async function finishSigning() {
    const pad = signatureRef.current;
    if (!pad || pad.isEmpty()) {
      setMessage("כדי להמשיך, צריך לחתום בתוך המסגרת.");
      return;
    }

    setSubmitting(true);
    setMessage("");

    try {
      const signature = pad.toDataURL("image/png");
      const response = await fetch(`/api/contracts/${contractId}/sign`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ signature }),
      });

      if (!response.ok) {
        throw new Error("לא הצלחנו להשלים את החתימה.");
      }

      router.push("/success");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "לא הצלחנו להשלים את החתימה. נסו שוב.",
      );
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen px-4 py-6 text-[#2F2F2F] sm:px-6 sm:py-10">
      <div className="mx-auto mb-8 max-w-4xl rounded-[1.75rem] border border-[#ECE7E1] bg-white/85 p-5 text-center shadow-[0_18px_60px_rgba(47,47,47,0.05)] backdrop-blur sm:p-6">
        <p className="text-lg font-semibold text-[#2F2F2F] sm:text-xl">
          קוראים בנחת, חותמים בסוף, ולוחצים על כפתור אחד.
        </p>
        <p className="mt-2 text-base text-[#7B7B7B]">בלי התחברות. בלי הורדה. בלי התקנה.</p>
      </div>

      {loading ? (
        <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
          <Loader2 className="mb-5 size-10 animate-spin text-[#BBDDFA]" aria-hidden />
          <p className="text-xl font-semibold text-[#2F2F2F]">פותחים את המסמך</p>
        </div>
      ) : null}

      {!loading && message && !pdf ? (
        <div className="mx-auto mt-20 max-w-lg rounded-[2rem] border border-[#ECE7E1] bg-white p-8 text-center shadow-[0_22px_70px_rgba(47,47,47,0.08)]">
          <p className="text-2xl font-semibold text-[#2F2F2F]">{message}</p>
        </div>
      ) : null}

      {pdf ? (
        <div className="space-y-10">
          {Array.from({ length: pageCount }, (_, index) => (
            <PdfPage key={index + 1} pdf={pdf} pageNumber={index + 1} />
          ))}

          <motion.section
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="mx-auto max-w-4xl rounded-[2rem] border border-[#ECE7E1] bg-white p-5 shadow-[0_28px_90px_rgba(47,47,47,0.08)] sm:p-7"
          >
            <div className="mb-5 flex items-center gap-3">
              <div className="flex size-12 items-center justify-center rounded-2xl bg-[#E9DCCF] text-[#2F2F2F]">
                <PenLine className="size-6" aria-hidden />
              </div>
              <div>
                <h1 className="text-3xl font-semibold tracking-[-0.02em] text-[#2F2F2F]">
                  חתימה כאן
                </h1>
                <p className="text-base text-[#7B7B7B]">אפשר לחתום עם אצבע, עכבר או עט.</p>
              </div>
            </div>

            <div className="overflow-hidden rounded-[1.75rem] border border-[#DCD3C9] bg-[#FFFDFC] shadow-inner shadow-[#E9DCCF]/30">
              <SignatureCanvas
                ref={signatureRef}
                penColor="#2F2F2F"
                canvasProps={{
                  className: "h-[250px] w-full touch-none bg-transparent",
                  "aria-label": "אזור חתימה",
                }}
              />
            </div>

            {message ? (
              <div className="mt-4 rounded-2xl bg-[#E9DCCF]/45 px-4 py-3 text-base font-semibold text-[#8A5F52]">
                {message}
              </div>
            ) : null}

            <div className="mt-5 grid gap-3 sm:grid-cols-[auto_1fr]">
              <button
                type="button"
                disabled={submitting}
                onClick={() => {
                  signatureRef.current?.clear();
                  setMessage("");
                }}
                className="inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl border border-[#ECE7E1] bg-white px-6 text-lg font-semibold text-[#7B7B7B] transition duration-150 hover:bg-[#FAF8F5] disabled:opacity-60"
              >
                <RotateCcw className="size-5" aria-hidden />
                ניקוי
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={() => void finishSigning()}
                className="inline-flex min-h-16 items-center justify-center gap-3 rounded-2xl bg-[#BBDDFA] px-8 text-xl font-semibold text-[#2F2F2F] shadow-[0_18px_45px_rgba(187,221,250,0.38)] transition duration-150 hover:bg-[#C9E5FB] disabled:cursor-wait disabled:opacity-70"
              >
                {submitting ? (
                  <Loader2 className="size-6 animate-spin" aria-hidden />
                ) : (
                  <CheckCircle2 className="size-6" aria-hidden />
                )}
                סיום ושליחה
              </button>
            </div>
          </motion.section>
        </div>
      ) : null}
    </main>
  );
}
