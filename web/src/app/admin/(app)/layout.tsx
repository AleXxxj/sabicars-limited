import Link from "next/link";
import { Logo } from "@/components/Logo";
import { NavLink } from "@/components/site/NavLink";
import { can, requireStaff } from "@/lib/auth";
import { orFallback, timed } from "@/lib/deadline";
import { signOut } from "@/lib/actions/auth";
import { adminNavFor, ROLE_LABEL } from "@/lib/admin-nav";
import { waitingChatsCount } from "@/lib/repositories/ask";
import { waitingCount } from "@/lib/repositories/leads";
import { reviewCounts } from "@/lib/repositories/reviews";
import { pendingCommentCount } from "@/lib/repositories/blog";
import { payableCount } from "@/lib/ledger";
import { openIncidentCount } from "@/lib/incidents";

/** What a badge counts, for a screen reader: "3 waiting" on a queue, "3 open" on errors. */
const BADGE_NOUN: Record<string, string> = { "/admin/status": "open" };

/**
 * The staff workspace. Built for a phone first: most listings will be made
 * standing next to the car in the park, not at a desk.
 */
// A slow moment reaching Supabase or the pooler should make a slow page, never a 504: a minute, for every admin page.
export const maxDuration = 60;

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const me = await requireStaff();
  const nav = adminNavFor(me.role);
  // What is waiting for someone, shown on the section it is waiting in. A badge is worth a few seconds, never the
  // page: a count that does not come back in time shows as nothing, and the page opens.
  const badge = (work: Promise<number>) => timed("badge", orFallback(work, 6000, 0));
  const [leadsWaiting, chatsWaiting, reviewsWaiting, commentsWaiting, payoutsReady, errorsOpen] = await Promise.all([
    badge(waitingCount(me.dealerId)),
    // Buyers in a "Chat with seller" room whose message no person has answered yet.
    badge(waitingChatsCount(me.dealerId)),
    me.role === "sales" ? 0 : badge(reviewCounts(me.dealerId).then((c) => c.waiting)),
    me.role === "sales" ? 0 : badge(pendingCommentCount(me.dealerId)),
    // Commissions past their cooling-off, waiting for a manager to pay them.
    can.payPartners(me) ? badge(payableCount(me.dealerId)) : 0,
    // Errors the site has seen and nobody has resolved yet; the status page is the owner's and managers'.
    can.seeMoney(me) ? badge(openIncidentCount()) : 0,
  ]);
  const badges: Record<string, number> = {
    "/admin/leads": leadsWaiting,
    "/admin/conversations": chatsWaiting,
    "/admin/reviews": reviewsWaiting,
    "/admin/blog": commentsWaiting,
    "/admin/payouts": payoutsReady,
    "/admin/status": errorsOpen,
  };

  return (
    <div className="min-h-svh bg-surface-0">
      <header className="sticky top-0 z-40 border-b border-border-subtle bg-surface-0/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-5 md:px-8">
          <div className="flex items-center gap-4">
            <Logo href="/admin" />
            <span className="eyebrow hidden !text-text-muted sm:inline">Admin</span>
          </div>
          <div className="flex items-center gap-5">
            <Link href="/vehicles" className="eyebrow hidden !text-text-secondary hover:!text-text-primary md:inline" target="_blank">
              View site ↗
            </Link>
            <span className="hidden text-right text-xs leading-tight text-text-muted sm:block">
              <span className="block text-text-secondary">{me.fullName ?? me.email}</span>
              {ROLE_LABEL[me.role]}
            </span>
            <form action={signOut}>
              <button type="submit" className="eyebrow min-h-12 !text-text-secondary hover:!text-text-primary">
                Sign out
              </button>
            </form>
          </div>
        </div>
        <nav
          aria-label="Admin"
          className="mx-auto flex max-w-7xl gap-7 overflow-x-auto px-5 pb-2 whitespace-nowrap [scrollbar-width:none] md:px-8 [&::-webkit-scrollbar]:hidden"
        >
          {nav.map((item) => (
            <NavLink key={item.href} href={item.href}>
              {item.label}
              {(badges[item.href] ?? 0) > 0 && (
                <span
                  className={`figures ml-2 inline-flex min-w-5 items-center justify-center rounded-full px-1.5 text-[0.7rem] font-bold text-[#090E0A] ${
                    item.href === "/admin/status" ? "bg-danger" : "bg-green-500"
                  }`}
                >
                  <span className="sr-only">, </span>
                  {badges[item.href]}
                  <span className="sr-only"> {BADGE_NOUN[item.href] ?? "waiting"}</span>
                </span>
              )}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-7xl px-5 py-8 md:px-8 md:py-10">{children}</main>
    </div>
  );
}
