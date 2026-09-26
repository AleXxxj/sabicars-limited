import Link from "next/link";
import { Logo } from "@/components/Logo";
import { Address } from "@/components/site/Address";
import { INVENTORY_SHORTCUTS, PRIMARY_NAV } from "@/lib/navigation";
import { site, whatsappLink } from "@/lib/site";

function Column({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-sm font-semibold text-text-primary">{title}</p>
      <ul className="mt-5 space-y-3 text-sm">{children}</ul>
    </div>
  );
}

const link = "text-text-secondary transition-colors hover:text-text-primary";

/**
 * Where the facts live: the registered name, the RC number, the showroom, and
 * every way to reach Sabicars — including WhatsApp, once, as one channel among
 * several rather than the only door.
 */
export function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="relative border-t border-white/[0.06] bg-[linear-gradient(180deg,var(--surface-1),var(--surface-0))]">
      <div className="mx-auto grid max-w-7xl gap-12 px-5 py-16 md:grid-cols-2 md:px-10 lg:grid-cols-[1.4fr_1fr_1fr_1.2fr]">
        <div>
          <Logo />
          <p className="mt-6 max-w-xs text-sm leading-relaxed text-text-secondary">
            Toyota Hiace Hummer buses, verified luxury cars, SUVs and trucks from Lagos — with the 40% Drive Plan and fleet supply
            for companies and government.
          </p>
          <a
            href={site.cacSearchUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="group mt-6 inline-flex items-center gap-4 text-xs text-text-muted hover:text-text-primary"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- a vector seal, cached across pages */}
            <img src="/brand/seal-gold.svg" alt="" width={72} height={72} className="size-18 shrink-0" />
            <span className="figures leading-relaxed">
              {site.legalName}
              <br />
              CAC RC {site.rcNumber} — verify it ↗
            </span>
          </a>
        </div>

        <Column title="Inventory">
          {INVENTORY_SHORTCUTS.map((s) => (
            <li key={s.href}>
              <Link href={s.href} className={link}>
                {s.label}
              </Link>
            </li>
          ))}
        </Column>

        <Column title="Sabicars">
          {PRIMARY_NAV.filter((n) => n.href !== "/vehicles").map((n) => (
            <li key={n.href}>
              <Link href={n.href} className={link}>
                {n.label}
              </Link>
            </li>
          ))}
        </Column>

        <Column title="Visit or call">
          <li className="text-text-secondary">
            <Address />
            <a href={site.mapsUrl} target="_blank" rel="noopener noreferrer" className={`mt-2 inline-block ${link}`}>
              Directions →
            </a>
          </li>
          {site.phones.map((p) => (
            <li key={p.e164}>
              <a href={`tel:${p.e164}`} className={`figures ${link}`}>
                {p.display}
              </a>
            </li>
          ))}
          <li>
            <a href={`mailto:${site.email}`} className={link}>
              {site.email}
            </a>
          </li>
          <li className="flex gap-5 pt-1">
            <a href={whatsappLink()} className={link} target="_blank" rel="noopener noreferrer">
              WhatsApp
            </a>
            <a href={site.social.instagram} className={link} target="_blank" rel="noopener noreferrer">
              Instagram
            </a>
          </li>
        </Column>
      </div>

      <div className="border-t border-border-subtle">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-4 text-xs text-text-muted md:px-10">
          <p>
            © {year} {site.legalName}. All rights reserved.
          </p>
          <a href={site.cacSearchUrl} target="_blank" rel="noopener noreferrer" className="hover:text-text-primary">
            Verify RC {site.rcNumber} on the CAC register ↗
          </a>
        </div>
      </div>
    </footer>
  );
}
