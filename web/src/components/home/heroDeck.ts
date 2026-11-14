/**
 * The order of the home hero's slides.
 *
 * Pure, with no React and no database: the server page builds the list and
 * the client slideshow (HeroSlides.tsx) plays it.
 */

export interface HeroSlide {
  /**
   * Which set of words shows over this photo: 0 is the page's opening
   * headline, 1 and up is a service's own (the page passes the words in that
   * order).
   */
  head: number;
  src: string;
  /** The photo's width over its height, when known: the hero shows the whole photo, and needs its shape to place it. */
  ratio?: number | null;
  /** The car in the photo: "2019 Toyota Hiace Hummer 2". */
  name: string;
  /** Said after the name: the car's price, or null when there is nothing to add. */
  note: string | null;
  /** The car's own page. */
  href: string;
  /** What a screen reader calls a worded slide's segment ("40% Drive Plan"); without it the segment is called by the car's name. */
  label?: string;
}

/**
 * One slide for each set of words, each over a different car, so one turn of
 * the slideshow never says or shows the same thing twice (the owner, 14
 * November 2026: "i dont want a repeatative hero"). Before this the standing
 * headline came back on every car slide, and a service slide borrowed the
 * next car's photo, so that car followed with the same picture.
 *
 * A set of words can bring its own photo: the car the owner chose for that
 * slide in Admin, Audience, or the Hummer slide's Hummer. The others take the
 * cars ticked for the hero in turn, skipping any car a slide has claimed, and
 * then the `fill` cars (others in stock) when there are more slides than
 * cars. A photo is never shown twice running, nor last and then first as the
 * show comes round, when there is another to use. There are as many slides
 * as sets of words, no more: a ticked car that no slide took is not shown.
 * With no cars there is nothing to show.
 */
export function heroDeck(cars: HeroSlide[], heads: (Pick<HeroSlide, "head" | "label"> & { photo?: HeroSlide | null })[], fill: HeroSlide[] = []): HeroSlide[] {
  if (cars.length === 0) return [];
  const claimed = new Set(heads.flatMap((h) => (h.photo ? [h.photo.href] : [])));
  const free = cars.filter((c) => !claimed.has(c.href));
  const more = fill.filter((c) => !claimed.has(c.href) && !cars.some((k) => k.href === c.href));
  // Every car claimed and nothing to fill with: the unclaimed slides share the cars rather than go without a photo.
  const pool = free.length + more.length ? [...free, ...more] : cars;
  let next = 0;
  const worded: HeroSlide[] = [];
  heads.forEach((h, i) => {
    let photo = h.photo ?? null;
    if (!photo) {
      // The next cars in turn, best first: one that is neither the photo before it nor (on the last slide) the first
      // photo; failing that, one that at least is not the photo before it; failing that, the next car.
      const turn = pool.map((_, k) => (next + k) % pool.length);
      const before = worded.at(-1)?.href;
      const first = i === heads.length - 1 && i > 1 ? worded[0]?.href : undefined;
      const k = turn.find((n) => pool[n].href !== before && pool[n].href !== first) ?? turn.find((n) => pool[n].href !== before) ?? turn[0];
      photo = pool[k];
      // Count on from the car taken, so one that was passed over still gets its turn only when the pool comes round.
      next += turn.indexOf(k) + 1;
    }
    worded.push({ ...photo, head: h.head, label: h.label });
  });
  return worded;
}
