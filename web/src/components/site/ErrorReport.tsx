"use client";

import { useEffect, useRef, useState } from "react";
import { Wordmark } from "@/components/Logo";
import { Button, ButtonAnchor } from "@/components/ui/Button";
import { CHUNK_FAILED_AT, CHUNK_FAILED_WITHIN_MS, CURE_KEY, CURE_WINDOW_MS, RELOADING_FLAG, whenSiteAnswers } from "@/lib/chunk-cure";
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

/**
 * A piece of the site's code that did not arrive: the phone's connection dropped while it downloaded, or the page was
 * open across an update. Reloading fetches it again, so this is cured, not reported (the owner's phone, 14 November
 * 2026: "Failed to load chunk … from module 40248" on /admin/leads, a file the site had sent but that never arrived).
 */
export function isChunkLoadError(error: unknown): boolean {
  const e = error as { name?: unknown; message?: unknown } | null;
  const text = `${typeof e?.name === "string" ? e.name : ""} ${typeof e?.message === "string" ? e.message : ""}`;
  return /ChunkLoadError|Failed to load chunk|Loading (CSS )?chunk [\w-]+ failed|dynamically imported module|Importing a module script failed/i.test(text);
}

type Reloading = { [RELOADING_FLAG]?: boolean; [CHUNK_FAILED_AT]?: number };

/**
 * A missing piece of code, by its name, or any error that comes moments after a file of the site's code failed to
 * arrive (noted by lib/chunk-cure.ts): on a very slow line React gives up on the page that waits for it with its own
 * error #482 instead, and that was shown as "Something went wrong" and alerted the managers (review of 666b037).
 */
function curedByReload(error: BoundaryError): boolean {
  if (isChunkLoadError(error)) return true;
  const failedAt = (window as Reloading)[CHUNK_FAILED_AT];
  return typeof failedAt === "number" && Date.now() - failedAt < CHUNK_FAILED_WITHIN_MS;
}

/**
 * The cure's state: "none" (report it and show the calm screen), "reloading" ("One moment…" while the page reloads
 * itself) or "waiting" (the site did not answer: the page waits for it, and says how to get on meanwhile).
 */
export type CureState = "none" | "reloading" | "waiting";

/**
 * Whether this error is cured by reloading the page once, and the reload itself. True for a chunk that did not arrive,
 * not already reloaded for one in the last minute (the same key and minute as the first-load cure, lib/chunk-cure.ts),
 * and true while that first-load cure is already reloading the page: then it is the same failure, so "One moment…" and
 * no report (review of 7c1faac, 15 November 2026: the two cures together showed "Something went wrong" and alerted
 * the managers). The reload waits until the site answers (whenSiteAnswers), so offline or with signal but no data the
 * visitor sees "One moment…" until it can land, not the browser's own error page; the minute starts at the reload.
 * While the site does not answer, "waiting": the screen also gives the ways on, so it is never a dead end.
 * Without session storage there is no way to stop a reload loop, so the error is reported as before; that includes
 * storage that can be read but not written (a full one), found only when the reload is due.
 */
export function useReloadCure(error: BoundaryError): CureState {
  const [cure, setCure] = useState<CureState>(() => {
    if (typeof window === "undefined" || !curedByReload(error)) return "none";
    if ((window as Reloading)[RELOADING_FLAG]) return "reloading";
    try {
      return Date.now() - Number(sessionStorage.getItem(CURE_KEY) ?? 0) > CURE_WINDOW_MS ? "reloading" : "none";
    } catch {
      return "none";
    }
  });
  const curing = cure !== "none";
  useEffect(() => {
    if (!curing || (window as Reloading)[RELOADING_FLAG]) return;
    return whenSiteAnswers(
      () => {
        try {
          sessionStorage.setItem(CURE_KEY, String(Date.now()));
        } catch {
          // Not written, so a reload could loop: the calm screen and the report instead of "One moment…" for ever.
          setCure("none");
          return;
        }
        (window as Reloading)[RELOADING_FLAG] = true;
        window.location.reload();
      },
      () => setCure("waiting"),
    );
  }, [curing]);
  return cure;
}

/**
 * What shows for the moment the page takes to reload itself: no alarm, nothing to do. If the site does not answer
 * (the phone's data is off, or has run out), the ways on as well, without blaming the site or saying the team was told:
 * try again, the homepage, or a call, which needs no data (review of 666b037, 15 November 2026: "One moment…" alone,
 * with nothing to tap, stayed for good).
 */
export function ReloadingScreen({ waiting = false }: { waiting?: boolean }) {
  const phone = site.phones[0];
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-6 px-5 text-center">
      <Wordmark className="h-7 w-auto md:h-8" />
      <div role="status" className="flex max-w-md flex-col items-center gap-3 text-text-secondary">
        <p>One moment…</p>
        {waiting && (
          <p className="leading-relaxed">
            We can&apos;t reach Sabicars right now. Check your data or Wi-Fi. This page will open by itself as soon as the line is
            back.
          </p>
        )}
      </div>
      {waiting && (
        <>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button type="button" onClick={() => window.location.reload()}>
              Try again
            </Button>
            <ButtonAnchor href="/" variant="secondary">
              Back to the homepage
            </ButtonAnchor>
          </div>
          <p className="text-text-secondary">
            Or call{" "}
            <a href={`tel:${phone.e164}`} className="figures whitespace-nowrap text-text-primary underline underline-offset-4 hover:text-accent-text">
              {phone.display}
            </a>
          </p>
        </>
      )}
    </main>
  );
}

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
