import type { Metadata } from "next";
import { PartnerLogInForm, SignedInMark } from "@/components/partner/PartnerLogIn";
import { ShareCars, type ShareCarView } from "@/components/partner/ShareCars";
import { PageIntro } from "@/components/site/PageIntro";
import { ButtonLink } from "@/components/ui/Button";
import { formatNaira } from "@/lib/money";
import { currentPartner } from "@/lib/partner-session";
import { commissionMinor } from "@/lib/referral";
import { shareCatalogue } from "@/lib/repositories/vehicles";
import { carShareLink, drivePlanLine, shareCaption, statusWords } from "@/lib/share-caption";
import { helpPhone, siteUrl } from "@/lib/site";

/** Personal: every link on it carries the partner's code. Never cached, never indexed. */
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Cars to share", robots: { index: false, follow: false } };

/**
 * Every car on sale, for a logged-in partner to share: a link that shows the
 * car's photo in WhatsApp and keeps their code, the photos with their code on
 * them to post or save, and the words to go with it. ?car=slug opens one car's
 * sheet straight away (the row on the partner's page links that way).
 */
export default async function CarsToShare({ searchParams }: { searchParams: Promise<{ car?: string | string[] }> }) {
  const me = await currentPartner();
  if (!me) {
    return (
      <section className="mx-auto max-w-xl px-5 py-14 md:px-10 md:py-24">
        <p className="kicker">Earn</p>
        <h1 className="mt-4 text-display-2">Log in to see the cars to share.</h1>
        <p className="mt-4 text-lg text-text-secondary">Use your phone number and your 6‑digit PIN.</p>
        <div className="mt-8">
          <PartnerLogInForm helpPhone={helpPhone} next="/partner/cars" />
        </div>
      </section>
    );
  }

  if (me.status !== "active") {
    return (
      <section className="mx-auto max-w-xl px-5 py-14 md:px-10 md:py-24">
        <p className="kicker">Earn</p>
        <h1 className="mt-4 text-display-2">Sharing is paused.</h1>
        <p className="mt-4 text-lg text-text-secondary">Your partner account is suspended, so your links do not record new buyers. Your page says more.</p>
        <ButtonLink href="/partner" className="mt-8">
          Your partner page
        </ButtonLink>
      </section>
    );
  }

  const base = siteUrl();
  const host = new URL(base).host.replace(/^www\./, "");
  const cars: ShareCarView[] = (await shareCatalogue()).map((c) => {
    const price = c.priceMinor ? formatNaira(c.priceMinor) : null;
    const link = carShareLink(base, me.code, c.slug);
    return {
      slug: c.slug,
      title: c.title,
      group: c.group,
      price,
      earn: c.priceMinor ? formatNaira(commissionMinor(c.priceMinor)) : null,
      photos: c.photos,
      link,
      caption: shareCaption({ title: c.title, year: c.year, price }, link),
      drivePlan: price ? drivePlanLine(c.year) : null,
      statusWords: statusWords(link),
    };
  });
  const { car } = await searchParams;

  return (
    <>
      <PageIntro eyebrow="Earn" title="Cars to share">
        <p>
          Every car at the park today. Share any of them. If your buyer buys it, you earn 1.5%. Your code is{" "}
          <span className="figures text-text-primary">{me.code}</span>, and it goes with every link and photo.
        </p>
      </PageIntro>
      <div className="mx-auto max-w-7xl px-5 py-10 md:px-10 md:py-14">
        <ShareCars cars={cars} code={me.code} host={host} initialSlug={typeof car === "string" ? car : undefined} />
      </div>
      {/* Logged in here without a full page load: the header shows Account at once. */}
      <SignedInMark />
    </>
  );
}
