"use client";

import { ErrorReport, ErrorScreen, type BoundaryError } from "@/components/site/ErrorReport";
import { archivo } from "@/lib/fonts";
import "./globals.css";

/**
 * The last line: an error in the root layout itself. This boundary replaces
 * the root layout, so it renders its own <html> and <body> — the same
 * language, theme and face as app/layout.tsx — and loads the site's styles
 * itself, because the layout that normally does is the thing that failed.
 *
 * Next.js shows this only in production; in development its overlay takes
 * the place of it.
 */
export default function GlobalError({ error, reset }: { error: BoundaryError; reset: () => void }) {
  return (
    <html lang="en-NG" data-theme="dark" className={archivo.variable}>
      <body>
        <ErrorReport error={error} />
        <ErrorScreen reset={reset} />
      </body>
    </html>
  );
}
