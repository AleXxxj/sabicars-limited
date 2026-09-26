import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArticleBody } from "@/components/blog/ArticleBody";
import { requireStaff } from "@/lib/auth";
import { adminPost } from "@/lib/repositories/blog";

export const metadata: Metadata = { title: "Preview · Admin", robots: { index: false, follow: false } };

type Props = { params: Promise<{ id: string }> };

/** The article as a reader will see it, published or not. */
export default async function PreviewArticle({ params }: Props) {
  const me = await requireStaff();
  const post = await adminPost(me.dealerId, (await params).id);
  if (!post) notFound();
  return (
    <>
      <p className="border border-gold-700 bg-surface-1 px-4 py-3 text-sm text-text-secondary">
        Preview{post.isPublished ? "" : " of a draft — readers cannot see it yet"}.{" "}
        <Link href={`/admin/blog/${post.id}`} className="font-semibold text-accent-text">
          Back to editing
        </Link>
      </p>
      <header className="mx-auto max-w-3xl pt-10">
        <p className="kicker">{post.category}</p>
        <h1 className="mt-4 font-display text-[clamp(2.3rem,1.6rem+3vw,4rem)] leading-[1.05]">{post.title}</h1>
        {post.standfirst && <p className="mt-5 text-xl leading-relaxed text-text-secondary">{post.standfirst}</p>}
      </header>
      <div className="mt-10">
        <ArticleBody blocks={post.blocks} />
      </div>
    </>
  );
}
