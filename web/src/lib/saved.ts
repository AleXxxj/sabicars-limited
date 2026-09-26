"use client";

import { useSyncExternalStore } from "react";

/**
 * Saved cars, kept on the visitor's own device — no account, no sign-up, one
 * tap. It is a shortlist, not a record: anything that must reach Sabicars (a
 * price-drop alert, an enquiry) is sent to the server by its own form.
 *
 * Every open tab stays in step through the storage event. Storage can be
 * unavailable (private windows, blocked site data): then saving simply does
 * nothing, and nothing breaks.
 */
const KEY = "sabicars-saved";
const LIMIT = 50;
const EMPTY: string[] = [];

let raw: string | null = null;
let slugs: string[] = EMPTY;
const listeners = new Set<() => void>();

function read(): string[] {
  let next: string | null = null;
  try {
    next = window.localStorage.getItem(KEY);
  } catch {
    return EMPTY;
  }
  // Same text, same array: useSyncExternalStore needs a stable snapshot.
  if (next !== raw) {
    raw = next;
    try {
      const parsed = JSON.parse(next ?? "[]");
      slugs = Array.isArray(parsed) ? parsed.filter((s): s is string => typeof s === "string").slice(0, LIMIT) : EMPTY;
    } catch {
      slugs = EMPTY;
    }
  }
  return slugs;
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  const onStorage = (e: StorageEvent) => e.key === KEY && onChange();
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onStorage);
  };
}

function write(next: string[]) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next.slice(0, LIMIT)));
  } catch {
    return;
  }
  listeners.forEach((l) => l());
}

export function toggleSaved(slug: string): boolean {
  const current = read();
  const saved = !current.includes(slug);
  write(saved ? [slug, ...current] : current.filter((s) => s !== slug));
  return saved;
}

export function removeSaved(slug: string) {
  write(read().filter((s) => s !== slug));
}

/** The saved slugs, newest first. Empty on the server and before hydration. */
export function useSaved(): string[] {
  return useSyncExternalStore(subscribe, read, () => EMPTY);
}
