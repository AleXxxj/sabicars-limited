import Link from "next/link";
import { UserRound } from "lucide-react";
import { Logo } from "@/components/Logo";
import { AccountLink } from "@/components/partner/AccountLink";
import { SavedLink } from "@/components/saved/SaveButton";
import { CARS_NAV, MAIN_NAV } from "@/lib/navigation";
import { MobileMenu } from "./MobileMenu";
import { NavLink } from "./NavLink";
import { NotificationBell } from "./NotificationBell";

/**
 * The name and the sections. No phone strip, no row of WhatsApp buttons: the
 * header says where you are and where you can go. On a wide screen that is
 * the cars for sale, the same three sections as the phone's tab bar, then
 * More. On a phone the sections live in the bottom tab bar and More.
 *
 * Log in is on every page, so a Refer & Earn partner can always get back to
 * their own page (/partner); once they have opened it on a phone, that phone
 * shows Account instead, straight to the page. The call button that sat here on phones was
 * taken off at the owner's call (2026-11-06): calling lives on each car's
 * page, on Contact and in the footer, where a buyer is ready to call.
 */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-[#090E0A]/70 backdrop-blur-xl">
      {/* Phone widths are tight: logo, bell, Log in and the menu must fit a 360px screen, so the gaps shrink and the
          logo steps down a size below 390px. Below 340px (a 320px phone, a narrow split window) they did not fit at
          all, and the menu button hung off the screen's edge, taking the whole page sideways with it (found 14
          November 2026): there the side padding, the gap and the logo step down once more. The heart joins them from
          480px; below that it lives in More. */}
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-2 px-3 min-[340px]:gap-3 min-[340px]:px-5 md:h-[4.5rem] md:gap-6 md:px-10">
        <Logo className="h-[18px] min-[340px]:h-[22px] min-[390px]:h-7 md:h-8" />
        <nav aria-label="Main" className="hidden items-center gap-6 lg:flex 2xl:gap-8">
          {/* The cars for sale lead the sections as a plain link, not an orange button: on the homepage the hero's Buy door
              is that button, and two of them side by side said the same thing twice (the owner, 14 November 2026). It
              stays in the header because every other page has no Buy door. */}
          <NavLink href={CARS_NAV.href} hint={CARS_NAV.hint}>
            {CARS_NAV.label}
          </NavLink>
          {MAIN_NAV.map((item) => (
            <NavLink key={item.href} href={item.href} hint={item.hint}>
              {item.label}
            </NavLink>
          ))}
          <MobileMenu variant="pill" />
        </nav>
        <div className="flex items-center gap-1.5 sm:gap-2">
          <NotificationBell />
          {/* On narrow phones the shortlist lives in More, so the header never overflows. */}
          <SavedLink className="!size-10 max-[479px]:!hidden sm:!size-11" />
          {/* Log in, or Account on a phone a partner has logged in on: one of the two shows, chosen before the first paint. */}
          {/* The only account on the site is a partner's, so the button says so where there is room; on a phone the
              short word fits, and the name read out is the full one (audit, 8 November 2026: a buyer took it for a buyer account). */}
          <Link
            href="/partner"
            prefetch={false}
            data-signed="out"
            aria-label="Partner log in"
            className="glass inline-flex h-10 items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 text-[0.9rem] font-semibold text-text-primary transition-colors hover:text-green-300 min-[420px]:pl-3 sm:h-11 sm:pl-3.5 sm:pr-4"
          >
            <UserRound aria-hidden size={17} strokeWidth={1.9} className="hidden shrink-0 min-[420px]:block" />
            <span className="md:hidden">Log in</span>
            <span className="hidden md:inline">Partner log in</span>
          </Link>
          <AccountLink />
          <MobileMenu />
        </div>
      </div>
    </header>
  );
}
