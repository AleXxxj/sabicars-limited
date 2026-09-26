import type { Metadata } from "next";
import Link from "next/link";
import { BlogEditor } from "@/components/admin/BlogEditor";
import { requireStaff } from "@/lib/auth";
import { editorOptions } from "../editor-data";

export const metadata: Metadata = { title: "New article · Admin", robots: { index: false, follow: false } };

export default async function NewArticle() {
  const me = await requireStaff();
  if (me.role === "sales") return <p className="py-16 text-center text-text-muted">A manager writes articles.</p>;
  const { categories, terms } = await editorOptions(me.dealerId);
  return (
    <>
      <Link href="/admin/blog" className="text-sm text-text-muted hover:text-text-primary">
        ← Articles
      </Link>
      <h1 className="mt-4 mb-8 text-display-3">Write an article</h1>
      <BlogEditor
        categories={categories}
        terms={terms}
        initial={{
          title: "",
          standfirst: "",
          category: "Buying Guide",
          coverImageUrl: "",
          coverVideoUrl: "",
          tags: "",
          // Starts as an article starts: an opening paragraph, then the short version.
          blocks: [
            { type: "p", text: "" },
            { type: "summary", items: [""] },
          ],
          isPublished: false,
          announced: false,
          everPublished: false,
        }}
      />
    </>
  );
}
