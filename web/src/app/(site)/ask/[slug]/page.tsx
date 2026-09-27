import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Sparkles } from "lucide-react";
import { AskButton } from "@/components/assistant/AskButton";
import { MessageText } from "@/components/assistant/MessageText";
import { answerBySlug, publishedAnswers } from "@/lib/repositories/ask";
import { breadcrumbJsonLd, faqJsonLd, jsonLdScript } from "@/lib/seo/structured-data";

type Props = { params: Promise<{ slug: string }> };

export const revalidate = 600;

export async function generateStaticParams() {
  return (await publishedAnswers()).map((a) => ({ slug: a.slug }));
}

const plain = (s: string) =>
  s
    .replace(/\*\*|\*/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const a = await answerBySlug((await params).slug);
  if (!a) return { title: "Answer not found" };
  const description = plain(a.answer).slice(0, 158);
  return {
    title: a.question,
    description,
    alternates: { canonical: `/ask/${a.slug}` },
    openGraph: { title: a.question, description, type: "article" },
  };
}

export default async function AskAnswerPage({ params }: Props) {
  const a = await answerBySlug((await params).slug);
  if (!a) notFound();
  const others = (await publishedAnswers()).filter((o) => o.id !== a.id).slice(0, 6);

  return (
    <article className="mx-auto max-w-3xl px-5 pt-10 pb-20 md:px-10 md:pt-16">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLdScript([
            faqJsonLd([{ q: a.question, a: a.answer }]),
            breadcrumbJsonLd([
              { name: "Home", path: "/" },
              { name: "Ask Sabicars", path: "/ask" },
              { name: a.question, path: `/ask/${a.slug}` },
            ]),
          ]),
        }}
      />
      <nav aria-label="Breadcrumb" className="text-sm text-text-muted">
        <Link href="/ask" className="hover:text-text-primary">
          Ask Sabicars
        </Link>
      </nav>
      <h1 className="mt-5 text-display-2">{a.question}</h1>
      <div className="mt-8 text-lg leading-relaxed text-text-secondary [&_a]:text-gold-300 [&_a]:underline [&_a]:decoration-gold-500/40 [&_a]:underline-offset-4 hover:[&_a]:text-gold-200 [&_strong]:font-semibold [&_strong]:text-text-primary">
        <MessageText text={a.answer} />
      </div>

      <div className="surface-card mt-12 flex flex-wrap items-center justify-between gap-5 p-6 md:p-8">
        <div className="max-w-md">
          <p className="font-semibold text-text-primary">Something this didn’t answer?</p>
          <p className="mt-1 text-text-secondary">
            Ask Sabicars knows every car in the showroom and replies in seconds — or a person can call you.
          </p>
        </div>
        <AskButton
          prompt={a.question}
          className="inline-flex min-h-12 items-center gap-2 rounded-full bg-[linear-gradient(180deg,var(--gold-300),var(--gold-500))] px-6 font-semibold text-[#0A0908]"
        >
          <Sparkles aria-hidden size={17} /> Ask a follow-up
        </AskButton>
      </div>

      {others.length > 0 && (
        <section className="mt-16">
          <h2 className="kicker">More answers</h2>
          <ul className="mt-5 divide-y divide-border-subtle border-y border-border-subtle">
            {others.map((o) => (
              <li key={o.id}>
                <Link
                  href={`/ask/${o.slug}`}
                  className="group flex min-h-14 items-center justify-between gap-4 py-3 font-medium text-text-primary hover:text-gold-200"
                >
                  {o.question}
                  <ArrowRight aria-hidden size={17} className="shrink-0 text-gold-300 transition-transform group-hover:translate-x-1" />
                </Link>
              </li>
            ))}
          </ul>
          <Link
            href="/ask"
            className="group mt-5 inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-gold-300 hover:text-gold-200"
          >
            Every answer <ArrowRight aria-hidden size={15} className="transition-transform group-hover:translate-x-1" />
          </Link>
        </section>
      )}
    </article>
  );
}
