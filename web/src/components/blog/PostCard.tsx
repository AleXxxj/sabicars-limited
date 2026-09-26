import Link from "next/link";
import { Cover } from "./Cover";
import type { PostCard as Post } from "@/lib/repositories/blog";

export const postDate = (d: Date) =>
  new Date(d).toLocaleDateString("en-NG", { day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Lagos" });

/** An article, as a card: the picture, the headline, and the line that makes you open it. */
export function PostCard({ post, size = "md", priority = false }: { post: Post; size?: "md" | "lg"; priority?: boolean }) {
  const lg = size === "lg";
  return (
    <Link
      href={`/blog/${post.slug}`}
      className={`group grid overflow-hidden rounded-3xl border border-white/[0.07] bg-surface-1 ${lg ? "md:grid-cols-[1.25fr_1fr]" : ""}`}
    >
      <div className={`relative overflow-hidden bg-surface-2 ${lg ? "aspect-[16/10] md:aspect-auto md:min-h-[26rem]" : "aspect-[16/10]"}`}>
        {post.coverImageUrl ? (
          <Cover
            src={post.coverImageUrl}
            priority={priority}
            sizes={lg ? "(min-width: 768px) 55vw, 100vw" : "(min-width: 1024px) 30vw, (min-width: 640px) 45vw, 100vw"}
            className="object-cover transition-transform duration-[var(--duration-slow)] ease-[var(--ease-out)] group-hover:scale-[1.04]"
          />
        ) : (
          <div aria-hidden className="absolute inset-0 bg-[radial-gradient(120%_90%_at_20%_10%,rgb(201_168_76/0.25),transparent_60%)]" />
        )}
      </div>
      <div className={`flex flex-col ${lg ? "justify-center p-7 md:p-10" : "p-6"}`}>
        <p className="text-xs font-semibold tracking-[0.16em] text-gold-300 uppercase">{post.category}</p>
        <h3
          className={`mt-3 leading-[1.12] text-text-primary transition-colors group-hover:text-gold-100 ${lg ? "text-display-3" : "text-[1.55rem]"}`}
        >
          {post.title}
        </h3>
        <p className={`mt-3 text-text-secondary ${lg ? "text-lg leading-relaxed" : "line-clamp-3 text-[0.98rem] leading-relaxed"}`}>
          {post.standfirst}
        </p>
        <p className="figures mt-auto pt-5 text-sm text-text-muted">
          {postDate(post.publishedAt)} · {post.minutes} min read
        </p>
      </div>
    </Link>
  );
}
