/**
 * Waiting has a limit. A dependency that never answers — the sign-in service,
 * the database pooler on a bad minute — used to hold an admin page for the
 * whole 60 seconds Vercel allows, and the owner saw a 504. A deadline turns
 * that into a clear error in seconds, with the error screen's "try again".
 */
export class DeadlineError extends Error {
  constructor(what: string, ms: number) {
    super(`${what} did not answer within ${Math.round(ms / 1000)} seconds. Please try again.`);
    this.name = "DeadlineError";
  }
}

/** The promise's value, or a DeadlineError once `ms` have passed. The underlying work is not cancelled, only no longer waited for. */
export function withDeadline<T>(work: Promise<T>, ms: number, what: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new DeadlineError(what, ms)), ms);
  });
  return Promise.race([work, late]).finally(() => clearTimeout(timer));
}

/** The promise's value, or `fallback` once `ms` have passed or it fails: for a figure the page can do without, like a badge count. */
export function orFallback<T>(work: Promise<T>, ms: number, fallback: T): Promise<T> {
  return withDeadline(work, ms, "a count").catch(() => fallback);
}

/** How long one call to Supabase may take: its auth service answers in well under a second when well. */
export const SUPABASE_CALL_MS = 8000;

/** fetch with a deadline, for the Supabase client: a call that hangs is abandoned rather than waited on. */
export const timedFetch: typeof fetch = (input, init) => fetch(input, { ...init, signal: init?.signal ?? AbortSignal.timeout(SUPABASE_CALL_MS) });

/** Slower than this is worth a line in the log, with its name: the only way to see where an admin page spent its time. */
const SLOW_MS = 1500;

/** The promise's value, and a log line when it took longer than SLOW_MS or failed — Vercel keeps console output, nothing else. */
export async function timed<T>(label: string, work: Promise<T>): Promise<T> {
  const started = Date.now();
  try {
    const value = await work;
    const ms = Date.now() - started;
    if (ms > SLOW_MS) console.warn(`[slow] ${label} took ${ms} ms`);
    return value;
  } catch (e) {
    console.warn(`[slow] ${label} failed after ${Date.now() - started} ms: ${e instanceof Error ? e.message : String(e)}`);
    throw e;
  }
}
