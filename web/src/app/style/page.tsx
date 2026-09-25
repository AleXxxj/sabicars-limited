import type { Metadata } from "next";
import { connection } from "next/server";
import palette from "@/styles/palette.json";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button, ButtonLink } from "@/components/ui/Button";
import { VehicleCard } from "@/components/VehicleCard";
import { featuredVehicles, heroVehicles } from "@/lib/repositories/vehicles";
import { VehicleImage } from "@/components/VehicleImage";
import { vehicleTitle } from "@/lib/vehicle";

/**
 * The design system, rendered with live inventory.
 *
 * A reference for anyone building a page, and the place the look is approved
 * before it is used everywhere. Not for the public: excluded from search.
 */
export const metadata: Metadata = { title: "Design system", robots: { index: false, follow: false } };

function Section({ label, title, children }: { label: string; title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-border-subtle py-20">
      <div className="mx-auto max-w-7xl px-5 md:px-10">
        <p className="eyebrow">{label}</p>
        <h2 className="mt-3 text-display-3">{title}</h2>
        <div className="mt-12">{children}</div>
      </div>
    </section>
  );
}

function Swatch({ name, hex, dark }: { name: string; hex: string; dark?: boolean }) {
  return (
    <div>
      <div className="aspect-[4/3] border border-border-subtle" style={{ background: hex }} />
      <p className={`mt-2 text-xs ${dark ? "text-text-primary" : "text-text-secondary"}`}>{name}</p>
      <p className="figures text-xs text-text-muted">{hex}</p>
    </div>
  );
}

export default async function StylePage() {
  await connection(); // live data on every request, never baked in at build
  const [hero] = await heroVehicles(1);
  const cards = await featuredVehicles(3);
  const gold = Object.entries(palette.gold).filter(([k]) => !k.startsWith("$"));
  const surfaces = Object.entries(palette.darkSurface).filter(([k]) => !k.startsWith("$"));

  return (
    <main>
      <header className="sticky top-0 z-20 border-b border-border-subtle bg-surface-0/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-5 py-3 md:px-10">
          <Logo href="/style" />
          <div className="flex items-center gap-6">
            <span className="eyebrow hidden sm:inline">Design system · v1</span>
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Hero — always the dark photographic treatment, whatever the theme. */}
      <section className="relative isolate flex min-h-[88svh] items-end overflow-hidden bg-[#0B0A09]">
        {hero?.cover && (
          <VehicleImage
            src={hero.cover.url}
            alt={vehicleTitle(hero)}
            fill
            priority
            sizes="100vw"
            className="-z-20 object-cover"
          />
        )}
        <div aria-hidden className="absolute inset-0 -z-10" style={{ background: "var(--hero-scrim)" }} />
        <div aria-hidden className="absolute inset-0 -z-10" style={{ background: "var(--hero-scrim-bottom)" }} />
        <div className="mx-auto w-full max-w-7xl px-5 pb-16 pt-32 md:px-10 md:pb-24">
          <p className="eyebrow !text-gold-300">Sabicars Limited · Lagos · RC 1560100</p>
          <h1 className="mt-6 max-w-4xl text-display-1 text-[var(--hero-text)]">
            Every car verified. <em className="text-gold-300">Every deal</em> on record.
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-[var(--hero-text-secondary)]">
            Luxury cars, Toyota Hiace buses and trucks — inspected, documented and ready. Reserve online, or drive today on the
            40% Drive Plan.
          </p>
          <div className="mt-10 flex flex-wrap gap-4">
            <Button size="lg" className="!bg-gold-500 !text-[#0B0A09] hover:!bg-gold-400">View inventory</Button>
            <Button size="lg" variant="secondary" className="!border-white/40 !text-white hover:!border-white">
              How the Drive Plan works
            </Button>
          </div>
          {hero && <p className="mt-12 text-xs text-[var(--hero-text-secondary)]">Pictured: {vehicleTitle(hero)}, in stock.</p>}
        </div>
      </section>

      <Section label="Colour" title="Black, gold, and nothing that fights them">
        <p className="max-w-2xl text-text-secondary">
          Gold 500 is the existing Sabicars gold, kept exact. On dark it carries the one action that matters on a screen; on light it
          becomes a rule or an icon, because gold text on white cannot be read at body size. Every pairing here is checked against
          WCAG contrast at build time — 56 checks, and the build fails if one does.
        </p>
        <div className="mt-10 grid grid-cols-5 gap-4 md:grid-cols-10">
          {gold.map(([k, hex]) => (
            <Swatch key={k} name={`gold ${k}`} hex={hex} dark={k === "500"} />
          ))}
        </div>
        <p className="eyebrow mt-14 !text-text-muted">Surface ladder — each step measurably lifts off the last</p>
        <div className="mt-4 grid grid-cols-5 gap-4 md:w-1/2">
          {surfaces.map(([k, hex]) => (
            <Swatch key={k} name={`surface ${k}`} hex={hex} />
          ))}
        </div>
      </Section>

      <Section label="Type" title="Two voices, each with one job">
        <div className="grid gap-16 lg:grid-cols-[1fr_20rem]">
          <div className="space-y-8">
            <p className="font-display text-display-1">Unmatched.</p>
            <p className="font-display text-display-2">The Hiace, done properly.</p>
            <p className="font-display text-display-3">Inspected, documented, delivered.</p>
            <p className="max-w-2xl text-lg leading-relaxed text-text-secondary">
              Body copy is Archivo — set for reading on a phone, with generous leading so a paragraph about financing terms does not
              feel like a contract. Headlines are Cormorant Garamond, the same face as the Sabicars wordmark.
            </p>
          </div>
          <div className="space-y-6 border-l border-border-subtle pl-8">
            <div>
              <p className="eyebrow">Label voice</p>
              <p className="mt-2 text-sm text-text-muted">Archivo at 125% width, tracked wide. How marques sign their names.</p>
            </div>
            <div>
              <p className="figures text-3xl font-semibold">₦38,000,000</p>
              <p className="mt-1 text-sm text-text-muted">Figures are tabular, so prices align in a column.</p>
            </div>
          </div>
        </div>
      </Section>

      <Section label="Actions" title="One primary action per screen">
        <div className="flex flex-wrap items-center gap-4">
          <Button>Reserve this vehicle</Button>
          <Button variant="secondary">Book a viewing</Button>
          <ButtonLink href="/style" variant="quiet">
            Read the Drive Plan terms
          </ButtonLink>
        </div>
      </Section>

      <Section label="Inventory" title="Live from the new database">
        <p className="max-w-2xl text-text-secondary">
          These are real Sabicars vehicles, imported from the current site. No card has a WhatsApp button: the whole card opens the
          vehicle, where every enquiry, viewing and reservation is recorded.
        </p>
        <div className="mt-10 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {cards.map((v, i) => (
            <VehicleCard key={v.id} vehicle={v} priority={i === 0} />
          ))}
        </div>
        {cards[0] && (
          <>
            <p className="eyebrow mt-16 !text-text-muted">When photos are not yet uploaded</p>
            <div className="mt-4 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              <VehicleCard vehicle={{ ...cards[0], cover: null }} />
            </div>
          </>
        )}
      </Section>

      <Section label="Forms" title="Asking for as little as possible">
        <form className="grid max-w-xl gap-6">
          <label className="grid gap-2">
            <span className="eyebrow !text-text-secondary">Your name</span>
            <input className="min-h-12 border border-border-strong bg-surface-1 px-4 text-text-primary outline-none transition-colors focus:border-gold-500" placeholder="Adaeze Okafor" />
          </label>
          <label className="grid gap-2">
            <span className="eyebrow !text-text-secondary">Phone or WhatsApp number</span>
            <input inputMode="tel" className="figures min-h-12 border border-border-strong bg-surface-1 px-4 text-text-primary outline-none transition-colors focus:border-gold-500" placeholder="0803 000 0000" />
          </label>
          <div>
            <Button type="button">Request a call back</Button>
          </div>
        </form>
      </Section>

      <footer className="border-t border-border-subtle py-10">
        <div className="mx-auto max-w-7xl px-5 text-xs text-text-muted md:px-10">
          Sabicars Limited · RC 1560100 · Design system reference — not indexed.
        </div>
      </footer>
    </main>
  );
}
