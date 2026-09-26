import type { Metadata } from "next";
import { ScrollReveal } from "@/components/ScrollReveal";
import { ContactForm } from "@/components/forms/ContactForm";
import { Address } from "@/components/site/Address";
import { PageIntro } from "@/components/site/PageIntro";
import { site, whatsappLink } from "@/lib/site";

export const metadata: Metadata = {
  title: "Contact Sabicars — showroom, phone and hours",
  description:
    "Visit the Sabicars showroom at Amazing Grace Shopping Complex, Km 16, Lasu Road, Igando, Lagos — or call 0810 188 5558. Open every day.",
  alternates: { canonical: "/contact" },
};

function Channel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-surface-1 p-6 md:p-8">
      <p className="eyebrow !text-text-muted">{title}</p>
      <div className="mt-4 text-text-secondary">{children}</div>
    </div>
  );
}

/**
 * Every way to reach Sabicars, with WhatsApp as one of them rather than the
 * only one — and a form that records the message with a reference, so a
 * conversation is never lost in one person's phone.
 */
export default function ContactPage() {
  return (
    <>
      <PageIntro eyebrow="Contact" title="Talk to Sabicars.">
        <p>Walk in, call, or send a message. Every message is recorded with a reference, so nothing is lost between conversations.</p>
      </PageIntro>

      <section className="mx-auto max-w-7xl px-5 py-16 md:px-10 md:py-20">
        <div className="grid gap-px bg-border-subtle lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
          <div className="grid content-start gap-px bg-border-subtle sm:grid-cols-2 lg:grid-cols-1">
            <Channel title="Visit">
              <Address />
              <a href={site.mapsUrl} target="_blank" rel="noopener noreferrer" className="eyebrow mt-4 inline-block">
                Get directions →
              </a>
            </Channel>
            <Channel title="Opening hours">
              <ul className="space-y-3">
                {site.hours.map((h) => (
                  <li key={h.days}>
                    <span className="block text-text-primary">{h.days}</span>
                    <span className="figures text-sm">{h.time}</span>
                  </li>
                ))}
              </ul>
            </Channel>
          </div>
          {/* Satellite view, as on the legacy page: it shows the plaza itself, which is what a first-time visitor is looking for. */}
          <div className="relative min-h-80 bg-surface-2 md:min-h-[28rem]">
            <iframe
              src={site.mapEmbedUrl}
              title="Map showing the Sabicars showroom at Amazing Grace Shopping Complex, Igando, Lagos"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              allowFullScreen
              className="absolute inset-0 size-full border-0"
            />
          </div>
        </div>
        <div className="mt-px grid gap-px bg-border-subtle sm:grid-cols-2">
          <Channel title="Call">
            <ul className="space-y-2">
              {site.phones.map((p) => (
                <li key={p.e164}>
                  <a href={`tel:${p.e164}`} className="figures text-lg text-text-primary hover:text-accent-text">
                    {p.display}
                  </a>
                </li>
              ))}
            </ul>
          </Channel>
          <Channel title="Write">
            <a href={`mailto:${site.email}`} className="block text-text-primary hover:text-accent-text">
              {site.email}
            </a>
            <a href={whatsappLink()} target="_blank" rel="noopener noreferrer" className="mt-3 block hover:text-text-primary">
              WhatsApp <span className="figures">{site.whatsapp.display}</span>
            </a>
            <a href={site.social.instagram} target="_blank" rel="noopener noreferrer" className="mt-3 block hover:text-text-primary">
              Instagram @sabicarsltd
            </a>
          </Channel>
        </div>
      </section>

      <section className="border-t border-border-subtle">
        <div className="mx-auto grid max-w-7xl gap-12 px-5 py-20 md:px-10 md:py-24 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
          <ScrollReveal>
            <p className="eyebrow">Send a message</p>
            <h2 className="mt-4 text-display-2">How can we help?</h2>
            <p className="mt-5 text-lg leading-relaxed text-text-secondary">
              Asking about a particular vehicle? You will get a faster answer from the enquiry form on its page — it tells us exactly
              which one you mean.
            </p>
            <p className="mt-8 text-sm text-text-muted">
              {site.legalName} · CAC RC {site.rcNumber} ·{" "}
              <a href={site.cacSearchUrl} target="_blank" rel="noopener noreferrer" className="underline-offset-4 hover:text-text-primary hover:underline">
                verify on the CAC register
              </a>
            </p>
          </ScrollReveal>
          <ContactForm whatsappBase={whatsappLink()} />
        </div>
      </section>
    </>
  );
}
