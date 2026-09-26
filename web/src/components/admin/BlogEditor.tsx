"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { deleteDraft, savePost, setPublished, announcePost } from "@/lib/actions/blog-admin";
import { ILLUSTRATIONS, type Block, type IllustrationName } from "@/lib/blog/blocks";
import { videoSource } from "@/lib/blog/video";
import { BlogImageUpload } from "./BlogImageUpload";

type Kind = Block["type"];

const KINDS: { type: Kind; label: string; hint: string }[] = [
  { type: "p", label: "Paragraph", hint: "Running text. **bold**, *italic*, [link](/vehicles)" },
  { type: "h2", label: "Section heading", hint: "Starts a section; appears in the contents list" },
  { type: "h3", label: "Sub-heading", hint: "A heading inside a section" },
  { type: "list", label: "List", hint: "One item per line" },
  { type: "summary", label: "The short version", hint: "Key points, near the top" },
  { type: "quote", label: "Pull quote", hint: "A line worth repeating, set large" },
  { type: "callout", label: "Callout", hint: "A tip, a warning or a note" },
  { type: "image", label: "Photo", hint: "Upload, with a caption" },
  { type: "video", label: "Video", hint: "YouTube, TikTok, Instagram or a Cloudinary clip" },
  { type: "illustration", label: "Illustration", hint: "An animated graphic" },
  { type: "cars", label: "Cars from the showroom", hint: "Live cards — never out of date" },
  { type: "table", label: "Table", hint: "A comparison" },
  { type: "faq", label: "Questions & answers", hint: "Also shown in Google results" },
  { type: "cta", label: "Next step", hint: "A card sending the reader somewhere useful" },
];
const LABEL = Object.fromEntries(KINDS.map((k) => [k.type, k.label])) as Record<Kind, string>;

function blank(type: Kind): Block {
  switch (type) {
    case "p":
    case "h2":
    case "h3":
      return { type, text: "" };
    case "quote":
      return { type, text: "" };
    case "list":
      return { type, items: [""] };
    case "summary":
      return { type, items: [""] };
    case "callout":
      return { type, tone: "tip", text: "" };
    case "image":
      return { type, url: "", alt: "" };
    case "video":
      return { type, url: "" };
    case "illustration":
      return { type, name: "hummer-anatomy" };
    case "cars":
      return { type, term: "", limit: 3 };
    case "table":
      return { type, head: ["", ""], rows: [["", ""]] };
    case "faq":
      return { type, items: [{ q: "", a: "" }] };
    case "cta":
      return { type, kind: "inventory" };
  }
}

/** What the editor keeps is what the reader sees: blank lines and empty optional fields are removed on save. */
function tidy(b: Block): Block {
  const opt = (s: string | undefined) => (s && s.trim() ? s.trim() : undefined);
  switch (b.type) {
    case "list":
    case "summary":
      return { ...b, items: b.items.map((i) => i.trim()).filter(Boolean), ...("title" in b ? { title: opt(b.title) } : {}) };
    case "quote":
      return { ...b, cite: opt(b.cite) };
    case "callout":
      return { ...b, title: opt(b.title) };
    case "image":
    case "video":
    case "illustration":
      return { ...b, caption: opt(b.caption) };
    case "cars":
      return { type: "cars", term: opt(b.term), limit: b.limit, title: opt(b.title) };
    case "table":
      return { ...b, caption: opt(b.caption), rows: b.rows.filter((r) => r.some((c) => c.trim())) };
    case "faq":
      return { ...b, items: b.items.filter((i) => i.q.trim() || i.a.trim()) };
    default:
      return b;
  }
}

const field = "min-h-10 w-full border border-border-default bg-surface-0 px-3 text-sm text-text-primary outline-none focus:border-gold-500";
const area = `${field} py-2 leading-relaxed`;
const small = "text-xs text-text-muted";

export interface EditorPost {
  id?: string;
  slug?: string;
  title: string;
  standfirst: string;
  category: string;
  coverImageUrl: string;
  coverVideoUrl: string;
  tags: string;
  blocks: Block[];
  isPublished: boolean;
  announced: boolean;
  everPublished: boolean;
}

/**
 * The article editor. Built from blocks, so an article written here looks
 * like every other one on the site — and so the rich pieces (illustrations,
 * live cars, video) are a menu choice, not code.
 */
export function BlogEditor({
  initial,
  categories,
  terms,
}: {
  initial: EditorPost;
  categories: string[];
  terms: { slug: string; label: string }[];
}) {
  const router = useRouter();
  const [post, setPost] = useState(initial);
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<{ tone: "ok" | "bad"; text: string; issues?: string[] } | null>(null);
  const [dirty, setDirty] = useState(false);

  const set = (patch: Partial<EditorPost>) => {
    setPost((p) => ({ ...p, ...patch }));
    setDirty(true);
  };
  const setBlock = (i: number, b: Block) => set({ blocks: post.blocks.map((x, j) => (j === i ? b : x)) });
  const move = (i: number, d: -1 | 1) => {
    const next = [...post.blocks];
    const [b] = next.splice(i, 1);
    next.splice(i + d, 0, b);
    set({ blocks: next });
  };
  const insert = (at: number, type: Kind) => {
    const next = [...post.blocks];
    next.splice(at, 0, blank(type));
    set({ blocks: next });
  };

  const save = () =>
    start(async () => {
      setMessage(null);
      const r = await savePost({
        id: post.id,
        title: post.title,
        standfirst: post.standfirst,
        category: post.category,
        coverImageUrl: post.coverImageUrl,
        coverVideoUrl: post.coverVideoUrl,
        tags: post.tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        blocks: post.blocks.map(tidy),
      });
      if (!r.ok) return setMessage({ tone: "bad", text: r.error ?? "It did not save.", issues: r.issues });
      setDirty(false);
      setMessage({ tone: "ok", text: "Saved." });
      if (!post.id && r.id) router.replace(`/admin/blog/${r.id}`);
      else router.refresh();
    });

  const publish = (on: boolean) =>
    start(async () => {
      if (!post.id) return;
      if (
        on &&
        !window.confirm(
          post.announced
            ? "Publish this article?"
            : "Publish this article? It will be announced on the bell, pushed to phones and emailed to subscribers — once.",
        )
      )
        return;
      const r = await setPublished(post.id, on);
      if (!r.ok) return setMessage({ tone: "bad", text: r.error ?? "That did not work." });
      setPost((p) => ({ ...p, isPublished: on, everPublished: p.everPublished || on, announced: p.announced || Boolean(r.announced) }));
      setMessage({
        tone: "ok",
        text: on ? (r.announced ? "Published and announced." : "Published.") : "Unpublished. Its address is kept.",
      });
      router.refresh();
    });

  return (
    <div className="grid gap-8">
      {/* The article's front: what a reader sees before the first paragraph. */}
      <section className="grid gap-4 border border-border-subtle bg-surface-1 p-5 md:p-6">
        <label className="grid gap-1.5">
          <span className={small}>Headline</span>
          <input
            value={post.title}
            onChange={(e) => set({ title: e.target.value })}
            maxLength={140}
            className={`${field} font-display text-xl`}
            placeholder="The one line that makes someone stop scrolling"
          />
        </label>
        <label className="grid gap-1.5">
          <span className={small}>The hook — one or two sentences under the headline</span>
          <textarea
            value={post.standfirst}
            onChange={(e) => set({ standfirst: e.target.value })}
            rows={2}
            maxLength={320}
            className={area}
          />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-1.5">
            <span className={small}>Category</span>
            <input
              list="blog-categories"
              value={post.category}
              onChange={(e) => set({ category: e.target.value })}
              className={field}
              placeholder="Buying Guide"
            />
            <datalist id="blog-categories">
              {categories.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </label>
          <label className="grid gap-1.5">
            <span className={small}>Search terms it is about (comma-separated, optional)</span>
            <input
              value={post.tags}
              onChange={(e) => set({ tags: e.target.value })}
              className={field}
              placeholder="toyota-hiace-hummer, hummer-bus"
            />
          </label>
        </div>
        <div className="grid gap-2">
          <span className={small}>Cover photo</span>
          <div className="flex flex-wrap items-center gap-3">
            {post.coverImageUrl && (
              // eslint-disable-next-line @next/next/no-img-element -- a small preview
              <img src={post.coverImageUrl} alt="" className="h-16 w-28 border border-border-subtle object-cover" />
            )}
            <BlogImageUpload label={post.coverImageUrl ? "Replace" : "Upload a cover"} onUploaded={(url) => set({ coverImageUrl: url })} />
            <input
              value={post.coverImageUrl}
              onChange={(e) => set({ coverImageUrl: e.target.value })}
              className={`${field} min-w-0 flex-1`}
              placeholder="…or paste a Cloudinary address"
            />
          </div>
        </div>
        <label className="grid gap-1.5">
          <span className={small}>Cover video (optional — a Cloudinary clip plays silently in place of the photo)</span>
          <input
            value={post.coverVideoUrl}
            onChange={(e) => set({ coverVideoUrl: e.target.value })}
            className={field}
            placeholder="https://res.cloudinary.com/…/video/upload/…mp4"
          />
        </label>
      </section>

      {/* The article, block by block. */}
      <section className="grid gap-3">
        {post.blocks.map((b, i) => (
          <div key={i} className="grid gap-3 border border-border-subtle bg-surface-1 p-4">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-semibold tracking-wide text-accent-text uppercase">
                {i + 1}. {LABEL[b.type]}
              </span>
              <span className="flex items-center gap-1">
                <button
                  type="button"
                  aria-label="Move up"
                  disabled={i === 0}
                  onClick={() => move(i, -1)}
                  className="inline-flex size-9 items-center justify-center text-text-muted hover:text-text-primary disabled:opacity-30"
                >
                  <ArrowUp size={16} />
                </button>
                <button
                  type="button"
                  aria-label="Move down"
                  disabled={i === post.blocks.length - 1}
                  onClick={() => move(i, 1)}
                  className="inline-flex size-9 items-center justify-center text-text-muted hover:text-text-primary disabled:opacity-30"
                >
                  <ArrowDown size={16} />
                </button>
                <button
                  type="button"
                  aria-label="Remove"
                  onClick={() => set({ blocks: post.blocks.filter((_, j) => j !== i) })}
                  className="inline-flex size-9 items-center justify-center text-text-muted hover:text-danger"
                >
                  <Trash2 size={16} />
                </button>
              </span>
            </div>
            <BlockFields block={b} onChange={(nb) => setBlock(i, nb)} terms={terms} />
            <AddBlock onAdd={(t) => insert(i + 1, t)} compact />
          </div>
        ))}
        {post.blocks.length === 0 && <AddBlock onAdd={(t) => insert(0, t)} />}
      </section>

      {/* Actions, always within reach. */}
      <div className="sticky bottom-0 z-10 -mx-5 flex flex-wrap items-center gap-3 border-t border-border-subtle bg-surface-0/95 px-5 py-3 backdrop-blur md:-mx-8 md:px-8">
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="min-h-11 bg-cta px-5 text-sm font-semibold text-cta-fg hover:bg-cta-hover disabled:opacity-50"
        >
          {pending ? "Working…" : dirty || !post.id ? "Save" : "Saved"}
        </button>
        {post.id && (
          <>
            <a
              href={`/admin/blog/${post.id}/preview`}
              target="_blank"
              className="inline-flex min-h-11 items-center border border-border-strong px-4 text-sm text-text-primary hover:border-text-primary"
            >
              Preview ↗
            </a>
            {post.isPublished ? (
              <button
                type="button"
                onClick={() => publish(false)}
                disabled={pending}
                className="min-h-11 px-3 text-sm text-text-muted hover:text-text-primary"
              >
                Unpublish
              </button>
            ) : (
              <button
                type="button"
                onClick={() => publish(true)}
                disabled={pending || dirty}
                title={dirty ? "Save first" : undefined}
                className="min-h-11 border border-gold-500 px-4 text-sm font-semibold text-accent-text hover:bg-surface-1 disabled:opacity-50"
              >
                Publish
              </button>
            )}
            {post.isPublished && !post.announced && (
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    if (!window.confirm("Announce it now? It goes on the bell, to phones and to every subscriber — once.")) return;
                    const r = await announcePost(post.id!);
                    setMessage(
                      r.ok ? { tone: "ok", text: r.detail ?? "Announced." } : { tone: "bad", text: r.error ?? "That did not work." },
                    );
                    if (r.ok) setPost((p) => ({ ...p, announced: true }));
                  })
                }
                className="min-h-11 border border-gold-500 px-4 text-sm font-semibold text-accent-text hover:bg-surface-1"
              >
                Announce to subscribers
              </button>
            )}
            {post.isPublished && post.slug && (
              <a
                href={`/blog/${post.slug}`}
                target="_blank"
                className="inline-flex min-h-11 items-center px-3 text-sm text-text-secondary hover:text-text-primary"
              >
                View on the site ↗
              </a>
            )}
            {!post.everPublished && (
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    if (!window.confirm("Delete this draft for good?")) return;
                    const r = await deleteDraft(post.id!);
                    if (r.ok) router.push("/admin/blog");
                    else setMessage({ tone: "bad", text: r.error ?? "It could not be deleted." });
                  })
                }
                className="ml-auto min-h-11 px-3 text-sm text-text-muted hover:text-danger"
              >
                Delete draft
              </button>
            )}
          </>
        )}
        {message && (
          <div role="status" className={`w-full text-xs ${message.tone === "ok" ? "text-success" : "text-danger"}`}>
            {message.text}
            {message.issues && (
              <ul className="mt-1 list-disc pl-5">
                {message.issues.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function AddBlock({ onAdd, compact = false }: { onAdd: (t: Kind) => void; compact?: boolean }) {
  const [open, setOpen] = useState(!compact);
  if (!open)
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 justify-self-start text-xs text-text-muted hover:text-accent-text"
      >
        <Plus size={14} /> Add a block below
      </button>
    );
  return (
    <div className="grid gap-2 border-t border-border-subtle pt-3 sm:grid-cols-2 lg:grid-cols-3">
      {KINDS.map((k) => (
        <button
          key={k.type}
          type="button"
          onClick={() => {
            onAdd(k.type);
            if (compact) setOpen(false);
          }}
          className="border border-border-subtle bg-surface-0 px-3 py-2 text-left hover:border-gold-500"
        >
          <span className="block text-sm text-text-primary">{k.label}</span>
          <span className="block text-xs text-text-muted">{k.hint}</span>
        </button>
      ))}
    </div>
  );
}

function BlockFields({
  block: b,
  onChange,
  terms,
}: {
  block: Block;
  onChange: (b: Block) => void;
  terms: { slug: string; label: string }[];
}) {
  switch (b.type) {
    case "p":
      return (
        <textarea
          value={b.text}
          onChange={(e) => onChange({ ...b, text: e.target.value })}
          rows={4}
          className={area}
          placeholder="Write…"
        />
      );
    case "h2":
    case "h3":
      return (
        <input
          value={b.text}
          onChange={(e) => onChange({ ...b, text: e.target.value })}
          className={`${field} ${b.type === "h2" ? "font-display text-lg" : "font-semibold"}`}
        />
      );
    case "list":
    case "summary":
      return (
        <div className="grid gap-2">
          {b.type === "list" && (
            <label className="flex items-center gap-2 text-xs text-text-muted">
              <input type="checkbox" checked={Boolean(b.ordered)} onChange={(e) => onChange({ ...b, ordered: e.target.checked })} />{" "}
              Numbered
            </label>
          )}
          <textarea
            value={b.items.join("\n")}
            onChange={(e) => onChange({ ...b, items: e.target.value.split("\n") })}
            rows={Math.max(3, b.items.length + 1)}
            className={area}
            placeholder="One item per line"
          />
        </div>
      );
    case "quote":
      return (
        <div className="grid gap-2">
          <textarea
            value={b.text}
            onChange={(e) => onChange({ ...b, text: e.target.value })}
            rows={2}
            className={`${area} font-display text-lg italic`}
          />
          <input
            value={b.cite ?? ""}
            onChange={(e) => onChange({ ...b, cite: e.target.value })}
            className={field}
            placeholder="Who said it (optional — leave empty for a line from the article)"
          />
        </div>
      );
    case "callout":
      return (
        <div className="grid gap-2 sm:grid-cols-[10rem_1fr]">
          <select value={b.tone} onChange={(e) => onChange({ ...b, tone: e.target.value as "tip" | "warning" | "note" })} className={field}>
            <option value="tip">Tip</option>
            <option value="warning">Watch out</option>
            <option value="note">Good to know</option>
          </select>
          <input
            value={b.title ?? ""}
            onChange={(e) => onChange({ ...b, title: e.target.value })}
            className={field}
            placeholder="Title (optional)"
          />
          <textarea
            value={b.text}
            onChange={(e) => onChange({ ...b, text: e.target.value })}
            rows={2}
            className={`${area} sm:col-span-2`}
          />
        </div>
      );
    case "image":
      return (
        <div className="grid gap-2">
          <div className="flex flex-wrap items-center gap-3">
            {b.url && (
              // eslint-disable-next-line @next/next/no-img-element -- a small preview
              <img src={b.url} alt="" className="h-16 w-28 border border-border-subtle object-cover" />
            )}
            <BlogImageUpload label={b.url ? "Replace" : "Upload a photo"} onUploaded={(url) => onChange({ ...b, url })} />
          </div>
          <input
            value={b.alt}
            onChange={(e) => onChange({ ...b, alt: e.target.value })}
            className={field}
            placeholder="What the photo shows (read out to blind readers, and to Google)"
          />
          <input
            value={b.caption ?? ""}
            onChange={(e) => onChange({ ...b, caption: e.target.value })}
            className={field}
            placeholder="Caption (optional)"
          />
        </div>
      );
    case "video": {
      const src = b.url ? videoSource(b.url) : null;
      return (
        <div className="grid gap-2">
          <input
            value={b.url}
            onChange={(e) => onChange({ ...b, url: e.target.value })}
            className={field}
            placeholder="Paste a YouTube, TikTok or Instagram link, or a Cloudinary video address"
          />
          <p className={`text-xs ${b.url && !src ? "text-danger" : "text-text-muted"}`}>
            {!b.url
              ? "Your own clips play silently in the article as the reader reaches them."
              : src
                ? `Recognised: ${src.kind === "file" ? "a video file" : src.kind}`
                : "That link is not one the article can play."}
          </p>
          <input
            value={b.caption ?? ""}
            onChange={(e) => onChange({ ...b, caption: e.target.value })}
            className={field}
            placeholder="Caption (optional)"
          />
        </div>
      );
    }
    case "illustration":
      return (
        <div className="grid gap-2">
          <select value={b.name} onChange={(e) => onChange({ ...b, name: e.target.value as IllustrationName })} className={field}>
            {(Object.keys(ILLUSTRATIONS) as IllustrationName[]).map((n) => (
              <option key={n} value={n}>
                {ILLUSTRATIONS[n]}
              </option>
            ))}
          </select>
          <input
            value={b.caption ?? ""}
            onChange={(e) => onChange({ ...b, caption: e.target.value })}
            className={field}
            placeholder="Caption (optional)"
          />
        </div>
      );
    case "cars":
      return (
        <div className="grid gap-2 sm:grid-cols-[1fr_8rem]">
          <select value={b.term ?? ""} onChange={(e) => onChange({ ...b, term: e.target.value })} className={field}>
            <option value="">Choose which cars…</option>
            {terms.map((t) => (
              <option key={t.slug} value={t.slug}>
                {t.label}
              </option>
            ))}
          </select>
          <select value={b.limit ?? 3} onChange={(e) => onChange({ ...b, limit: Number(e.target.value) })} className={field}>
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <option key={n} value={n}>
                Show {n}
              </option>
            ))}
          </select>
          <input
            value={b.title ?? ""}
            onChange={(e) => onChange({ ...b, title: e.target.value })}
            className={`${field} sm:col-span-2`}
            placeholder="Heading (optional) — e.g. Hummer buses in the showroom now"
          />
        </div>
      );
    case "table":
      return (
        <div className="grid gap-2">
          <input
            value={b.head.join(" | ")}
            onChange={(e) => onChange({ ...b, head: e.target.value.split("|").map((c) => c.trim()) })}
            className={`${field} font-semibold`}
            placeholder="Column | Column | Column"
          />
          <textarea
            value={b.rows.map((r) => r.join(" | ")).join("\n")}
            onChange={(e) => onChange({ ...b, rows: e.target.value.split("\n").map((line) => line.split("|").map((c) => c.trim())) })}
            rows={Math.max(3, b.rows.length + 1)}
            className={area}
            placeholder="One row per line, cells separated by |"
          />
        </div>
      );
    case "faq":
      return (
        <div className="grid gap-3">
          {b.items.map((f, j) => (
            <div key={j} className="grid gap-1.5 border-l-2 border-border-strong pl-3">
              <input
                value={f.q}
                onChange={(e) => onChange({ ...b, items: b.items.map((x, k) => (k === j ? { ...x, q: e.target.value } : x)) })}
                className={`${field} font-semibold`}
                placeholder="Question"
              />
              <textarea
                value={f.a}
                onChange={(e) => onChange({ ...b, items: b.items.map((x, k) => (k === j ? { ...x, a: e.target.value } : x)) })}
                rows={2}
                className={area}
                placeholder="Answer"
              />
              <button
                type="button"
                onClick={() => onChange({ ...b, items: b.items.filter((_, k) => k !== j) })}
                className="justify-self-start text-xs text-text-muted hover:text-danger"
              >
                Remove this question
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => onChange({ ...b, items: [...b.items, { q: "", a: "" }] })}
            className="justify-self-start text-xs font-semibold text-accent-text"
          >
            + Add a question
          </button>
        </div>
      );
    case "cta":
      return (
        <select value={b.kind} onChange={(e) => onChange({ ...b, kind: e.target.value as typeof b.kind })} className={field}>
          <option value="inventory">See the inventory</option>
          <option value="drive-plan">The 40% Drive Plan</option>
          <option value="find">The Sourcing Desk (not in stock?)</option>
          <option value="fleet">Fleet quotation</option>
          <option value="hummer">Every Hummer bus</option>
        </select>
      );
  }
}
