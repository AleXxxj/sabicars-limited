import Link from "next/link";
import { Fragment } from "react";
import { Logo } from "@/components/Logo";
import { SubscribeForm } from "@/components/subscribe/SubscribeForm";
import { CARS_NAV, MAIN_NAV, MORE_ITEMS } from "@/lib/navigation";
import { searchTerms } from "@/lib/repositories/vehicles";
import { termHref } from "@/lib/seo/search-terms";
import { site, whatsappLink } from "@/lib/site";

const link = "text-text-secondary transition-colors hover:text-text-primary";
// Sized so the three fit one row on a 310px phone.
const chip =
  "inline-flex min-h-11 items-center rounded-full border border-border-default px-3 text-[0.85rem] font-semibold text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary sm:px-4 sm:text-sm";
const small = "inline-flex min-h-11 items-center transition-colors hover:text-text-primary";

/**
 * The footer, short (the owner, 14 November 2026: "summarise the footer page, is to busy and ambigious"). It was 2,400px
 * on a phone with 43 links; now it is the Friday email, who Sabicars is in one line, the three places to message or
 * follow it, and the facts every page carries: the registered name and RC number, the address in one line, the numbers
 * to call, the privacy notice.
 *
 * The list of sections and the popular searches show on a wide screen only, as on the Adedayo site: on a phone the tab
 * bar and More already hold every section. The searches are still in every page's HTML on a phone too (hidden by CSS,
 * not left out), so a search engine reading the phone version finds and follows the same twelve links; the model pages
 * are also in the sitemap. The hours, the email and the way to the park are in the homepage's "Visit or call" and on
 * Contact.
 */
export async function SiteFooter() {
  const year = new Date().getFullYear();
  // The models people search for most that are in stock now: a link to each from every page. Twelve, as before the
  // footer was shortened, so search engines find as many model pages from every page as they did (Alex asked, 14 November).
  const popular = (await searchTerms()).filter((t) => t.family && t.inStock > 0).slice(0, 12);
  return (
    <footer className="relative border-t border-white/[0.06] bg-[linear-gradient(180deg,var(--surface-1),var(--surface-0))]">
      <section aria-labelledby="newsletter-title" className="border-b border-white/[0.06]">
        <div className="mx-auto grid max-w-7xl gap-5 px-5 py-10 md:px-10 md:py-12 lg:grid-cols-[1fr_minmax(0,28rem)] lg:items-center lg:gap-16">
          <div>
            <p id="newsletter-title" className="font-display text-[1.6rem] leading-tight text-text-primary md:text-[2.2rem]">
              New cars every Friday, in your inbox.
            </p>
            <p className="mt-2 text-text-secondary">With photos and prices, before they go. Nothing else.</p>
          </div>
          <SubscribeForm source="footer" />
        </div>
      </section>

      <div className="mx-auto grid max-w-7xl gap-10 px-5 py-10 md:px-10 md:py-14 lg:grid-cols-[1.1fr_1fr_1.4fr] lg:gap-14">
        <div>
          <Logo />
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-text-secondary">Cars, SUVs, Hummer buses and trucks in Lagos.</p>
          {/* WhatsApp once, as one way in among several, never the only door. */}
          <ul aria-label="Message or follow Sabicars" className="mt-5 flex flex-wrap gap-2">
            <li>
              <a href={whatsappLink()} target="_blank" rel="noopener noreferrer" className={chip}>
                WhatsApp
              </a>
            </li>
            <li>
              <a href={site.social.instagram} target="_blank" rel="noopener noreferrer" className={chip}>
                Instagram
              </a>
            </li>
            <li>
              <a href={site.social.tiktok} target="_blank" rel="noopener noreferrer" className={chip}>
                TikTok
              </a>
            </li>
          </ul>
        </div>

        {/* Every section, under the names the header, the tab bar and More use. */}
        <nav aria-label="Sections" className="hidden lg:block">
          <p className="text-sm font-semibold text-text-primary">Quick links</p>
          <ul className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2.5 text-sm">
            {[CARS_NAV, ...MAIN_NAV, ...MORE_ITEMS].map((n) => (
              <li key={n.href}>
                <Link href={n.href} className={link}>
                  {n.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {popular.length > 0 && (
          <nav aria-label="Popular searches" className="hidden lg:block">
            <p className="text-sm font-semibold text-text-primary">Popular cars for sale in Lagos</p>
            <ul className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2.5 text-sm">
              {popular.map((t) => (
                <li key={t.slug}>
                  <Link href={termHref(t.slug)} className={link}>
                    {t.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        )}
      </div>

      {/* The facts every page carries, once each: who runs the site and how to check it, where it is, how to call. */}
      <div className="border-t border-border-subtle">
        <div className="mx-auto grid max-w-7xl gap-3 px-5 py-6 text-xs leading-relaxed text-text-muted md:px-10 lg:grid-cols-[auto_1fr] lg:items-center lg:gap-x-10">
          <a href={site.cacSearchUrl} target="_blank" rel="noopener noreferrer" className="group inline-flex items-center gap-3 hover:text-text-primary">
            {/* eslint-disable-next-line @next/next/no-img-element -- a vector seal, cached across pages */}
            <img src="/brand/seal.svg" alt="" width={44} height={44} className="size-11 shrink-0" />
            {/* No-break spaces keep "RC 1560100" whole on a narrow phone. */}
            <span className="figures">
              © {year} {site.legalName} · CAC RC{" "}{site.rcNumber} · <span className="underline underline-offset-2">Check it</span>{" "}↗
            </span>
          </a>
          <div className="flex flex-col gap-y-1 lg:flex-row lg:flex-wrap lg:items-center lg:justify-end lg:gap-x-6">
            <span>
              {site.address.line1}, {site.address.area}, {site.address.city}
            </span>
            <span className="figures">
              Call{" "}
              {site.phones.map((p, i) => (
                <Fragment key={p.e164}>
                  {i > 0 && " or "}
                  <a href={`tel:${p.e164}`} className="inline-flex min-h-11 items-center hover:text-text-primary">
                    {p.display}
                  </a>
                </Fragment>
              ))}
            </span>
            <span className="flex gap-x-5">
              {/* On a wide screen Contact is in Quick links already. */}
              <Link href="/contact" className={`${small} lg:hidden`}>
                Contact
              </Link>
              <Link href="/privacy" className={small}>
                Privacy notice
              </Link>
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
