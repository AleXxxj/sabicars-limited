import type { Block } from "@/lib/blog/blocks";

/**
 * Toyota Highlander vs Lexus GX 460 — the rewrite of the old site's
 * blog/highlander-vs-lexus-gx.html (redirected here). The original promised
 * "accident-free" and "verified" stock; this one states what the two SUVs are
 * built like and lets the reader weigh them, with the stock live.
 */
export const highlanderVsGx460 = {
  slug: "toyota-highlander-vs-lexus-gx-460",
  title: "Toyota Highlander vs Lexus GX 460: which one should you buy?",
  category: "Comparison",
  standfirst:
    "Both are Toyotas underneath, both hold their value, and Lagos is full of both. But one is built like a car and the other like a truck — and that one difference decides which is right for you.",
  coverImageUrl: "https://res.cloudinary.com/dbmtqpex2/image/upload/v1784573169/sabicars/m0httpcnkxdkdwqlwcni.jpg",
  tags: ["highlander", "lexus-gx", "suv", "comparison"],
  blocks: [
    {
      type: "p",
      text: "Park them side by side and they look like close cousins: big seven-seat SUVs from the Toyota family, both famous for going on and on, both easy to sell when you are done with them. Ask a dozen Lagos owners which is better and you will get a dozen answers.",
    },
    {
      type: "p",
      text: "They are all right, because these two are built for different lives. One is a car on stilts; the other is a truck in a tailored suit. Once you see the difference — and you are about to, quite literally — choosing between them gets easy.",
    },
    {
      type: "summary",
      items: [
        "The **Highlander** is built like a car: one welded shell. Smoother and quieter on tarmac, cheaper to buy and to fuel, and roomier in the third row.",
        "The **GX 460** is built like a truck: a body on a steel ladder frame, a V8, and full-time four-wheel drive with low range. Tougher on bad roads, more luxurious, thirstier.",
        "The GX uses roughly **30% more fuel**. Work out what that means for your pocket below.",
        "Tap your priorities into **the balance** further down — it tips towards the one that suits you.",
      ],
    },

    { type: "h2", text: "The difference you cannot see" },
    {
      type: "p",
      text: "From the kerb, the differences look like styling. Underneath is where these two part ways. Drag the scanner across both and look at what each one is built on:",
    },
    { type: "illustration", name: "frame-xray" },
    {
      type: "p",
      text: "The Highlander’s body *is* its frame: one welded structure, like a saloon car’s, only bigger. That makes it lighter, lower and quieter, and it rides broken tarmac with a car’s composure.",
    },
    {
      type: "p",
      text: "The GX 460’s body sits on a separate steel ladder frame, on rubber mounts — the way the Land Cruiser Prado is built, because the GX shares the Prado’s bones. The frame takes the twisting and the knocks of a bad road so the body does not have to, and with it come full-time four-wheel drive, a low-range gearbox and a centre differential you can lock.",
    },
    {
      type: "callout",
      tone: "tip",
      title: "What that means in Lagos",
      text: "If most of your driving is tarmac — even bad tarmac — the Highlander is the more comfortable daily car. If you regularly leave the tarmac — the village road, the building site, the street that floods every July — the GX is built for it.",
    },

    { type: "h2", text: "Engine and power" },
    {
      type: "table",
      head: ["At a glance", "Toyota Highlander", "Lexus GX 460"],
      rows: [
        ["Engine", "3.5-litre V6 (on the Highlanders you will mostly see)", "4.6-litre V8"],
        ["Power", "About 270–295 hp, depending on the year", "About 301 hp"],
        ["Gearbox", "Automatic: 6-speed to 2016, 8-speed from 2017", "6-speed automatic"],
        ["Drive", "Front-wheel or all-wheel drive", "Full-time 4WD with low range"],
        ["Seats", "7 or 8", "7 (the third row suits children)"],
        ["Built", "Unibody, like a car", "Body-on-frame, like a truck"],
      ],
    },
    {
      type: "p",
      text: "The V8 is the GX’s pride: more pulling power low down, which you feel with a full load, a trailer or a steep, broken track. The Highlander’s V6 goes about its work more quietly, and wakes up on the expressway more eagerly than you might expect.",
    },
    {
      type: "p",
      text: "A note on the newest Lexus: from 2024 the **GX 550** replaced the GX 460, with a twin-turbo V6 in place of the V8. It is a newer and far more expensive car. This guide is about the GX 460 that most buyers weigh against a Highlander.",
    },

    { type: "h2", text: "What each one costs to fuel" },
    {
      type: "p",
      text: "This is where the Highlander quietly wins, every single month. Set how far you drive and what you paid at the pump this week:",
    },
    { type: "illustration", name: "fuel-duel" },

    { type: "h2", text: "Space and comfort" },
    {
      type: "p",
      text: "Both carry seven. The difference is who sits at the back. The Highlander’s third row takes adults for a short trip; the GX’s is better kept for children, and with it in use there is little room for luggage.",
    },
    {
      type: "p",
      text: "Inside, the GX is the richer place to sit — Lexus leather and trim, a hushed cabin, the feeling of an expensive car. The Highlander is well made and comfortable, especially in the upper trims, but it is a Toyota and feels like one.",
    },

    { type: "h2", text: "Price and value" },
    {
      type: "p",
      text: "Model year for model year, a GX 460 usually costs more than a Highlander: the V8, the badge and the smaller number on the market all push its price up. Both hold their value well in Nigeria, because both are known quantities — buyers trust them and mechanics understand them.",
    },
    { type: "cars", term: "toyota-highlander", limit: 3, title: "Highlanders in the showroom now" },
    { type: "cars", term: "lexus-gx-460", limit: 3, title: "The GX 460 in the showroom now" },

    { type: "h2", text: "Which one is for you?" },
    {
      type: "p",
      text: "Tap what matters to you. Each priority drops a weight on the SUV that answers it best. Watch which way the balance tips:",
    },
    { type: "illustration", name: "suv-duel" },

    { type: "h2", text: "Before you buy either" },
    {
      type: "list",
      items: [
        "**Match the chassis number** on the car to every document you are shown.",
        "**Look for flood damage**: rust on the seat rails, silt under the carpet. Our [20-minute inspection guide](/blog/5-things-to-check-before-buying-a-used-car-in-lagos) shows you where.",
        "**On a GX, test the four-wheel drive**: low range and the centre-differential lock should engage cleanly.",
        "**On either, start it cold**: listen for ticking or knocking, and watch the exhaust.",
      ],
    },
    {
      type: "quote",
      text: "One is a car on stilts; the other is a truck in a tailored suit. Choose the life, and the SUV chooses itself.",
    },

    { type: "h2", text: "Questions buyers ask" },
    {
      type: "faq",
      items: [
        {
          q: "Is the Lexus GX 460 just a Toyota Prado?",
          a: "It shares the Land Cruiser Prado’s frame, suspension design and four-wheel-drive system, and it is built by Toyota’s luxury brand. The GX adds a V8 and a far more luxurious cabin. Much of the running gear is shared, which helps with parts.",
        },
        {
          q: "Which is cheaper to maintain?",
          a: "Generally the Highlander: it is lighter, its V6 uses less fuel, and its parts are everywhere. The GX is not expensive to keep for a luxury SUV — it is a Toyota underneath — but a V8 and a four-wheel-drive system have more to service.",
        },
        {
          q: "Can a Highlander handle Nigerian roads?",
          a: "Yes. Potholes, speed bumps and bad tarmac are its daily life in Lagos, and the all-wheel-drive versions cope well in the rain. Where it is out of its depth is proper off-road driving and deep water — exactly where the GX’s frame and low range come into their own.",
        },
        {
          q: "Can I buy either on the Drive Plan?",
          a: "Yes, when the car is listed on Sabicars’ Autochek store — ask if you are not sure. You pay 40% and Autochek finances the rest, subject to its approval; the car leaves the showroom once Autochek approves and your 40% is paid. [How the Drive Plan works](/drive-plan).",
        },
      ],
    },
    {
      type: "p",
      text: "Then drive both. Ten minutes behind each wheel will tell you more than any table — and at Sabicars, you can.",
    },
    { type: "cta", kind: "drive-plan" },
  ] satisfies Block[],
};
