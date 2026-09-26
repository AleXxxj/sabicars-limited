"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { TAB_BAR } from "@/lib/navigation";
import { NAV_ICON } from "./nav-icons";

/**
 * The phone's bottom bar — the way every app the audience already uses is
 * navigated. Five destinations, labelled and one thumb away, instead of a
 * menu to open and read. Hidden on wide screens, where the header carries
 * the full navigation.
 */
export function MobileTabBar() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Quick"
      className="glass fixed inset-x-0 bottom-0 z-40 border-x-0 border-b-0 pb-[env(safe-area-inset-bottom)] xl:hidden"
    >
      <ul className="mx-auto grid max-w-lg grid-cols-5">
        {TAB_BAR.map((item) => {
          const Icon = NAV_ICON[item.href];
          const active = item.href === "/" ? pathname === "/" : !item.href.includes("#") && pathname.startsWith(item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className="flex h-16 flex-col items-center justify-center gap-1 text-[0.68rem] font-medium text-text-muted transition-colors aria-[current=page]:text-gold-300"
              >
                {Icon && <Icon aria-hidden size={22} strokeWidth={1.75} />}
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
