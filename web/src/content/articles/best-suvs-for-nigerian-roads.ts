import type { Block } from "@/lib/blog/blocks";

/**
 * The best SUVs for Nigerian roads — the rewrite of the old site's
 * blog/top-5-suvs-nigeria-2025.html (redirected here). Same five SUVs; the
 * unverifiable parts (an unnamed customer quote, "warranty on every vehicle",
 * "drive home same day", an unconfirmed fleet order) are gone, and nothing in
 * it dates with the stock.
 */
export const bestSuvsForNigerianRoads = {
  slug: "best-suvs-for-nigerian-roads",
  title: "The best SUVs for Nigerian roads: five that can take it, and who each one is for",
  category: "Buying Guide",
  standfirst:
    "Potholes on the way to work, floods every rainy season, a long run to Abuja at Christmas. Five SUVs handle Nigerian roads better than most — but none of them is best at everything. Pick your road and watch them race.",
  coverImageUrl: "https://res.cloudinary.com/dbmtqpex2/image/upload/v1782168037/sabicars/ku5qarj1cyjr8yagesin.jpg",
  tags: ["suv", "highlander", "prado", "lexus-gx", "mercedes-gle", "range-rover"],
  blocks: [
    {
      type: "p",
      text: "Nigerian roads ask more of a car than almost anywhere. A pothole that would make the news abroad is a Tuesday on the way to Ikeja. The same car that crawls through Lekki traffic in the morning may be on the Lagos–Ibadan expressway by evening, and wading through a flooded street by July.",
    },
    {
      type: "p",
      text: "That is why SUVs rule here — and why these five are the ones Nigerians keep coming back to. Each is excellent. Each is excellent at *different things*. Pick the road you drive most, and watch them race it.",
    },
    {
      type: "summary",
      items: [
        "**Toyota Highlander**: the all-rounder. The most economical, the roomiest for seven, the easiest to keep.",
        "**Lexus GX 460** and **Toyota Land Cruiser Prado**: built like trucks, for bad roads and floods.",
        "**Mercedes-Benz GLE** and **Range Rover Sport**: the most luxurious, and the most demanding to keep.",
        "Every one of them is only as good as its condition: **inspect before you pay**.",
      ],
    },

    { type: "h2", text: "Pick your road" },
    { type: "illustration", name: "suv-race" },
    {
      type: "p",
      text: "Try every road. The order changes — and that is the whole point. The best SUV is the one built for the road *you* drive.",
    },

    { type: "h2", text: "1. Toyota Highlander" },
    {
      type: "p",
      text: "The one most Lagos families end up with, for good reasons. It is built like a car, so it rides smoothly, drives easily in traffic and uses the least fuel of the five. Seven people fit, and adults survive the third row. Every mechanic knows it, every parts market stocks it — and when you sell, buyers queue.",
    },
    {
      type: "p",
      text: "Where it gives way: proper off-road driving and deep water. It copes with bad roads; it is not built for no road.",
    },
    { type: "cars", term: "toyota-highlander", limit: 3, title: "Highlanders in the showroom now" },

    { type: "h2", text: "2. Lexus GX 460" },
    {
      type: "p",
      text: "A Land Cruiser Prado underneath, a Lexus inside. The body sits on a steel ladder frame, a V8 drives all four wheels full-time, and there is a low range for the worst tracks. It takes floods and broken roads in its stride, and keeps everyone in leather-lined calm while it does.",
    },
    {
      type: "p",
      text: "The price of all that is fuel: the V8 is thirsty, and the third row is best for children. We weigh it against the Highlander in detail in [Toyota Highlander vs Lexus GX 460](/blog/toyota-highlander-vs-lexus-gx-460).",
    },
    { type: "cars", term: "lexus-gx-460", limit: 3, title: "The GX 460 in the showroom now" },

    { type: "h2", text: "3. Toyota Land Cruiser Prado" },
    {
      type: "p",
      text: "The legend. Body-on-frame, four-wheel drive, and a reputation across Africa for simply refusing to stop. It is at home on the worst roads in the country and on the expressway, and it holds its value like few vehicles anywhere.",
    },
    {
      type: "p",
      text: "Prados come with different petrol and diesel engines, depending on the market they were built for. Check which one you are looking at — it decides the running costs.",
    },
    { type: "cars", term: "toyota-land-cruiser-prado", limit: 3, title: "Prados in the showroom now" },

    { type: "h2", text: "4. Mercedes-Benz GLE" },
    {
      type: "p",
      text: "European luxury with SUV practicality: a beautiful cabin, strong engines, 4MATIC all-wheel drive and real presence. On the expressway it is supremely comfortable.",
    },
    {
      type: "p",
      text: "Budget honestly for upkeep. Parts cost more than a Toyota’s, and it deserves a mechanic who knows Mercedes-Benz — not one learning on your car. Most GLEs you will see seat five.",
    },
    { type: "cars", term: "mercedes-benz-gle", limit: 3, title: "The GLE in the showroom now" },

    { type: "h2", text: "5. Range Rover Sport" },
    {
      type: "p",
      text: "The ultimate status SUV, and genuinely capable: air suspension that lifts it over obstacles and through water, and off-road systems that make hard ground look easy. Nothing arrives quite like it.",
    },
    {
      type: "p",
      text: "It is also the most demanding of the five to own. Repairs are costly and specialist, so buy only after a thorough inspection, with a trusted Land Rover mechanic on call. If there is none in the showroom when you read this, the [Sourcing Desk](/find?want=Range%20Rover%20Sport) can look for one.",
    },

    { type: "h2", text: "All five, side by side" },
    {
      type: "p",
      text: "The race shows who wins each road. This shows each SUV’s whole character. Pick any two and watch the shapes change:",
    },
    { type: "illustration", name: "suv-radar" },

    { type: "h2", text: "Before you buy any of them" },
    {
      type: "list",
      items: [
        "**Inspect it in daylight**, with a torch — and with your own mechanic if you can. Our [20-minute guide](/blog/5-things-to-check-before-buying-a-used-car-in-lagos) walks you through it.",
        "**Look for flood damage.** SUVs are the cars people drive into water. Rust on the seat rails and silt under the carpet give it away.",
        "**Match the chassis number** on the car to every document.",
        "**Test the four-wheel drive** on the GX and the Prado: low range should engage cleanly.",
        "**Price the upkeep before the car.** A cheap GLE or Range Rover can be the most expensive car you ever buy.",
      ],
    },
    {
      type: "callout",
      tone: "note",
      title: "About our ratings",
      text: "The ratings behind the race and the chart are our judgement of what each SUV is known for, weighed by how Nigerians use them. They are not measurements — drive the car, and trust your mechanic.",
    },

    { type: "h2", text: "Questions buyers ask" },
    {
      type: "faq",
      items: [
        {
          q: "Which SUV is best for Nigerian roads?",
          a: "It depends on the road. For everyday Lagos driving and family life, the Toyota Highlander is the best all-rounder. For bad roads and floods, the Land Cruiser Prado and the Lexus GX 460 are built for it. For luxury, the Mercedes-Benz GLE and the Range Rover Sport — with higher running costs.",
        },
        {
          q: "Which is cheapest to maintain?",
          a: "The Toyotas — the Highlander and the Prado — closely followed by the Lexus GX 460, which shares much of the Prado’s running gear. The GLE and the Range Rover Sport cost the most to keep.",
        },
        {
          q: "Which holds its value best?",
          a: "The Toyotas and the Lexus. Buyers trust the Highlander, the Prado and the GX 460, so they are always in demand when you come to sell.",
        },
        {
          q: "Can I buy an SUV on the Drive Plan?",
          a: "Yes, when it is listed on Sabicars’ Autochek store. You pay 40% and Autochek finances the rest, subject to its approval; the SUV leaves the showroom once Autochek approves and your 40% is paid. [How the Drive Plan works](/drive-plan).",
        },
      ],
    },
    {
      type: "p",
      text: "Pick your road, pick your SUV, and inspect it before you pay. Nigerian roads are hard on cars — the right one makes them easy on you.",
    },
    { type: "cta", kind: "inventory" },
  ] satisfies Block[],
};
