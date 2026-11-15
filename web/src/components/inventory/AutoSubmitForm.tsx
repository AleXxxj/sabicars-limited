"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

/** Defaults that never need to appear in a shared link. */
const DEFAULTS: Record<string, string> = { sort: "newest" };

/**
 * A GET form that re-submits whenever a field changes (a search box: when it is sent, or emptied).
 *
 * Without JavaScript it is an ordinary form with an Apply button, so filters
 * still work on a budget phone with scripts blocked by a data saver. With
 * JavaScript it builds the URL itself — leaving out empty fields and defaults,
 * so a link shared on WhatsApp reads "/vehicles?body=bus&price=20000000-40000000"
 * rather than a trail of "make=&condition=" — and navigates client-side.
 */
export function AutoSubmitForm({ children, className }: { children: React.ReactNode; className?: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function go(form: HTMLFormElement) {
    const params = new URLSearchParams();
    for (const [key, value] of new FormData(form)) {
      if (typeof value === "string" && value !== "" && DEFAULTS[key] !== value) params.set(key, value);
    }
    const qs = params.toString();
    startTransition(() => router.push(qs ? `/vehicles?${qs}` : "/vehicles", { scroll: false }));
  }

  return (
    <form
      action="/vehicles"
      method="get"
      aria-busy={pending}
      className={`${className ?? ""} transition-opacity ${pending ? "opacity-60" : ""}`}
      onChange={(e) => {
        // A search box goes when the buyer asks (Search, or the keyboard's search key), not at every letter typed; emptied,
        // it goes at once, so clearing it brings every car back.
        const field = e.target as HTMLElement;
        if (field instanceof HTMLInputElement && (field.type === "search" || field.type === "text") && field.value !== "") return;
        go(e.currentTarget);
      }}
      onSubmit={(e) => {
        e.preventDefault();
        go(e.currentTarget);
      }}
    >
      {children}
    </form>
  );
}
