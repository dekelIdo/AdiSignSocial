"use client";

import { motion } from "framer-motion";
import { useSearchParams } from "next/navigation";
import { Suspense, useMemo } from "react";

function SuccessContent() {
  const searchParams = useSearchParams();
  const signedUrl = useMemo(() => {
    const id = searchParams.get("id");
    if (!id || !/^[A-Za-z0-9_-]{8,32}$/.test(id)) {
      return "";
    }

    return `/api/contracts/${id}/signed`;
  }, [searchParams]);

  async function shareSignedPdf() {
    if (!signedUrl) {
      return;
    }

    if (!navigator.share) {
      const message = `ההסכם החתום מוכן להורדה: ${window.location.origin}${signedUrl}`;
      window.open(
        `https://wa.me/?text=${encodeURIComponent(message)}`,
        "_blank",
        "noopener,noreferrer",
      );
      return;
    }

    const response = await fetch(signedUrl);
    const blob = await response.blob();
    const file = new File([blob], "signed-agreement.pdf", {
      type: "application/pdf",
    });

    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({
        files: [file],
        title: "ההסכם החתום",
      });
      return;
    }

    await navigator.share({
      title: "ההסכם החתום",
      url: `${window.location.origin}${signedUrl}`,
    });
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-10 text-[#2E2E2E]">
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.15, ease: "easeOut" }}
        className="w-full max-w-[480px] rounded-[2rem] border border-[#ECE7E1] bg-white/[0.92] px-6 py-12 text-center shadow-[0_28px_90px_rgba(47,47,47,0.07)] backdrop-blur sm:px-10 sm:py-14"
      >
        <h1 className="text-4xl font-semibold leading-tight tracking-[-0.025em] text-[#2E2E2E]">
          ההסכם נחתם בהצלחה 🌿
        </h1>
        <p className="mx-auto mt-6 max-w-sm whitespace-pre-line text-xl leading-9 text-[#757575]">
          {"תודה רבה.\nהעותק החתום נשמר בהצלחה."}
        </p>
        {signedUrl ? (
          <div className="mt-10 grid gap-3">
            <a
              href={signedUrl}
              download
              className="inline-flex min-h-16 w-full items-center justify-center rounded-3xl bg-[#BBDDFA] px-8 text-xl font-semibold text-[#2E2E2E] shadow-[0_18px_45px_rgba(187,221,250,0.34)] transition duration-150 hover:bg-[#C9E5FB]"
            >
              הורדת ההסכם החתום
            </a>
            <button
              type="button"
              onClick={() => void shareSignedPdf()}
              className="inline-flex min-h-14 w-full items-center justify-center rounded-3xl border border-[#ECE7E1] bg-white px-8 text-lg font-semibold text-[#757575] transition duration-150 hover:bg-[#FAF8F5]"
            >
              <svg
                viewBox="0 0 32 32"
                aria-hidden="true"
                className="ml-2 size-5 fill-current"
              >
                <path d="M16.03 4.5A11.35 11.35 0 0 0 6.3 21.7L5 27.5l5.93-1.25A11.35 11.35 0 1 0 16.03 4.5Zm0 2.1a9.25 9.25 0 0 1 0 18.5 9.1 9.1 0 0 1-4.43-1.14l-.36-.2-3.4.72.74-3.3-.24-.38A9.25 9.25 0 0 1 16.03 6.6Zm-3.1 4.8c-.22-.01-.58.08-.88.42-.3.34-1.16 1.13-1.16 2.76 0 1.62 1.19 3.2 1.36 3.42.17.22 2.3 3.68 5.68 5.02 2.8 1.1 3.38.88 3.99.82.61-.06 1.98-.8 2.26-1.58.28-.78.28-1.45.2-1.59-.09-.14-.31-.22-.65-.39-.34-.17-1.98-.98-2.29-1.09-.3-.11-.53-.17-.75.17-.22.34-.86 1.08-1.06 1.3-.2.22-.39.25-.73.08-.34-.17-1.43-.53-2.73-1.68-1.01-.9-1.7-2.02-1.9-2.36-.2-.34-.02-.52.15-.69.15-.15.34-.39.5-.58.17-.2.22-.34.34-.56.11-.22.06-.42-.03-.59-.08-.17-.75-1.82-1.03-2.49-.27-.65-.55-.56-.75-.57h-.58Z" />
              </svg>
              שיתוף ב-WhatsApp
            </button>
          </div>
        ) : null}
      </motion.section>
    </main>
  );
}

function SuccessFallback() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-10 text-[#2E2E2E]">
      <section className="w-full max-w-[480px] rounded-[2rem] border border-[#ECE7E1] bg-white/[0.92] px-6 py-12 text-center shadow-[0_28px_90px_rgba(47,47,47,0.07)] backdrop-blur sm:px-10 sm:py-14">
        <h1 className="text-4xl font-semibold leading-tight tracking-[-0.025em] text-[#2E2E2E]">
          ההסכם נחתם בהצלחה 🌿
        </h1>
        <p className="mx-auto mt-6 max-w-sm whitespace-pre-line text-xl leading-9 text-[#757575]">
          {"תודה רבה.\nהעותק החתום נשמר בהצלחה."}
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
