"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { PRIMARY_NAV } from "@/lib/navigation";
import { site } from "@/lib/site";
import { Address } from "./Address";

/**
 * The phone menu: a full-screen sheet with the sections set large, the way a
 * printed brochure's contents page would be.
 *
 * Closes on navigation, on Escape and on the close button; locks page scroll
 * while open so the page underneath does not drift; moves focus into the sheet
 * and back to the trigger, so it is usable with a screen reader or keyboard.
 */
export function MobileMenu() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const trigger = useRef<HTMLButtonElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  const [lastPath, setLastPath] = useState(pathname);

  // Navigating closes the menu. Adjusting state during render (rather than in
  // an effect) is React's pattern for reacting to a changed value.
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    close.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    const triggerEl = trigger.current;
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
      triggerEl?.focus();
    };
  }, [open]);

  return (
    <>
      <button
        ref={trigger}
        type="button"
        onClick={() => setOpen(true)}
        aria-expanded={open}
        aria-controls="mobile-menu"
        className="eyebrow min-h-12 px-1 !text-text-primary lg:hidden"
      >
        Menu
      </button>

      <div
        id="mobile-menu"
        role="dialog"
        aria-modal="true"
        aria-label="Menu"
        hidden={!open}
        className="fixed inset-0 z-50 flex flex-col overflow-y-auto bg-surface-0 px-5 pb-10 pt-4 lg:hidden"
      >
        <div className="flex items-center justify-between">
          <span className="eyebrow !text-text-muted">Sabicars</span>
          <button ref={close} type="button" onClick={() => setOpen(false)} className="eyebrow min-h-12 px-1 !text-text-primary">
            Close
          </button>
        </div>

        <nav className="mt-10 flex flex-col">
          {PRIMARY_NAV.map((item, i) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={pathname.startsWith(item.href) ? "page" : undefined}
              className="flex items-baseline gap-5 border-b border-border-subtle py-5 font-display text-[2.1rem] leading-none text-text-primary aria-[current=page]:text-accent-text"
            >
              <span className="figures font-sans text-xs text-text-muted">0{i + 1}</span>
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="mt-auto space-y-2 pt-12 text-sm text-text-secondary">
          <Address />
          <p className="figures pt-3">
            <a href={`tel:${site.phones[0].e164}`} className="text-text-primary">
              {site.phones[0].display}
            </a>
          </p>
        </div>
      </div>
    </>
  );
}
