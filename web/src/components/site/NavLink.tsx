"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** A header link that knows when it is the current section. Sentence case, readable at a glance. */
export function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const active = !href.includes("#") && (pathname === href || pathname.startsWith(`${href}/`));
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`relative py-2 font-sans text-[0.92rem] font-medium transition-colors duration-[var(--duration-fast)] after:absolute after:inset-x-0 after:-bottom-0.5 after:h-px after:origin-left after:bg-gold-500 after:transition-transform after:duration-[var(--duration-base)] after:ease-[var(--ease-out)] ${
        active ? "text-text-primary after:scale-x-100" : "text-text-secondary after:scale-x-0 hover:text-text-primary hover:after:scale-x-100"
      }`}
    >
      {children}
    </Link>
  );
}
