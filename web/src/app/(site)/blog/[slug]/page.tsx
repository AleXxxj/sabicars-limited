import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { ArticleBody } from "@/components/blog/ArticleBody";
import { CommentForm, Reactions, ShareBar } from "@/components/blog/Engage";
import { PostCard, postDate } from "@/components/blog/PostCard";
import { Contents, ReadingProgress, ViewBeacon } from "@/components/blog/ReadingAids";
import { SubscribeForm } from "@/components/subscribe/SubscribeForm";
import { Cover } from "@/components/blog/Cover";
import { anchorFor, plainText, readingMinutes } from "@/lib/blog/blocks";
import { videoSource } from "@/lib/blog/video";
import { approvedComments, postBySlug, publishedPosts, relatedPosts } from "@/lib/repositories/blog";
import { articleJsonLd, breadcrumbJsonLd, faqJsonLd, jsonLdScript } from "@/lib/seo/structured-data";
import { siteUrl } from "@/lib/site";

export const revalidate = 300;

type Props = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  return (await publishedPosts()).map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const post = await postBySlug((await params).slug);
  if (!post) return { title: "Not found" };
  const description = post.standfirst || post.excerpt || plainText(post.blocks, 160);
  return {
    title: post.title,
    description,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: {
      type: "article",
      title: post.title,
      description,
      publishedTime: post.publishedAt?.toISOString(),
      images: post.coverImageUrl ? [{ url: post.coverImageUrl }] : undefined,
    },
  };
}

/**
 * An article.
 *
 * Its one job: be worth reading to the end — and at the end, make the next
 * step obvious: a car in the showroom, the Drive Plan, the Sourcing Desk, or
 * the newsletter. Everything around the text serves the reading: a progress
 * line, the sections within reach, and nothing that interrupts.
 */
export default async function ArticlePage({ params }: Props) {
  const post = await postBySlug((await params).slug);
  if (!post) notFound();
  const [comments, related] = await Promise.all([approvedComments(post.id), relatedPosts(post)]);

  const headings = post.blocks.filter((b) => b.type === "h2").map((b) => ({ id: anchorFor(b.text), text: b.text }));
  const minutes = readingMinutes(post.blocks);
  const url = `${siteUrl()}/blog/${post.slug}`;
  const faq = post.blocks.find((b) => b.type === "faq");
  const coverVideo = post.coverVideoUrl ? videoSource(post.coverVideoUrl) : null;
  const trail = [
    { name: "Home", path: "/" },
    { name: "Insights", path: "/blog" },
    { name: post.title, path: `/blog/${post.slug}` },
  ];

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLdScript([
            articleJsonLd({
              title: post.title,
              description: post.standfirst || post.excerpt,
              path: `/blog/${post.slug}`,
              image: post.coverImageUrl,
              author: post.author,
              publishedAt: post.publishedAt ?? post.createdAt,
              updatedAt: post.updatedAt,
            }),
            breadcrumbJsonLd(trail),
            ...(faq?.type === "faq" ? [faqJsonLd(faq.items)] : []),
          ]),
        }}
      />
      <ReadingProgress targetId="article" />
      <ViewBeacon slug={post.slug} />

      <header className="mx-auto max-w-5xl px-5 pt-10 md:px-10 md:pt-16">
        <nav aria-label="Breadcrumb" className="text-sm text-text-muted">
          <Link href="/blog" className="hover:text-text-primary">
            Insights
          </Link>
          <span aria-hidden className="mx-2">
            ›
          </span>
          <span className="text-gold-300">{post.category}</span>
        </nav>
        <h1 className="mt-6 max-w-4xl font-display text-[clamp(2.5rem,1.6rem+3.8vw,4.6rem)] leading-[1.02] tracking-[-0.02em] text-text-primary">
          {post.title}
        </h1>
        {(post.standfirst || post.excerpt) && (
          <p className="mt-6 max-w-3xl text-[1.3rem] leading-relaxed text-text-secondary md:text-[1.45rem]">
            {post.standfirst || post.excerpt}
          </p>
        )}
        <p className="figures mt-8 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-white/[0.07] pt-5 text-sm text-text-muted">
          <span className="text-text-secondary">{post.author}</span>
          <span aria-hidden>·</span>
          <time dateTime={(post.publishedAt ?? post.createdAt).toISOString()}>{postDate(post.publishedAt ?? post.createdAt)}</time>
          <span aria-hidden>·</span>
          <span>{minutes} min read</span>
        </p>
      </header>

      {(post.coverImageUrl || coverVideo) && (
        <figure className="mx-auto mt-10 max-w-6xl px-5 md:mt-14 md:px-10">
          <div className="relative aspect-[16/9] overflow-hidden rounded-3xl border border-white/[0.08] bg-surface-2 shadow-[0_40px_90px_-40px_rgb(0_0_0/0.9)]">
            {coverVideo?.kind === "file" ? (
              <video
                src={coverVideo.src}
                poster={coverVideo.poster ?? post.coverImageUrl ?? undefined}
                autoPlay
                muted
                loop
                playsInline
                className="absolute inset-0 size-full object-cover"
              />
            ) : (
              post.coverImageUrl && (
                <Cover src={post.coverImageUrl} priority sizes="(min-width: 1152px) 1100px, 100vw" className="object-cover" />
              )
            )}
          </div>
        </figure>
      )}

      <div className="mx-auto mt-12 max-w-7xl md:mt-16 xl:grid xl:grid-cols-[15rem_minmax(0,1fr)] xl:gap-6 xl:px-10">
        <aside className="hidden xl:block">
          <Contents headings={headings} variant="rail" />
        </aside>
        <div id="article" className="min-w-0">
          {headings.length >= 3 && (
            <div className="mx-auto mb-10 max-w-[40rem] px-5 xl:hidden">
              <Contents headings={headings} variant="inline" />
            </div>
          )}
          <ArticleBody blocks={post.blocks} />

          <div className="article mt-16">
            <div className="grid gap-8 border-t border-white/[0.07] pt-10">
              <Reactions slug={post.slug} initial={post.reactions} />
              <ShareBar slug={post.slug} title={post.title} url={url} />
            </div>

            <section aria-labelledby="subscribe-title" className="surface-card spaced p-6 md:p-8">
              <p id="subscribe-title" className="font-display text-[1.7rem] leading-tight text-text-primary">
                Get the next one — and the week&rsquo;s new arrivals.
              </p>
              <p className="mt-2 text-[1rem] text-text-secondary">Every Friday. Nothing else, and one click to stop.</p>
              <div className="mt-5">
                <SubscribeForm source="article" />
              </div>
            </section>

            <section aria-labelledby="comments-title" className="spaced">
              <h2 id="comments-title" className="!mt-0 text-[1.9rem] leading-tight text-text-primary">
                {comments.length ? `${comments.length} ${comments.length === 1 ? "comment" : "comments"}` : "Questions and comments"}
              </h2>
              {comments.length > 0 && (
                <ul className="mt-6 grid gap-4">
                  {comments.map((c) => (
                    <li key={c.id} className="rounded-2xl border border-white/[0.07] p-5">
                      <p className="text-[1rem] leading-relaxed whitespace-pre-wrap text-text-primary">{c.message}</p>
                      <p className="mt-3 text-sm text-text-muted">
                        {c.name} · {postDate(c.createdAt)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-6">
                <CommentForm slug={post.slug} />
              </div>
            </section>
          </div>
        </div>
      </div>

      {related.length > 0 && (
        <section aria-labelledby="keep-reading" className="mt-20 border-t border-border-subtle bg-surface-1">
          <div className="mx-auto max-w-7xl px-5 py-16 md:px-10 md:py-20">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <h2 id="keep-reading" className="text-display-3">
                Keep reading
              </h2>
              <Link href="/blog" className="group inline-flex min-h-11 items-center gap-2 font-semibold text-gold-300 hover:text-gold-200">
                All insights <ArrowRight aria-hidden size={17} className="transition-transform group-hover:translate-x-1" />
              </Link>
            </div>
            <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {related.map((p) => (
                <PostCard key={p.slug} post={p} />
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  );
}
