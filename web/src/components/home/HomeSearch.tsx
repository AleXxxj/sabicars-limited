"use client";

import { useId, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Search, Sparkles } from "lucide-react";
import { openAssistant } from "@/lib/assistant/open";
import { formatNaira } from "@/lib/money";

/** A make or a make and model family in stock, with its own page (/buy/…). */
export interface SearchTerm {
  slug: string;
  label: string;
  fromMinor: number | null;
}

interface Suggestion {
  key: string;
  label: string;
  hint?: string;
  href?: string;
  ask?: string;
}

/**
 * A budget typed the way people say it — "20m", "₦20,000,000", "20 million",
 * "under 15m" — in whole naira, or null. A bare small number ("20") is not a
 * budget: it could be a year or a seat count.
 */
export function budgetFrom(text: string): number | null {
  const m = text
    .toLowerCase()
    .replace(/[₦,]/g, "")
    .match(/(\d+(?:\.\d+)?)\s*(m\b|mil\b|million|k\b)?/);
  if (!m) return null;
  const n = Number(m[1]);
  const unit = m[2];
  const naira = unit === "k" ? n * 1_000 : unit ? n * 1_000_000 : n;
  return naira >= 100_000 ? Math.round(naira) : null;
}

/**
 * Find your car: one field under the hero that answers "do they have what I
 * want?" before anything else is read.
 *
 * As the visitor types, it offers the makes and models in stock that match
 * (each with its own page and its lowest price), the Hummer bus page for
 * "hummer", the cars within a budget when the text is an amount, and always
 * a last line that hands the words to Ask Sabicars, which knows every car in
 * stock — so a sentence ("a 7-seater for my church under 20m") gets an answer,
 * not an empty result. Enter takes the highlighted line, or the first one.
 * Without JavaScript the form opens Ask Sabicars with the words (/?ask=…).
 *
 * The shortcuts under it are the questions buyers ask most, built from stock.
 */
export function HomeSearch({ terms, shortcuts }: { terms: SearchTerm[]; shortcuts: { label: string; href: string }[] }) {
  const router = useRouter();
  const id = useId();
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const suggestions = useMemo<Suggestion[]>(() => {
    const q = text.trim();
    if (!q) return [];
    const words = q.toLowerCase().split(/\s+/).filter((w) => w.length > 1 && !/^\d/.test(w) && !/^(under|below|less|than|for|a|an|the|my|with|down)$/.test(w));
    const out: Suggestion[] = [];
    if (/hum+er/i.test(q)) out.push({ key: "hummer", label: "Hummer buses", hint: "Every Toyota Hiace high-roof in stock", href: "/hummer-bus" });
    if (words.length) {
      for (const t of terms) {
        const label = t.label.toLowerCase();
        if (words.every((w) => label.includes(w)) && out.length < 6) {
          out.push({ key: t.slug, label: t.label, hint: t.fromMinor ? `from ${formatNaira(t.fromMinor, { compact: true })}` : undefined, href: `/buy/${t.slug}` });
        }
      }
    }
    const budget = budgetFrom(q);
    if (budget) {
      const amount = formatNaira(budget * 100, { compact: true });
      if (/deposit|down|drive plan|plan/i.test(q)) {
        out.push({ key: "deposit", label: `Cars you can get with ${amount} down`, hint: "On the 40% Drive Plan", href: `/vehicles?maxDeposit=${budget}` });
      } else {
        out.push({ key: "budget", label: `Cars up to ${amount}`, hint: "Dearest first", href: `/vehicles?maxPrice=${budget}&sort=price_desc` });
      }
    }
    out.push({ key: "ask", label: `Ask Sabicars: “${q}”`, hint: "Answers from every car in stock", ask: q });
    return out;
  }, [text, terms]);

  const choose = (s: Suggestion | undefined) => {
    if (!s) return;
    setOpen(false);
    if (s.href) router.push(s.href);
    else if (s.ask) openAssistant(s.ask);
  };

  const listId = `${id}-list`;
  const showList = open && suggestions.length > 0;

  return (
    <div className="glass rounded-2xl p-4 shadow-[0_24px_60px_-30px_rgb(0_0_0/0.9)] md:p-5">
      <form
        action="/"
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          choose(suggestions[active] ?? suggestions[0]);
        }}
        className="relative"
      >
        <label htmlFor={`${id}-q`} className="text-sm font-medium text-text-secondary">
          Find your car
        </label>
        <div className="relative mt-2">
          <Search aria-hidden size={20} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            id={`${id}-q`}
            name="ask"
            type="search"
            autoComplete="off"
            enterKeyHint="search"
            maxLength={200}
            value={text}
            placeholder="Make, model or budget — or ask a question"
            role="combobox"
            aria-expanded={showList}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={showList ? `${id}-opt-${active}` : undefined}
            onChange={(e) => {
              setText(e.target.value);
              setActive(0);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => window.setTimeout(() => setOpen(false), 150)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setOpen(true);
                setActive((a) => Math.min(a + 1, suggestions.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((a) => Math.max(a - 1, 0));
              } else if (e.key === "Escape") {
                setOpen(false);
              }
            }}
            className="min-h-14 w-full rounded-xl border border-border-default bg-surface-1/80 pl-12 pr-4 text-base text-text-primary placeholder:text-text-muted focus:border-green-500 focus:outline-none"
          />
        </div>
        {showList && (
          <ul id={listId} role="listbox" aria-label="Suggestions" className="absolute inset-x-0 top-full z-20 mt-2 overflow-hidden rounded-xl border border-border-default bg-surface-1 shadow-[0_24px_60px_-20px_rgb(0_0_0/0.9)]">
            {suggestions.map((s, i) => (
              <li
                key={s.key}
                id={`${id}-opt-${i}`}
                role="option"
                aria-selected={i === active}
                onMouseDown={(e) => {
                  e.preventDefault();
                  choose(s);
                }}
                onMouseEnter={() => setActive(i)}
                className={`flex cursor-pointer items-center justify-between gap-4 px-4 py-3 ${i === active ? "bg-white/[0.06]" : ""} ${s.ask ? "border-t border-white/[0.06]" : ""}`}
              >
                <span className="flex min-w-0 items-center gap-2.5">
                  {s.ask && <Sparkles aria-hidden size={16} className="shrink-0 text-green-300" />}
                  <span className="truncate text-text-primary">{s.label}</span>
                </span>
                {s.hint && <span className="figures shrink-0 text-sm text-text-muted">{s.hint}</span>}
              </li>
            ))}
          </ul>
        )}
      </form>
      {shortcuts.length > 0 && (
        <ul aria-label="Popular searches" className="-mx-1 mt-3 flex gap-2 overflow-x-auto px-1 [scrollbar-width:none] md:flex-wrap [&::-webkit-scrollbar]:hidden">
          {shortcuts.map((s) => (
            <li key={s.href} className="shrink-0">
              <Link
                href={s.href}
                className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-border-default px-3.5 text-sm text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary"
              >
                {s.label} <ArrowRight aria-hidden size={14} className="opacity-60" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
