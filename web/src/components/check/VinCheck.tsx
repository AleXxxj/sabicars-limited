"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useReducer, useRef, useState, useSyncExternalStore } from "react";
import {
  Car,
  CarFront,
  CircleAlert,
  CircleCheck,
  CirclePlus,
  Cog,
  Copy,
  Factory,
  Flame,
  Fuel,
  Gauge,
  HeartPulse,
  Info,
  Leaf,
  MessagesSquare,
  PlugZap,
  RotateCw,
  Route,
  Star,
  Tag,
  TriangleAlert,
  Users,
  Wrench,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { lookUpVin, checkCar, type LookUpResult, type CheckResult, type Outside } from "@/lib/actions/vin-check";
import type { ComplaintSummary, CrashRatings, DecodedVin, ModelRecall, RatedVersion } from "@/lib/vin/nhtsa";
import type { CarPhoto } from "@/lib/vin/photo";
import type { RecallText } from "@/lib/vin/recallPlain";
import { airBagsLine, bodyShape, confirmFacts, factLines, safetyItems, summaryLine, type Fact, type FactIcon } from "@/lib/vin/features";
import { brand, cleanModel, joinAnd, recallPart, titleCase } from "@/lib/vin/plain";
import { fieldClass } from "@/components/forms/field";
import { Button } from "@/components/ui/Button";
import { CarShape } from "./CarShape";
import { CANNOT_SHOW_LINE, NextSteps } from "./CheckScope";

/** Dates and big numbers the way they are written in Nigeria: "12 Nov 2026", "2,013". */
const LOCALE = "en-NG";

function carName(c: DecodedVin): string {
  return [c.year, c.make && brand(c.make), cleanModel(c.model), c.series, c.trim].filter(Boolean).join(" ");
}

function modelName(c: DecodedVin, under?: string | null): string {
  return [c.year, c.make && brand(c.make), under ?? cleanModel(c.model), under ? null : c.series].filter(Boolean).join(" ");
}

/** "UNITED STATES" -> "the United States"; "JAPAN" -> "Japan". */
function country(raw: string): string {
  const name = titleCase(raw);
  return /^(United |Czech Republic|Netherlands|Philippines|Dominican Republic)/.test(name) ? `the ${name}` : name;
}

type Looked = { vin: string; car: DecodedVin; warning: string | null; photo: CarPhoto | null };
type Checked = CheckResult & { vin: string; car: DecodedVin };
/** A car this check can't read: why, and the maker if the number gave that much. */
type NotKnown = { kind: Outside; maker: string | null };

type View =
  | { step: "enter"; vin: string; error: string | null; outside: NotKnown | null }
  | { step: "confirm"; looked: Looked; error: string | null }
  | { step: "results"; checked: Checked; error: string | null };

/**
 * The step on screen, where focus goes after the last answer, and a count
 * that changes with every answer: the same error twice is still news, and
 * focus has to move for it.
 */
type State = { view: View; focus: "heading" | "input" | "error" | null; seq: number };

type Action =
  | { type: "started" }
  | { type: "looked"; looked: Looked }
  | { type: "lookFailed"; error: string; outside: NotKnown | null }
  | { type: "checked"; checked: Checked }
  | { type: "checkFailed"; vin: string; error: string; outside: NotKnown | null }
  | { type: "back"; vin: string };

function reducer(s: State, a: Action): State {
  const next = (view: View, focus: State["focus"]): State => ({ view, focus, seq: s.seq + 1 });
  switch (a.type) {
    case "started":
      // A new try clears the last one's error; focus stays where it is.
      if (!s.view.error) return s;
      return { ...s, view: s.view.step === "enter" ? { ...s.view, error: null, outside: null } : { ...s.view, error: null }, focus: null };
    case "looked":
      return next({ step: "confirm", looked: a.looked, error: null }, "heading");
    case "lookFailed":
      // To the VIN box, which names the error, so it can be corrected. For a car this check can't read, to
      // the explanation above the box instead: that is the answer, and the box is only where to try again.
      return s.view.step === "enter" ? next({ ...s.view, error: a.error, outside: a.outside }, a.outside ? "heading" : "input") : s;
    case "checked":
      return next({ step: "results", checked: a.checked, error: null }, "heading");
    case "checkFailed":
      if (s.view.step === "enter") return s;
      // The second step found the car is not in the records after all (the first answer had aged out of the
      // cache): back to the box, with the same plain explanation the first step gives.
      return a.outside ? next({ step: "enter", vin: a.vin, error: a.error, outside: a.outside }, "heading") : next({ ...s.view, error: a.error }, "error");
    case "back":
      return next({ step: "enter", vin: a.vin, error: null, outside: null }, "input");
  }
}

const FAILED = "Something went wrong. Please try again.";

const subscribeNothing = () => () => {};
/** False on the server and while the page wakes up; true once React runs it. */
function useHydrated(): boolean {
  return useSyncExternalStore(subscribeNothing, () => true, () => false);
}

/**
 * Check any car: VIN, then "Is this the car?", then what is known about it.
 *
 * One state, moved only by answers to the latest request. Each request takes
 * a ticket, and an answer for an older ticket is dropped, so a result still
 * on its way when the visitor goes back, or starts on another car, can't
 * pull the page back to the car they left. Which button is busy is part of
 * that ticket too: going back frees the buttons at once, instead of leaving
 * "Looking it up…" on screen until the abandoned request ends.
 *
 * Focus follows the answer. The button just pressed disappears with its
 * step, so focus goes to the new step's heading; after an error it goes to
 * the VIN box or to the error itself, where a screen reader reads it.
 *
 * It asks for a VIN and nothing else: no name, no phone, no email.
 */
export function VinCheck() {
  // Until React is running, a press would post the form to the page itself.
  const hydrated = useHydrated();
  const [state, dispatch] = useReducer(reducer, {
    view: { step: "enter", vin: "", error: null, outside: null },
    focus: null,
    seq: 0,
  });
  const [busy, setBusy] = useState<"look" | "check" | null>(null);
  const ticket = useRef(0);
  const heading = useRef<HTMLHeadingElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const { view } = state;

  useEffect(() => {
    const target =
      state.focus === "input" ? input.current : state.focus === "error" ? errorRef.current : state.focus === "heading" ? heading.current : null;
    target?.focus();
  }, [state.seq, state.focus]);

  async function run<R extends { ok: boolean; error?: string }>(kind: "look" | "check", call: () => Promise<R>, done: (r: R) => void) {
    const mine = ++ticket.current;
    setBusy(kind);
    dispatch({ type: "started" });
    let r: R;
    try {
      r = await call();
    } catch {
      r = { ok: false, error: FAILED } as R;
    }
    if (mine !== ticket.current) return;
    setBusy(null);
    done(r);
  }

  const notKnown = (r: LookUpResult | CheckResult): NotKnown | null => (r.outside ? { kind: r.outside, maker: r.maker ?? null } : null);

  const look = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (busy) return;
    const fd = new FormData(e.currentTarget);
    void run<LookUpResult>("look", () => lookUpVin(null, fd), (r) => {
      if (r.ok && r.vin && r.car) {
        dispatch({ type: "looked", looked: { vin: r.vin, car: r.car, warning: r.warning ?? null, photo: r.photo ?? null } });
      } else {
        dispatch({ type: "lookFailed", error: r.error ?? FAILED, outside: notKnown(r) });
      }
    });
  };

  // The photo "Is this the car?" already showed stays if the check comes back without one.
  const check = (vin: string, photo: CarPhoto | null) => {
    if (busy) return;
    const fd = new FormData();
    fd.set("vin", vin);
    void run<CheckResult>("check", () => checkCar(null, fd), (r) => {
      if (r.ok && r.vin === vin && r.car) {
        dispatch({ type: "checked", checked: { ...r, vin: r.vin, car: r.car, photo: r.photo ?? photo } });
      } else {
        dispatch({ type: "checkFailed", vin, error: r.error ?? FAILED, outside: notKnown(r) });
      }
    });
  };

  // Going back cancels whatever is on its way. "No, change the VIN" keeps it
  // to correct; "Check another car" starts with an empty box.
  const back = (vin: string) => {
    ticket.current++;
    setBusy(null);
    dispatch({ type: "back", vin });
  };

  // Keyed by the count, so the same message twice is announced twice.
  const errorNote = (id?: string) =>
    view.error ? (
      <p className="vc-error" role="alert" id={id} key={state.seq} ref={errorRef} tabIndex={-1}>
        {view.error}
      </p>
    ) : null;

  if (view.step === "results") {
    return (
      <div className="vc-tool">
        <Results
          checked={view.checked}
          heading={heading}
          error={errorNote()}
          retrying={busy === "check"}
          onRetry={busy ? undefined : () => check(view.checked.vin, view.checked.photo ?? null)}
          onAnother={() => back("")}
        />
      </div>
    );
  }

  if (view.step === "confirm") {
    const { looked } = view;
    // The results' own facts, as the same icon list: body, seats, engine,
    // transmission, drive and where it was built, as far as NHTSA has them.
    const facts = confirmFacts(looked.car);
    return (
      <div className="vc-tool">
        {/* data-receipt: the visitor is halfway through a check, with a question to answer; no other ask may sit beside it. */}
        <div className="vc-card surface-card" data-receipt>
          <CarPicture photo={looked.photo} car={looked.car} />
          <p className="kicker">Is this the car?</p>
          <h2 className="vc-car" ref={heading} tabIndex={-1}>
            {carName(looked.car)}
          </h2>
          {facts.length >= 2 ? (
            <FactList facts={facts} compact />
          ) : (
            <p className="vc-facts">
              {/* A decode with almost nothing in it: one line, from its own fields if it has no details. */}
              {summaryLine(looked.car) ??
                [
                  looked.car.body,
                  // An electric car has no engine size; its fuel says what it runs on.
                  looked.car.engine ?? looked.car.fuel,
                  looked.car.drive,
                  looked.car.builtIn && `Built in ${country(looked.car.builtIn)}`,
                ]
                  .filter(Boolean)
                  .join(" · ")}
            </p>
          )}
          {looked.warning && <p className="vc-warn">{looked.warning}</p>}

          <div className="vc-actions">
            <Button type="button" className="w-full" disabled={busy !== null || !hydrated} onClick={() => check(looked.vin, looked.photo)}>
              {busy === "check" ? "Checking…" : "Yes, check it"}
            </Button>
            <Button type="button" variant="secondary" className="w-full" onClick={() => back(looked.vin)}>
              No, change the VIN
            </Button>
          </div>
          {errorNote()}
        </div>
      </div>
    );
  }

  return (
    <div className="vc-tool grid gap-4">
      {/* Above the box, not under it: on a phone, under the box is off the screen, and all the visitor would
          see is a red line about a number. */}
      {view.outside && <NotInRecords outside={view.outside} heading={heading} />}
      {/* POST, so a press before the page is ready can never put a VIN in a URL. */}
      <form method="post" onSubmit={look} className="vc-card surface-card relative" aria-busy={busy === "look"} noValidate>
        <label className="vc-label" htmlFor="vc-vin">
          VIN (chassis number) <span>17 letters and numbers</span>
        </label>
        {/* Not controlled by React: what is typed before the page wakes up stays typed. */}
        <input
          ref={input}
          id="vc-vin"
          name="vin"
          defaultValue={view.vin}
          autoComplete="off"
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          maxLength={24}
          placeholder="e.g. 1HGCM82633A004352"
          className={`${fieldClass} vc-input`}
          aria-invalid={view.error ? true : undefined}
          aria-describedby={view.error ? "vc-vin-error" : undefined}
          required
        />
        {/* Only a bot fills this in: the hidden field every Sabicars form carries (forms/shared.tsx). */}
        <div aria-hidden className="absolute -left-[9999px]">
          <label>
            Website <input type="text" name="website" tabIndex={-1} autoComplete="off" />
          </label>
        </div>
        {errorNote("vc-vin-error")}
        <Button type="submit" size="lg" className="w-full" disabled={busy !== null || !hydrated}>
          {busy === "look" ? "Looking it up…" : "Check this car"}
        </Button>
        <p className="vc-note">Free. We do not ask for your name, phone number or email. {CANNOT_SHOW_LINE}</p>
        <details className="vc-help">
          <summary>Where do I find the VIN?</summary>
          <p>
            Stand outside the car and look at the bottom corner of the windscreen on the driver&rsquo;s side. It is also on the driver&rsquo;s door
            frame, and in the car&rsquo;s papers: the customs papers and the registration. The number on the car and the number on the papers
            must be the same.
          </p>
        </details>
      </form>
    </div>
  );
}

/**
 * The answer for a car this check can't read, in plain words, with the next
 * step. Never an empty result: an empty result reads as "nothing wrong", and
 * what is true is "nothing known".
 */
function NotInRecords({ outside, heading }: { outside: NotKnown; heading: React.RefObject<HTMLHeadingElement | null> }) {
  const { kind, maker } = outside;
  return (
    // data-receipt: the visitor has just been given an answer and a next step; no other ask may sit beside it.
    <section className="vc-card surface-card" role="status" data-receipt aria-labelledby="vc-unknown">
      <p className="kicker">{kind === "short" ? "Count the number again" : "Not in the US records"}</p>
      {kind === "short" ? (
        <>
          <h2 className="vc-h" id="vc-unknown" ref={heading} tabIndex={-1}>
            Is the number on the car shorter than 17?
          </h2>
          <p>
            Count it again against the car. If it really has fewer than 17 letters and numbers, the car was made for another country, such as
            Japan. Many Toyota Hiace buses are like this. The US records do not know these cars, so this check cannot read the number.
          </p>
        </>
      ) : (
        <>
          <h2 className="vc-h" id="vc-unknown" ref={heading} tabIndex={-1}>
            We could not find this car in the US records.
          </h2>
          <p>
            {maker ? `The number says the maker is ${maker}. The US records know nothing more about it.` : "The US records do not know this number."}{" "}
            This check only knows cars first sold in America. A car made for another country, such as a Toyota Hiace bus, is not in those
            records.
          </p>
          <p>First look at the number again. One wrong letter gives this answer too.</p>
        </>
      )}
      <p className="font-semibold text-text-primary">
        This does not mean the car is good, and it does not mean the car is bad. We have nothing to show you. No result is not a clean result.
      </p>
      <NextSteps />
      <p className="vc-note">To try the number again, use the box below.</p>
    </section>
  );
}

/**
 * A photo of the model from Wikimedia Commons, with the credit its licence
 * asks for, and the line that matters most under it: it is the model, not the
 * car being checked. When there is none, a small plain outline of the body
 * shape and the words "No photo of this model yet": a placeholder that says
 * so, not a picture standing in for the car.
 */
function CarPicture({ photo, car }: { photo: CarPhoto | null | undefined; car: DecodedVin }) {
  // A photo that doesn't load (Wikimedia or the resizer unreachable) gives
  // way to the placeholder, rather than a broken image with a credit under it.
  const [failed, setFailed] = useState<string | null>(null);
  if (!photo || failed === photo.src) {
    return (
      <div className="vc-photo vc-photo--none">
        <CarShape shape={bodyShape(car)} />
        <p className="vc-nophoto">No photo of this model yet</p>
      </div>
    );
  }
  const shown = [photo.photoYear, car.make && brand(car.make), photo.model].filter(Boolean).join(" ");
  return (
    <figure className="vc-photo">
      <Image
        src={photo.src}
        width={photo.width}
        height={photo.height}
        alt={`${shown}: a photo of the model, not this exact car`}
        sizes="(min-width: 1024px) 640px, calc(100vw - 40px)"
        onError={() => setFailed(photo.src)}
      />
      <figcaption className="vc-credit">
        <strong>A photo of this model, not this exact car.</strong>
        <a href={photo.pageUrl} target="_blank" rel="noopener noreferrer">
          Photo: {shown}
        </a>
        {photo.artist && <> · {photo.artist}</>}
        {" · "}
        {photo.licenseUrl ? (
          <a href={photo.licenseUrl} target="_blank" rel="noopener noreferrer">
            {photo.license}
          </a>
        ) : (
          photo.license
        )}
        {" · Wikimedia Commons"}
      </figcaption>
    </figure>
  );
}

/** "Could not load", and a way to ask again: each new check of the car counts against the connection's limit. */
function Unloaded({ what, retrying, onRetry }: { what: string; retrying: boolean; onRetry?: () => void }) {
  return (
    <>
      <p className="vc-muted">We could not load {what} from the US records just now.</p>
      <Button type="button" variant="secondary" className="justify-self-start" disabled={!onRetry} onClick={onRetry}>
        {retrying ? "Trying again…" : "Try again"}
      </Button>
    </>
  );
}

const FACT_ICONS: Record<FactIcon, LucideIcon> = {
  body: CarFront,
  seats: Users,
  engine: Gauge,
  motor: Zap,
  gearbox: Cog,
  drive: Route,
  fuel: Fuel,
  hybrid: Leaf,
  plug: PlugZap,
  factory: Factory,
  tag: Tag,
};

/**
 * An icon, a small label and one short line for each fact. `compact` is the
 * list on "Is this the car?": two to a row at every width, closer together.
 */
function FactList({ facts, compact = false }: { facts: Fact[]; compact?: boolean }) {
  if (facts.length === 0) return null;
  return (
    <ul className={`vc-factgrid${compact ? " vc-factgrid--compact" : ""}`} aria-label="About this car">
      {facts.map((f) => {
        const Icon = FACT_ICONS[f.icon];
        return (
          <li key={f.key}>
            <span className="vc-fact-label">
              <Icon aria-hidden size={14} strokeWidth={2} /> {f.label}
            </span>
            <span className="vc-fact-text">{f.text}</span>
            {f.note && <span className="vc-fact-note">{f.note}</span>}
          </li>
        );
      })}
    </ul>
  );
}

/** The safety equipment vPIC marks standard or optional, airbags first. */
function SafetyEquipment({ car }: { car: DecodedVin }) {
  const bags = airBagsLine(car.details);
  const items = safetyItems(car.details);
  if (!bags && items.length === 0) return null;
  return (
    <section className="vc-card surface-card" aria-labelledby="vc-equipment">
      <h3 className="vc-h" id="vc-equipment">
        Safety equipment
      </h3>
      <ul className="vc-checks">
        {bags && (
          <li>
            <CircleCheck aria-hidden size={18} />
            <span>{bags}</span>
          </li>
        )}
        {items.map((item) => (
          <li key={item.name} className={item.optional ? "vc-check--optional" : undefined}>
            {item.optional ? <CirclePlus aria-hidden size={18} /> : <CircleCheck aria-hidden size={18} />}
            <span>
              {item.name}
              {item.optional && " (an extra: this car may not have it)"}
            </span>
          </li>
        ))}
      </ul>
      <p className="vc-note">
        This is what the car left the factory with, from the US records. It does not say the equipment still works. If something is not on
        this list, the car may still have it.
      </p>
    </section>
  );
}

const STAR_WORD: Record<string, string> = { "5": "Top score", "4": "Good", "3": "Fair", "2": "Poor", "1": "Poor" };

/** Moves to a section and its heading, smoothly unless the visitor asked for less motion. */
function jumpTo(e: React.MouseEvent<HTMLAnchorElement>) {
  const target = document.getElementById(e.currentTarget.hash.slice(1));
  if (!target) return;
  e.preventDefault();
  const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  target.scrollIntoView({ behavior: still ? "auto" : "smooth", block: "start" });
  target.focus({ preventScroll: true });
}

const UNLOADED = "Could not load";
/** Shown where a number would be, when there is none to show. */
const NO_VALUE = "–";

function safetyGlance(r: CrashRatings | null | undefined): { value: string; sub: string } {
  if (!r) return { value: NO_VALUE, sub: UNLOADED };
  const { versions, matched } = r;
  if (versions.length === 0) return { value: NO_VALUE, sub: "Not tested" };
  if (matched > versions.length || new Set(versions.map((v) => v.overall ?? "-")).size > 1) {
    return { value: "?", sub: "Depends on version" };
  }
  const overall = versions[0].overall;
  return overall ? { value: `${overall}/5`, sub: STAR_WORD[overall] ?? "" } : { value: NO_VALUE, sub: "Not tested" };
}

/**
 * Three tiles that say the most in the least reading, and jump to their
 * sections. "No recalls" is never painted green with a tick: none in the US
 * records for the model is not the same as nothing wrong with this car.
 */
function Glance({
  recalls,
  complaints,
  ratings,
}: {
  recalls: ModelRecall[] | null;
  complaints: ComplaintSummary | null | undefined;
  ratings: CrashRatings | null | undefined;
}) {
  const urgent = recalls?.some((r) => r.parkIt || r.parkOutside) ?? false;
  const tone = !recalls ? "plain" : urgent ? "stop" : recalls.length > 0 ? "warn" : "plain";
  const safety = safetyGlance(ratings);
  return (
    <nav className="vc-glance" aria-label="At a glance">
      <ul>
        <li>
          <a href="#vc-recalls" className={`vc-tile vc-tile--${tone}`} onClick={jumpTo}>
            {urgent ? <TriangleAlert aria-hidden size={20} /> : <Wrench aria-hidden size={20} />}
            <strong>{recalls ? recalls.length : NO_VALUE}</strong>
            <span className="vc-tile-label">Recalls</span>
            <span className="vc-tile-sub">{!recalls ? UNLOADED : urgent ? "Urgent" : recalls.length > 0 ? "Ask if fixed" : "None in US records"}</span>
          </a>
        </li>
        <li>
          <a href="#vc-complaints" className="vc-tile vc-tile--plain" onClick={jumpTo}>
            <MessagesSquare aria-hidden size={20} />
            <strong>{complaints ? complaints.total.toLocaleString(LOCALE) : NO_VALUE}</strong>
            <span className="vc-tile-label">Complaints</span>
            <span className="vc-tile-sub">{complaints ? "From owners in America" : UNLOADED}</span>
          </a>
        </li>
        <li>
          <a href="#vc-stars" className="vc-tile vc-tile--plain" onClick={jumpTo}>
            <Star aria-hidden size={20} />
            <strong>{safety.value}</strong>
            <span className="vc-tile-label">Crash test</span>
            <span className="vc-tile-sub">{safety.sub}</span>
          </a>
        </li>
      </ul>
    </nav>
  );
}

function Results({
  checked,
  heading,
  error,
  retrying,
  onRetry,
  onAnother,
}: {
  checked: Checked;
  heading: React.RefObject<HTMLHeadingElement | null>;
  error: React.ReactNode;
  retrying: boolean;
  onRetry?: () => void;
  onAnother: () => void;
}) {
  const { car, vin, recalls, complaints, ratings } = checked;
  const model = modelName(car);
  const [copied, setCopied] = useState(false);
  const copyVin = async () => {
    try {
      await navigator.clipboard.writeText(vin);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Refused; the VIN is on screen to select by hand.
    }
  };
  const asOf = checked.asOf
    ? new Intl.DateTimeFormat(LOCALE, { day: "numeric", month: "short", year: "numeric" }).format(new Date(checked.asOf))
    : null;
  // Recalls filed under another name ("C300" for a C-Class) are labelled with it.
  const recallModel =
    recalls && recalls.foundUnder.length > 0 && !recalls.foundUnder.includes(car.model ?? "") ? modelName(car, joinAnd(recalls.foundUnder)) : model;
  const complaintModel =
    complaints && complaints.foundUnder.length > 0 && !complaints.foundUnder.includes(car.model ?? "")
      ? modelName(car, joinAnd(complaints.foundUnder))
      : model;
  // Every part answered, and every part is empty: most likely a model that was never sold in America under
  // this name. Said out loud, so three empty sections are not read as three clean ones.
  const nothingKnown = recalls?.list.length === 0 && complaints?.total === 0 && ratings?.versions.length === 0;

  return (
    // data-receipt: a result is on the page and the buyer is reading it; the engagement prompt holds off.
    <div className="vc-results" data-receipt>
      <section className="vc-card surface-card" aria-labelledby="vc-car-name">
        <CarPicture photo={checked.photo} car={car} />
        <p className="kicker">Free check</p>
        <h2 className="vc-car" id="vc-car-name" ref={heading} tabIndex={-1}>
          {carName(car)}
        </h2>
        <div className="vc-vin">
          <p>
            VIN (chassis number) <code>{vin}</code>{" "}
            <button type="button" className="vc-link-button" onClick={copyVin}>
              {copied ? "Copied" : "Copy VIN"}
            </button>
          </p>
          {/* When NHTSA was asked: a cached answer can be a day or more old. */}
          {asOf && <p className="vc-note">From the US records, as of {asOf}</p>}
        </div>
        {error}
        {car.warnings[0] && <p className="vc-warn">{car.warnings[0]}</p>}
        <FactList facts={factLines(car)} />
      </section>

      {/* Straight under the car, before any count: what the page below is not. */}
      <p className="vc-limits">
        <CircleAlert aria-hidden size={20} />
        <span>
          <strong>This is not the car&rsquo;s full history.</strong>
          {CANNOT_SHOW_LINE}
          {nothingKnown &&
            " The US records hold almost nothing about this model, so it may have been made for another country. An empty result is not a clean result."}
        </span>
      </p>

      <Glance recalls={recalls ? recalls.list : null} complaints={complaints} ratings={ratings} />

      <SafetyEquipment car={car} />

      {recalls ? (
        <Recalls list={recalls.list} texts={checked.recallText ?? {}} model={recallModel} />
      ) : (
        <section className="vc-card surface-card" aria-labelledby="vc-recalls">
          <h3 className="vc-h" id="vc-recalls" tabIndex={-1}>
            Safety recalls
          </h3>
          <Unloaded what="the recalls" retrying={retrying} onRetry={onRetry} />
        </section>
      )}

      <section className="vc-card surface-card" aria-labelledby="vc-complaints">
        <h3 className="vc-h" id="vc-complaints" tabIndex={-1}>
          What owners in America complained about
        </h3>
        {!complaints ? (
          <Unloaded what="the complaints" retrying={retrying} onRetry={onRetry} />
        ) : complaints.total === 0 ? (
          <p>The US records hold no owner complaints for the {model}. That can also mean few of them were sold there.</p>
        ) : (
          <Complaints complaints={complaints} filedAs={complaintModel === model ? null : complaintModel} />
        )}
        <p className="vc-note">These are owners&rsquo; own reports about the model, not proven faults, and not about this exact car.</p>
      </section>

      <section className="vc-card surface-card" aria-labelledby="vc-stars">
        <h3 className="vc-h" id="vc-stars" tabIndex={-1}>
          Crash-test stars
        </h3>
        {!ratings ? (
          <Unloaded what="the crash-test stars" retrying={retrying} onRetry={onRetry} />
        ) : ratings.versions.length === 0 ? (
          <p className="vc-muted">
            We could not find crash-test stars for the {model}. Not every car is tested, and some are listed under another name. You can
            search for it at{" "}
            <a href="https://www.nhtsa.gov/ratings" target="_blank" rel="noopener noreferrer">
              nhtsa.gov/ratings
            </a>
            .
          </p>
        ) : (
          <Stars ratings={ratings} model={model} year={car.year} />
        )}
      </section>

      <section className="vc-card surface-card" aria-labelledby="vc-exact">
        <h3 className="vc-h" id="vc-exact">
          Check this exact car
        </h3>
        {/* What this page shows is about the model. These two are about the one car, free, from the bodies
            that hold the records. Accident and mileage history are not free anywhere. */}
        <p className="vc-facts">
          Two free American websites can tell you a little more about this one car. They are not Sabicars, and they only know cars that
          were in America. Tap Copy VIN, then paste it on their site.
        </p>
        <ul className="vc-out">
          <li>
            <a href="https://www.nhtsa.gov/recalls" target="_blank" rel="noopener noreferrer">
              Is a recall still open on this car? <span>NHTSA, the US road safety agency · free</span>
            </a>
          </li>
          <li>
            <a href="https://www.nicb.org/vincheck" target="_blank" rel="noopener noreferrer">
              Was it reported stolen or written off in America? <span>NICB, the US insurers&rsquo; crime bureau · free, 5 checks a day</span>
            </a>
          </li>
        </ul>
        <Button type="button" variant="secondary" className="justify-self-start" onClick={copyVin}>
          <Copy aria-hidden size={18} /> {copied ? "VIN copied" : "Copy VIN"}
        </Button>
      </section>

      <section className="vc-card surface-card" aria-labelledby="vc-cannot">
        <h3 className="vc-h" id="vc-cannot">
          What this check cannot show
        </h3>
        <p>
          {CANNOT_SHOW_LINE} Those records are not free anywhere. Before you pay for any car, have it looked at by someone you trust.
        </p>
        <NextSteps lead />
      </section>

      <p className="vc-footnote">
        This information comes from NHTSA, the United States road safety agency. We cannot promise it is complete or correct. See a mistake?{" "}
        <Link href="/contact">Tell us</Link>.
      </p>
      <Button type="button" variant="secondary" className="justify-self-start" onClick={onAnother}>
        Check another car
      </Button>
    </div>
  );
}

/** The count, what happened, and the parts owners name most, as bars. */
function Complaints({ complaints, filedAs }: { complaints: ComplaintSummary; filedAs: string | null }) {
  const { total, crashes, fires, injuries } = complaints;
  const areas = complaints.topAreas ?? complaints.topParts.map((p) => ({ area: titleCase(p.part), count: p.count }));
  const most = Math.max(1, ...areas.map((a) => a.count));
  const n = (x: number) => x.toLocaleString(LOCALE);
  return (
    <>
      <p className="vc-big">
        {n(total)} <span>complaint{total === 1 ? "" : "s"}</span>
      </p>
      <p className="vc-facts">
        Sent to the US government by owners of this model and year{filedAs ? `, listed as the ${filedAs}` : ""}. A model that sold in large
        numbers has more.
      </p>
      <ul className="vc-incidents">
        <li>
          <TriangleAlert aria-hidden size={18} />
          <span>
            <strong>{n(crashes)}</strong> involved a crash
          </span>
        </li>
        <li>
          <Flame aria-hidden size={18} />
          <span>
            <strong>{n(fires)}</strong> involved a fire
          </span>
        </li>
        <li>
          <HeartPulse aria-hidden size={18} />
          <span>
            <strong>{n(injuries)}</strong> {injuries === 1 ? "injury" : "injuries"} reported
          </span>
        </li>
      </ul>
      {areas.length > 0 && (
        <>
          <p className="vc-subhead">Problems owners report most</p>
          <ul className="vc-bars">
            {areas.map((a) => (
              <li key={a.area}>
                <span className="vc-bar-name">{a.area}</span>
                <strong>{n(a.count)}</strong>
                <span className="vc-bar-track" aria-hidden="true">
                  <span className="vc-bar-fill" style={{ width: `${Math.max(2, Math.round((a.count / most) * 100))}%` }} />
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}

// The names the stars are explained under (StarList).
const STAR_ROWS = [
  ["Overall", "overall"],
  ["Head-on crash", "front"],
  ["Side crash", "side"],
  ["Rollover", "rollover"],
] as const;

function starsOf(v: RatedVersion): string {
  return STAR_ROWS.map(([, k]) => v[k] ?? "-").join("|");
}

/** The maker's own name for a cab, when NHTSA's name has one before its code. */
const NAMED_CAB =
  /\b(Super ?Crew|Super ?Cab|Crew ?Max|Crew Cab|King Cab|Access Cab|Double Cab|Quad Cab|Mega Cab|Regular Cab)\s+PU\/(?:CC|EC|RC)\b/gi;

/** Capitals that are names or abbreviations people know, left as they are. */
const KEEP_CAPS = new Set(["MINI", "AMG", "SUV", "AWD", "FWD", "RWD", "4WD", "2WD", "BMW", "GMC", "RAM", "SRT", "TRX"]);

/**
 * NHTSA's shorthand in words: "Super Crew PU/CC 4x4" -> "Super Crew 4WD",
 * "Crew PU/CC 4WD" -> "Crew Cab 4WD", "5 HB FWD" -> "5-door hatchback FWD",
 * "C RWD" -> "convertible RWD", "HEV" or "HV" -> "hybrid", "W/ SAB" -> "with
 * side airbags", "TOYOTA TUNDRA" -> "Toyota Tundra". "Later Release" stays,
 * as "built later": it is what tells two versions apart.
 */
function plainVersion(description: string): string {
  let d = description
    .replace(/\b(?:early|earlier) release\b/gi, "built earlier")
    .replace(/\blater release\b/gi, "built later")
    .replace(/\bw\/o\s*(rear\s+)?sab'?s?\b/gi, (_, rear?: string) => `without ${rear ? "rear " : ""}side airbags`)
    .replace(/\bw\/\s*(rear\s+)?(?:seat\s+)?sab'?s?\b/gi, (_, rear?: string) => `with ${rear ? "rear " : ""}side airbags`)
    .replace(NAMED_CAB, "$1")
    .replace(/\b(Crew|Quad|Regular|Double|Extended|King|Access|Mega)\s+PU\/(?:CC|EC|RC)\b/gi, "$1 Cab");
  // The maker's cab name is already there ("Super Crew Diesel PU/CC"): the
  // code would name the cab twice.
  if (/\b(Cab|Crew|CrewMax|Super ?Crew|Super ?Cab)\b/i.test(d)) d = d.replace(/\s*PU\/(?:CC|EC|RC)\b/gi, "");
  d = d
    .replace(/\bPU\/CC\b/gi, "crew cab")
    .replace(/\bPU\/EC\b/gi, "extended cab")
    .replace(/\bPU\/RC\b/gi, "regular cab")
    .replace(/\b(\d)\s*DR\b/gi, "$1-door")
    .replace(/\b(\d)\s*HB\b/gi, "$1-door hatchback")
    .replace(/\bHB\b/gi, "hatchback")
    .replace(/\bSW\b/gi, "wagon")
    .replace(/\bVAN\b/g, "van")
    .replace(/\bPHEV\b/g, "plug-in hybrid")
    .replace(/\b(HEV|HV)\b/g, "hybrid")
    .replace(/\bBEV\b/g, "electric")
    .replace(/\s+C\s+(?=(?:AWD|4WD|FWD|RWD|2WD|4x4|4x2)\b)/i, " convertible ")
    .replace(/\b4x4\b/gi, "4WD")
    .replace(/\b4x2\b/gi, "2WD")
    .replace(/\s{2,}/g, " ")
    .trim();
  return d
    .split(" ")
    .map((w) => (/^[A-Z]{4,}$/.test(w) && !KEEP_CAPS.has(w) ? w.charAt(0) + w.slice(1).toLowerCase() : w))
    .join(" ")
    .replace(/\bXdrive\b/g, "xDrive")
    .replace(/\bSdrive\b/g, "sDrive");
}

/** Words that describe a version rather than name the model. */
const VERSION_WORD = /^(suv|van|wagon|hatchback|convertible|crew|extended|regular|cab|\d-door|awd|fwd|rwd|4wd|2wd|built|with|without|plug-in|hybrid|electric)$/i;

/**
 * The model's part of the shared start: "2022 Nissan Rogue", not "2022
 * Nissan Rogue SUV FWD built" when the versions differ only in "built
 * later" and "built earlier".
 */
function modelPart(start: string): string {
  const words = start ? start.split(" ") : [];
  const cut = words.findIndex((w) => VERSION_WORD.test(w));
  return (cut >= 0 ? words.slice(0, cut) : words).join(" ");
}

/** The words every description starts with ("2019 Chevrolet Silverado 1500"), left off a list. */
function sharedStart(descriptions: string[]): string {
  const split = descriptions.map((d) => d.split(" "));
  const words: string[] = [];
  for (let i = 0; split.every((w) => i < w.length - 1 && w[i] === split[0][i]); i++) words.push(split[0][i]);
  return words.join(" ");
}

/** Words of a phrase ("built later", "with side airbags"), kept even when every version has them. */
const PHRASE_WORD = /^(built|with|without|side|airbags|rear)$/i;

/**
 * What tells each version apart, in words: "AWD", "FWD", "hybrid AWD" for
 * the Highlanders; "built later" and "built earlier"; "crew cab 4WD" for a
 * Silverado rated alone. Words every version shares ("SUV") are left out.
 */
function versionLabels(descriptions: string[]): string[] {
  const plain = descriptions.map(plainVersion);
  const start = modelPart(sharedStart(plain));
  const rests = plain.map((p) => p.slice(start.length).trim().split(" ").filter(Boolean));
  const common = rests.length > 1 ? rests[0].filter((w) => !PHRASE_WORD.test(w) && rests.every((r) => r.includes(w))) : [];
  return rests.map((r, i) => {
    const own = r.filter((w) => !common.includes(w));
    return (own.length > 0 ? own : r).join(" ") || plain[i];
  });
}

/** Stars as one image with one name, so a screen reader says "4 of 5 stars", not five "black star"s. */
function StarGlyphs({ value }: { value: string }) {
  const n = Math.max(0, Math.min(5, Number(value) || 0));
  return (
    <span className="vc-glyphs" role="img" aria-label={`${value} of 5 stars`}>
      {"★".repeat(n)}
      <span className="vc-star-off">{"☆".repeat(5 - n)}</span>
    </span>
  );
}

/** "17%", or "17% to 19%" when the versions this car could be differ. */
function rolloverChance(versions: RatedVersion[]): string | null {
  const risks = versions
    .map((v) => v.rolloverRisk)
    .filter((r): r is number => typeof r === "number")
    .map((r) => Math.round(r * 100));
  if (risks.length === 0) return null;
  const lo = Math.min(...risks);
  const hi = Math.max(...risks);
  return lo === hi ? `${lo}%` : `${lo}% to ${hi}%`;
}

const MEANING = {
  front: "How well it protects people when it hits something at the front.",
  side: "How well it protects people when it is hit from the side.",
} as const;

/** The three crash tests, each with what it means. */
function StarList({ v, chance }: { v: RatedVersion; chance: string | null }) {
  const rows: { Icon: LucideIcon; name: string; value: string | null; meaning: string }[] = [
    { Icon: CarFront, name: "Head-on crash", value: v.front, meaning: MEANING.front },
    { Icon: Car, name: "Side crash", value: v.side, meaning: MEANING.side },
    {
      Icon: RotateCw,
      name: "Rollover",
      value: v.rollover,
      meaning: chance
        ? `How likely it is to roll over: ${chance} chance in a crash with no other car.`
        : "How likely it is to roll over in a crash with no other car.",
    },
  ];
  return (
    <ul className="vc-starlist">
      {rows.map(({ Icon, ...row }) => (
        <li key={row.name}>
          <Icon aria-hidden size={18} />
          <span className="vc-star-name">{row.name}</span>
          {row.value ? <StarGlyphs value={row.value} /> : <span className="vc-muted">Not tested</span>}
          <span className="vc-star-meaning">{row.meaning}</span>
        </li>
      ))}
    </ul>
  );
}

/** Four rows of stars, small: for a version shown beside this car's. */
function MiniStars({ v, rows = STAR_ROWS }: { v: RatedVersion; rows?: readonly (typeof STAR_ROWS)[number][] }) {
  return (
    <dl className="vc-ministars">
      {rows.map(([label, k]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{v[k] ? <StarGlyphs value={v[k]!} /> : <span className="vc-muted">Not tested</span>}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * Crash-test stars, explained. One set when the versions this car could be
 * agree, with the other versions of the model compared; when they differ,
 * each version with its own stars. Never one version's stars presented as
 * another's, and never "Not tested" for a version that has some stars. When
 * more versions match than could be fetched, none are offered as the choices.
 */
function Stars({ ratings, model, year }: { ratings: CrashRatings; model: string; year: number | null }) {
  const { versions, matched } = ratings;
  const others = ratings.others ?? [];
  const otherCount = ratings.otherCount ?? 0;
  const intro = (
    <p className="vc-facts">
      NHTSA, the US road safety agency, crashes new cars on purpose and scores them from 1 to 5 stars. More stars means more protection.
      The stars are for the model when it was new, not for this car as it is today.
    </p>
  );
  const notes = (
    <>
      {year !== null && year < 2011 && (
        <p className="vc-note">Cars from before 2011 were scored the old way, so compare their stars only with each other.</p>
      )}
      <p className="vc-note">Compare stars only between cars of about the same size and weight.</p>
    </>
  );
  const seeAll = (
    <a href="https://www.nhtsa.gov/ratings" target="_blank" rel="noopener noreferrer">
      nhtsa.gov/ratings
    </a>
  );

  if (matched > versions.length) {
    return (
      <>
        {intro}
        <p className="vc-muted">
          The US records score more versions of the {model} than we can show here, and the VIN does not say which one this is. See them all
          at {seeAll}.
        </p>
      </>
    );
  }

  const agree = new Set(versions.map(starsOf)).size === 1;
  const v = versions[0];

  if (agree) {
    if (!STAR_ROWS.some(([, k]) => v[k])) {
      return (
        <>
          {intro}
          <p className="vc-muted">The US records have no crash-test stars for this version.</p>
          {notes}
        </>
      );
    }
    const one = versions.length === 1;
    const labels = versionLabels([...versions, ...others].map((x) => x.description));
    const otherLabels = labels.slice(versions.length);
    const othersAgree = others.every((o) => starsOf(o) === starsOf(v));
    const checkedAll = others.length === otherCount;
    // "Same stars": the rollover chance above is this version's own, and can differ.
    let line: string | null = null;
    if (!one) line = otherCount === 0 ? "Same stars for every version of this model." : "Same stars for every version that matches this car.";
    else if (otherCount > 0 && othersAgree && checkedAll) line = "Same stars for every version of this model.";
    else if (otherCount > 0) line = `These stars are for the ${labels[0]} version.`;
    const alsoSame =
      one && others.length > 0 && othersAgree && !checkedAll
        ? `The ${joinAnd(otherLabels)} version${others.length === 1 ? " has" : "s have"} the same stars.`
        : null;

    return (
      <>
        {intro}
        <div className="vc-overall">
          <p className="vc-overall-label">Overall</p>
          {v.overall ? (
            <>
              <StarGlyphs value={v.overall} />
              <p className="vc-overall-score">
                <strong>{v.overall} out of 5</strong> · {STAR_WORD[v.overall]}
              </p>
            </>
          ) : (
            <p className="vc-overall-score">
              <strong>No overall score</strong>
            </p>
          )}
        </div>
        <StarList v={v} chance={rolloverChance(versions)} />
        {line && <p className="vc-facts vc-version-line">{line}</p>}
        {alsoSame && <p className="vc-facts">{alsoSame}</p>}
        {one && others.length > 0 && !othersAgree && (
          <details className="vc-others">
            <summary>Other versions</summary>
            <ul className="vc-versions">
              {others.map((o, i) => (
                <li key={`${i}:${o.description}`}>
                  <p className="vc-version-name">The {otherLabels[i]} version</p>
                  <MiniStars v={o} />
                </li>
              ))}
            </ul>
            {!checkedAll && <p className="vc-note">There are more versions. See them all at {seeAll}.</p>}
          </details>
        )}
        {notes}
      </>
    );
  }

  const plain = versions.map((x) => plainVersion(x.description));
  const start = modelPart(sharedStart(plain));
  // What tells them apart, without the words they share: "Built later", "Built earlier".
  const names = versionLabels(versions.map((x) => x.description)).map((l) => l.charAt(0).toUpperCase() + l.slice(1));
  const same = STAR_ROWS.filter(([, k]) => v[k] && versions.every((x) => x[k] === v[k]));
  const differ = STAR_ROWS.filter(([, k]) => new Set(versions.map((x) => x[k] ?? "-")).size > 1);
  return (
    <>
      {intro}
      <p className="vc-facts">The stars for the {start || "model"} depend on the version, and the VIN does not say which one this is.</p>
      {same.length > 0 && (
        <>
          <p className="vc-note">The same for every version:</p>
          <MiniStars v={v} rows={same} />
        </>
      )}
      <ul className="vc-versions">
        {versions.map((x, i) => (
          <li key={`${i}:${x.description}`}>
            <p className="vc-version-name">{names[i] || plain[i]}</p>
            {STAR_ROWS.some(([, k]) => x[k]) ? <MiniStars v={x} rows={differ} /> : <p className="vc-muted">Not tested</p>}
          </li>
        ))}
      </ul>
      {notes}
    </>
  );
}

/** The newest few recalls, then the rest on request: a popular model can have twenty or more. */
const FIRST_RECALLS = 5;

function Recalls({ list, texts, model }: { list: ModelRecall[]; texts: Record<string, RecallText>; model: string }) {
  // YYYY-MM-DD from the server, shown the way the reader writes dates.
  const when = (iso: string) => new Intl.DateTimeFormat(LOCALE, { month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));
  const [showAll, setShowAll] = useState(false);
  const listRef = useRef<HTMLUListElement>(null);

  // The button that was pressed is gone; focus goes to the first recall it
  // revealed, so the reader carries on from where they were. Each recall's
  // own summary, not the "Read the US notice" one inside it.
  useEffect(() => {
    if (showAll) {
      listRef.current?.querySelectorAll<HTMLElement>(":scope > li > details > summary")[FIRST_RECALLS]?.focus();
    }
  }, [showAll]);

  const urgent = list.some((r) => r.parkIt || r.parkOutside);
  // The server sends words for every recall; this is only for one it somehow left out. No fix line then:
  // NHTSA's raw remedy says "free of charge", which is America's promise, and it is one tap away below.
  const textOf = (r: ModelRecall): RecallText =>
    texts[r.campaign] ?? { headline: recallPart(r.component), problem: r.summary, risk: r.consequence, fix: null, source: "nhtsa" };
  const anyAi = list.some((r) => texts[r.campaign]?.source === "ai");
  const checkThisCar = (
    <a href="https://www.nhtsa.gov/recalls" target="_blank" rel="noopener noreferrer">
      nhtsa.gov/recalls
    </a>
  );

  return (
    <section className="vc-card surface-card" aria-labelledby="vc-recalls">
      <h3 className="vc-h" id="vc-recalls" tabIndex={-1}>
        Safety recalls for this model
      </h3>
      {/* What a recall is, for someone who has never met the word: said
          once, under the heading, whether or not the model has any. */}
      <p className="vc-explain">
        <Info aria-hidden size={18} />
        <span>A recall means the maker found a fault that affects safety. A used car can still have one that was never fixed.</span>
      </p>
      {list.length === 0 ? (
        <p>
          The US records list no recalls for the {model}. That is not proof this exact car is fine. To check this car itself, type its VIN at{" "}
          {checkThisCar}. It is free.
        </p>
      ) : (
        <>
          <p className="vc-big">
            {list.length} <span>recall{list.length === 1 ? "" : "s"}</span>
          </p>
          {urgent && (
            <p className="vc-warn vc-warn--stop">
              Some {model} cars are under a recall that says do not drive the car, or park it outside, until it is fixed. Check this
              car&rsquo;s VIN at nhtsa.gov/recalls before you drive it.
            </p>
          )}
          <div className="vc-todo">
            <p className="vc-todo-title">
              <Wrench aria-hidden size={18} /> What to do
            </p>
            {/* Not "fixed free at any dealer": that is the maker's promise to owners in America, and it does
                not reach a car in Nigeria. What a buyer here can do is ask for proof, or have the part checked. */}
            <p>
              An open recall means the maker found a fault and this car was never fixed. Ask the seller for proof it was fixed, or ask a
              mechanic to check that part. To see if a recall is still open on this exact car, type its VIN at {checkThisCar}. It is free.
            </p>
            <p className="vc-note">In America the maker&rsquo;s dealers fix a recall at no charge. That does not apply in Nigeria.</p>
          </div>
          <p className="vc-facts">
            {list.length === 1 ? "This recall was" : `These ${list.length} recalls were`} issued for the {model}. Some may not apply to this
            car, and some may already be fixed.
          </p>
          {anyAi && <p className="vc-note">Short summaries written by AI from the US notices. Tap a recall to read the original.</p>}
          <ul className="vc-recalls" ref={listRef}>
            {(showAll ? list : list.slice(0, FIRST_RECALLS)).map((r) => {
              const t = textOf(r);
              return (
                <li key={r.campaign}>
                  <details>
                    <summary>
                      <span className="vc-recall-head">{t.headline}</span>
                      <span className="vc-recall-meta">
                        {r.date && <span>{when(r.date)}</span>}
                        {r.parkIt && <span className="vc-badge vc-badge--stop">Do not drive it until it is fixed</span>}
                        {r.parkOutside && <span className="vc-badge vc-badge--stop">Park it outside</span>}
                      </span>
                    </summary>
                    <div className="vc-recall-body">
                      {anyAi && t.source === "nhtsa" && <p className="vc-note">In the US notice&rsquo;s own words.</p>}
                      <dl>
                        {t.problem && (
                          <div>
                            <dt>What is wrong</dt>
                            <dd>{t.problem}</dd>
                          </div>
                        )}
                        {t.risk && (
                          <div>
                            <dt>What could happen</dt>
                            <dd>{t.risk}</dd>
                          </div>
                        )}
                        {t.fix && (
                          <div>
                            <dt>How the maker fixes it</dt>
                            <dd>{t.fix}</dd>
                          </div>
                        )}
                      </dl>
                      <details className="vc-notice">
                        <summary>Read the US notice</summary>
                        {r.summary && (
                          <p>
                            <strong>Summary:</strong> {r.summary}
                          </p>
                        )}
                        {r.consequence && (
                          <p>
                            <strong>What could happen:</strong> {r.consequence}
                          </p>
                        )}
                        {r.remedy && (
                          <p>
                            <strong>The fix in America:</strong> {r.remedy}
                          </p>
                        )}
                        <p className="vc-note">NHTSA campaign {r.campaign}</p>
                      </details>
                    </div>
                  </details>
                </li>
              );
            })}
          </ul>
          {!showAll && list.length > FIRST_RECALLS && (
            <Button type="button" variant="secondary" className="justify-self-start" onClick={() => setShowAll(true)}>
              Show all {list.length} recalls
            </Button>
          )}
        </>
      )}
    </section>
  );
}
