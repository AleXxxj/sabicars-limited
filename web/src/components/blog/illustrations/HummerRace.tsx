"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, Flag, Megaphone, RotateCcw, Trophy } from "lucide-react";
import { VehicleImage } from "@/components/VehicleImage";
import { formatNaira } from "@/lib/money";
import { Burst, haptic, usePulse } from "./rewards";
import { JOBS, LEGS, SETUPS, WHY, legTimes, totalTime, type HummerStock, type Job, type Setup, type Trait } from "./hummers";
import { RaceTrack, type Phase, type RaceSpec, type Racer, type TrackHandle } from "./race/RaceTrack";
import { LEG_ICON } from "./race/scenery";

/** The winner's time; everyone else's follows from their pace. */
const WINNER_MS = 7600;

const name = (s: Setup) => `${s.fuel} ${s.gearbox}`;
const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const PLACES = ["1st", "2nd", "3rd", "4th"];

export const HUMMER_RACERS: Racer[] = SETUPS.map((s) => ({ id: s.id, label: s.label, color: s.color, shape: "hummer" }));

/**
 * The job as a race: each leg's time from the bus's rating for what the leg
 * tests, and what the reader should see as it happens — stop-start in
 * traffic for a manual, smoke at a doubtful pump for a diesel, a long wait at
 * the mechanic for the dearest to fix, speed lines where a diesel stretches out.
 */
export function hummerSpec(job: Job): RaceSpec {
  const best = Math.min(...SETUPS.map((s) => totalTime(s, job)));
  const rating = (s: Setup, k: number) => s.ratings[LEGS[job.legs[k].kind].trait];
  return {
    key: job.id,
    from: job.from,
    to: job.to,
    legs: job.legs.map((l) => ({ kind: l.kind, len: l.len })),
    durations: SETUPS.map((s) => legTimes(s, job).map((t) => (t / best) * WINNER_MS)),
    struggle: SETUPS.map((s) => job.legs.map((l, k) => (l.kind === "mechanic" ? rating(s, k) <= 3 : rating(s, k) <= 2))),
    cruise: SETUPS.map((s) => job.legs.map((l, k) => l.kind === "expressway" && rating(s, k) >= 4)),
    notes: SETUPS.map((s) =>
      job.legs.map((l, k) => {
        const r = rating(s, k);
        return { text: s.says[LEGS[l.kind].trait], tone: r >= 4 ? "good" : r <= 2 ? "bad" : "mid" };
      }),
    ),
  };
}

/**
 * Pick the job; guess the winner; four Hummer buses — petrol or diesel,
 * manual or automatic — race it through Lagos. Every leg tests one trade-off
 * from the article's table, and the bus says what it is feeling as it goes.
 * The result names the bus that suits the job, and shows the ones in the
 * showroom that match.
 */
export function HummerRace({ stock }: { stock: HummerStock }) {
  const [jobId, setJobId] = useState(JOBS[0].id);
  const job = JOBS.find((j) => j.id === jobId)!;
  const spec = useMemo(() => hummerSpec(job), [job]);
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
  const winner = SETUPS.find((s) => s.id === order[0]);
  const runnerUp = SETUPS.find((s) => s.id === order[1]);
  const pickSetup = SETUPS.find((s) => s.id === pick);

  return (
    <div className="surface-card overflow-hidden p-4 sm:p-6 md:p-8">
      <p className="text-sm font-semibold text-text-primary">1. Pick the job</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {JOBS.map((j) => (
          <button
            key={j.id}
            type="button"
            aria-pressed={j.id === jobId}
            onClick={() => {
              track.current?.reset();
              setOrder([]);
              setJobId(j.id);
            }}
            className={`min-h-11 rounded-full border px-4 text-sm transition-all active:scale-95 ${j.id === jobId ? "border-gold-400 bg-gold-500/15 font-semibold text-gold-100" : "border-white/[0.12] text-text-secondary hover:border-gold-500/40 hover:text-text-primary"}`}
          >
            {j.short}
          </button>
        ))}
      </div>

      <p className="mt-5 text-sm font-semibold text-text-primary">
        2. Which bus wins it? <span className="font-normal text-text-muted">Tap your pick.</span>
      </p>
      <div className={`mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 ${shaking ? "shake" : ""}`}>
        {SETUPS.map((s) => {
          const on = pick === s.id;
          const place = order.indexOf(s.id);
          return (
            <button
              key={s.id}
              type="button"
              aria-pressed={on}
              disabled={busy}
              onClick={() => {
                setPick(on ? null : s.id);
                haptic(8);
              }}
              className={`relative flex min-h-12 items-center gap-2 rounded-xl border px-3 text-left text-sm transition-all active:scale-95 disabled:cursor-default ${on ? "border-gold-400 bg-gold-500/15 text-gold-100" : "border-white/[0.1] text-text-secondary hover:border-gold-500/40 hover:text-text-primary"}`}
            >
              <span aria-hidden className="h-3.5 w-6 shrink-0 rounded-[4px] border border-white/25" style={{ background: s.color }} />
              <span className="min-w-0 flex-1 leading-tight">
                <span className="block font-semibold">{capital(s.fuel)}</span>
                <span className="block text-xs opacity-80">{capital(s.gearbox)}</span>
              </span>
              {phase === "done" && place >= 0 && (
                <span
                  className={`pop-in rounded-full px-1.5 py-px text-[0.65rem] font-bold ${place === 0 ? "bg-[linear-gradient(180deg,var(--gold-200),var(--gold-500))] text-[#0A0908]" : "bg-white/15 text-text-primary"}`}
                >
                  {PLACES[place]}
                </span>
              )}
              {on && phase === "done" && place === 0 && <Burst fire={fire} />}
            </button>
          );
        })}
      </div>

      <div className="mt-5">
        <RaceTrack
          racers={HUMMER_RACERS}
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
          {phase === "done" ? "Race again" : phase === "ready" ? "3. Start the run" : "On the road…"}
        </button>
        {racing && pickSetup && (
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
        <p className="basis-full text-xs text-text-muted">A race of the trade-offs in the table above, not a road test.</p>
      </div>

      {phase === "done" && winner && (
        <Result job={job} winner={winner} runnerUp={runnerUp} pick={pickSetup} order={order} fire={fire} stock={stock} run={spec} />
      )}
    </div>
  );
}

function Result({
  job,
  winner,
  runnerUp,
  pick,
  order,
  fire,
  stock,
  run,
}: {
  job: Job;
  winner: Setup;
  runnerUp?: Setup;
  pick?: Setup;
  order: string[];
  fire: number;
  stock: HummerStock;
  run: { durations: number[][] };
}) {
  const wi = SETUPS.indexOf(winner);
  // Its strengths on this job: the traits it rates well on, weighted by how much of the run tests them.
  const weight = new Map<Trait, number>();
  for (const l of job.legs) {
    const t = LEGS[l.kind].trait;
    if (winner.ratings[t] >= 4) weight.set(t, (weight.get(t) ?? 0) + l.len);
  }
  const traits = [...weight.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t);
  const why = traits.length ? `${capital(WHY[traits[0]].good)}${traits[1] ? `, and ${WHY[traits[1]].good}` : ""}.` : "";

  // Where it beat the runner-up by most.
  let edge = "";
  if (runnerUp) {
    const ri = SETUPS.indexOf(runnerUp);
    let bestK = -1;
    let gain = 0;
    job.legs.forEach((_, k) => {
      const g = run.durations[ri][k] - run.durations[wi][k];
      if (g > gain) {
        gain = g;
        bestK = k;
      }
    });
    if (bestK >= 0) {
      const kind = job.legs[bestK].kind;
      const t = LEGS[kind].trait;
      const reason =
        t === "traffic"
          ? "an automatic is easier in go-slow"
          : t === "distance"
            ? "diesel goes further on a litre"
            : t === "fuel"
              ? "petrol forgives poor fuel"
              : winner.fuel !== runnerUp.fuel
                ? "petrol is cheaper to put right"
                : "a manual costs less to put right";
      const at = {
        stops: "at the bus stops",
        goslow: "in the go-slow",
        expressway: "on the expressway",
        pump: "at the filling station",
        mechanic: "at the mechanic",
      }[kind];
      edge = `It beat the ${name(runnerUp)} ${at}: ${reason}.`;
    }
  }

  const buses = stock[winner.id] ?? [];
  const pickPlace = pick ? order.indexOf(pick.id) : -1;

  return (
    <div className="mt-6 grid gap-6 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]" aria-live="polite">
      <div>
        <p className="flex items-center gap-2 text-xs font-semibold tracking-[0.16em] text-gold-300 uppercase">
          <Trophy aria-hidden size={15} /> {job.label}
        </p>
        <p className="relative mt-1 font-display text-[1.9rem] leading-tight text-text-primary">
          The {name(winner)} Hummer
          <span className="absolute top-1/2 left-24">
            <Burst fire={fire} />
          </span>
        </p>
        {pick && (
          <p className={`mt-2 text-sm font-semibold ${pickPlace === 0 ? "text-gold-200" : "text-text-secondary"}`}>
            {pickPlace === 0 ? "You called it. You sabi!" : `Your pick, the ${name(pick)}, came ${PLACES[pickPlace]}.`}
          </p>
        )}
        <p className="mt-2 text-sm leading-relaxed text-text-secondary">
          {why} {edge}
        </p>
        <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-2">
          {job.legs.map((l, k) => {
            const fastest = Math.min(...SETUPS.map((_, i) => run.durations[i][k]));
            const won = SETUPS.filter((_, i) => run.durations[i][k] - fastest < 1);
            const Icon = LEG_ICON[l.kind];
            return (
              <li key={k} className="flex items-center gap-1.5 text-xs text-text-muted">
                <Icon aria-hidden size={13} />
                {LEGS[l.kind].label}
                <span className="flex -space-x-1">
                  {won.map((s) => (
                    <span
                      key={s.id}
                      title={s.label}
                      className="size-3 rounded-full border border-[#0A0908]"
                      style={{ background: s.color }}
                    />
                  ))}
                </span>
              </li>
            );
          })}
        </ul>
        <p className="mt-3 text-xs leading-relaxed text-text-muted">
          Whichever you choose, the bus itself matters more than the fuel or the gearbox. Check the six places below before you pay.
        </p>
      </div>

      <div>
        {buses.length ? (
          <>
            <p className="text-sm font-semibold text-text-primary">
              {buses.length === 1 ? "One" : buses.length} {name(winner)} {buses.length === 1 ? "Hummer" : "Hummers"} in the showroom now
            </p>
            <ul className="mt-3 grid gap-2">
              {buses.slice(0, 3).map((b) => (
                <li key={b.slug}>
                  <Link
                    href={`/vehicles/${b.slug}`}
                    className="group flex items-center gap-3 rounded-xl border border-white/[0.07] bg-surface-0/60 p-2 pr-3 !no-underline transition-colors hover:border-gold-500/40"
                  >
                    <span className="relative block aspect-[4/3] w-20 shrink-0 overflow-hidden rounded-lg bg-surface-2">
                      {b.coverUrl && <VehicleImage src={b.coverUrl} alt="" fill sizes="80px" className="object-cover" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-text-primary group-hover:text-gold-200">{b.title}</span>
                      <span className="figures block text-sm text-text-secondary">
                        {formatNaira(b.priceMinor)}
                        {b.seats ? ` · ${b.seats} seats` : ""}
                      </span>
                    </span>
                    <ArrowRight aria-hidden size={16} className="shrink-0 text-gold-300 transition-transform group-hover:translate-x-1" />
                  </Link>
                </li>
              ))}
            </ul>
            <Link
              href="/hummer-bus"
              className="group mt-3 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-gold-300 hover:text-gold-200"
            >
              Every Hummer bus in stock
              <ArrowRight aria-hidden size={16} className="transition-transform group-hover:translate-x-1" />
            </Link>
          </>
        ) : (
          <>
            <p className="text-sm leading-relaxed text-text-secondary">
              There is no {name(winner)} Hummer in the showroom today. The Sourcing Desk can find one, and tells you the moment it lands.
            </p>
            <Link
              href={`/find?want=${encodeURIComponent(`Toyota Hiace Hummer bus, ${name(winner)}`)}`}
              className="group mt-3 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-gold-300 hover:text-gold-200"
            >
              Ask the Sourcing Desk
              <ArrowRight aria-hidden size={16} className="transition-transform group-hover:translate-x-1" />
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
