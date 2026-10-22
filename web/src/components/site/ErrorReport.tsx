"use client";

import { useEffect, useRef } from "react";
import { Wordmark } from "@/components/Logo";
import { Button, ButtonAnchor } from "@/components/ui/Button";
import { site, whatsappLink } from "@/lib/site";

/**
 * What happens when a page breaks in a visitor's browser.
 *
 * `ErrorReport` tells the site: it posts the error to /api/ops/client-error,
 * which records it as an incident and pages the managers (lib/incidents.ts),
 * so the fault is on record before anyone complains. Once per error
 * instance — React runs effects twice in development, and a boundary can
 * re-render — and any failure to report is swallowed: reporting must never
 * add to the problem.
 *
 * `ErrorScreen` is what the visitor sees, shared by app/error.tsx and
 * app/global-error.tsx. Calm, in the site's own dark theme, with the two
 * things that help: try again, and a human to call. Plain anchors rather
 * than Next's Link, because the global boundary renders when the app itself
 * has failed and the router may be in no state to help.
 */

export type BoundaryError = Error & { digest?: string };

/** The limits /api/ops/client-error accepts; anything longer is cut here rather than refused there. */
const MESSAGE_CHARS = 500;
const STACK_CHARS = 4000;
const PATH_CHARS = 300;
const DIGEST_CHARS = 100;

export function ErrorReport({ error }: { error: BoundaryError }) {
  const reported = useRef<BoundaryError | null>(null);

  useEffect(() => {
    if (!error || reported.current === error) return;
    reported.current = error;
    try {
      const message = (typeof error.message === "string" && error.message.trim()) || String(error) || "Unknown error";
      const body = JSON.stringify({
        message: message.slice(0, MESSAGE_CHARS),
        stack: typeof error.stack === "string" && error.stack ? error.stack.slice(0, STACK_CHARS) : undefined,
        path: window.location.pathname.slice(0, PATH_CHARS),
        digest: error.digest ? String(error.digest).slice(0, DIGEST_CHARS) : undefined,
      });
      // keepalive: the report still goes out if the visitor leaves the page straight away.
      fetch("/api/ops/client-error", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(() => {});
    } catch {
      // Nothing to do: an error while reporting an error is not worth a second one.
    }
  }, [error]);

  return null;
}

/** The calm page: what went wrong in one line, what to do in two. */
export function ErrorScreen({ reset }: { reset: () => void }) {
  const phone = site.phones[0];
  return (
    <main className="flex min-h-svh flex-col items-center justify-center px-5 py-16 text-center">
      {/* A full page load, on purpose: a soft navigation would reuse the app shell that just failed. */}
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
      <a href="/" className="inline-flex items-center" aria-label="Sabicars — home">
        <Wordmark className="h-7 w-auto md:h-8" />
      </a>
      <p className="kicker mt-12">
        {site.legalName} · RC {site.rcNumber}
      </p>
      <h1 className="mt-5 max-w-2xl text-display-2">Something went wrong on our side.</h1>
      <p className="mt-5 max-w-xl text-lg leading-relaxed text-text-secondary">
        The team has been told. Try again, or call{" "}
        <a href={`tel:${phone.e164}`} className="figures whitespace-nowrap text-text-primary underline underline-offset-4 hover:text-accent-text">
          {phone.display}
        </a>{" "}
        /{" "}
        <a href={whatsappLink()} className="text-text-primary underline underline-offset-4 hover:text-accent-text" target="_blank" rel="noopener">
          WhatsApp
        </a>
        .
      </p>
      <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
        <Button type="button" onClick={reset}>
          Try again
        </Button>
        <ButtonAnchor href="/" variant="secondary">
          Back to the homepage
        </ButtonAnchor>
      </div>
    </main>
  );
}
