"use client";

import { useSyncExternalStore } from "react";
import { THEME_KEY } from "@/lib/theme";

type Theme = "dark" | "light";

/** The page's data-theme attribute is the source of truth; this just watches it. */
function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => observer.disconnect();
}
const currentTheme = (): Theme => (document.documentElement.dataset.theme === "light" ? "light" : "dark");
/** The server always renders dark; the boot script in <head> may already have switched it. */
const serverTheme = (): Theme => "dark";

export function ThemeToggle({ className = "" }: { className?: string }) {
  const theme = useSyncExternalStore(subscribe, currentTheme, serverTheme);

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {}
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
      className={`eyebrow inline-flex min-h-12 items-center gap-2 !text-text-secondary transition-colors hover:!text-text-primary ${className}`}
    >
      <span
        aria-hidden
        className="inline-block size-3 rounded-full border border-current"
        style={{ background: theme === "dark" ? "transparent" : "currentColor" }}
      />
      {theme === "dark" ? "Light" : "Dark"}
    </button>
  );
}
