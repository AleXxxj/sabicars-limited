"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Menu, Phone, X } from "lucide-react";
import { ButtonAnchor } from "@/components/ui/Button";
import { PRIMARY_NAV, SAVED_NAV } from "@/lib/navigation";
import { site, whatsappLink } from "@/lib/site";
import { Address } from "./Address";
import { NAV_ICON } from "./nav-icons";

/**
 * The phone menu: every section with an icon and a line saying what it is
 * for, then the three ways to reach a person — so nobody has to guess what a
 * word like "Fleet" leads to.
 *
 * Closes on navigation, on Escape and on the close button; locks page scroll
 * while open so the page underneath does not drift; moves focus into the sheet
 * and back to the trigger, so it is usable with a screen reader or keyboard.
 *
 * The sheet is portalled to <body>. The header it is opened from has a
 * backdrop blur, and a blurred ancestor becomes the box a `fixed` element is
 * placed in — left inside the header, the full-screen sheet was squeezed into
 * the header's 72px and showed as an empty bar.
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
        aria-label="Menu"
        className="glass inline-flex size-10 items-center justify-center rounded-full text-text-primary transition-colors hover:text-gold-300 sm:size-11 xl:hidden"
      >
        <Menu aria-hidden size={20} strokeWidth={1.75} />
      </button>

      {open &&
        createPortal(
          <div
            id="mobile-menu"
            role="dialog"
            aria-modal="true"
            aria-label="Menu"
            className="fixed inset-0 z-50 flex flex-col overflow-y-auto bg-surface-0 bg-[radial-gradient(900px_500px_at_80%_-10%,rgb(201_168_76/0.1),transparent_70%)] px-5 pb-8 pt-3 xl:hidden"
          >
            <div className="flex h-12 items-center justify-between">
              <span className="kicker">Sabicars</span>
              <button
                ref={close}
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close menu"
                className="glass inline-flex size-11 items-center justify-center rounded-full text-text-primary"
              >
                <X aria-hidden size={20} strokeWidth={1.75} />
              </button>
            </div>

            <nav className="mt-6 grid gap-1">
              {[...PRIMARY_NAV, SAVED_NAV].map((item) => {
                const Icon = NAV_ICON[item.href];
                const current = !item.href.includes("#") && pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    aria-current={current ? "page" : undefined}
                    className="group flex min-w-0 items-center gap-4 rounded-2xl px-3 py-3.5 transition-colors hover:bg-white/[0.04] aria-[current=page]:bg-white/[0.05]"
                  >
                    <span className="glass inline-flex size-11 shrink-0 items-center justify-center rounded-xl text-gold-300">
                      {Icon && <Icon aria-hidden size={20} strokeWidth={1.75} />}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[1.15rem] font-semibold leading-tight text-text-primary">{item.label}</span>
                      <span className="block truncate text-sm text-text-muted">{item.hint}</span>
                    </span>
                  </Link>
                );
              })}
            </nav>

            <div className="mt-auto grid gap-3 pt-10">
              <ButtonAnchor href={`tel:${site.phones[0].e164}`} size="lg" className="w-full">
                <Phone aria-hidden size={18} /> Call {site.phones[0].display}
              </ButtonAnchor>
              <div className="grid grid-cols-2 gap-3">
                <ButtonAnchor href={whatsappLink()} target="_blank" rel="noopener noreferrer" variant="secondary" className="w-full">
                  WhatsApp
                </ButtonAnchor>
                <ButtonAnchor href={site.mapsUrl} target="_blank" rel="noopener noreferrer" variant="secondary" className="w-full">
                  Directions
                </ButtonAnchor>
              </div>
              <Address className="pt-3 text-center text-sm text-text-muted" />
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
