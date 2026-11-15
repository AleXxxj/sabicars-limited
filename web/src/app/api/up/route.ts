export const dynamic = "force-dynamic";

/**
 * Does the site answer at all? Nothing else is asked: no database, no other service.
 *
 * For the page's self-repair (lib/chunk-cure.ts), which reloads a page only once a reload will land. Pages come from the
 * page cache even while the database is down, so /api/health's 503 at such a time would hold a reload that works, and
 * its database check can take longer than the self-repair waits (review of 666b037, 15 November 2026). The uptime
 * monitor keeps /api/health.
 */
export function GET() {
  return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
}
