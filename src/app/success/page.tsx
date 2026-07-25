"use client";

import { motion } from "framer-motion";
import { Check } from "lucide-react";

export default function SuccessPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-10 text-[#2F2F2F]">
      <motion.section
        initial={{ opacity: 0, y: 18, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.15, ease: "easeOut" }}
        className="w-full max-w-xl rounded-[2.25rem] border border-[#ECE7E1] bg-white/90 p-8 text-center shadow-[0_28px_90px_rgba(47,47,47,0.08)] backdrop-blur sm:p-12"
      >
        <motion.div
          initial={{ scale: 0.65 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.03, duration: 0.15, ease: "easeOut" }}
          className="mx-auto mb-8 flex size-28 items-center justify-center rounded-full bg-[#CAD8C5] text-[#2F2F2F] shadow-[0_20px_55px_rgba(202,216,197,0.45)]"
        >
          <Check className="size-16" strokeWidth={3} aria-hidden />
        </motion.div>
        <h1 className="text-4xl font-semibold leading-tight tracking-[-0.025em] text-[#2F2F2F] sm:text-5xl">
          המסמך נחתם בהצלחה.
        </h1>
        <p className="mx-auto mt-5 max-w-sm text-lg leading-8 text-[#7B7B7B]">
          תודה. אפשר לסגור את החלון.
        </p>
      </motion.section>
    </main>
  );
}
