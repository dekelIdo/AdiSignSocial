"use client";

import { Check, Copy, FileUp, Loader2, Send } from "lucide-react";
import { useId, useMemo, useRef, useState } from "react";

const maxPdfBytes = 60 * 1024 * 1024;

type UploadState = "idle" | "uploading" | "done" | "error";

export function UploadCard() {
  const inputRef = useRef<HTMLInputElement>(null);
  const nameId = useId();
  const [state, setState] = useState<UploadState>("idle");
  const [clientName, setClientName] = useState("");
  const [error, setError] = useState("");
  const [signUrl, setSignUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const absoluteSignUrl = useMemo(() => {
    if (!signUrl || typeof window === "undefined") {
      return "";
    }

    return `${window.location.origin}${signUrl}`;
  }, [signUrl]);

  const whatsappMessage = useMemo(() => {
    const greeting = clientName.trim() ? `היי ${clientName.trim()},` : "היי,";
    return `${greeting} הנה הסכם העבודה שלנו לחתימה 🌿\nפותחים את הקישור, קוראים וחותמים עם האצבע. זה לוקח כמה רגעים:\n${absoluteSignUrl}`;
  }, [clientName, absoluteSignUrl]);

  async function uploadFile(file: File) {
    setError("");

    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      setState("error");
      setError("אפשר להעלות כאן רק קובץ PDF.");
      return;
    }

    if (file.size > maxPdfBytes) {
      setState("error");
      setError("הקובץ גדול מדי. אפשר להעלות PDF עד 60MB.");
      return;
    }

    setState("uploading");
    const formData = new FormData();
    formData.append("file", file);
    formData.append("clientName", clientName.trim());

    try {
      const response = await fetch("/api/contracts", { method: "POST", body: formData });
      const payload = (await response.json().catch(() => ({}))) as {
        signUrl?: string;
        message?: string;
      };

      if (!response.ok || !payload.signUrl) {
        throw new Error(payload.message || "לא הצלחנו ליצור קישור. נסי שוב.");
      }

      setSignUrl(payload.signUrl);
      setState("done");
    } catch (uploadError) {
      setState("error");
      setError(uploadError instanceof Error ? uploadError.message : "לא הצלחנו לשמור את ההסכם. נסי שוב.");
    } finally {
      if (inputRef.current) {
        inputRef.current.value = "";
      }
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
    <div className="card fade-in mx-auto w-full max-w-2xl p-4 sm:p-6">
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="sr-only"
        aria-label="בחירת קובץ ההסכם"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) {
            void uploadFile(file);
          }
        }}
      />

      {state !== "done" ? (
        <div className="grid gap-5">
          <div>
            <label htmlFor={nameId} className="mb-2 block text-lg font-semibold text-ink">
              שם הלקוחה <span className="font-normal text-muted">(לא חובה)</span>
            </label>
            <input
              id={nameId}
              type="text"
              value={clientName}
              onChange={(event) => setClientName(event.target.value)}
              maxLength={60}
              autoComplete="off"
              placeholder="למשל: אסתי צמרת"
              className="min-h-14 w-full rounded-xl border border-line-strong bg-white px-4 text-lg text-ink placeholder:text-muted/70"
            />
            <p className="mt-2 text-base text-muted">
              השם מופיע בברכה ללקוחה ובשם הקובץ החתום.
            </p>
          </div>

          <button
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
            className="group flex min-h-64 w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-line-strong bg-paper px-6 py-10 text-center transition hover:border-accent-deep hover:bg-white disabled:cursor-wait"
          >
            <span className="mb-5 flex size-16 items-center justify-center rounded-2xl bg-accent/60 text-ink">
              {state === "uploading" ? (
                <Loader2 className="size-8 animate-spin" aria-hidden />
              ) : (
                <FileUp className="size-8" aria-hidden />
              )}
            </span>
            <span className="text-2xl font-semibold text-ink sm:text-3xl">
              {state === "uploading" ? "שומרת את ההסכם…" : "בחירת ההסכם"}
            </span>
            <span className="mt-2 max-w-sm text-lg text-ink-soft">
              {state === "uploading"
                ? "קבצים גדולים יכולים לקחת כמה שניות."
                : "לחצי כאן ובחרי את קובץ ה-PDF של ההסכם."}
            </span>
            {error ? (
              <span className="mt-5 rounded-full bg-danger-soft px-4 py-2 text-base font-semibold text-danger" role="alert">
                {error}
              </span>
            ) : null}
          </button>
        </div>
      ) : (
        <div className="fade-in rounded-2xl border border-line bg-paper p-5 sm:p-7">
          <div className="mb-5 flex size-14 items-center justify-center rounded-2xl bg-sage text-sage-ink">
            <Check className="size-8" aria-hidden />
          </div>
          <h2 className="text-3xl font-semibold tracking-[-0.02em] text-ink">הקישור מוכן</h2>
          <p className="mt-2 text-xl text-ink-soft">
            שלחי אותו {clientName.trim() ? `ל${clientName.trim()}` : "ללקוחה"} בוואטסאפ. היא פותחת,
            קוראת וחותמת.
          </p>
          <div
            className="mt-5 rounded-xl border border-line bg-white p-4 text-left text-base break-all text-ink-soft"
            dir="ltr"
          >
            {absoluteSignUrl}
          </div>
          <div className="mt-5 grid gap-3">
            <a
              href={`https://wa.me/?text=${encodeURIComponent(whatsappMessage)}`}
              target="_blank"
              rel="noreferrer"
              className="btn btn-primary btn-lg btn-block"
            >
              <Send className="size-5" aria-hidden />
              שליחה בוואטסאפ
            </a>
            <button type="button" onClick={() => void copyLink()} className="btn btn-secondary btn-block">
              {copied ? <Check className="size-5" aria-hidden /> : <Copy className="size-5" aria-hidden />}
              {copied ? "הועתק" : "העתקת קישור"}
            </button>
            <button
              type="button"
              className="btn btn-quiet"
              onClick={() => {
                setSignUrl("");
                setState("idle");
                setClientName("");
              }}
            >
              יצירת קישור נוסף
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
