"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { HandCoins, X } from "lucide-react";

/** The cookie names lib/partners.ts sets on /r/CODE (kept here as plain strings: that module is server-only). */
const NAME = "sc_ref";
const WELCOME = "sc_ref_new";

const noSubscription = () => () => {};

/**
 * Who sent this visitor, read once per page load and kept: the welcome flag is
 * cleared as soon as it is shown, and a later redraw must not make the welcome
 * vanish early because the flag is gone.
 */
let arrival: string | null | undefined;
function arrivalSnapshot(): string | null {
  if (arrival === undefined) {
    const all = document.cookie;
    arrival = cookieValue(all, WELCOME) === "1" ? cookieValue(all, NAME) : null;
  }
  return arrival;
}

function cookieValue(all: string, name: string): string | null {
  const hit = all.split("; ").find((c) => c.startsWith(`${name}=`));
  if (!hit) return null;
  try {
    return decodeURIComponent(hit.slice(name.length + 1));
  } catch {
    return null;
  }
}

/**
 * The welcome a buyer sees when they arrive through a partner's link: who sent
 * them, and that their price does not change because of it, the fear every
 * Lagos buyer has of an agent's cut. It floats over the top of the page, so it
 * never moves anything (the car page's first screen is fitted to the pixel),
 * shows once per arrival, and goes away by itself.
 */
export function ReferralWelcome() {
  const name = useSyncExternalStore(noSubscription, arrivalSnapshot, () => null);
  const [closed, setClosed] = useState(false);
  const show = !closed && Boolean(name);

  useEffect(() => {
    if (!show) return;
    // Once per arrival: the flag goes now, so the next page or the next visit does not welcome again.
    document.cookie = `${WELCOME}=; Max-Age=0; Path=/; SameSite=Lax`;
    const timer = window.setTimeout(() => setClosed(true), 9000);
    return () => window.clearTimeout(timer);
  }, [show]);

  if (!show) return null;
  return (
    <div role="status" className="pointer-events-none fixed inset-x-3 top-[calc(4rem+10px)] z-40 flex justify-center md:top-[calc(4.5rem+12px)]">
      {/* Solid, not glass: it sits over the hero's words and a car's title, and must read on its own. */}
      <div className="pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-2xl border border-green-500/30 bg-surface-1 px-4 py-3 shadow-[0_24px_60px_-20px_rgb(0_0_0/0.9)]">
        <HandCoins aria-hidden size={20} className="mt-0.5 shrink-0 text-green-300" />
        <p className="min-w-0 flex-1 text-sm leading-snug text-text-primary">
          <span className="font-semibold">{name} sent you here.</span>
          <br />
          <span className="text-text-secondary">Your price stays the same.</span>
        </p>
        <button
          type="button"
          onClick={() => setClosed(true)}
          aria-label="Close"
          className="-mr-1 -mt-1 inline-flex size-9 shrink-0 items-center justify-center rounded-full text-text-secondary hover:text-text-primary"
        >
          <X aria-hidden size={17} />
        </button>
      </div>
    </div>
  );
}
