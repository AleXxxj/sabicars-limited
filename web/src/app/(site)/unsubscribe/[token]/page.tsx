import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { UnsubscribeButtons } from "@/components/subscribe/UnsubscribeButtons";
import { ButtonLink } from "@/components/ui/Button";
import { db } from "@/db";
import { subscribers } from "@/db/schema";

export const metadata: Metadata = { title: "Unsubscribe", robots: { index: false, follow: false } };

type Props = { params: Promise<{ token: string }> };

/**
 * The unsubscribe link in every newsletter. Opening it asks for one tap
 * rather than unsubscribing outright, because link scanners in mail
 * services open every link in an email — a GET must never change anything.
 */
export default async function UnsubscribePage({ params }: Props) {
  const { token } = await params;
  const [sub] = /^[0-9a-f-]{36}$/i.test(token)
    ? await db
        .select({ email: subscribers.email, isActive: subscribers.isActive })
        .from(subscribers)
        .where(eq(subscribers.unsubscribeToken, token))
        .limit(1)
    : [];

  return (
    <section className="mx-auto max-w-xl px-5 py-20 md:px-10 md:py-28">
      <p className="kicker">Newsletter</p>
      {!sub ? (
        <>
          <h1 className="mt-4 text-display-3">This link is not valid.</h1>
          <p className="mt-4 text-text-secondary">
            It may have been copied incompletely. Reply to any Sabicars email and we will take you off the list.
          </p>
          <ButtonLink href="/" variant="secondary" className="mt-8">
            Go to Sabicars
          </ButtonLink>
        </>
      ) : (
        <UnsubscribeButtons token={token} email={sub.email} active={sub.isActive} />
      )}
    </section>
  );
}
