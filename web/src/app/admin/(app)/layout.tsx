import Link from "next/link";
import { Logo } from "@/components/Logo";
import { NavLink } from "@/components/site/NavLink";
import { requireStaff } from "@/lib/auth";
import { signOut } from "@/lib/actions/auth";
import { adminNavFor, ROLE_LABEL } from "@/lib/admin-nav";
import { waitingCount } from "@/lib/repositories/leads";

/**
 * The staff workspace. Built for a phone first: most listings will be made
 * standing next to the car in the park, not at a desk.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const me = await requireStaff();
  const nav = adminNavFor(me.role);
  const waiting = await waitingCount(me.dealerId);

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
              {item.href === "/admin/leads" && waiting > 0 && (
                <span className="figures ml-2 inline-flex min-w-5 items-center justify-center rounded-full bg-gold-500 px-1.5 text-[0.7rem] font-bold text-[#0A0908]">
                  <span className="sr-only">, </span>
                  {waiting}
                  <span className="sr-only"> waiting</span>
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
