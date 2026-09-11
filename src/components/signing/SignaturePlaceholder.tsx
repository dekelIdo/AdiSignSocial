"use client";

import { PenLine } from "lucide-react";
import type { NormalizedPlacement } from "@/lib/signature-placement";

type SignaturePlaceholderProps = {
  target: NormalizedPlacement;
  /** Briefly emphasised after the "jump to signature" action. */
  flashing: boolean;
  placeholderRef?: (element: HTMLDivElement | null) => void;
};

/** The owner-defined signature area, shown until the recipient signs. */
export function SignaturePlaceholder({ target, flashing, placeholderRef }: SignaturePlaceholderProps) {
  return (
    <div
      ref={placeholderRef}
      className={`sig-target ${flashing ? "sig-target--flash" : ""}`}
      style={{
        left: `${target.x * 100}%`,
        top: `${target.y * 100}%`,
        width: `${target.width * 100}%`,
        height: `${target.height * 100}%`,
      }}
      role="note"
      aria-label="כאן חותמים"
    >
      <PenLine className="sig-target__icon" aria-hidden />
      <span>חתימה כאן</span>
    </div>
  );
}
