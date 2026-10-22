"use client";

import { ErrorReport, ErrorScreen, type BoundaryError } from "@/components/site/ErrorReport";

/**
 * The error boundary for every page under the root layout: a page that
 * throws while rendering, or a client component that throws, lands here
 * instead of on a blank screen. The error is reported to the site
 * (ErrorReport) and the visitor is given a way on (ErrorScreen).
 *
 * Errors in the root layout itself fall through to global-error.tsx.
 */
export default function ErrorPage({ error, reset }: { error: BoundaryError; reset: () => void }) {
  return (
    <>
      <ErrorReport error={error} />
      <ErrorScreen reset={reset} />
    </>
  );
}
