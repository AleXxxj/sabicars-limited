import { VehicleImage } from "@/components/VehicleImage";

/**
 * How every inner page opens: a label, a statement, one paragraph. With a
 * photograph it takes the dark photographic treatment (in both themes, like the
 * homepage hero); without one it sits on the page.
 */
export function PageIntro({
  eyebrow,
  title,
  children,
  imageUrl,
}: {
  eyebrow: string;
  title: string;
  children?: React.ReactNode;
  imageUrl?: string | null;
}) {
  if (imageUrl) {
    return (
      <section className="relative isolate overflow-hidden bg-[#0B0A09]">
        <VehicleImage src={imageUrl} alt="" fill priority sizes="100vw" className="-z-20 object-cover opacity-55" />
        <div aria-hidden className="absolute inset-0 -z-10" style={{ background: "var(--hero-scrim)" }} />
        <div className="mx-auto max-w-7xl px-5 pb-16 pt-20 md:px-10 md:pb-24 md:pt-32">
          <p className="kicker">{eyebrow}</p>
          <h1 className="mt-5 max-w-4xl text-display-1 text-[var(--hero-text)]">{title}</h1>
          {children && <div className="mt-6 max-w-2xl text-lg leading-relaxed text-[var(--hero-text-secondary)]">{children}</div>}
        </div>
      </section>
    );
  }
  return (
    <section className="border-b border-border-subtle">
      <div className="mx-auto max-w-7xl px-5 pb-14 pt-16 md:px-10 md:pb-20 md:pt-24">
        <p className="kicker">{eyebrow}</p>
        <h1 className="mt-5 max-w-4xl text-display-1">{title}</h1>
        {children && <div className="mt-6 max-w-2xl text-lg leading-relaxed text-text-secondary">{children}</div>}
      </div>
    </section>
  );
}
