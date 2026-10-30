import { withinLimit } from "@/lib/rate-limit";
import { viewingByReference } from "@/lib/viewing-reminders";
import { viewingCalendar } from "@/lib/viewings";

export const dynamic = "force-dynamic";

/**
 * The calendar file for a booked viewing, by its reference.
 *
 * A real address, because a phone needs one: an iPhone does nothing with a
 * data: calendar link, but opens a text/calendar response in Calendar, and an
 * Android phone hands it to whichever calendar it has. The file holds the
 * time, the car and the place — nothing about the buyer — so a reference
 * that leaks tells nobody who booked.
 *
 * No Content-Disposition, on purpose: with one — even "inline" — iPhone
 * Safari files the response under Downloads instead of showing the event
 * with "Add to Calendar". The lowercase media type matters to Chrome on
 * iPhone, which rejects "text/Calendar" as an unknown file type.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ reference: string }> }) {
  const { reference } = await params;
  // Silent ceiling, so the six-character references cannot be walked through from one connection.
  if (!(await withinLimit("engage"))) return new Response("Too many requests", { status: 429 });
  const viewing = await viewingByReference(reference);
  if (!viewing) return new Response("No viewing with that reference", { status: 404 });
  return new Response(viewingCalendar(viewing.at, viewing.title, viewing.where, viewing.reference), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Cache-Control": "private, no-store",
    },
  });
}
