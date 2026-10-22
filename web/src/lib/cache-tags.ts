/**
 * Names for the parts of Next's data cache that public pages read from.
 *
 * A page a crowd can open (the inventory, the articles) reads its data from
 * the cache, not the database, and the cache refreshes itself after a short
 * while. When staff change something, the tag is expired at once —
 * revalidateTag(TAGS.inventory, { expire: 0 }) in lib/public-pages.ts, and
 * TAGS.blog in the article actions — so a sold car or a new article shows
 * straight away rather than when the timer runs out.
 */
export const TAGS = {
  /** Cars on sale, their photos and verification marks, and everything counted from them. */
  inventory: "inventory",
  /** Published articles. */
  blog: "blog",
  /**
   * The makes and models in stock that every page's footer lists. Kept apart
   * from inventory on purpose: nearly every page carries the footer, so if a
   * photo upload expired it, a ten-photo upload would rebuild the whole site
   * ten times. It changes only when stock itself does (a car listed, priced,
   * sold or taken down).
   */
  terms: "terms",
} as const;
