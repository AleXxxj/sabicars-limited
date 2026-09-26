import type { Metadata } from "next";
import { BadgeCheck } from "lucide-react";
import { ReviewForm } from "@/components/reviews/ReviewForm";
import { Stars } from "@/components/reviews/Stars";
import { ButtonLink } from "@/components/ui/Button";
import { buyerInvite } from "@/lib/repositories/reviews";

export const metadata: Metadata = { title: "Review your purchase", robots: { index: false, follow: false } };

type Props = { params: Promise<{ token: string }> };

/**
 * A buyer's private review link, sent after their purchase. What they write
 * here is published — once read — as "Verified buyer", tied to the sale on
 * record.
 */
export default async function BuyerReviewPage({ params }: Props) {
  const invite = await buyerInvite((await params).token);

  return (
    <section className="mx-auto max-w-2xl px-5 py-16 md:px-10 md:py-24">
      {!invite ? (
        <>
          <p className="kicker">Review</p>
          <h1 className="mt-4 text-display-3">This link is not valid.</h1>
          <p className="mt-4 text-text-secondary">It may have been copied incompletely. Ask the Sabicars team to send it again.</p>
          <ButtonLink href="/" variant="secondary" className="mt-8">
            Go to Sabicars
          </ButtonLink>
        </>
      ) : invite.existing ? (
        <>
          <p className="kicker">Thank you</p>
          <h1 className="mt-4 text-display-3">Your review is in, {invite.firstName}.</h1>
          <p className="mt-5 flex items-center gap-3 text-text-secondary">
            <Stars rating={invite.existing.rating} size={18} />
            {invite.existing.isApproved
              ? "It is on the site now, marked Verified buyer."
              : "It appears on the site once the team has read it."}
          </p>
          <blockquote className="surface-card mt-8 p-6 font-display text-[1.3rem] leading-snug">“{invite.existing.message}”</blockquote>
          <ButtonLink href="/#reviews" variant="secondary" className="mt-8">
            See the reviews
          </ButtonLink>
        </>
      ) : (
        <>
          <p className="kicker">Your purchase</p>
          <h1 className="mt-4 text-display-3">How did it go, {invite.firstName}?</h1>
          <p className="mt-4 text-lg leading-relaxed text-text-secondary">
            {invite.vehicle ? (
              <>
                You bought the <span className="text-text-primary">{invite.vehicle.title}</span> from Sabicars.{" "}
              </>
            ) : null}
            Your review helps the next buyer decide — the good and the not so good.
          </p>
          <p className="mt-4 inline-flex items-center gap-2 text-sm text-gold-300">
            <BadgeCheck aria-hidden size={17} /> It will show as a Verified buyer review.
          </p>
          <div className="surface-card mt-10 p-6 md:p-8">
            <ReviewForm token={(await params).token} defaultName={invite.firstName} />
          </div>
        </>
      )}
    </section>
  );
}
