"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, Copy, FileUp, Loader2, Send } from "lucide-react";
import { useMemo, useRef, useState } from "react";

const maxPdfBytes = 20 * 1024 * 1024;

type UploadState = "idle" | "uploading" | "done" | "error";

export function UploadCard() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<UploadState>("idle");
  const [error, setError] = useState("");
  const [signUrl, setSignUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const absoluteSignUrl = useMemo(() => {
    if (!signUrl || typeof window === "undefined") {
      return "";
    }

    return `${window.location.origin}${signUrl}`;
  }, [signUrl]);

  async function uploadFile(file: File) {
    setError("");

    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      setState("error");
      setError("אפשר להעלות כאן מסמך מתאים בלבד.");
      return;
    }

    if (file.size > maxPdfBytes) {
      setState("error");
      setError("הקובץ גדול מדי. יש לבחור מסמך קטן יותר.");
      return;
    }

    setState("uploading");
    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("/api/contracts", {
        method: "POST",
        body: formData,
      });
      const payload = (await response.json()) as { signUrl?: string; message?: string };

      if (!response.ok || !payload.signUrl) {
        throw new Error("לא הצלחנו ליצור קישור. נסו שוב.");
      }

      setSignUrl(payload.signUrl);
      setState("done");
    } catch (uploadError) {
      setState("error");
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : "לא הצלחנו לשמור את המסמך. יש לנסות שוב.",
      );
    }
  }

  async function copyLink() {
    if (!absoluteSignUrl) {
      return;
    }

    await navigator.clipboard.writeText(absoluteSignUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.15, ease: "easeOut" }}
      className="mx-auto w-full max-w-2xl rounded-[2rem] border border-[#ECE7E1] bg-white/90 p-4 shadow-[0_28px_90px_rgba(47,47,47,0.08)] backdrop-blur sm:p-6"
    >
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) {
            void uploadFile(file);
          }
        }}
      />

      <AnimatePresence mode="wait">
        {state !== "done" ? (
          <motion.button
            key="upload"
            type="button"
            disabled={state === "uploading"}
            onClick={() => inputRef.current?.click()}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              const file = event.dataTransfer.files[0];
              if (file) {
                void uploadFile(file);
              }
            }}
            className="group flex min-h-80 w-full flex-col items-center justify-center rounded-[1.5rem] border border-dashed border-[#DCD3C9] bg-[#FAF8F5]/80 px-6 py-12 text-center transition duration-150 hover:border-[#BBDDFA] hover:bg-white disabled:cursor-wait"
          >
            <span className="mb-7 flex size-20 items-center justify-center rounded-[1.65rem] bg-[#BBDDFA]/55 text-[#2E2E2E] shadow-[0_18px_45px_rgba(187,221,250,0.35)]">
              {state === "uploading" ? (
                <Loader2 className="size-9 animate-spin" aria-hidden />
              ) : (
                <FileUp className="size-9" aria-hidden />
              )}
            </span>
            <span className="text-3xl font-semibold tracking-[-0.02em] text-[#2E2E2E] sm:text-4xl">
              {state === "uploading" ? "מכינה קישור" : "בחרי הסכם"}
            </span>
            <span className="mt-4 max-w-sm text-xl leading-9 text-[#757575]">
              לחצי כאן כדי לבחור את ההסכם.
            </span>
            {error ? (
              <span className="mt-6 rounded-full bg-[#E9DCCF]/45 px-5 py-2.5 text-base font-semibold text-[#8A5F52]">
                {error}
              </span>
            ) : null}
          </motion.button>
        ) : (
          <motion.div
            key="done"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="rounded-[1.5rem] border border-[#ECE7E1] bg-[#FAF8F5] p-6 text-[#2E2E2E] sm:p-8"
          >
            <div className="mb-6 flex size-16 items-center justify-center rounded-2xl bg-[#CAD8C5] text-[#2E2E2E] shadow-[0_16px_36px_rgba(202,216,197,0.45)]">
              <Check className="size-9" aria-hidden />
            </div>
            <h2 className="text-3xl font-semibold tracking-[-0.02em]">הקישור מוכן</h2>
            <p className="mt-3 text-xl leading-9 text-[#757575]">
              שלחי אותו ללקוחה בוואטסאפ.
            </p>
            <div className="mt-6 rounded-2xl border border-[#ECE7E1] bg-white p-4 text-left text-base break-all text-[#757575]" dir="ltr">
              {absoluteSignUrl}
            </div>
            <div className="mt-5 grid gap-3">
              <a
                href={`https://wa.me/?text=${encodeURIComponent(`אפשר לחתום כאן על המסמך: ${absoluteSignUrl}`)}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-16 items-center justify-center gap-2 rounded-2xl bg-[#BBDDFA] px-6 text-xl font-semibold text-[#2E2E2E] shadow-[0_14px_36px_rgba(187,221,250,0.35)] transition duration-150 hover:bg-[#C9E5FB]"
              >
                <Send className="size-5" aria-hidden />
                שליחה בוואטסאפ
              </a>
              <button
                type="button"
                onClick={() => void copyLink()}
                className="inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl border border-[#ECE7E1] bg-white px-5 text-lg font-semibold text-[#757575] transition duration-150 hover:bg-[#FAF8F5]"
              >
                {copied ? <Check className="size-5" aria-hidden /> : <Copy className="size-5" aria-hidden />}
                {copied ? "הועתק" : "העתקת קישור"}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </motion.div>
  );
}
