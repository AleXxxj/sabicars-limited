"use client";

import { Printer } from "lucide-react";

/** Opens the browser's print dialog for the page it sits on. */
export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="mt-6 inline-flex min-h-12 items-center gap-2 rounded-full bg-[#101511] px-6 text-[0.95rem] font-semibold text-white"
    >
      <Printer aria-hidden size={18} /> Print the seal
    </button>
  );
}
