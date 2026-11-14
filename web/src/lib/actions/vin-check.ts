"use server";

import { after } from "next/server";
import { looksAutomated } from "@/lib/leads";
import { RATE_LIMITED_MESSAGE, withinLimit } from "@/lib/rate-limit";
import { checkVin } from "@/lib/vin/validate";
import {
  decodeVin,
  recallsForModel,
  complaintsForModel,
  crashRatings,
  type DecodedVin,
  type ModelRecalls,
  type ComplaintSummary,
  type CrashRatings,
} from "@/lib/vin/nhtsa";
import { carPhoto, type CarPhoto } from "@/lib/vin/photo";
import { brand } from "@/lib/vin/plain";
import { recallTexts, settleWithin, warmRecallTexts, type RecallText } from "@/lib/vin/recallPlain";

/**
 * The free "Check any car" tool (/check): two public actions, on purpose.
 *
 * Both are open to anyone, because the page exists for visitors, and both
 * return only public United States government data about a model of car,
 * never anything about a person. Nothing is saved: no name, phone or email
 * is asked for, and the VIN is not stored. It travels in the POST body and
 * is never put in a URL or a log: on its own it names no one, but beside an
 * address or an email it can.
 *
 * The honest part is the answer for a car the US records do not know. Much
 * of what is sold in Lagos was never sold in America (a Toyota Hiace bus, a
 * car built for Japan or the Gulf), and its number decodes to nothing. That
 * is returned as `outside`, with words that say so plainly, so the page can
 * offer the next step (ask Sabicars, or see the cars Sabicars has checked)
 * instead of showing an empty result that reads as a clean one.
 *
 * Each action counts once against the connection's limit (the "vincheck"
 * bucket in lib/rate-limit.ts), so the site can't be used to run thousands
 * of checks against NHTSA.
 *
 * One other service sees the car's year, make and model, never its VIN:
 * Wikimedia Commons, for a photo of the model (lib/vin/photo.ts). A second
 * is off until the owner turns it on with RECALL_SUMMARIES=on: Anthropic,
 * which would be given NHTSA's public recall notices to put in plain words
 * (lib/vin/recallPlain.ts).
 */

/** How long "Is this the car?" waits for a photo before showing the drawing instead. */
const PHOTO_ON_CONFIRM_MS = 1_500;
/** How long a check waits for the photo and the AI recall summaries; the rest are NHTSA's words. */
const CHECK_BUDGET_MS = 4_500;

const UNREACHABLE = "We could not reach the US records just now. Please try again in a minute.";

/** Said at the VIN box; the page puts the fuller explanation and the next step under it. */
const NOT_IN_RECORDS = "This number is not in the US records.";

/**
 * Why there is nothing to show, when it is not a typing mistake to fix:
 * - "short": fewer than 17 letters and numbers, as on a car built for Japan;
 * - "unknown": 17 characters, but the US records do not know the car.
 */
export type Outside = "short" | "unknown";

/** A number this long is a real chassis number that is simply not a VIN; shorter is a slip of the thumb. */
const SHORTEST_FRAME_NUMBER = 6;

export interface LookUpResult {
  ok: boolean;
  error?: string;
  /** Set when the car is outside what this check can read; the page then offers the next step. */
  outside?: Outside;
  /** The maker, when the number gives that much and nothing more ("Toyota"). */
  maker?: string | null;
  vin?: string;
  car?: DecodedVin;
  /** A check-digit or decoding warning to show beside the car, if any. */
  warning?: string | null;
  /** A photo of the model, if one was ready in time; the page draws the body shape otherwise. */
  photo?: CarPhoto | null;
}

/** A number that can't be looked up: the message for the box, and whether it is a car this check can't read. */
function refuse(check: ReturnType<typeof checkVin>): { ok: false; error: string; outside?: Outside } {
  const short = check.problem === "length" && check.vin.length >= SHORTEST_FRAME_NUMBER && check.vin.length < 17;
  return { ok: false, error: check.message ?? "Please check the VIN.", ...(short ? { outside: "short" as const } : {}) };
}

/** The car decoded to no year, make or model: said plainly, with the maker if the number gave one. */
function notInRecords(car: DecodedVin): { ok: false; error: string; outside: Outside; maker: string | null } {
  return { ok: false, error: NOT_IN_RECORDS, outside: "unknown", maker: car.make ? brand(car.make) : null };
}

/** Step one: what the car is, for "Is this the car?". */
export async function lookUpVin(_prev: LookUpResult | null, formData: FormData): Promise<LookUpResult> {
  // The hidden field only a bot fills in (the same one every Sabicars form carries). No timer here: pasting
  // a VIN and pressing the button takes a person two seconds, and that must never be refused.
  if (looksAutomated(formData.get("website"), undefined)) return { ok: false, error: "Please try again." };

  const check = checkVin(String(formData.get("vin") ?? ""));
  if (!check.wellFormed) return refuse(check);
  // Counted only once the VIN is worth asking NHTSA about: a typo costs nothing.
  if (!(await withinLimit("vincheck"))) return { ok: false, error: RATE_LIMITED_MESSAGE };

  const car = await decodeVin(check.vin);
  if (!car) return { ok: false, error: UNREACHABLE };
  if (!car.year || !car.make || !car.model) return notInRecords(car);

  /*
   * Fetch the model's data while the visitor reads "Is this the car?".
   *
   * The first lookup of a popular model can take several seconds (its
   * complaints arrive as one large download), and the answer is cached, so
   * starting it now means the next step is usually instant. `after` keeps the
   * server working once this reply has gone; a failure here costs nothing,
   * because the next step asks again.
   */
  const { year, make, names, fit } = car;
  const want = { power: fit.power, cab: fit.cab, words: fit.words };
  // Started now rather than in the after() callback, so it runs while the
  // photo is awaited below. The recalls' plain-English summaries are warmed
  // as soon as the recalls are known.
  const prefetch = Promise.allSettled([
    recallsForModel(year, make, names, want).then((r) => (r ? warmRecallTexts(r.list, make) : null)),
    complaintsForModel(year, make, names, want),
    crashRatings(year, make, names, fit),
  ]);
  // The photo helps the visitor say "yes, that's the car", but is worth only
  // a short wait: if it isn't ready, the drawing shows here and the photo on
  // the results. Either way it carries on into the cache.
  const photoLookup = carPhoto(car);
  after(() => Promise.allSettled([prefetch, photoLookup]));
  const [photo] = await settleWithin([photoLookup], PHOTO_ON_CONFIRM_MS);

  return {
    ok: true,
    vin: check.vin,
    car,
    warning: check.checkDigitOk ? (car.warnings[0] ?? null) : check.message,
    photo: photo ?? null,
  };
}

export interface CheckResult {
  ok: boolean;
  error?: string;
  outside?: Outside;
  maker?: string | null;
  vin?: string;
  car?: DecodedVin;
  /** null = NHTSA could not be reached for that part; empty = none on file. */
  recalls?: ModelRecalls | null;
  complaints?: ComplaintSummary | null;
  ratings?: CrashRatings | null;
  /** The oldest of the answers' dates, for "US records as of". */
  asOf?: string | null;
  photo?: CarPhoto | null;
  /** Each recall in plain words, by campaign number: Claude's or NHTSA's own (RecallText.source). */
  recallText?: Record<string, RecallText>;
}

/** Step two: everything free that is known about this model. */
export async function checkCar(_prev: CheckResult | null, formData: FormData): Promise<CheckResult> {
  const check = checkVin(String(formData.get("vin") ?? ""));
  if (!check.wellFormed) return refuse(check);
  // Counted here too: this action is an endpoint of its own, and calling it
  // directly would otherwise skip the limit.
  if (!(await withinLimit("vincheck"))) return { ok: false, error: RATE_LIMITED_MESSAGE };

  const car = await decodeVin(check.vin);
  if (!car) return { ok: false, error: UNREACHABLE };
  if (!car.year || !car.make || !car.model) return notInRecords(car);

  // The same arguments as the prefetch in lookUpVin, so its answers are the ones found here.
  const { year, make } = car;
  const want = { power: car.fit.power, cab: car.fit.cab, words: car.fit.words };
  const photoLookup = carPhoto(car);
  const [recalled, complaints, ratings, [photo]] = await Promise.all([
    // The summaries start as soon as the recalls are known, not after the
    // complaints, which can take several seconds to download.
    recallsForModel(year, make, car.names, want).then(async (recalls) => {
      if (!recalls || recalls.list.length === 0) return { recalls, recallText: {} };
      const { texts, rest } = await recallTexts(recalls.list, make, CHECK_BUDGET_MS);
      // Late summaries finish after the reply, so the next visitor gets them.
      after(() => rest);
      return { recalls, recallText: texts };
    }),
    complaintsForModel(year, make, car.names, want),
    crashRatings(year, make, car.names, car.fit),
    settleWithin([photoLookup], CHECK_BUDGET_MS),
  ]);
  after(() => photoLookup);
  const { recalls, recallText } = recalled;

  const dates = [recalls?.fetchedAt, complaints?.fetchedAt, ratings?.fetchedAt].filter((d): d is string => !!d);

  return {
    ok: true,
    vin: check.vin,
    car,
    recalls,
    complaints,
    ratings,
    asOf: dates.length ? dates.sort()[0] : null,
    photo: photo ?? null,
    recallText,
  };
}
