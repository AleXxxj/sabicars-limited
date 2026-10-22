import type { Instrumentation } from "next";

/**
 * Every error thrown while serving a request — a page render, a server
 * action, a route handler — is recorded as an incident and the managers are
 * told (lib/incidents.ts). Next.js calls this hook itself; nothing in the
 * app has to remember to report.
 *
 * Only the Node.js runtime has the database; the edge runtime has nothing to
 * record with, so it logs instead.
 */
export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  if (process.env.NEXT_RUNTIME !== "nodejs") {
    console.error("[edge error]", request.path, error);
    return;
  }
  const err = error instanceof Error ? error : new Error(typeof error === "string" ? error : "Unknown error");
  const digest = (error as { digest?: string } | null)?.digest ?? null;
  const { recordIncident } = await import("@/lib/incidents");
  await recordIncident({
    kind: "server",
    message: err.message,
    stack: err.stack ?? null,
    path: request.path,
    method: request.method,
    digest,
  });
  void context;
};
