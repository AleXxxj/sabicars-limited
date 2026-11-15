"use client";

import { ErrorReport, ErrorScreen, ReloadingScreen, useReloadCure, type BoundaryError } from "@/components/site/ErrorReport";

/**
 * The error boundary for every page under the root layout: a page that
 * throws while rendering, or a client component that throws, lands here
 * instead of on a blank screen. The error is reported to the site
 * (ErrorReport) and the visitor is given a way on (ErrorScreen).
 *
 * A piece of code that did not arrive (a dropped connection, a page open
 * across an update) is cured instead: the page reloads itself once, and
 * nothing is reported unless it happens again (useReloadCure).
 *
 * Errors in the root layout itself fall through to global-error.tsx.
 */
export default function ErrorPage({ error, reset }: { error: BoundaryError; reset: () => void }) {
  const cure = useReloadCure(error);
  if (cure !== "none") return <ReloadingScreen waiting={cure === "waiting"} />;
  return (
    <>
      <ErrorReport error={error} />
      <ErrorScreen reset={reset} />
    </>
  );
}
