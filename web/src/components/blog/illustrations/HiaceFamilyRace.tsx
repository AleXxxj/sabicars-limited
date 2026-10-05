"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, Flag, Megaphone, RotateCcw, Trophy, Users } from "lucide-react";
import { FAMILY, type FamilyId, type FamilyMember } from "@/lib/hiace-family";
import { formatNaira } from "@/lib/money";
import { Burst, haptic, usePulse } from "./rewards";
import { RaceTrack, type Note, type Phase, type RaceSpec, type Racer, type TrackHandle } from "./race/RaceTrack";
import type { LegKind } from "./race/scenery";

/**
 * The Hiace family race: the old square-face Hiace, the short Hiace and the
 * Hummer 1, 2 and 3, on the road and load the reader picks.
 *
 * Pace is worked out from real figures, not ratings: each engine's published
 * power and torque against the weight it moves — its body, and every seat
 * filled when the bus is full. Bigger buses take longer to board. The sums are
 * stand-ins, and the race says so; what they show is true to the engines.
 */

export type Trait = "empty" | "loaded" | "rough" | "distance";

export interface Scenario {
  id: string;
  label: string;
  from: string;
  to: string;
  loaded: boolean;
  legs: { kind: LegKind; len: number; trait: Trait; label?: string }[];
}

export const SCENARIOS: Scenario[] = [
  {
    id: "empty",
    label: "Empty, good road",
    from: "Igando",
    to: "Ikeja",
    loaded: false,
    legs: [
      { kind: "city", len: 0.4, trait: "empty" },
      { kind: "expressway", len: 0.6, trait: "empty" },
    ],
  },
  {
    id: "full",
    label: "Full, good road",
    from: "Igando",
    to: "Victoria Island",
    loaded: true,
    legs: [
      { kind: "stops", len: 0.2, trait: "loaded", label: "Boarding" },
      { kind: "city", len: 0.32, trait: "loaded" },
      { kind: "expressway", len: 0.48, trait: "loaded" },
    ],
  },
  {
    id: "bad",
    label: "Full, bad road",
    from: "Igando",
    to: "Ikotun",
    loaded: true,
    legs: [
      { kind: "stops", len: 0.2, trait: "loaded", label: "Boarding" },
      { kind: "potholes", len: 0.5, trait: "rough" },
      { kind: "city", len: 0.3, trait: "loaded" },
    ],
  },
  {
    id: "long",
    label: "Full, long distance",
    from: "Lagos",
    to: "Ibadan",
    loaded: true,
    legs: [
      { kind: "stops", len: 0.16, trait: "loaded", label: "Boarding" },
      { kind: "expressway", len: 0.7, trait: "distance" },
      { kind: "city", len: 0.14, trait: "loaded" },
    ],
  },
];

/** A passenger and their bag, against the body-size unit (about 75 kg against a Hummer 2's two tonnes). */
const PASSENGER = 0.0375;
/** Boarding time per passenger, in race time. */
const BOARD_MS = 130;
/** The fastest bus's time on the road, boarding aside. */
const ROAD_MS = 6800;

const weight = (m: FamilyMember, loaded: boolean) => m.size + (loaded ? m.seats * PASSENGER : 0);

/** How well a bus does what a leg asks: an engine figure against the weight it moves. */
const SCORE: Record<Trait, (m: FamilyMember) => number> = {
  // Empty on a good road: power against the body alone.
  empty: (m) => m.hp / weight(m, false),
  // Full, pulling away and climbing: torque against the body and every passenger.
  loaded: (m) => m.nm / weight(m, true),
  // Full on a bad road: lighter is nimbler; the oldest suspension and the tallest body slow down most.
  rough: (m) => (1 / weight(m, true)) * (m.id === "square" ? 0.85 : m.shape === "hummer-tall" ? 0.95 : 1),
  // Full at speed for hours: power against the body and every passenger.
  distance: (m) => m.hp / weight(m, true),
};

const NOTES: Record<Trait, Record<FamilyId, Note>> = {
  empty: {
    square: { text: "Older, smaller engine", tone: "bad" },
    short: { text: "Light body, quick", tone: "good" },
    hummer1: { text: "2.0 in a big body", tone: "mid" },
    hummer2: { text: "2.7 power", tone: "good" },
    hummer3: { text: "2.7, bigger body", tone: "mid" },
  },
  loaded: {
    square: { text: "Old engine strains", tone: "bad" },
    short: { text: "Only 9 aboard", tone: "good" },
    hummer1: { text: "2.0 working hard", tone: "bad" },
    hummer2: { text: "2.7 pulls 18 easily", tone: "good" },
    hummer3: { text: "Same 2.7, more room", tone: "mid" },
  },
  rough: {
    square: { text: "Old suspension", tone: "bad" },
    short: { text: "Nimble on potholes", tone: "good" },
    hummer1: { text: "Takes it steady", tone: "mid" },
    hummer2: { text: "Takes it steady", tone: "mid" },
    hummer3: { text: "Tallest: slows down", tone: "bad" },
  },
  distance: {
    square: { text: "Tired on long runs", tone: "bad" },
    short: { text: "Light and quick", tone: "good" },
    hummer1: { text: "2.0 revs hard", tone: "bad" },
    hummer2: { text: "2.7 cruises", tone: "good" },
    hummer3: { text: "Comfortable cruiser", tone: "good" },
  },
};

const engineShort = (m: FamilyMember) => (m.id === "square" ? "2.0–2.4" : m.engine.slice(0, 3));

export const FAMILY_RACERS: Racer[] = FAMILY.map((m) => ({
  id: m.id,
  label: m.name.replace(" (square face)", ""),
  sub: `${engineShort(m)} · ${m.seats} seats`,
  color: m.color,
  shape: m.shape,
  seats: m.seats,
}));

export function familySpec(s: Scenario): RaceSpec {
  const pace = (m: FamilyMember, t: Trait) => {
    const best = Math.max(...FAMILY.map((x) => SCORE[t](x)));
    return Math.pow(SCORE[t](m) / best, 0.85);
  };
  const road = FAMILY.map((m) => s.legs.map((l) => l.len / pace(m, l.trait)));
  const scale = ROAD_MS / Math.min(...road.map((r) => r.reduce((a, b) => a + b, 0)));
  const boarding = (m: FamilyMember, k: number) => (s.loaded && k === 0 && s.legs[0].kind === "stops" ? m.seats * BOARD_MS : 0);
  const durations = FAMILY.map((m, i) => road[i].map((t, k) => t * scale + boarding(m, k)));
  return {
    key: s.id,
    from: s.from,
    to: s.to,
    loaded: s.loaded,
    legs: s.legs.map((l) => ({ kind: l.kind, len: l.len, label: l.label })),
    durations,
    hold: FAMILY.map((m, i) => s.legs.map((_, k) => boarding(m, k) / durations[i][k])),
    notes: FAMILY.map((m) => s.legs.map((l, k) => (s.loaded && k === 0 ? null : NOTES[l.trait][m.id]))),
    struggle: FAMILY.map((m) => s.legs.map((l, k) => !(s.loaded && k === 0) && NOTES[l.trait][m.id].tone === "bad")),
    cruise: FAMILY.map((m) => s.legs.map((l) => l.kind === "expressway" && NOTES[l.trait][m.id].tone === "good")),
  };
}

/** Why the first bus got there first, for each road. */
const FIRST_BECAUSE: Record<string, string> = {
  empty: "it has the least weight for its engine to move",
  full: "for it, full means only 9 people — the lightest load of all",
  bad: "a light, compact bus picks its way through potholes most easily",
  long: "it has the most power for the weight it carries",
};

export type FamilyStock = Partial<Record<FamilyId, { count: number; fromMinor: number | null; slug: string }>>;

/**
 * Pick the road and the load; guess the winner; five buses race it. The
 * result says who got there first and who moved the most people — which, for
 * a bus that earns per seat, is the number that matters.
 */
export function HiaceFamilyRace({ stock }: { stock: FamilyStock }) {
  const [scenarioId, setScenarioId] = useState(SCENARIOS[1].id);
  const scenario = SCENARIOS.find((s) => s.id === scenarioId)!;
  const spec = useMemo(() => familySpec(scenario), [scenario]);
  const [pick, setPick] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("ready");
  const [order, setOrder] = useState<string[]>([]);
  const [fire, setFire] = useState(0);
  const [honk, setHonk] = useState(0);
  const [miss, setMiss] = useState(0);
  const shaking = usePulse(miss);
  const track = useRef<TrackHandle>(null);

  const racing = phase === "racing";
  const busy = phase === "countdown" || racing;

  return (
    <div className="surface-card overflow-hidden p-4 sm:p-6 md:p-8">
      <p className="text-sm font-semibold text-text-primary">1. Pick the road and the load</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {SCENARIOS.map((s) => (
          <button
            key={s.id}
            type="button"
            aria-pressed={s.id === scenarioId}
            onClick={() => {
              track.current?.reset();
              setOrder([]);
              setScenarioId(s.id);
            }}
            className={`min-h-11 rounded-full border px-4 text-sm transition-all active:scale-95 ${s.id === scenarioId ? "border-gold-400 bg-gold-500/15 font-semibold text-gold-100" : "border-white/[0.12] text-text-secondary hover:border-gold-500/40 hover:text-text-primary"}`}
          >
            {s.label}
          </button>
        ))}
      </div>

      <p className="mt-5 text-sm font-semibold text-text-primary">
        2. Which one gets there first? <span className="font-normal text-text-muted">Tap your pick.</span>
      </p>
      <div className={`mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5 ${shaking ? "shake" : ""}`}>
        {FAMILY.map((m) => {
          const on = pick === m.id;
          const place = order.indexOf(m.id);
          return (
            <button
              key={m.id}
              type="button"
              aria-pressed={on}
              disabled={busy}
              onClick={() => {
                setPick(on ? null : m.id);
                haptic(8);
              }}
              className={`relative flex min-h-12 items-center gap-2 rounded-xl border px-3 text-left text-sm transition-all active:scale-95 disabled:cursor-default ${on ? "border-gold-400 bg-gold-500/15 text-gold-100" : "border-white/[0.1] text-text-secondary hover:border-gold-500/40 hover:text-text-primary"}`}
            >
              <span aria-hidden className="h-3.5 w-6 shrink-0 rounded-[4px] border border-white/25" style={{ background: m.color }} />
              <span className="min-w-0 flex-1 leading-tight">
                <span className="block font-semibold">{m.name.replace(" (square face)", "")}</span>
                <span className="block text-xs opacity-80">
                  {engineShort(m)} · {m.seats} seats
                </span>
              </span>
              {phase === "done" && place >= 0 && (
                <span
                  className={`pop-in rounded-full px-1.5 py-px text-[0.65rem] font-bold ${place === 0 ? "bg-[linear-gradient(180deg,var(--gold-200),var(--gold-500))] text-[#0A0908]" : "bg-white/15 text-text-primary"}`}
                >
                  {["1st", "2nd", "3rd", "4th", "5th"][place]}
                </span>
              )}
              {on && phase === "done" && place === 0 && <Burst fire={fire} />}
            </button>
          );
        })}
      </div>

      <div className="mt-5">
        <RaceTrack
          racers={FAMILY_RACERS}
          spec={spec}
          pick={pick}
          honk={honk}
          handle={track}
          onPhase={setPhase}
          onFinish={(o) => {
            setOrder(o);
            setFire((f) => f + 1);
            if (pick && pick !== o[0]) setMiss((m) => m + 1);
          }}
        />
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => {
            setOrder([]);
            track.current?.start();
          }}
          disabled={busy}
          className="inline-flex min-h-12 items-center gap-2 rounded-full bg-[linear-gradient(180deg,var(--gold-300),var(--gold-500))] px-6 font-semibold text-[#0A0908] transition-transform active:scale-95 disabled:opacity-50"
        >
          {phase === "done" ? <RotateCcw aria-hidden size={17} /> : <Flag aria-hidden size={17} />}
          {phase === "done"
            ? "Race again"
            : phase === "ready"
              ? "3. Start the race"
              : phase === "countdown"
                ? "Get ready…"
                : "On the road…"}
        </button>
        {racing && pick && (
          <button
            type="button"
            onClick={() => {
              setHonk((h) => h + 1);
              haptic([8, 40, 8]);
            }}
            className="inline-flex min-h-12 items-center gap-2 rounded-full border border-gold-500/50 px-5 text-sm font-semibold text-gold-200 transition-transform active:scale-90"
          >
            <Megaphone aria-hidden size={16} /> Honk for yours
          </button>
        )}
        <p className="basis-full text-xs text-text-muted">
          Worked out from each engine&rsquo;s published power and torque against the weight it carries. A guide, not a road test.
        </p>
      </div>

      {phase === "done" && order.length > 0 && (
        <FamilyResult scenario={scenario} order={order} durations={spec.durations} pick={pick} fire={fire} />
      )}

      <FamilyFacts stock={stock} />
    </div>
  );
}

export function familyVerdict(scenario: Scenario, order: string[], durations: number[][]) {
  const member = (id: string) => FAMILY.find((m) => m.id === id)!;
  const total = (id: string) => durations[FAMILY.findIndex((m) => m.id === id)].reduce((a, b) => a + b, 0);
  const first = member(order[0]);
  // For a bus paid by the seat, the number that matters: people delivered for the time taken.
  const mover = scenario.loaded ? [...FAMILY].sort((a, b) => b.seats / total(b.id) - a.seats / total(a.id))[0] : null;
  const lines = [`The ${first.name.replace(" (square face)", "")} got there first: ${FIRST_BECAUSE[scenario.id]}.`];
  if (mover && mover.id !== first.id)
    lines.push(
      `But the ${mover.name} moved the most people for the time it took: ${mover.seats} in one trip, against the ${first.name.replace(" (square face)", "")}'s ${first.seats}.`,
    );
  if (scenario.loaded && order.indexOf("hummer2") < order.indexOf("hummer1"))
    lines.push("Hummer 1 and Hummer 2 look alike, but with every seat full the Hummer 2's 2.7 pulls away from the Hummer 1's 2.0.");
  if (scenario.id === "long")
    lines.push("Hummer 3 carries the same 18 as Hummer 2 with more room for each: on a long trip, that is comfort you can sell.");
  if (scenario.id === "empty") lines.push("Empty is the easy part. Pick a full load to see what each engine is really carrying.");
  return { first, mover, lines };
}

function FamilyResult({
  scenario,
  order,
  durations,
  pick,
  fire,
}: {
  scenario: Scenario;
  order: string[];
  durations: number[][];
  pick: string | null;
  fire: number;
}) {
  const { first, mover, lines } = familyVerdict(scenario, order, durations);
  const pickPlace = pick ? order.indexOf(pick) : -1;
  const pickName = FAMILY.find((m) => m.id === pick)?.name.replace(" (square face)", "");
  return (
    <div className="mt-6 grid gap-6 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]" aria-live="polite">
      <div>
        <p className="flex items-center gap-2 text-xs font-semibold tracking-[0.16em] text-gold-300 uppercase">
          <Trophy aria-hidden size={15} /> {scenario.label}
        </p>
        <p className="relative mt-1 font-display text-[1.9rem] leading-tight text-text-primary">
          First there: {first.name.replace(" (square face)", "")}
          <span className="absolute top-1/2 left-24">
            <Burst fire={fire} />
          </span>
        </p>
        {mover && (
          <p className="mt-1 flex items-center gap-2 font-display text-[1.35rem] leading-tight text-gold-200">
            <Users aria-hidden size={18} /> Most people moved: {mover.name}
          </p>
        )}
        {pick && (
          <p className={`mt-2 text-sm font-semibold ${pickPlace === 0 ? "text-gold-200" : "text-text-secondary"}`}>
            {pickPlace === 0
              ? "You called it. You sabi!"
              : `Your pick, the ${pickName}, came ${["1st", "2nd", "3rd", "4th", "5th"][pickPlace]}.`}
          </p>
        )}
        <div className="mt-2 grid gap-2 text-sm leading-relaxed text-text-secondary">
          {lines.map((l) => (
            <p key={l}>{l}</p>
          ))}
        </div>
      </div>
      <ol className="grid content-start gap-1.5">
        {order.map((id, i) => {
          const m = FAMILY.find((x) => x.id === id)!;
          return (
            <li key={id} className="flex items-center gap-3 rounded-xl bg-white/[0.03] px-3 py-2 text-sm">
              <span className={`figures w-7 font-bold ${i === 0 ? "text-gold-300" : "text-text-muted"}`}>
                {["1st", "2nd", "3rd", "4th", "5th"][i]}
              </span>
              <span aria-hidden className="h-3 w-5 shrink-0 rounded-[3px] border border-white/25" style={{ background: m.color }} />
              <span className="min-w-0 flex-1 truncate font-semibold text-text-primary">{m.name.replace(" (square face)", "")}</span>
              {scenario.loaded && (
                <span className="figures flex items-center gap-1 text-xs text-text-secondary">
                  <Users aria-hidden size={12} /> {m.seats}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/** The family side by side: what each one is, in the words a buyer uses, with what is in the showroom. */
function FamilyFacts({ stock }: { stock: FamilyStock }) {
  return (
    <div className="mt-8 border-t border-white/[0.06] pt-6">
      <p className="text-sm font-semibold text-text-primary">The five, side by side</p>
      <p className="mt-1 text-xs text-text-muted sm:hidden">Swipe to compare.</p>
      {/* On a phone the five sit side by side and swipe, so the article stays short. */}
      <div className="-mx-4 mt-3 flex snap-x snap-mandatory gap-2 overflow-x-auto px-4 pb-2 [scrollbar-width:none] sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-3 [&::-webkit-scrollbar]:hidden">
        {FAMILY.map((m) => {
          const s = stock[m.id];
          return (
            <div
              key={m.id}
              className="w-[16.5rem] shrink-0 snap-start rounded-xl border border-white/[0.07] bg-surface-0/50 p-3.5 sm:w-auto"
            >
              <p className="flex items-center gap-2 font-semibold text-text-primary">
                <span aria-hidden className="h-3 w-5 rounded-[3px] border border-white/25" style={{ background: m.color }} />
                {m.name}
              </p>
              <dl className="mt-2 grid grid-cols-[5rem_minmax(0,1fr)] gap-x-2 gap-y-1 text-xs">
                <dt className="text-text-muted">Engine</dt>
                <dd className="text-text-secondary">{m.engine}</dd>
                <dt className="text-text-muted">Power</dt>
                <dd className="text-text-secondary">
                  {m.power}, {m.torque}
                </dd>
                <dt className="text-text-muted">Seats</dt>
                <dd className="text-text-secondary">Usually {m.seats}</dd>
                <dt className="text-text-muted">Body</dt>
                <dd className="text-text-secondary">{m.body}</dd>
                <dt className="text-text-muted">Best for</dt>
                <dd className="text-text-secondary">{m.bestFor}</dd>
              </dl>
              {s?.count ? (
                <Link
                  href={s.count === 1 ? `/vehicles/${s.slug}` : "/hummer-bus"}
                  className="group mt-2.5 inline-flex min-h-9 items-center gap-1.5 text-xs font-semibold text-gold-300 hover:text-gold-200"
                >
                  {s.count} in the showroom{s.fromMinor ? `, from ${formatNaira(s.fromMinor)}` : ""}
                  <ArrowRight aria-hidden size={13} className="transition-transform group-hover:translate-x-1" />
                </Link>
              ) : (
                <Link
                  href={`/find?want=${encodeURIComponent(`Toyota Hiace — ${m.name}`)}`}
                  className="group mt-2.5 inline-flex min-h-9 items-center gap-1.5 text-xs font-semibold text-text-muted hover:text-gold-200"
                >
                  None in today — ask the Sourcing Desk
                  <ArrowRight aria-hidden size={13} className="transition-transform group-hover:translate-x-1" />
                </Link>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
