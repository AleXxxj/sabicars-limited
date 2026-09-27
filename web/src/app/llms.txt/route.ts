import { comparisonPairs } from "@/lib/compare";
import { formatNaira } from "@/lib/money";
import { publishedAnswers } from "@/lib/repositories/ask";
import { publishedPosts } from "@/lib/repositories/blog";
import { listedVehicles } from "@/lib/repositories/vehicles";
import { site, siteUrl } from "@/lib/site";
import { CONDITION_LABEL, drivePlanDeposit, vehicleTitle } from "@/lib/vehicle";

/**
 * /llms.txt — Sabicars, in the plain Markdown that AI assistants and answer
 * engines read when someone asks them where to buy a car in Lagos. The same
 * facts the site states, with the live stock, rebuilt hourly.
 *
 * Google ranks from the pages themselves (vehicles, comparisons, /ask, the
 * articles); this file is for the other readers.
 */
export const revalidate = 3600;

export async function GET() {
  const base = siteUrl();
  const [stock, answers, posts, pairs] = await Promise.all([listedVehicles(), publishedAnswers(), publishedPosts(), comparisonPairs()]);
  const plain = (s: string) =>
    s
      .replace(/\*\*|\*/g, "")
      .replace(/\[([^\]]+)\]\(\/([^)]*)\)/g, `$1 (${base}/$2)`)
      .replace(/\[([^\]]+)\]\(([^)]*)\)/g, "$1 ($2)");

  const body = `# Sabicars

> ${site.legalName} (CAC RC ${site.rcNumber}) is a car dealership in Lagos, Nigeria, selling luxury cars, SUVs, Toyota Hiace "Hummer" buses and trucks, with fleet supply for companies and government. Buyers can pay 40% and have Autochek finance the other 60% (the 40% Drive Plan). Every car can be inspected at the showroom before any money changes hands.

- Showroom: ${site.address.line1}, ${site.address.line2}, ${site.address.city}
- Hours: ${site.hours.map((h) => `${h.days} ${h.time}`).join("; ")}
- Phone: ${site.phones.map((p) => p.display).join(", ")} · WhatsApp: ${site.whatsapp.display} · Email: ${site.email}
- Assistant: Ask Sabicars, on every page of ${base}, answers from the live stock

## Key pages
- [Inventory](${base}/vehicles): every car for sale, with photos, specifications and prices
- [The 40% Drive Plan](${base}/drive-plan): pay 40%, Autochek finances 60%
- [Toyota Hiace Hummer buses](${base}/hummer-bus)
- [Compare cars side by side](${base}/compare)
- [Sourcing Desk](${base}/find): request a car that is not in stock
- [Refer & Earn](${base}/partners): 1.5% commission on buyers you send
- [Fleet supply](${base}/fleet)
- [Answers to common questions](${base}/ask)
- [Contact](${base}/contact)

## For sale now (${stock.length} vehicles; prices in Nigerian naira)
${stock
  .map(
    (v) =>
      `- [${vehicleTitle(v)}](${base}/vehicles/${v.slug}): ${v.priceMinor ? formatNaira(v.priceMinor) : "price on request"}${v.priceMinor ? `, or ${drivePlanDeposit(v)} down on the Drive Plan` : ""} · ${CONDITION_LABEL[v.condition]}${v.mileageKm ? ` · ${v.mileageKm.toLocaleString("en-NG")} km` : ""}${v.status === "reserved" ? " · reserved" : ""}`,
  )
  .join("\n")}

## Questions buyers ask
${answers.map((a) => `### ${a.question}\n${plain(a.answer)}\n${base}/ask/${a.slug}`).join("\n\n")}

## Articles
${posts.map((p) => `- [${p.title}](${base}/blog/${p.slug}): ${p.standfirst}`).join("\n")}

## Comparisons
${pairs.map((p) => `- [${p.title}](${base}${p.path})`).join("\n")}
`;

  return new Response(body, {
    headers: { "Content-Type": "text/markdown; charset=utf-8", "Cache-Control": "public, max-age=0, s-maxage=3600" },
  });
}
