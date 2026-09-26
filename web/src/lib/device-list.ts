"use client";

import { useSyncExternalStore } from "react";

/**
 * A short list of vehicle slugs kept on the visitor's own device — saved cars,
 * recently viewed. No account, no sign-up. Every open tab stays in step
 * through the storage event, and when storage is unavailable (private windows,
 * blocked site data) the list is simply empty and nothing breaks.
 */
export function deviceList(key: string, limit: number) {
  const EMPTY: string[] = [];
  let raw: string | null = null;
  let items: string[] = EMPTY;
  const listeners = new Set<() => void>();

  function read(): string[] {
    let next: string | null = null;
    try {
      next = window.localStorage.getItem(key);
    } catch {
      return EMPTY;
    }
    // Same text, same array: useSyncExternalStore needs a stable snapshot.
    if (next !== raw) {
      raw = next;
      try {
        const parsed = JSON.parse(next ?? "[]");
        items = Array.isArray(parsed) ? parsed.filter((s): s is string => typeof s === "string").slice(0, limit) : EMPTY;
      } catch {
        items = EMPTY;
      }
    }
    return items;
  }

  function subscribe(onChange: () => void): () => void {
    listeners.add(onChange);
    const onStorage = (e: StorageEvent) => e.key === key && onChange();
    window.addEventListener("storage", onStorage);
    return () => {
      listeners.delete(onChange);
      window.removeEventListener("storage", onStorage);
    };
  }

  function write(next: string[]) {
    try {
      window.localStorage.setItem(key, JSON.stringify(next.slice(0, limit)));
    } catch {
      return;
    }
    listeners.forEach((l) => l());
  }

  return {
    read,
    write,
    /** The list, newest first. Empty on the server and before hydration. */
    useList: () => useSyncExternalStore(subscribe, read, () => EMPTY),
  };
}
