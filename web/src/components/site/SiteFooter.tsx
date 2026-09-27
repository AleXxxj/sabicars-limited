import Link from "next/link";
import { Logo } from "@/components/Logo";
import { Address } from "@/components/site/Address";
import { SubscribeForm } from "@/components/subscribe/SubscribeForm";
import { INVENTORY_SHORTCUTS, PRIMARY_NAV } from "@/lib/navigation";
import { searchTerms } from "@/lib/repositories/vehicles";
import { termHref } from "@/lib/seo/search-terms";
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
export async function SiteFooter() {
  const year = new Date().getFullYear();
  // The models people search for most that are in stock now: a link to each from every page.
  const popular = (await searchTerms()).filter((t) => t.family && t.inStock > 0).slice(0, 12);
  return (
    <footer className="relative border-t border-white/[0.06] bg-[linear-gradient(180deg,var(--surface-1),var(--surface-0))]">
      <section aria-labelledby="newsletter-title" className="border-b border-white/[0.06]">
        <div className="mx-auto grid max-w-7xl gap-6 px-5 py-12 md:px-10 lg:grid-cols-[1fr_minmax(0,28rem)] lg:items-center lg:gap-16">
          <div>
            <p id="newsletter-title" className="font-display text-[1.9rem] leading-tight text-text-primary md:text-[2.2rem]">
              The week&rsquo;s new arrivals, every Friday.
            </p>
            <p className="mt-2 text-text-secondary">Photographed, priced and ready to inspect — before they are gone. Nothing else.</p>
          </div>
          <SubscribeForm source="footer" />
        </div>
      </section>
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
          <li>
            <Link href="/compare" className={link}>
              Compare cars
            </Link>
          </li>
          <li>
            <Link href="/ask" className={link}>
              Ask Sabicars
            </Link>
          </li>
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

      {popular.length > 0 && (
        <nav aria-label="Popular searches" className="mx-auto max-w-7xl px-5 pb-10 md:px-10">
          <p className="text-sm font-semibold text-text-primary">Popular searches</p>
          <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm">
            {popular.map((t) => (
              <li key={t.slug}>
                <Link href={termHref(t.slug)} className={link}>
                  {t.label} for sale in Lagos
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}

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
