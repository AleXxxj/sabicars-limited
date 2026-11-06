import Link from "next/link";
import { UserRound } from "lucide-react";

/**
 * The header's Account, shown instead of Log in on a phone where a partner is
 * logged in (the CSS in globals.css picks one before the first paint, from
 * lib/partner-flag.ts). Both lead to /partner, which shows the partner's page
 * to its owner and the log-in to anyone else. Not prefetched: /partner is
 * personal, and a prefetch on every page would cost a server call each time.
 */
export function AccountLink() {
  return (
    <Link
      href="/partner"
      prefetch={false}
      data-signed="in"
      className="glass inline-flex size-10 items-center justify-center gap-2 rounded-full text-green-300 transition-colors hover:text-green-200 sm:h-11 sm:w-auto sm:pl-3.5 sm:pr-4"
    >
      <UserRound aria-hidden size={18} strokeWidth={2} className="shrink-0" />
      <span className="sr-only text-[0.9rem] font-semibold text-text-primary sm:not-sr-only">Account</span>
    </Link>
  );
}
