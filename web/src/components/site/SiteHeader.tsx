import { Phone } from "lucide-react";
import { Logo } from "@/components/Logo";
import { SavedLink } from "@/components/saved/SaveButton";
import { ButtonLink } from "@/components/ui/Button";
import { PRIMARY_NAV } from "@/lib/navigation";
import { site } from "@/lib/site";
import { MobileMenu } from "./MobileMenu";
import { NavLink } from "./NavLink";
import { NotificationBell } from "./NotificationBell";

/**
 * The name, the sections, one action. No phone strip, no row of WhatsApp
 * buttons: the header says where you are and where you can go. On a phone
 * the sections live in the bottom tab bar and the menu; the header keeps a
 * single call button, because calling is how many buyers still start.
 */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-[#0A0908]/70 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-6 px-5 md:h-[4.5rem] md:px-10">
        <Logo />
        <nav aria-label="Main" className="hidden items-center gap-6 xl:flex 2xl:gap-8">
          {PRIMARY_NAV.map((item) => (
            <NavLink key={item.href} href={item.href}>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <NotificationBell />
          {/* On the narrowest phones the shortlist lives in the menu, so the header never overflows. */}
          <SavedLink className="!size-10 max-[419px]:!hidden sm:!size-11" />
          <ButtonLink href="/vehicles" className="!hidden !min-h-11 !px-5 !text-[0.9rem] xl:!inline-flex">
            Browse cars
          </ButtonLink>
          <a
            href={`tel:${site.phones[0].e164}`}
            aria-label={`Call Sabicars on ${site.phones[0].display}`}
            className="glass inline-flex size-10 items-center justify-center rounded-full text-text-primary transition-colors hover:text-gold-300 sm:size-11 xl:hidden"
          >
            <Phone aria-hidden size={19} strokeWidth={1.75} />
          </a>
          <MobileMenu />
        </div>
      </div>
    </header>
  );
}
