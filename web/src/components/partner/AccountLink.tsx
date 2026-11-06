"use client";

import { useSyncExternalStore } from "react";
import { UserRound } from "lucide-react";
import { parseRemembered, partnerPageHref, rememberedRaw, subscribeRemembered } from "@/lib/partner-device";

/**
 * The header's Account, shown instead of Log in on a phone that has a partner
 * page remembered (the CSS in globals.css picks one before the first paint).
 * A plain link, so the partner page opens with a full page load: its address
 * carries the page's private key (lib/partner-device.ts, partnerPageHref).
 * Before this script runs it points at /partner, which forwards the same way.
 */
export function AccountLink() {
  const raw = useSyncExternalStore(subscribeRemembered, rememberedRaw, () => null);
  const remembered = parseRemembered(raw);
  return (
    <a
      href={remembered ? partnerPageHref(remembered.token) : "/partner"}
      data-signed="in"
      className="glass inline-flex size-10 items-center justify-center gap-2 rounded-full text-green-300 transition-colors hover:text-green-200 sm:h-11 sm:w-auto sm:pl-3.5 sm:pr-4"
    >
      <UserRound aria-hidden size={18} strokeWidth={2} className="shrink-0" />
      <span className="sr-only text-[0.9rem] font-semibold text-text-primary sm:not-sr-only">Account</span>
    </a>
  );
}
