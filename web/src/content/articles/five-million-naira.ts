import type { Block } from "@/lib/blog/blocks";

/**
 * What ₦5 million buys — a rewrite of the old "Best Cars Under ₦5 Million"
 * guide at the same address. The models are the ones the old guide
 * recommended; market prices for them are not printed, because they move
 * every month. What the money reaches at Sabicars is live from the showroom.
 */
export const fiveMillionNaira = {
  slug: "best-cars-under-5-million-in-nigeria-2026-buyers-guide",
  title: "Best cars under ₦5 million in Nigeria (2026): what the money really buys",
  category: "Buying Guide",
  standfirst:
    "₦5 million still buys a car in 2026 — an older one, bought carefully. Or it can be the 40% that drives home something newer. Here is how to choose, and what to buy either way.",
  coverImageUrl: "https://res.cloudinary.com/dbmtqpex2/image/upload/v1790185491/sabicars/x4uotw9pdeeaaiy4khgi.jpg",
  tags: ["budget", "drive-plan"],
  blocks: [
    {
      type: "p",
      text: "Five million naira is a strange amount in 2026. It is serious money — and it is no longer new-car money, or anywhere near it. What it buys depends less on the amount than on one decision: whether you spend it, or use it.",
    },
    {
      type: "p",
      text: "Spent in cash, it buys an older car — and there are good ones, if you know which to look for. Used as a 40% deposit, it reaches a car two and a half times the price. Neither answer is right for everyone. By the end of this guide you will know which is right for you.",
    },
    {
      type: "summary",
      items: [
        "In cash, ₦5 million is **older-car money**: think Toyota and Honda saloons from the 2000s, bought carefully.",
        "As a **40% Drive Plan deposit**, the same money reaches a car priced up to **₦12.5 million**.",
        "Take the **four-question quiz** below to match your money and your life to a plan — and to real cars.",
        "Whatever you buy, **inspect it first**.",
      ],
    },

    { type: "h2", text: "Your money, two ways" },
    {
      type: "p",
      text: "Start with the amount you actually have. On the left, what it buys in cash; on the right, what it reaches as a Drive Plan deposit — both against the cars in the Sabicars showroom today:",
    },
    { type: "illustration", name: "deposit-stretch", caption: "Live from the showroom. Change the amount and watch both lanes move." },

    { type: "h2", text: "If you are paying cash: the dependable five" },
    {
      type: "p",
      text: "At this money, you are buying reliability, not features. These are the cars Nigerian mechanics know best and Nigerian buyers trust most — which is exactly why they are easy to fix and easy to sell on.",
    },
    { type: "h3", text: "Toyota Corolla (2003 – 2006)" },
    {
      type: "p",
      text: "The benchmark. Frugal, tough, and every part is on every shelf. Ideal for a first car, for town driving, and for ride-hailing.",
    },
    { type: "h3", text: "Toyota Camry (2002 – 2005)" },
    {
      type: "p",
      text: "The one Nigerians call *Big Daddy*: more room and more comfort than a Corolla, with the same reputation for going on and on.",
    },
    { type: "h3", text: "Honda Accord (2003 – 2007)" },
    {
      type: "p",
      text: "Sharper to drive and well equipped. Check the automatic gearbox with extra care — a smooth change is what you are paying for.",
    },
    { type: "h3", text: "Hyundai Accent (2011 – 2013)" },
    { type: "p", text: "Newer for the money, light on fuel, and simple. A sensible small car for city life." },
    { type: "h3", text: "Kia Rio (2010 – 2013)" },
    { type: "p", text: "The Accent’s cousin, with the same strengths: a younger car than the money usually buys, cheap to run." },
    {
      type: "callout",
      tone: "warning",
      title: "At this money, condition is everything",
      text: "Two cars of the same model and year can be worlds apart. A well-kept 2004 beats a neglected 2006 every time — so inspect before you pay. Our [20-minute inspection guide](/blog/5-things-to-check-before-buying-a-used-car-in-lagos) shows you how.",
    },

    { type: "h2", text: "Which is right for you?" },
    {
      type: "p",
      text: "Four questions. Answer honestly, and you will get a straight suggestion — and the cars in the showroom that fit it.",
    },
    { type: "illustration", name: "budget-quiz" },

    { type: "h2", text: "Tokunbo or Nigerian-used?" },
    {
      type: "p",
      text: "At this price you will see both. Tokunbo cars often have lower mileage and have not met Nigerian roads yet; Nigerian-used cars come with a local history you can ask about. Either can be a great buy — the inspection decides, not the label.",
    },

    { type: "h2", text: "Questions buyers ask" },
    {
      type: "faq",
      items: [
        {
          q: "Can I still buy a good car for ₦5 million in 2026?",
          a: "Yes — an older, well-kept car from a dependable make. Condition matters more than the year, so inspect carefully before you pay.",
        },
        {
          q: "Is it better to pay cash or use the Drive Plan?",
          a: "Cash means no repayments and an older car. The Drive Plan means a newer, bigger car and a monthly repayment to Autochek. The quiz above helps you decide which fits your life.",
        },
        {
          q: "Does Sabicars sell cars under ₦5 million?",
          a: "The showroom starts above that today. But ₦5 million as a 40% deposit reaches cars in it now — and the [Sourcing Desk](/find) can look for a specific car in your budget.",
        },
      ],
    },
    {
      type: "p",
      text: "Spend it or use it — just decide on purpose. ₦5 million, used well, still drives you somewhere good.",
    },
    { type: "cta", kind: "drive-plan" },
  ] satisfies Block[],
};
