import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BlogEditor } from "@/components/admin/BlogEditor";
import { requireStaff } from "@/lib/auth";
import { editorOptions, editorPost } from "../editor-data";

export const metadata: Metadata = { title: "Edit article · Admin", robots: { index: false, follow: false } };

type Props = { params: Promise<{ id: string }> };

export default async function EditArticle({ params }: Props) {
  const me = await requireStaff();
  if (me.role === "sales") return <p className="py-16 text-center text-text-muted">A manager edits articles.</p>;
  const [post, options] = await Promise.all([editorPost(me.dealerId, (await params).id), editorOptions(me.dealerId)]);
  if (!post) notFound();
  return (
    <>
      <Link href="/admin/blog" className="text-sm text-text-muted hover:text-text-primary">
        ← Articles
      </Link>
      <div className="mt-4 mb-8 flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="text-display-3">Edit article</h1>
        <p className="text-sm text-text-muted">
          {post.isPublished ? (post.announced ? "Published and announced" : "Published — not yet announced") : "Draft"}
        </p>
      </div>
      <BlogEditor key={post.id} initial={post} categories={options.categories} terms={options.terms} />
    </>
  );
}
