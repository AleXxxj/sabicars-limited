"use client";

import { deviceList } from "./device-list";

/**
 * Saved cars, kept on the visitor's own device — no account, no sign-up, one
 * tap. It is a shortlist, not a record: anything that must reach Sabicars (a
 * price-drop alert, an enquiry) is sent to the server by its own form.
 */
const saved = deviceList("sabicars-saved", 50);

export function toggleSaved(slug: string): boolean {
  const current = saved.read();
  const isSaved = !current.includes(slug);
  saved.write(isSaved ? [slug, ...current] : current.filter((s) => s !== slug));
  return isSaved;
}

export function removeSaved(slug: string) {
  saved.write(saved.read().filter((s) => s !== slug));
}

/** The saved slugs, newest first. Empty on the server and before hydration. */
export const useSaved = saved.useList;
