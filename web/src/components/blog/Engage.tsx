"use client";

import { useActionState, useEffect, useState } from "react";
import { Check, Link2, Share2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { FieldError, fieldClass, Label, SpamGuard } from "@/components/forms/shared";
import { react, recordShare, submitComment } from "@/lib/actions/blog";
import { REACTIONS, type Reaction } from "@/lib/blog/reactions";

/** The old blog's four reactions, with its counts. One of each per reader, and a second tap takes it back. */
export function Reactions({ slug, initial }: { slug: string; initial: Record<string, number> }) {
  const [counts, setCounts] = useState(initial);
  const [mine, setMine] = useState<Reaction[]>([]);
  const key = `sabicars:reacted:${slug}`;

  useEffect(() => {
    const t = window.setTimeout(() => {
      try {
        setMine(JSON.parse(localStorage.getItem(key) ?? "[]"));
      } catch {}
    }, 0);
    return () => window.clearTimeout(t);
  }, [key]);

  const toggle = async (r: Reaction) => {
    const undo = mine.includes(r);
    const next = undo ? mine.filter((x) => x !== r) : [...mine, r];
    setMine(next);
    setCounts((c) => ({ ...c, [r]: Math.max(0, (c[r] ?? 0) + (undo ? -1 : 1)) }));
    try {
      localStorage.setItem(key, JSON.stringify(next));
    } catch {}
    const res = await react(slug, r, undo);
    if (res.ok && res.reactions) setCounts(res.reactions);
  };

  return (
    <div>
      <p className="text-sm font-semibold text-text-primary">Was this worth your time?</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {REACTIONS.map((r) => {
          const on = mine.includes(r.key);
          return (
            <button
              key={r.key}
              type="button"
              onClick={() => toggle(r.key)}
              aria-pressed={on}
              aria-label={`${r.label}${counts[r.key] ? ` (${counts[r.key]})` : ""}`}
              className={`inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm transition-[background,border-color,transform] active:scale-95 ${
                on ? "border-gold-500/50 bg-gold-500/15 text-gold-100" : "border-white/12 text-text-secondary hover:border-white/30"
              }`}
            >
              <span aria-hidden className="text-base">
                {r.emoji}
              </span>
              <span>{r.label}</span>
              {(counts[r.key] ?? 0) > 0 && <span className="figures text-text-muted">{counts[r.key]}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Sharing, in the order this audience shares: WhatsApp first. On a phone the
 * system share sheet offers everything else.
 */
export function ShareBar({ slug, title, url }: { slug: string; title: string; url: string }) {
  const [copied, setCopied] = useState(false);
  const [native, setNative] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setNative(typeof navigator.share === "function"), 0);
    return () => window.clearTimeout(t);
  }, []);
  const shared = () => void recordShare(slug);
  const text = `${title} — ${url}`;
  const pill =
    "inline-flex min-h-11 items-center gap-2 rounded-full border border-white/12 px-4 text-sm text-text-secondary transition-colors hover:border-white/30 hover:text-text-primary";

  return (
    <div>
      <p className="text-sm font-semibold text-text-primary">Know someone who should read this?</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <a
          href={`https://wa.me/?text=${encodeURIComponent(text)}`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={shared}
          className={pill}
        >
          WhatsApp
        </a>
        <a
          href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={shared}
          className={pill}
        >
          Facebook
        </a>
        <a
          href={`https://x.com/intent/post?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={shared}
          className={pill}
        >
          X
        </a>
        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(url);
              setCopied(true);
              shared();
              window.setTimeout(() => setCopied(false), 2500);
            } catch {}
          }}
          className={pill}
        >
          {copied ? <Check aria-hidden size={16} className="text-gold-300" /> : <Link2 aria-hidden size={16} />}
          {copied ? "Link copied" : "Copy link"}
        </button>
        {native && (
          <button
            type="button"
            onClick={async () => {
              try {
                await navigator.share({ title, url });
                shared();
              } catch {}
            }}
            className={pill}
          >
            <Share2 aria-hidden size={16} /> More
          </button>
        )}
      </div>
    </div>
  );
}

/** A comment, read by the team before it appears. */
export function CommentForm({ slug }: { slug: string }) {
  const [state, action, pending] = useActionState(submitComment, null);
  if (state?.ok) {
    return (
      <p role="status" className="surface-card flex items-start gap-3 p-5 text-text-secondary">
        <Check aria-hidden size={18} className="mt-1 shrink-0 text-gold-300" />
        Thank you. Your comment appears here once the team has read it.
      </p>
    );
  }
  const v = state?.values ?? {};
  const err = state?.fieldErrors ?? {};
  return (
    <form action={action} className="relative grid gap-5" noValidate>
      <SpamGuard />
      <input type="hidden" name="slug" value={slug} />
      {state?.error && (
        <p role="alert" className="border-l-2 border-danger bg-surface-2 px-4 py-3 text-sm text-danger">
          {state.error}
        </p>
      )}
      <label className="grid gap-2">
        <Label>Your comment or question</Label>
        <textarea
          name="message"
          rows={4}
          required
          maxLength={1500}
          defaultValue={v.message}
          className={`${fieldClass} py-3 leading-relaxed`}
        />
        <FieldError message={err.message} />
      </label>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
        <label className="grid flex-1 gap-2">
          <Label>Your name</Label>
          <input name="name" autoComplete="name" required maxLength={80} defaultValue={v.name} className={fieldClass} />
          <FieldError message={err.name} />
        </label>
        <Button type="submit" disabled={pending}>
          {pending ? "Posting…" : "Post comment"}
        </Button>
      </div>
    </form>
  );
}
