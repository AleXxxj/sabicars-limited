import { Logo } from "@/components/Logo";
import { PRIMARY_NAV } from "@/lib/navigation";
import { MobileMenu } from "./MobileMenu";
import { NavLink } from "./NavLink";

/**
 * The name, the sections, and nothing else. No phone strip, no row of
 * WhatsApp buttons: the header's job is to say where you are and where you can
 * go. Contact details live in the footer and on the contact page.
 */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border-subtle bg-surface-0/85 backdrop-blur-md supports-[backdrop-filter]:bg-surface-0/70">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-6 px-5 md:h-20 md:px-10">
        <Logo />
        <nav aria-label="Main" className="hidden items-center gap-9 lg:flex">
          {PRIMARY_NAV.map((item) => (
            <NavLink key={item.href} href={item.href}>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <MobileMenu />
      </div>
    </header>
  );
}
