"use client";

import { ArrowDown } from "lucide-react";

type JumpToSignatureProps = {
  visible: boolean;
  onJump: () => void;
};

/** Floating shortcut that scrolls straight to the signature area. */
export function JumpToSignature({ visible, onJump }: JumpToSignatureProps) {
  return (
    <button
      type="button"
      className={`jump-chip ${visible ? "" : "jump-chip--hidden"}`}
      onClick={onJump}
      aria-hidden={!visible}
      tabIndex={visible ? 0 : -1}
    >
      <ArrowDown className="size-5" aria-hidden />
      מעבר ישירות לחתימה
    </button>
  );
}
