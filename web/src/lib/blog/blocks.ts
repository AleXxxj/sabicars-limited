import { z } from "zod";

/**
 * An article is a list of blocks, not a blob of HTML.
 *
 * Every block has one purpose and one rendering, so every article looks like
 * the same publication whoever writes it, nothing in the database is ever
 * trusted as markup, and the rich pieces — animated illustrations, live cars
 * from the showroom, video — are just blocks staff can drop in.
 *
 * Text fields accept a small, safe inline syntax: **bold**, *italic* and
 * [a link](/vehicles). Nothing else is interpreted.
 */

const text = z.string().trim().min(1).max(4000);
const short = z.string().trim().min(1).max(300);

/** Animated illustrations, drawn in code (components/blog/illustrations). */
export const ILLUSTRATIONS = {
  "hummer-anatomy": "The Hummer bus, drawn and labelled: what to look at, where",
  "drive-plan-split": "The 40% / 60% split on a real price, animated",
  "inspection-checklist": "An inspection checklist the reader ticks off",
  "route-calculator": "Will a bus pay for itself? The reader's own numbers",
  "stock-chart": "The Hummer buses in stock, plotted by year and price",
  "drive-plan-journey": "The Drive Plan as a journey: a car drives the six steps as the reader scrolls",
  "deposit-stretch": "Your money two ways: cash, or a 40% deposit, against live stock",
  "repayment-comfort": "Can you carry the repayment? Pay against Autochek's quote",
  "walkaround": "The 20-minute walk-around, played out as the reader scrolls",
  "flood-detective": "Has it been under water? A find-the-evidence game",
  "budget-quiz": "Four questions: what the reader's money should buy them",
  "frame-xray": "Drag an X-ray across a Highlander and a GX 460: unibody against body-on-frame",
  "fuel-duel": "Two fuel pumps: what the Highlander and the GX 460 cost to fuel on the reader's driving",
  "suv-duel": "A balance: the reader's priorities tip it towards the Highlander or the GX 460",
  "suv-race": "Five SUVs race the road the reader picks, with start lights and a podium",
  "suv-radar": "Five SUVs as shapes on six ratings; pick two and they morph",
  "truck-builder": "Pick the cargo; the right truck body drops onto the chassis",
  "smoke-doctor": "Crank a cold truck and diagnose the smoke: a four-round game",
  "chassis-match": "Spot the difference between the chassis number and the papers",
} as const;
export type IllustrationName = keyof typeof ILLUSTRATIONS;

export const blockSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("p"), text }),
  z.object({ type: z.literal("h2"), text: short }),
  z.object({ type: z.literal("h3"), text: short }),
  z.object({ type: z.literal("quote"), text, cite: short.optional() }),
  z.object({ type: z.literal("list"), ordered: z.boolean().optional(), items: z.array(text).min(1).max(30) }),
  z.object({ type: z.literal("callout"), tone: z.enum(["tip", "warning", "note"]), title: short.optional(), text }),
  z.object({ type: z.literal("summary"), title: short.optional(), items: z.array(text).min(1).max(12) }),
  z.object({ type: z.literal("image"), url: z.url().startsWith("https://"), alt: short, caption: short.optional() }),
  /** YouTube, TikTok, Instagram, or a Cloudinary / .mp4 clip. */
  z.object({ type: z.literal("video"), url: z.url().startsWith("https://"), caption: short.optional() }),
  z.object({
    type: z.literal("illustration"),
    name: z.enum(Object.keys(ILLUSTRATIONS) as [IllustrationName, ...IllustrationName[]]),
    caption: short.optional(),
  }),
  /** Live cards from the showroom: a search-term family (e.g. "toyota-hiace-hummer") or chosen vehicles. */
  z.object({
    type: z.literal("cars"),
    title: short.optional(),
    term: z.string().trim().max(80).optional(),
    slugs: z.array(z.string().max(120)).max(12).optional(),
    /** Everything listed with this body type, e.g. "truck". */
    body: z.enum(["sedan", "suv", "bus", "van", "pickup", "truck", "coupe", "hatchback", "wagon", "convertible", "other"]).optional(),
    limit: z.number().int().min(1).max(6).optional(),
  }),
  z.object({
    type: z.literal("table"),
    caption: short.optional(),
    head: z.array(short).min(2).max(6),
    rows: z
      .array(z.array(z.string().max(300)))
      .min(1)
      .max(30),
  }),
  z.object({
    type: z.literal("faq"),
    items: z
      .array(z.object({ q: short, a: text }))
      .min(1)
      .max(15),
  }),
  z.object({ type: z.literal("cta"), kind: z.enum(["drive-plan", "find", "fleet", "hummer", "inventory"]) }),
]);

export type Block = z.infer<typeof blockSchema>;
export const blocksSchema = z.array(blockSchema).max(300);

/** "How to inspect one" → "how-to-inspect-one": anchors for the contents list. */
export function anchorFor(heading: string): string {
  return heading
    .toLowerCase()
    .replace(/\*\*|\*|\[|\]\([^)]*\)/g, "")
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/** The words a reader actually reads, for the reading time. */
export function wordCount(blocks: Block[]): number {
  const words = (s: string) => s.split(/\s+/).filter(Boolean).length;
  let n = 0;
  for (const b of blocks) {
    if ("text" in b && typeof b.text === "string") n += words(b.text);
    if (b.type === "list" || b.type === "summary") n += b.items.reduce((t, i) => t + words(i), 0);
    if (b.type === "faq") n += b.items.reduce((t, i) => t + words(i.q) + words(i.a), 0);
    if (b.type === "table") n += b.rows.flat().reduce((t, c) => t + words(c), 0);
    // An illustration or a video holds the reader for a while too.
    if (b.type === "illustration" || b.type === "video") n += 60;
  }
  return n;
}

export const readingMinutes = (blocks: Block[]) => Math.max(1, Math.round(wordCount(blocks) / 220));

/** Plain text of a block list — for descriptions and search. */
export function plainText(blocks: Block[], limit = 300): string {
  const out: string[] = [];
  for (const b of blocks) if (b.type === "p") out.push(b.text.replace(/\*\*|\*/g, "").replace(/\[([^\]]+)\]\([^)]*\)/g, "$1"));
  const s = out.join(" ");
  return s.length > limit ? `${s.slice(0, limit - 1).trimEnd()}…` : s;
}
