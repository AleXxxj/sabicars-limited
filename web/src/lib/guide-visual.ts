/**
 * The small moving picture on an article's card, chosen from what the article is about: ticks for a checklist, two bars
 * for a comparison, a bus's seats for the Hummer, a truck on the road, the 40% then the months for the Drive Plan, five
 * bars for a "best five", a budget line for "under ₦5 million". After the Adedayo guide cards (the owner, 14 November
 * 2026: "add it on our blog card too ... not something complicated").
 *
 * Read from the article's tags, category and title, so a new article gets one without anyone choosing. Pure, with no
 * React: scripts/verify-guide-visual.ts proves the choice for every article on the site. The pictures themselves are
 * in components/blog/GuideVisual.tsx and styles/guide-visual.css.
 */
export const GUIDE_VISUALS = ["check", "versus", "seats", "road", "plan", "rank", "budget"] as const;
export type GuideVisualKind = (typeof GUIDE_VISUALS)[number];

/** How many marks each picture is made of. */
export const GUIDE_VISUAL_PARTS: Record<GuideVisualKind, number> = { check: 4, versus: 2, seats: 14, road: 7, plan: 4, rank: 5, budget: 5 };

/** The picture for an article. The first rule that fits wins; anything else is a guide, and gets the ticks. */
export function guideVisual(post: { title: string; category: string; tags?: readonly string[] | null }): GuideVisualKind {
  const tags = (post.tags ?? []).map((t) => t.toLowerCase());
  const title = post.title.toLowerCase();
  const tagged = (re: RegExp) => tags.some((t) => re.test(t));
  if (/comparison/i.test(post.category) || /\bvs\.?\s|\bversus\b/.test(title)) return "versus";
  if (tagged(/hummer|(^|-)bus(es)?($|-)/) || /\bhummer\b|\bbus(es)?\b/.test(title)) return "seats";
  if (tagged(/^trucks?$/) || /\btrucks?\b/.test(title)) return "road";
  if (tagged(/^budget$/) || /\bunder ₦|\bbudget\b|\bcheap/.test(title)) return "budget";
  if (/financ/i.test(post.category) || tagged(/drive-plan|loan|financ/) || /\bdrive plan\b|\bpay monthly\b|\bloans?\b/.test(title)) return "plan";
  if (/\bbest\b|\btop \d|\b(three|four|five|six|seven|eight|nine|ten|\d+) (cars|suvs|buses|trucks)\b/.test(title)) return "rank";
  return "check";
}
