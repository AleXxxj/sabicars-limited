"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";

/**
 * A panel over the page. A native <dialog>, so Escape, focus trapping and the
 * back gesture behave as the phone expects. On a phone it rises from the
 * bottom like an app sheet; on a desk it sits in the middle.
 */
export function Dialog({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      aria-label={title}
      className="m-0 mt-auto max-h-[92svh] w-full max-w-none overflow-y-auto rounded-t-3xl border border-white/10 bg-surface-1 p-0 text-text-primary shadow-[0_-30px_80px_-20px_rgb(0_0_0/0.8)] backdrop:bg-[#0A0908]/75 backdrop:backdrop-blur-sm open:animate-[prompt-in_var(--duration-base)_var(--ease-out)] sm:m-auto sm:max-w-xl sm:rounded-3xl"
    >
      <div className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-white/[0.06] bg-surface-1/95 px-6 py-4 backdrop-blur md:px-8">
        <h2 className="font-display text-[1.6rem] leading-tight">{title}</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="inline-flex size-11 items-center justify-center rounded-full text-text-secondary hover:bg-white/[0.06] hover:text-text-primary"
        >
          <X aria-hidden size={20} />
        </button>
      </div>
      <div className="px-6 py-6 md:px-8 md:py-8">{children}</div>
    </dialog>
  );
}
