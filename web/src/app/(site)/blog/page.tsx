import type { Metadata } from "next";
import Link from "next/link";
import { PostCard } from "@/components/blog/PostCard";
import { ScrollReveal } from "@/components/ScrollReveal";
import { publishedPosts } from "@/lib/repositories/blog";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Insights — buying, financing and running a vehicle in Nigeria",
  description:
    "Straight answers about buying, financing and running a vehicle in Nigeria, from people who sell them every day: buyer's guides, the 40% Drive Plan, inspections and the Toyota Hiace Hummer bus.",
  alternates: { canonical: "/blog" },
};

type Props = { searchParams: Promise<{ category?: string }> };

/**
 * Insights.
 *
 * Its one job: make the reader better at buying a vehicle than the person
 * selling it to them expects — and trust Sabicars because of it. The newest
 * or featured article leads; the rest follow, filterable by what they cover.
 */
export default async function BlogIndex({ searchParams }: Props) {
  const all = await publishedPosts();
  const category = (await searchParams).category;
  const categories = [...new Set(all.map((p) => p.category))];
  const posts = category ? all.filter((p) => p.category === category) : all;
  const [lead, ...rest] = posts;

  return (
    <>
      <header className="mx-auto max-w-7xl px-5 pt-12 pb-10 md:px-10 md:pt-20 md:pb-14">
        <p className="kicker">Insights</p>
        <h1 className="mt-5 max-w-4xl font-display text-[clamp(2.6rem,1.7rem+3.6vw,4.8rem)] leading-[1.02] tracking-[-0.02em]">
          Know more than the seller.
        </h1>
        <p className="mt-6 max-w-2xl text-xl leading-relaxed text-text-secondary">
          Straight answers about buying, financing and running a vehicle in Nigeria — from people who sell them every day, and would rather
          you bought well.
        </p>
        {categories.length > 1 && (
          <nav aria-label="Topics" className="mt-10 flex flex-wrap gap-2">
            {[null, ...categories].map((c) => {
              const on = (c ?? undefined) === category;
              return (
                <Link
                  key={c ?? "all"}
                  href={c ? `/blog?category=${encodeURIComponent(c)}` : "/blog"}
                  aria-current={on ? "page" : undefined}
                  className={`inline-flex min-h-11 items-center rounded-full border px-4 text-sm transition-colors ${
                    on
                      ? "border-gold-500/50 bg-gold-500/10 text-gold-100"
                      : "border-white/12 text-text-secondary hover:border-white/30 hover:text-text-primary"
                  }`}
                >
                  {c ?? "All"}
                </Link>
              );
            })}
          </nav>
        )}
      </header>

      <section className="mx-auto max-w-7xl px-5 pb-20 md:px-10 md:pb-28">
        {!lead ? (
          <p className="text-text-secondary">Nothing here yet.</p>
        ) : (
          <>
            <ScrollReveal>
              <PostCard post={lead} size="lg" priority />
            </ScrollReveal>
            {rest.length > 0 && (
              <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {rest.map((p, i) => (
                  <ScrollReveal key={p.slug} delay={(i % 3) * 90}>
                    <PostCard post={p} />
                  </ScrollReveal>
                ))}
              </div>
            )}
          </>
        )}
      </section>
    </>
  );
}
