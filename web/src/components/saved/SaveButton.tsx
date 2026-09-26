"use client";

import Link from "next/link";
import { Heart } from "lucide-react";
import { toggleSaved, useSaved } from "@/lib/saved";

/** The heart on a card or a vehicle's page: one tap to keep a car on the shortlist. */
export function SaveButton({ slug, title, variant = "icon", className = "" }: { slug: string; title: string; variant?: "icon" | "labelled"; className?: string }) {
  const saved = useSaved().includes(slug);
  const label = saved ? `Remove the ${title} from saved cars` : `Save the ${title}`;

  if (variant === "labelled") {
    return (
      <button
        type="button"
        onClick={() => toggleSaved(slug)}
        aria-pressed={saved}
        aria-label={label}
        className={`inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition-colors ${
          saved ? "border-gold-500/50 bg-gold-500/10 text-gold-200" : "border-white/15 text-text-secondary hover:border-white/35 hover:text-text-primary"
        } ${className}`}
      >
        <Heart aria-hidden size={17} strokeWidth={1.9} className={saved ? "fill-current" : ""} />
        {saved ? "Saved" : "Save"}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={(e) => {
        // On a card the heart sits above the card's link: save, don't navigate.
        e.preventDefault();
        e.stopPropagation();
        toggleSaved(slug);
      }}
      aria-pressed={saved}
      aria-label={label}
      className={`glass inline-flex size-10 items-center justify-center rounded-full transition-[color,transform] active:scale-90 ${saved ? "text-gold-300" : "text-white hover:text-gold-200"} ${className}`}
    >
      <Heart aria-hidden size={18} strokeWidth={1.9} className={saved ? "fill-current" : ""} />
    </button>
  );
}

/** The header's way to the shortlist, with how many are on it. */
export function SavedLink({ className = "" }: { className?: string }) {
  const count = useSaved().length;
  return (
    <Link
      href="/saved"
      aria-label={count ? `Saved cars (${count})` : "Saved cars"}
      className={`glass relative inline-flex size-11 items-center justify-center rounded-full text-text-primary transition-colors hover:text-gold-300 ${className}`}
    >
      <Heart aria-hidden size={19} strokeWidth={1.75} className={count ? "fill-gold-400 text-gold-400" : ""} />
      {count > 0 && (
        <span className="figures absolute -right-1 -top-1 grid min-w-5 place-items-center rounded-full bg-gold-400 px-1 text-[0.68rem] font-bold leading-5 text-[#0A0908]">{count}</span>
      )}
    </Link>
  );
}
