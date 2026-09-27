import "server-only";
import type { VehicleWithCover } from "@/lib/repositories/vehicles";
import { formatNaira } from "@/lib/money";
import { vehicleTitle } from "@/lib/vehicle";
import { PHONE_IN_TEXT } from "./summarise";

/**
 * A stand-in for the model, for local development only — never in
 * production. It answers from the real stock with simple keyword matching, so
 * the chat window, the cards, comparisons, the callback form and the lead
 * pipeline can all be exercised before an Anthropic key exists. It is not
 * clever and does not pretend to be.
 */
export async function* devReply(message: string, stock: VehicleWithCover[], pageVehicle: VehicleWithCover | null): AsyncGenerator<string> {
  const m = message.toLowerCase();
  const pick = (list: VehicleWithCover[], n = 3) => list.slice(0, n);
  const budget = /(\d+(?:\.\d+)?)\s*(m|million)/.exec(m);
  const cap = budget ? Number(budget[1]) * 1_000_000 * 100 : null;

  let reply: string;
  if (PHONE_IN_TEXT.test(message)) {
    reply = "Thank you — I've passed your number to the team, and someone will call you during showroom hours.";
  } else if (/\b(compare|vs|versus|or the)\b/.test(m)) {
    const pool = pageVehicle
      ? [pageVehicle, ...stock.filter((v) => v.body === pageVehicle.body && v.id !== pageVehicle.id)]
      : stock.filter((v) => v.body === "suv");
    const [a, b] = pool;
    reply =
      a && b
        ? `Here they are side by side.\n\n[[compare: ${a.slug}, ${b.slug}]]\n\n(Development stand-in: the real assistant gives its honest read here.)`
        : "I need two cars to compare.";
  } else if (/call|person|human|someone/.test(m)) {
    reply = "Of course — leave your name and number and someone from the team will call you.\n\n[[callback]]";
  } else {
    const body = /suv|jeep/.test(m) ? "suv" : /bus|hummer|hiace/.test(m) ? "bus" : /saloon|sedan|car\b/.test(m) ? "sedan" : null;
    let pool = body ? stock.filter((v) => v.body === body) : stock;
    if (cap) pool = pool.filter((v) => v.priceMinor && v.priceMinor <= cap);
    const shown = pick(pageVehicle && !body && !cap ? [pageVehicle] : pool);
    reply = shown.length
      ? `Here ${shown.length === 1 ? "is one" : `are ${shown.length}`} worth a look${cap ? ` within ${formatNaira(cap)}` : ""}.\n\n[[cars: ${shown.map((v) => v.slug).join(", ")}]]\n\n${shown.map((v) => `**${vehicleTitle(v)}** — ${v.priceMinor ? formatNaira(v.priceMinor) : "price on request"}.`).join("\n")}\n\n(Development stand-in — add ANTHROPIC_API_KEY for the real assistant.)`
      : "Nothing in the showroom matches that today. The [Sourcing Desk](/find) can look for one for you.";
  }

  // Released a few characters at a time, the way a real reply streams in.
  for (let i = 0; i < reply.length; i += 6) {
    await new Promise((r) => setTimeout(r, 12));
    yield reply.slice(i, i + 6);
  }
}
