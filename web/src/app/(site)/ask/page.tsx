import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { AskButton } from "@/components/assistant/AskButton";
import { PageIntro } from "@/components/site/PageIntro";
import { publishedAnswers } from "@/lib/repositories/ask";
import { faqJsonLd, jsonLdScript } from "@/lib/seo/structured-data";

/** Refreshed as staff publish answers (and on their save). */
export const revalidate = 600;

export const metadata: Metadata = {
  title: "Straight answers for car buyers in Lagos",
  description:
    "Buying a car in Lagos? Straight answers to what buyers ask Sabicars most: the 40% Drive Plan, inspections, Hummer buses, the showroom, sourcing a car and more — or ask your own.",
  alternates: { canonical: "/ask" },
};

const excerpt = (s: string) => {
  const plain = s
    .replace(/\*\*|\*/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
  return plain.length > 150 ? `${plain.slice(0, 150).replace(/\s\S*$/, "")}…` : plain;
};

export default async function AskIndex() {
  const answers = await publishedAnswers();
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(faqJsonLd(answers.map((a) => ({ q: a.question, a: a.answer })))) }}
      />
      <PageIntro eyebrow="Ask Sabicars" title="Straight answers to what buyers ask.">
        <p>
          The questions we hear most, answered plainly. Something else on your mind? Ask — the assistant knows every car in the showroom and
          replies in seconds, day or night.
        </p>
        <AskButton className="mt-7 inline-flex min-h-12 items-center gap-2 rounded-full bg-[linear-gradient(180deg,var(--gold-300),var(--gold-500))] px-6 text-base font-semibold text-[#0A0908]">
          <Sparkles aria-hidden size={18} /> Ask your own question
        </AskButton>
      </PageIntro>

      <section className="mx-auto max-w-4xl px-5 py-14 md:px-10 md:py-20">
        <ul className="divide-y divide-border-subtle border-y border-border-subtle">
          {answers.map((a) => (
            <li key={a.id}>
              <Link href={`/ask/${a.slug}`} className="group flex items-start justify-between gap-6 py-6">
                <span>
                  <span className="block text-xl font-semibold text-text-primary group-hover:text-gold-200 md:text-2xl">{a.question}</span>
                  <span className="mt-2 block text-text-secondary">{excerpt(a.answer)}</span>
                </span>
                <ArrowRight
                  aria-hidden
                  size={20}
                  className="mt-1.5 shrink-0 text-gold-300 transition-transform group-hover:translate-x-1"
                />
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
