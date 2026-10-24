"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Menu, Phone, X } from "lucide-react";
import { ButtonAnchor } from "@/components/ui/Button";
import { MORE_NAV } from "@/lib/navigation";
import { site, whatsappLink } from "@/lib/site";
import { Address } from "./Address";
import { NAV_ICON } from "./nav-icons";

/**
 * More: every section the header and the tab bar do not show, in two groups,
 * each with an icon and a line saying what it is for, then the three ways to
 * reach a person — so nobody has to guess what a name leads to. One menu and
 * one list on every width: on a phone it opens full screen from the header's
 * icon (`variant="icon"`); from `lg` it opens as a panel at the right, from
 * the "More" pill at the end of the header's links (`variant="pill"`).
 *
 * Closes on navigation, on Escape, on the close button and, on a wide screen,
 * on the dimmed page beside it; locks page scroll while open so the page
 * underneath does not drift; moves focus into the menu, keeps Tab inside it
 * (on a wide screen the page beside it is still visible, but not reachable),
 * and returns focus to the trigger, so it is usable with a screen reader or
 * keyboard.
 *
 * The menu is portalled to <body>. The header it is opened from has a
 * backdrop blur, and a blurred ancestor becomes the box a `fixed` element is
 * placed in — left inside the header, the full-screen sheet was squeezed into
 * the header's 72px and showed as an empty bar.
 */
export function MobileMenu({ variant = "icon" }: { variant?: "icon" | "pill" }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const trigger = useRef<HTMLButtonElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const [lastPath, setLastPath] = useState(pathname);
  // The header renders this twice (pill and icon), so each needs its own id.
  const id = useId();

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
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") return setOpen(false);
      if (e.key !== "Tab" || !panel.current) return;
      // Tab wraps from the last link back to the close button, and Shift+Tab the other way.
      const focusable = panel.current.querySelectorAll<HTMLElement>("a[href], button:not([disabled])");
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) return;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
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
      {variant === "pill" ? (
        <button
          ref={trigger}
          type="button"
          onClick={() => setOpen(true)}
          aria-expanded={open}
          aria-controls={id}
          className="glass hidden min-h-11 items-center gap-2 whitespace-nowrap rounded-full px-4 font-sans text-[0.92rem] font-medium text-text-secondary transition-colors hover:text-text-primary aria-expanded:text-text-primary lg:inline-flex"
        >
          <Menu aria-hidden size={18} strokeWidth={1.75} />
          More
        </button>
      ) : (
        <button
          ref={trigger}
          type="button"
          onClick={() => setOpen(true)}
          aria-expanded={open}
          aria-controls={id}
          aria-label="More"
          className="glass inline-flex size-10 items-center justify-center rounded-full text-text-primary transition-colors hover:text-green-300 sm:size-11 lg:hidden"
        >
          <Menu aria-hidden size={20} strokeWidth={1.75} />
        </button>
      )}

      {open &&
        createPortal(
          <>
            {/* From lg the menu is a panel; the page beside it dims, and a click there closes it. */}
            <div aria-hidden onClick={() => setOpen(false)} className="fixed inset-0 z-50 hidden bg-[#090E0A]/60 backdrop-blur-[2px] lg:block" />
            <div
              ref={panel}
              id={id}
              role="dialog"
              aria-modal="true"
              aria-label="More"
              className="fixed inset-0 z-50 flex flex-col overflow-y-auto bg-surface-0 bg-[radial-gradient(900px_500px_at_80%_-10%,rgb(120_176_48/0.1),transparent_70%)] px-5 pb-8 pt-3 lg:inset-y-0 lg:left-auto lg:right-0 lg:w-[26rem] lg:border-l lg:border-white/[0.06] lg:px-6 lg:shadow-[-40px_0_90px_-30px_rgb(0_0_0/0.9)]"
            >
              <div className="flex h-12 items-center justify-between">
                <span className="kicker">More</span>
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

              <nav className="mt-6 grid gap-6">
                {MORE_NAV.map((group) => (
                  <div key={group.group}>
                    <h2 className="px-3 text-sm font-semibold text-text-muted">{group.group}</h2>
                    <ul className="mt-1 grid gap-1">
                      {group.items.map((item) => {
                        const Icon = NAV_ICON[item.href];
                        const current = pathname.startsWith(item.href);
                        return (
                          <li key={item.href}>
                            <Link
                              href={item.href}
                              onClick={() => setOpen(false)}
                              aria-current={current ? "page" : undefined}
                              className="group flex min-w-0 items-center gap-4 rounded-2xl px-3 py-3.5 transition-colors hover:bg-white/[0.04] aria-[current=page]:bg-white/[0.05]"
                            >
                              <span className="glass inline-flex size-11 shrink-0 items-center justify-center rounded-xl text-green-300">
                                {Icon && <Icon aria-hidden size={20} strokeWidth={1.75} />}
                              </span>
                              <span className="min-w-0">
                                <span className="block text-[1.15rem] font-semibold leading-tight text-text-primary">{item.label}</span>
                                <span className="line-clamp-2 text-sm text-text-muted">{item.hint}</span>
                              </span>
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
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
            </div>
          </>,
          document.body,
        )}
    </>
  );
}
