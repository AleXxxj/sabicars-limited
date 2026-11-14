#!/usr/bin/env tsx
/**
 * The home hero's two rules, proved on the cases that went wrong or could.
 *
 * The order of its slides (src/components/home/heroDeck.ts): one slide for
 * each set of words, each over a different car, and nothing shown twice
 * running (the owner, 14 November 2026: "i dont want a repeatative hero").
 * The first build showed each service over the next car's photo, so that car
 * followed with the same picture.
 *
 * Which car may stand on which slide (src/lib/hero-slides.ts): the owner
 * chooses a car for a slide in Admin, Audience, and may choose a sold one;
 * but never where the slide's words would not be true of it. "Pay 40% now"
 * is never said over a car that needs 50%, has no price or is sold; "Your
 * next car is here" is never said over a sold car; the Hummer slide shows a
 * Hummer. And how long the hero video plays before the slides come back
 * (src/lib/hero-video.ts). Part of `npm run build`: a wrong rule never ships.
 */
import { heroDeck, type HeroSlide } from "../src/components/home/heroDeck";
import { heroPickProblem, readHeroPicks, type HeroCandidate, type HeroSlideKey } from "../src/lib/hero-slides";
import { parseVideoSeconds, readVideoSeconds } from "../src/lib/hero-video";

const car = (n: string): HeroSlide => ({ head: 0, src: n, name: n, note: null, href: `/${n}` });
const cars = (names: string) => names.split("").map(car);
const heads = (n: number, own: Record<number, string> = {}) => Array.from({ length: n }, (_, i) => ({ head: i, label: `h${i}`, photo: own[i] ? car(own[i]) : undefined }));
/** A deck as "head:car head:car". */
const show = (deck: HeroSlide[]) => deck.map((s) => `${s.head}:${s.name}`).join(" ");
const twiceRunning = (deck: HeroSlide[]) => deck.some((s, i) => s.href === deck[(i + 1) % deck.length].href && deck.length > 1);

const ok: HeroCandidate = { status: "available", model: "Highlander", year: 2018, priceMinor: 3_500_000_000, hasCover: true };
const problem = (key: HeroSlideKey, over: Partial<HeroCandidate> = {}) => heroPickProblem(key, { ...ok, ...over }) !== null;

const checks: [string, unknown, unknown][] = [
  // the order of the slides
  ["one slide per set of words, each its own car", show(heroDeck(cars("abcdefg"), heads(7))), "0:a 1:b 2:c 3:d 4:e 5:f 6:g"],
  ["a ticked car no slide took is not shown", heroDeck(cars("abcdefghi"), heads(4)).length, 4],
  ["a slide's own car is kept, and no other slide takes it", show(heroDeck(cars("abcdef"), heads(4, { 1: "c", 2: "a" }))), "0:b 1:c 2:a 3:d"],
  ["a slide's own car need not be ticked for the hero", show(heroDeck(cars("ab"), heads(3, { 1: "z" }))), "0:a 1:z 2:b"],
  ["more slides than cars: the fill cars lend their photos", show(heroDeck(cars("abcdef"), heads(7, { 1: "b", 2: "c" }), cars("agh"))), "0:a 1:b 2:c 3:d 4:e 5:f 6:g"],
  ["more slides than cars, nothing to fill with: none twice running, nor last then first", twiceRunning(heroDeck(cars("abcdef"), heads(7, { 1: "b", 2: "c" }))), false],
  ["three cars, seven slides: still none twice running", twiceRunning(heroDeck(cars("abc"), heads(7))), false],
  ["two cars, three slides, every car claimed: the third shares, not twice running", show(heroDeck(cars("ab"), heads(3, { 0: "a", 1: "b" }))), "0:a 1:b 2:a"],
  ["one car: every slide shows it, there is no other", show(heroDeck(cars("a"), heads(3))), "0:a 1:a 2:a"],
  ["no cars: nothing to show", heroDeck([], heads(3)).length, 0],
  ["a slide keeps its words' number and label", heroDeck(cars("ab"), heads(2))[1], { ...car("b"), head: 1, label: "h1" }],

  // which car may stand where
  ["a car on the site may stand on any slide", (["opening", "plan", "check", "sell", "find", "earn"] as const).map((k) => problem(k)), [false, false, false, false, false, false]],
  ["a reserved car may too", problem("opening", { status: "reserved" }), false],
  ["a sold car may be shown where the words are not about buying it", (["check", "sell", "find", "earn"] as const).map((k) => problem(k, { status: "sold" })), [false, false, false, false]],
  ["a sold Hummer may stand on the Hummer slide", problem("hummer", { status: "sold", model: "Hiace Hummer 2", year: 2014 }), false],
  ["never 'Your next car is here' over a sold car", problem("opening", { status: "sold" }), true],
  ["never 'Pay 40% now' over a sold car", problem("plan", { status: "sold" }), true],
  ["never 'Pay 40% now' over a 2009 car: it needs 50%", problem("plan", { year: 2009 }), true],
  ["2010 is new enough for 40%", problem("plan", { year: 2010 }), false],
  ["never 'Pay 40% now' over a car with no price", problem("plan", { priceMinor: null }), true],
  ["the Hummer slide shows a Hummer", [problem("hummer"), problem("hummer", { model: "Hiace Hummer 1" }), problem("hummer", { model: "Hiace Humer 3" })], [true, false, false]],
  ["an unlisted or draft car stands nowhere", [problem("earn", { status: "unlisted" }), problem("earn", { status: "draft" })], [true, true]],
  ["a car with no cover photo stands nowhere", problem("earn", { hasCover: false }), true],

  // reading what was stored
  ["stored picks: only known slides, only real slugs", readHeroPicks({ opening: "a", plan: "  b ", nope: "c", sell: "", find: 7 }), { opening: "a", plan: "b" }],
  ["stored picks: nothing, or not an object, is no picks", [readHeroPicks(null), readHeroPicks("x"), readHeroPicks(undefined)], [{}, {}, {}]],

  // how long the hero video plays (the owner, 14 November 2026: 20 seconds, or a number set in the admin)
  ["video seconds: none stored is 20", [readVideoSeconds(undefined), readVideoSeconds(null), readVideoSeconds("")], [20, 20, 20]],
  ["video seconds: a stored number or numeric text is used", [readVideoSeconds(30), readVideoSeconds("45")], [30, 45]],
  ["video seconds: out of range is kept within 5 to 120, halves rounded", [readVideoSeconds(1), readVideoSeconds(900), readVideoSeconds(12.6)], [5, 120, 13]],
  ["video seconds: junk is 20", [readVideoSeconds("abc"), readVideoSeconds({}), readVideoSeconds(Number.NaN)], [20, 20, 20]],
  ["typed seconds: empty is 20, a whole number is taken", [parseVideoSeconds(""), parseVideoSeconds(" 30 ")], [{ seconds: 20 }, { seconds: 30 }]],
  ["typed seconds: the limits themselves are allowed", [parseVideoSeconds("5"), parseVideoSeconds("120")], [{ seconds: 5 }, { seconds: 120 }]],
  ["typed seconds: out of range is refused, not changed", ["error" in parseVideoSeconds("4"), "error" in parseVideoSeconds("121")], [true, true]],
  ["typed seconds: not a whole number is refused", ["error" in parseVideoSeconds("1.5"), "error" in parseVideoSeconds("ten"), "error" in parseVideoSeconds("-20")], [true, true, true]],
];

let failed = 0;
for (const [name, got, want] of checks) {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  if (!pass) failed++;
  console.log(`${pass ? "ok  " : "FAIL"} ${name}${pass ? "" : `: got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`}`);
}
if (failed) {
  console.error(`${failed} hero check(s) failed.`);
  process.exit(1);
}
console.log(`Hero: ${checks.length} checks passed.`);
