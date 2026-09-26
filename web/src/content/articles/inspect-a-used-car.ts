import type { Block } from "@/lib/blog/blocks";

/**
 * How to inspect a used car — a rewrite of the old "5 Things to Check Before
 * Buying a Used Car in Lagos" at the same address. General inspection
 * practice only; nothing here depends on a figure that can go out of date.
 */
export const inspectAUsedCar = {
  slug: "5-things-to-check-before-buying-a-used-car-in-lagos",
  title: "How to inspect a used car in Lagos in 20 minutes",
  category: "Buying Guide",
  standfirst:
    "Walk round it, look under it, drive it — in that order. Twenty minutes tells you more than any seller’s story, including whether the car has ever been under water.",
  coverImageUrl: "https://res.cloudinary.com/dbmtqpex2/image/upload/v1784373596/sabicars/yzrmhvi1q1njcpkdgrkg.jpg",
  tags: ["inspection", "used-car"],
  blocks: [
    {
      type: "p",
      text: "A used car can be washed, polished and parked in the shade in a way that hides almost everything. What it cannot hide is twenty minutes with someone who knows where to look.",
    },
    {
      type: "p",
      text: "You do not need to be a mechanic. You need an order to work in, a torch, and the patience to look in the places sellers hope you won’t. This guide gives you all three — and one game worth playing before you ever meet a car that has been through a Lagos flood.",
    },
    {
      type: "summary",
      items: [
        "Work in order: **walk round, look under, get inside, then drive**. Twenty minutes is enough.",
        "The places that tell the truth are the ones nobody cleans: **the boot floor, the seat rails, the wiring**.",
        "Flood cars look perfect. Learn the **six signs** below before you look at any car.",
        "**No money changes hands** before the inspection — and bring a mechanic if you can.",
        "The **chassis number** on the car must match every document.",
      ],
    },

    { type: "h2", text: "The walk-around" },
    {
      type: "p",
      text: "Start at the front and walk round the car the way a buyer should — then under the bonnet, into the driver’s seat, and out onto the road. Scroll, and walk it with us:",
    },
    { type: "illustration", name: "walkaround" },
    {
      type: "callout",
      tone: "tip",
      title: "Look in daylight, and bring a torch",
      text: "Evening light and a fresh wash hide ripples, overspray and mismatched paint. Daylight and a torch find them.",
    },

    { type: "h2", text: "Has it been under water?" },
    {
      type: "p",
      text: "Every rainy season, Lagos floods — and some cars that arrive as tokunbo were written off abroad after floods of their own. A flood car can look perfect for months. Then the electrics start to fail, the rust starts from the inside, and there is no fixing either.",
    },
    {
      type: "p",
      text: "The water leaves the same marks every time, in places nobody thinks to clean. Watch it rise and fall — then see if you can find all six:",
    },
    { type: "illustration", name: "flood-detective" },
    {
      type: "callout",
      tone: "warning",
      title: "A new carpet in an old car",
      text: "It is not proof of anything — but ask why it was replaced. Flood-damaged cars are often re-carpeted to hide the silt underneath.",
    },

    { type: "h2", text: "Tokunbo or Nigerian-used?" },
    {
      type: "p",
      text: "Both can be excellent buys, and both have their own risks. Know which one you are looking at, and what to check for it:",
    },
    {
      type: "table",
      head: ["Kind", "What is good", "What to check"],
      rows: [
        [
          "Tokunbo (foreign-used)",
          "Often lower mileage, and has not yet met Nigerian roads.",
          "Flood or accident history abroad, and customs papers that match the chassis number.",
        ],
        [
          "Nigerian-used",
          "A local history you can ask about, often a known previous owner.",
          "Suspension worn by rough roads, the registration history, and signs the mileage has been wound back.",
        ],
      ],
    },

    { type: "h2", text: "The papers" },
    {
      type: "list",
      items: [
        "**The chassis number** stamped on the car matches every document you are shown.",
        "**Tokunbo:** the customs papers showing duty was paid on this car.",
        "**Nigerian-used:** the registration history and proof of ownership, in the seller’s name.",
        "**The seller:** the person taking your money is the person — or the company — named on the papers.",
      ],
    },
    {
      type: "callout",
      tone: "warning",
      title: "The odometer",
      text: "Mileage can be wound back. A worn-smooth steering wheel, tired pedal rubbers and a sagging driver’s seat on a “low-mileage” car are telling you the truth.",
    },
    {
      type: "quote",
      text: "The places that tell the truth are the ones nobody cleans.",
    },

    { type: "h2", text: "Buying at Sabicars" },
    {
      type: "p",
      text: "Every car in the Sabicars showroom can be inspected before any money changes hands, and you are welcome to bring your own mechanic. Use this guide on us too — a good car has nothing to hide.",
    },

    { type: "h2", text: "Questions buyers ask" },
    {
      type: "faq",
      items: [
        {
          q: "How long should an inspection take?",
          a: "About twenty minutes for a first look, done in order. If the car passes, have your mechanic spend longer on anything that worried you.",
        },
        {
          q: "Do I need a mechanic?",
          a: "Not for a first look — this guide covers it. For the final decision, a mechanic you trust is worth every naira. At Sabicars you are welcome to bring one.",
        },
        {
          q: "What is the surest sign of a flood car?",
          a: "Rust where water should never reach: the seat rails, their bolts, and the metal under the carpet. Paint can hide a lot; it rarely covers those.",
        },
        { q: "Should I pay a deposit before I see the car?", a: "No. See it, inspect it and check the papers first." },
      ],
    },
    {
      type: "p",
      text: "Twenty minutes, in order, with a torch. It is the cheapest insurance you will ever buy on a car.",
    },
    { type: "cta", kind: "inventory" },
  ] satisfies Block[],
};
