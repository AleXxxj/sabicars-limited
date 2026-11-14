#!/usr/bin/env tsx
/**
 * Which small moving picture an article's card shows (src/lib/guide-visual.ts), proved on every article published on
 * 14 November 2026 and on the cases that could go wrong: an article about two things, a tag that only looks like
 * "bus", an article with no tags. Part of `npm run build`: a card never ships with a picture that says the wrong thing.
 */
import { GUIDE_VISUAL_PARTS, GUIDE_VISUALS, guideVisual, type GuideVisualKind } from "../src/lib/guide-visual";

type Case = [name: string, post: { title: string; category: string; tags?: string[] | null }, want: GuideVisualKind];

const cases: Case[] = [
  // The seven articles on the site, as published.
  ["the tokunbo truck guide: a truck on the road", { title: "Buying a tokunbo truck in Nigeria: the complete guide", category: "Buying Guide", tags: ["truck", "tokunbo", "commercial"] }, "road"],
  ["the best SUVs: five bars, best first", { title: "The best SUVs for Nigerian roads: five that can take it, and who each one is for", category: "Buying Guide", tags: ["suv", "highlander", "prado", "lexus-gx", "mercedes-gle", "range-rover"] }, "rank"],
  ["Highlander vs GX 460: two bars", { title: "Toyota Highlander vs Lexus GX 460: which one should you buy?", category: "Comparison", tags: ["highlander", "lexus-gx", "suv", "comparison"] }, "versus"],
  ["the Hummer bus guide: a bus's seats", { title: "The Toyota Hiace Hummer bus: the complete buyer’s guide", category: "Buying Guide", tags: ["toyota-hiace-hummer", "hummer-bus"] }, "seats"],
  ["under ₦5 million: a budget line, before its Drive Plan tag", { title: "Best cars under ₦5 million in Nigeria (2026): what the money really buys", category: "Buying Guide", tags: ["budget", "drive-plan"] }, "budget"],
  ["the Drive Plan article: the 40% then the months", { title: "Drive now, pay monthly: how the 40% Drive Plan really works", category: "Financing", tags: ["drive-plan"] }, "plan"],
  ["the inspection guide: ticks", { title: "How to inspect a used car in Lagos in 20 minutes", category: "Buying Guide", tags: ["inspection", "used-car"] }, "check"],
  // Cases that could go wrong.
  ["no tags, a plain guide: ticks", { title: "What to ask before you pay", category: "Buying Guide", tags: null }, "check"],
  ["a comparison named only in its title", { title: "Prado versus Land Cruiser", category: "Buying Guide", tags: [] }, "versus"],
  ['"vs." with a full stop', { title: "Camry vs. Corolla in 2026", category: "Buying Guide" }, "versus"],
  ['"business" is not a bus', { title: "Cars for a small business", category: "Buying Guide", tags: ["business"] }, "check"],
  ["a school-bus tag is a bus", { title: "Transport for your school", category: "Buying Guide", tags: ["school-bus"] }, "seats"],
  ['"top 5" is a ranking', { title: "Top 5 family cars for Lagos", category: "Buying Guide" }, "rank"],
  ["a loan article named only in its title", { title: "Can I get a car loan with a small salary?", category: "Buying Guide" }, "plan"],
];

let failed = 0;
for (const [name, post, want] of cases) {
  const got = guideVisual(post);
  if (got !== want) {
    failed++;
    console.error(`✗ ${name}: got "${got}", want "${want}"`);
  } else console.log(`✓ ${name}`);
}
// Every picture has marks to draw.
for (const kind of GUIDE_VISUALS) {
  if (!(GUIDE_VISUAL_PARTS[kind] > 0)) {
    failed++;
    console.error(`✗ the "${kind}" picture has no marks`);
  }
}
console.log(failed ? `\n${failed} guide-picture check(s) failed` : `\nAll ${cases.length} guide-picture checks passed`);
process.exit(failed ? 1 : 0);
