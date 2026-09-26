import { requireStaff } from "@/lib/auth";
import { arrivalsSince, renderNewsletter } from "@/lib/newsletter";

/**
 * This Friday's newsletter, exactly as a subscriber will see it — built from
 * the arrivals of the last seven days. Nothing is sent.
 */
export async function GET() {
  const me = await requireStaff();
  const cars = await arrivalsSince(me.dealerId, new Date(Date.now() - 7 * 86_400_000));
  if (!cars.length) {
    return new Response(
      "<p style='font-family:sans-serif;padding:2rem'>No vehicles were listed in the last seven days, so this Friday's newsletter would not be sent.</p>",
      {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      },
    );
  }
  const { html } = renderNewsletter(
    {
      kicker: "New this week",
      headline: cars.length === 1 ? "One new arrival at Sabicars." : `${cars.length} new arrivals at Sabicars.`,
      intro:
        "Photographed, priced and ready to inspect at the showroom. Every one can be bought outright or on the 40% Drive Plan — you pay 40%, Autochek finances the rest once it approves.",
      vehicles: cars,
      campaign: "preview",
    },
    "#unsubscribe-preview",
  );
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}
