"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, Flag, Fuel, Gauge, Megaphone, RotateCcw, TrafficCone, Trophy, Users, Wrench } from "lucide-react";
import { VehicleImage } from "@/components/VehicleImage";
import { formatNaira } from "@/lib/money";
import { useReducedMotion, useWidth } from "./motion";
import { Burst, haptic, usePulse } from "./rewards";
import { JOBS, LEGS, SETUPS, WHY, legTimes, totalTime, type HummerStock, type Job, type LegKind, type Setup, type Trait } from "./hummers";

type Phase = "ready" | "countdown" | "racing" | "done";

const LEG_ICON: Record<LegKind, typeof Fuel> = {
  stops: Users,
  goslow: TrafficCone,
  expressway: Gauge,
  pump: Fuel,
  mechanic: Wrench,
};
/** Each leg's colour: on the road, on the map, on its sign. */
const LEG_TINT: Record<LegKind, { road: string; sign: string; ink: string }> = {
  stops: { road: "rgb(90 140 255 / 0.07)", sign: "#2f5fb3", ink: "#fff" },
  goslow: { road: "rgb(255 90 70 / 0.08)", sign: "#e0a82e", ink: "#0A0908" },
  expressway: { road: "rgb(61 220 132 / 0.05)", sign: "#1f6b3a", ink: "#fff" },
  pump: { road: "rgb(240 170 40 / 0.08)", sign: "#b8322a", ink: "#fff" },
  mechanic: {
    road: "rgb(170 180 200 / 0.08)",
    sign: "#f2d23c",
    ink: "#0A0908",
  },
};

/** The winner's time; everyone else's follows from their pace. */
const WINNER_MS = 7600;
/** A standing start: the buses pull away over the first half-second. */
const GETAWAY_MS = 500;
const warp = (t: number) => (t < GETAWAY_MS ? (t * t) / (2 * GETAWAY_MS) : t - GETAWAY_MS / 2);
const TAU = Math.PI * 2;

const name = (s: Setup) => `${s.fuel} ${s.gearbox}`;
const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const PLACES = ["1st", "2nd", "3rd", "4th"];

interface Run {
  /** Where each leg starts, as a share of the run. */
  starts: number[];
  /** For each bus: when it enters each leg, and how long each leg takes it, in ms. */
  enters: number[][];
  durations: number[][];
  totals: number[];
}

function plan(job: Job): Run {
  const starts = job.legs.reduce<number[]>((a, l, i) => [...a, i ? a[i - 1] + job.legs[i - 1].len : 0], []);
  const best = Math.min(...SETUPS.map((s) => totalTime(s, job)));
  const durations = SETUPS.map((s) => legTimes(s, job).map((t) => (t / best) * WINNER_MS));
  const enters = durations.map((d) => d.reduce<number[]>((a, _, i) => [...a, i ? a[i - 1] + d[i - 1] : 0], []));
  return {
    starts,
    enters,
    durations,
    totals: durations.map((d) => d.reduce((a, b) => a + b, 0)),
  };
}

/**
 * Where a bus is, as a share of the run, at race time `t`. The leg's time is
 * fixed by its rating; within the leg the pace has a shape — stop-start in
 * traffic for a tired gearbox, a pull-in and pull-out at the pump and the
 * mechanic — so a reader can see why a bus is losing time, not only that it is.
 */
function position(run: Run, job: Job, bus: number, t: number): { x: number; leg: number } {
  const tt = warp(t);
  const enters = run.enters[bus];
  const s = SETUPS[bus];
  if (tt >= run.totals[bus]) return { x: 1, leg: job.legs.length - 1 };
  let k = enters.length - 1;
  while (k > 0 && tt < enters[k]) k--;
  const q = Math.min(1, (tt - enters[k]) / run.durations[bus][k]);
  const leg = job.legs[k];
  const rating = s.ratings[LEGS[leg.kind].trait];
  let u = q;
  if (leg.kind === "goslow" || leg.kind === "stops") {
    const a = rating <= 2 ? 0.88 : 0.22;
    const n = leg.kind === "stops" ? 3 : 4;
    u = q - (a * Math.sin(TAU * n * q)) / (TAU * n);
  } else if (leg.kind === "pump" || leg.kind === "mechanic") {
    u = q + (0.82 * Math.sin(TAU * q)) / TAU;
  }
  return { x: run.starts[k] + leg.len * u, leg: k };
}

/** A side view of a high-roof Hiace, facing right. Wheels and the brake light are left to the caller to drive. */
function Bus({
  color,
  wheels,
  brake,
}: {
  color: string;
  wheels: (el: SVGGElement | null, i: number) => void;
  brake: (el: SVGPathElement | null) => void;
}) {
  const dark = color === "#24262a";
  return (
    <svg viewBox="66 52 694 280" className="block h-full w-full overflow-visible" aria-hidden>
      <g transform="matrix(-1 0 0 1 820 0)">
        <path
          d="M78 300 L70 246 C70 222 80 206 104 200 L164 88 C172 72 186 66 206 65 L700 60 C724 60 734 72 736 94 L744 272 C745 292 734 300 716 300 L656 300 A56 56 0 0 0 544 300 L232 300 A56 56 0 0 0 120 300 Z"
          fill={color}
          stroke={dark ? "rgb(255 255 255 / 0.35)" : "rgb(0 0 0 / 0.35)"}
          strokeWidth="4"
        />
        <path
          d="M78 300 L70 246 C70 222 80 206 104 200 L740 196 L744 272 C745 292 734 300 716 300 L656 300 A56 56 0 0 0 544 300 L232 300 A56 56 0 0 0 120 300 Z"
          fill="url(#hr-shade)"
        />
        <g fill="#141a22" stroke="rgb(255 255 255 / 0.18)" strokeWidth="2">
          <path d="M174 96 L256 93 L256 184 L126 186 Z" />
          <rect x="280" y="91" width="114" height="91" rx="6" />
          <rect x="414" y="89" width="124" height="93" rx="6" />
          <rect x="552" y="87" width="136" height="95" rx="10" />
        </g>
        <path d="M180 100 L210 99 L160 182 L136 182 Z" fill="rgb(255 255 255 / 0.1)" />
        <path d="M262 90 L262 298 M406 86 L406 298" stroke="rgb(0 0 0 / 0.3)" strokeWidth="3" />
        <path d="M406 210 L740 205" stroke="rgb(201 168 76 / 0.75)" strokeWidth="6" />
        <path d="M72 232 L96 226 L100 238 L74 244 Z" fill="#fff4cf" />
        <path d="M736 200 L744 200 L745 240 L737 240 Z" fill="#7a1a14" />
        <path
          ref={brake}
          d="M732 196 L748 196 L749 244 L733 244 Z"
          fill="#ff3b2f"
          opacity="0.15"
          style={{ filter: "drop-shadow(0 0 10px #ff3b2f)" }}
        />
      </g>
      {/* Wheels, outside the mirror so that turning them clockwise rolls the bus forwards. */}
      {[220, 644].map((cx, i) => (
        <g key={cx} ref={(el) => wheels(el, i)} style={{ transformBox: "fill-box", transformOrigin: "center" }}>
          <circle cx={cx} cy="286" r="38" fill="#0d0d0e" />
          <circle cx={cx} cy="286" r="18" fill="#9a9ea5" />
          <path d={`M${cx - 17} 286 H${cx + 17} M${cx} 269 V303`} stroke="#3a3c40" strokeWidth="5" />
        </g>
      ))}
    </svg>
  );
}

/** The Lagos skyline, one tile, drawn behind everything and scrolled slower than the road. */
const TILE = 520;
const SKYLINE = (() => {
  const out: { x: number; w: number; h: number; lit: boolean }[] = [];
  for (let x = 0, i = 0; x < TILE - 10; i++) {
    const w = 16 + ((i * 37) % 26);
    out.push({
      x,
      w,
      h: 18 + ((i * 53) % 46) + (i % 7 === 3 ? 22 : 0),
      lit: i % 3 === 0,
    });
    x += w + 3 + (i % 4);
  }
  return out;
})();

function Skyline({ height }: { height: number }) {
  return (
    <svg width={TILE * 3} height={height} className="absolute bottom-0 left-0" aria-hidden>
      {[0, 1, 2].map((copy) =>
        SKYLINE.map((b, i) => (
          <g key={`${copy}-${i}`}>
            <rect x={copy * TILE + b.x} y={height - b.h} width={b.w} height={b.h} fill="rgb(255 255 255 / 0.055)" />
            {b.lit &&
              [0.3, 0.55].map((f) => (
                <rect key={f} x={copy * TILE + b.x + b.w * 0.3} y={height - b.h * f} width="3" height="3" fill="rgb(255 214 140 / 0.35)" />
              ))}
          </g>
        )),
      )}
    </svg>
  );
}

/** What stands beside the road on each leg: a bridge over the lagoon, a shelter, trees, a filling station, a workshop. */
function Roadside({ kind, width, sky }: { kind: LegKind; width: number; sky: number }) {
  if (kind === "goslow")
    return (
      <div aria-hidden className="absolute bottom-0 left-0 h-full" style={{ width }}>
        <div className="absolute inset-x-0 bottom-0 h-[38%] bg-[linear-gradient(180deg,rgb(40_80_110/0.0),rgb(40_80_110/0.45))]" />
        <div className="absolute inset-x-0 bottom-1.5 h-px bg-white/30" />
        <div className="absolute inset-x-0 bottom-0 h-3 bg-[repeating-linear-gradient(90deg,rgb(255_255_255/0.28)_0_2px,transparent_2px_14px)]" />
      </div>
    );
  if (kind === "stops")
    return (
      <div aria-hidden className="absolute bottom-0 left-0 h-full" style={{ width }}>
        {[0.32, 0.72].map((f) => (
          <div key={f} className="absolute bottom-0" style={{ left: width * f }}>
            <div className="h-1.5 w-16 rounded-sm bg-[#2f5fb3]/80" />
            <div className="flex h-7 justify-between px-1">
              <span className="w-0.5 bg-white/30" />
              <span className="flex items-end gap-1 pb-0.5">
                {[0, 1, 2].map((p) => (
                  <span key={p} className="flex flex-col items-center">
                    <span className="size-1.5 rounded-full bg-white/50" />
                    <span className="h-2.5 w-1.5 rounded-t-sm bg-white/35" />
                  </span>
                ))}
              </span>
              <span className="w-0.5 bg-white/30" />
            </div>
          </div>
        ))}
      </div>
    );
  if (kind === "expressway")
    return (
      <div
        aria-hidden
        className="absolute bottom-0 left-0 h-6 bg-[radial-gradient(circle_at_12px_8px,rgb(60_120_70/0.55)_7px,transparent_8px),linear-gradient(90deg,transparent_11px,rgb(255_255_255/0.18)_11px_13px,transparent_13px)] bg-[length:46px_24px] bg-repeat-x"
        style={{ width }}
      />
    );
  if (kind === "pump")
    return (
      <div aria-hidden className="absolute bottom-0" style={{ left: width * 0.3 }}>
        <div className="h-2 w-28 rounded-sm bg-[linear-gradient(180deg,#d8463b,#9e2a22)] shadow-[0_2px_0_rgb(242_210_60/0.8)]" />
        <div className="flex h-8 items-end justify-between px-2">
          <span className="h-full w-1 bg-white/25" />
          {[0, 1].map((p) => (
            <span key={p} className="mb-0 flex h-5 w-3 flex-col items-center rounded-t-sm bg-white/40 pt-0.5">
              <span className="h-1 w-2 rounded-[1px] bg-[#0A0908]/60" />
            </span>
          ))}
          <span className="h-full w-1 bg-white/25" />
        </div>
      </div>
    );
  return (
    <div aria-hidden className="absolute bottom-0" style={{ left: width * 0.32, height: sky }}>
      <div className="absolute bottom-0 left-0 h-9 w-24 bg-white/[0.07]" />
      <div className="absolute bottom-9 left-0 h-3 w-24 bg-white/[0.12] [clip-path:polygon(0_100%,50%_0,100%_100%)]" />
      <div className="absolute bottom-3 left-2 rounded-[2px] bg-[#f2d23c] px-1 text-[0.45rem] leading-[0.7rem] font-black tracking-wider text-[#0A0908]">
        MECHANIC
      </div>
      <div className="absolute bottom-0 left-[4.6rem] flex flex-col items-center">
        {[0, 1, 2].map((t) => (
          <span key={t} className="-mt-0.5 h-2 w-4 rounded-full border-2 border-black/80 bg-[#222]" />
        ))}
      </div>
    </div>
  );
}

/**
 * Pick the job; guess the winner; four Hummer buses — petrol or diesel,
 * manual or automatic — race it through Lagos. Every leg tests one trade-off
 * from the article's table, and the bus says what it is feeling as it goes:
 * stop-start in the go-slow, smoke at a doubtful pump, a long wait at the
 * mechanic. The result names the bus that suits the job, and shows the ones
 * in the showroom that match.
 */
export function HummerRace({ stock }: { stock: HummerStock }) {
  const reduced = useReducedMotion();
  const [jobId, setJobId] = useState(JOBS[0].id);
  const job = JOBS.find((j) => j.id === jobId)!;
  const run = useMemo(() => plan(job), [job]);
  const [pick, setPick] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("ready");
  const [lights, setLights] = useState(0);
  const [legOf, setLegOf] = useState<number[]>(SETUPS.map(() => -1));
  const [live, setLive] = useState<string[]>([]);
  const [order, setOrder] = useState<string[]>([]);
  const [fire, setFire] = useState(0);
  const [honk, setHonk] = useState(0);
  const [miss, setMiss] = useState(0);
  const shaking = usePulse(miss);
  const [view, width] = useWidth<HTMLDivElement>(640);

  // The geometry follows the width of the screen.
  const narrow = width < 560;
  const busW = Math.round(Math.min(104, Math.max(66, width * 0.19)));
  const busH = Math.round(busW * 0.403);
  const laneH = narrow ? 56 : 66;
  const sky = narrow ? 84 : 104;
  const track = Math.round(Math.max(width * 3, 960));
  const START = 14;
  const camMax = track + 56 - width;

  const world = useRef<HTMLDivElement>(null);
  const skyline = useRef<HTMLDivElement>(null);
  const buses = useRef<(HTMLDivElement | null)[]>([]);
  const wheels = useRef<(SVGGElement | null)[][]>(SETUPS.map(() => []));
  const brakes = useRef<(SVGPathElement | null)[]>([]);
  const dots = useRef<(HTMLSpanElement | null)[]>([]);
  const frame = useRef(0);
  const timers = useRef<number[]>([]);
  const cam = useRef(0);
  const geo = useRef({ busW, laneH, track, START, camMax, width });
  useEffect(() => {
    geo.current = { busW, laneH, track, START, camMax, width };
  }, [busW, laneH, track, camMax, width]);

  /** Draws every bus at `xs` (shares of the run) and points the camera. */
  const paint = (xs: number[], camera: number, extra?: (i: number) => void) => {
    const g = geo.current;
    const left = (x: number) => g.START + x * (g.track - g.busW - g.START);
    if (world.current) world.current.style.transform = `translate3d(${-camera}px,0,0)`;
    if (skyline.current) skyline.current.style.transform = `translate3d(${-((camera * 0.3) % TILE)}px,0,0)`;
    xs.forEach((x, i) => {
      const px = left(x);
      dots.current[i]?.style.setProperty("left", `${x * 100}%`);
      const el = buses.current[i];
      if (!el) return;
      el.style.left = `${px}px`;
      const turn = (px / (g.busW * 0.055)) * (180 / Math.PI);
      wheels.current[i].forEach((w) => w?.style.setProperty("transform", `rotate(${turn}deg)`));
      extra?.(i);
    });
  };

  const clear = () => {
    cancelAnimationFrame(frame.current);
    timers.current.splice(0).forEach(window.clearTimeout);
  };
  useEffect(() => {
    const list = timers.current;
    const raf = frame;
    return () => {
      cancelAnimationFrame(raf.current);
      list.splice(0).forEach(window.clearTimeout);
    };
  }, []);

  // At rest — before a race, after one, or when the screen turns — draw the buses where they stand.
  useEffect(() => {
    if (phase === "racing" || phase === "countdown") return;
    const done = phase === "done";
    cam.current = done ? Math.max(0, camMax) : 0;
    paint(
      SETUPS.map(() => (done ? 1 : 0)),
      cam.current,
    );
    brakes.current.forEach((b) => b?.setAttribute("opacity", "0.15"));
    buses.current.forEach((b) => b?.style.setProperty("transform", "none"));
  }, [phase, width, jobId, camMax]);

  const reset = (id = jobId) => {
    clear();
    setJobId(id);
    setPhase("ready");
    setLights(0);
    setLegOf(SETUPS.map(() => -1));
    setLive([]);
    setOrder([]);
  };

  const finish = (finalOrder: string[]) => {
    setOrder(finalOrder);
    setLive(finalOrder);
    setPhase("done");
    setFire((f) => f + 1);
    if (pick && pick !== finalOrder[0]) setMiss((m) => m + 1);
    haptic([12, 50, 12, 50, 24]);
  };

  const race = () => {
    reset(jobId);
    const byTime = SETUPS.map((s, i) => ({ id: s.id, t: run.totals[i] })).sort((a, b) => a.t - b.t);
    if (reduced) {
      finish(byTime.map((b) => b.id));
      return;
    }
    setPhase("countdown");
    for (const n of [1, 2, 3]) {
      timers.current.push(
        window.setTimeout(() => {
          setLights(n);
          haptic(6);
        }, n * 420),
      );
    }
    timers.current.push(
      window.setTimeout(() => {
        setLights(4);
        setPhase("racing");
        haptic(20);
        // The green lights stay up for a moment as the buses pull away.
        timers.current.push(window.setTimeout(() => setLights(5), 800));
        const start = performance.now();
        let last = start;
        let lastLegs = SETUPS.map(() => -1).join();
        let lastOrder = "";
        let finished = 0;
        const prev = SETUPS.map(() => 0);
        const speeds = SETUPS.map(() => 0);
        const tick = (now: number) => {
          const t = now - start;
          const dt = Math.max(1, now - last);
          last = now;
          const at = SETUPS.map((_, i) => position(run, job, i, t));
          const xs = at.map((p) => p.x);

          // The camera keeps the pack in shot, and never loses the leader.
          const g = geo.current;
          const left = (x: number) => g.START + x * (g.track - g.busW - g.START);
          const front = left(Math.max(...xs)) + g.busW;
          const back = left(Math.min(...xs));
          let target = (front + back) / 2 - g.width / 2;
          target = Math.max(target, front - g.width + 28);
          target = Math.min(Math.max(target, 0), g.camMax);
          cam.current += (target - cam.current) * (1 - Math.exp(-dt / 160));

          paint(xs, cam.current, (i) => {
            // Brake lights when a bus is crawling; a nod of the nose as it brakes.
            const v = (xs[i] - prev[i]) / dt;
            const avg = 1 / run.totals[i];
            const slowing = speeds[i] - v;
            speeds[i] += (v - speeds[i]) * 0.3;
            prev[i] = xs[i];
            brakes.current[i]?.setAttribute("opacity", xs[i] < 1 && v < avg * 0.45 ? "1" : "0.15");
            const legKind = job.legs[at[i].leg].kind;
            const s = SETUPS[i];
            const sputter = legKind === "pump" && s.ratings.fuel <= 2 && xs[i] < 1 ? Math.sin(t / 24 + i) * 1.4 : 0;
            const nod = Math.max(-1.6, Math.min(1.6, (slowing / avg) * 2.2));
            const idle = Math.sin(t / 95 + i * 1.7) * 0.5;
            buses.current[i]?.style.setProperty("transform", `translateY(${idle + sputter}px) rotate(${xs[i] < 1 ? nod : 0}deg)`);
          });

          const legs = at.map((p, i) => (xs[i] >= 1 ? job.legs.length : p.leg)).join();
          if (legs !== lastLegs) {
            lastLegs = legs;
            setLegOf(legs.split(",").map(Number));
          }
          const nowDone = byTime.filter((b) => warp(t) >= b.t).length;
          const running = SETUPS.map((s, i) => ({
            id: s.id,
            x: xs[i],
            t: run.totals[i],
          }))
            .sort((a, b) => (a.x >= 1 && b.x >= 1 ? a.t - b.t : b.x - a.x))
            .map((r) => r.id);
          const key = running.join();
          if (key !== lastOrder) {
            if (lastOrder) haptic(4);
            lastOrder = key;
            setLive(running);
          }
          if (nowDone !== finished) {
            finished = nowDone;
            setOrder(byTime.slice(0, nowDone).map((b) => b.id));
            haptic(nowDone === 1 ? [10, 30, 10] : 5);
          }
          if (finished < SETUPS.length) frame.current = requestAnimationFrame(tick);
          else finish(byTime.map((b) => b.id));
        };
        frame.current = requestAnimationFrame(tick);
      }, 4 * 420),
    );
  };

  const racing = phase === "racing";
  const winner = SETUPS.find((s) => s.id === order[0]);
  const runnerUp = SETUPS.find((s) => s.id === order[1]);
  const lead = SETUPS.findIndex((s) => s.id === live[0]);
  const leadLeg = lead >= 0 ? legOf[lead] : -1;
  const pickSetup = SETUPS.find((s) => s.id === pick);
  const pickIndex = SETUPS.findIndex((s) => s.id === pick);

  return (
    <div className="surface-card overflow-hidden p-4 sm:p-6 md:p-8">
      <p className="text-sm font-semibold text-text-primary">1. Pick the job</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {JOBS.map((j) => (
          <button
            key={j.id}
            type="button"
            aria-pressed={j.id === jobId}
            onClick={() => reset(j.id)}
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
              disabled={phase === "countdown" || racing}
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

      {/* The run */}
      <div
        ref={view}
        className="relative mt-5 overflow-hidden rounded-2xl border border-white/[0.08] bg-[#1c1b19] select-none"
        style={{ height: sky + laneH * SETUPS.length }}
        aria-hidden
      >
        <svg width="0" height="0" className="absolute">
          <defs>
            <linearGradient id="hr-shade" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="rgb(0 0 0 / 0)" />
              <stop offset="1" stopColor="rgb(0 0 0 / 0.32)" />
            </linearGradient>
          </defs>
        </svg>
        {/* Sky and skyline, scrolled slower than the road */}
        <div className="absolute inset-x-0 top-0 bg-[linear-gradient(180deg,#0f1522,#221d28_62%,#3b2a1d)]" style={{ height: sky }}>
          <div ref={skyline} className="absolute inset-0 will-change-transform">
            <Skyline height={sky} />
          </div>
        </div>

        {/* The world: everything that scrolls with the road */}
        <div ref={world} className="absolute top-0 left-0 h-full will-change-transform" style={{ width: track + 160 }}>
          {job.legs.map((l, k) => {
            const x = run.starts[k] * track;
            const w = l.len * track;
            const Icon = LEG_ICON[l.kind];
            const tint = LEG_TINT[l.kind];
            return (
              <div key={k} className="absolute top-0 h-full" style={{ left: x, width: w }}>
                <div className="absolute inset-x-0 top-0" style={{ height: sky }}>
                  <Roadside kind={l.kind} width={w} sky={sky} />
                  {/* The sign at the start of the leg; the first carries where the run begins */}
                  <div className="absolute top-2 left-2 flex flex-col items-start">
                    <span className="flex items-center gap-1.5">
                      {k === 0 && (
                        <span className="rounded-[4px] bg-white/90 px-1.5 py-0.5 text-[0.62rem] font-extrabold tracking-wide text-[#0A0908] uppercase shadow-[0_2px_6px_rgb(0_0_0/0.4)]">
                          {job.from}
                        </span>
                      )}
                      <span
                        className="flex items-center gap-1 rounded-[4px] px-1.5 py-0.5 text-[0.62rem] font-extrabold tracking-wide uppercase shadow-[0_2px_6px_rgb(0_0_0/0.4)]"
                        style={{ background: tint.sign, color: tint.ink }}
                      >
                        <Icon size={11} strokeWidth={2.6} />
                        {l.kind === "expressway" ? `${job.to} →` : LEGS[l.kind].label}
                      </span>
                    </span>
                    <span className="ml-2 h-6 w-0.5 bg-white/30" />
                  </div>
                </div>
                <div className="absolute inset-x-0 bottom-0" style={{ top: sky, background: tint.road }} />
                <div className="absolute bottom-0 left-0 w-px bg-white/[0.08]" style={{ top: sky }} />
              </div>
            );
          })}
          {/* Lanes */}
          <div className="absolute inset-x-0 h-0.5 bg-white/25" style={{ top: sky }} />
          {SETUPS.slice(1).map((_, i) => (
            <div
              key={i}
              className="absolute inset-x-0 h-0.5 bg-[repeating-linear-gradient(90deg,rgb(255_255_255/0.22)_0_22px,transparent_22px_48px)]"
              style={{ top: sky + laneH * (i + 1) - 1 }}
            />
          ))}
          {/* Start and finish */}
          <div className="absolute bottom-0 w-0.5 bg-white/40" style={{ left: START - 4, top: sky }} />
          <div
            className="absolute bottom-0 w-3 bg-[repeating-conic-gradient(#f5f2ea_0_25%,#0B0A09_0_50%)] bg-[length:12px_12px] opacity-85"
            style={{ left: track, top: sky }}
          />
          <div className="absolute top-2 flex -translate-x-full flex-col items-end" style={{ left: track + 10 }}>
            <span className="rounded-[4px] bg-[linear-gradient(180deg,var(--gold-200),var(--gold-500))] px-2 py-0.5 text-[0.62rem] font-extrabold tracking-wide whitespace-nowrap text-[#0A0908] uppercase">
              {job.to}
            </span>
            <span className="h-6 w-0.5 bg-white/30" />
          </div>

          {/* The buses */}
          {SETUPS.map((s, i) => {
            const k = legOf[i];
            const inLeg = k >= 0 && k < job.legs.length ? job.legs[k] : null;
            const trait: Trait | null = inLeg ? LEGS[inLeg.kind].trait : null;
            const rating = trait ? s.ratings[trait] : 3;
            const moving = racing && k < job.legs.length;
            return (
              <div
                key={s.id}
                ref={(el) => {
                  buses.current[i] = el;
                }}
                className="absolute origin-bottom"
                style={{
                  left: START,
                  top: sky + laneH * (i + 1) - busH - 6,
                  width: busW,
                  height: busH,
                }}
              >
                {/* Speed on the open road; smoke at a bad pump; a spanner at the mechanic */}
                {moving && inLeg?.kind === "expressway" && rating >= 4 && (
                  <span className="absolute top-[30%] -left-1 flex flex-col gap-1.5">
                    {[0, 1, 2].map((n) => (
                      <span
                        key={n}
                        className="speed-line block h-0.5 w-5 rounded-full bg-white/50"
                        style={{ animationDelay: `${n * 110}ms` }}
                      />
                    ))}
                  </span>
                )}
                {moving && inLeg?.kind === "pump" && rating <= 2 && (
                  <span className="absolute bottom-[8%] -left-1">
                    {[0, 1, 2].map((n) => (
                      <span
                        key={n}
                        className="bus-puff absolute size-3.5 rounded-full bg-[#8d8d8d]/80"
                        style={{ animationDelay: `${n * 230}ms` }}
                      />
                    ))}
                  </span>
                )}
                {moving && inLeg?.kind === "mechanic" && (
                  <span className="absolute top-[18%] left-[42%] grid size-5 place-items-center rounded-full bg-[#f2d23c] text-[#0A0908] shadow-[0_2px_6px_rgb(0_0_0/0.5)]">
                    <Wrench size={11} strokeWidth={2.8} className={rating <= 3 ? "animate-spin" : ""} />
                  </span>
                )}
                <Bus
                  color={s.color}
                  wheels={(el, w) => {
                    wheels.current[i][w] = el;
                  }}
                  brake={(el) => {
                    brakes.current[i] = el;
                  }}
                />
                {/* What the bus is going through, as it enters each leg */}
                {moving && inLeg && trait && (
                  <span
                    key={`${jobId}-${k}`}
                    className={`bus-bubble absolute right-0 bottom-full mb-1 rounded-full px-2 py-0.5 text-[0.62rem] font-bold whitespace-nowrap shadow-[0_2px_8px_rgb(0_0_0/0.5)] ${rating >= 4 ? "bg-[#1f6b3a] text-white" : rating <= 2 ? "bg-[#9e2a22] text-white" : "bg-white/85 text-[#0A0908]"}`}
                  >
                    {rating >= 4 ? "▲ " : rating <= 2 ? "▼ " : ""}
                    {s.says[trait]}
                  </span>
                )}
                {racing && i === pickIndex && honk > 0 && (
                  <span
                    key={`honk-${honk}`}
                    className="bus-bubble absolute bottom-full left-0 mb-1 rounded-full bg-[linear-gradient(180deg,var(--gold-200),var(--gold-500))] px-2 py-0.5 text-[0.65rem] font-extrabold whitespace-nowrap text-[#0A0908]"
                  >
                    Pom pom!
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Lane names stay put while the road scrolls */}
        {SETUPS.map((s, i) => {
          const place = live.indexOf(s.id);
          const done = order.includes(s.id);
          return (
            <span
              key={s.id}
              className="pointer-events-none absolute left-2 flex items-center gap-1.5 rounded-full bg-black/45 py-0.5 pr-1.5 pl-1 text-[0.62rem] font-semibold text-white/80"
              style={{ top: sky + laneH * i + 4 }}
            >
              <span className="size-2 rounded-full border border-white/40" style={{ background: s.color }} />
              {s.label}
              {(racing || phase === "done") && place >= 0 && (
                <span
                  key={`${place}-${done}`}
                  className={`pop-in rounded-full px-1.5 py-px text-[0.6rem] font-bold ${place === 0 ? "bg-[linear-gradient(180deg,var(--gold-200),var(--gold-500))] text-[#0A0908]" : "bg-white/15 text-text-primary"}`}
                >
                  {PLACES[place]}
                </span>
              )}
              {s.id === pick && <span className="text-gold-300">· yours</span>}
            </span>
          );
        })}

        {/* Start lights */}
        {phase === "countdown" || (racing && lights === 4) ? (
          <div className="absolute left-1/2 flex -translate-x-1/2 gap-2 rounded-full bg-black/75 px-3 py-2" style={{ top: sky * 0.42 }}>
            {[1, 2, 3].map((n) => (
              <span
                key={n}
                className={`size-4 rounded-full transition-colors duration-150 ${lights === 4 ? "bg-[#3ddc84] shadow-[0_0_14px_#3ddc84]" : lights >= n ? "bg-[#ff4b3e] shadow-[0_0_14px_#ff4b3e]" : "bg-white/15"}`}
              />
            ))}
          </div>
        ) : null}
      </div>

      {/* The whole run at a glance, so nobody is lost off the edge of the screen; the leader's leg is lit */}
      <div aria-hidden className="mt-3">
        <div className="flex">
          {job.legs.map((l, k) => {
            const Icon = LEG_ICON[l.kind];
            const now = racing && k === leadLeg;
            return (
              <span
                key={k}
                className={`flex items-center justify-center gap-1 text-[0.62rem] whitespace-nowrap transition-colors ${now ? "font-semibold text-gold-200" : "text-text-muted"}`}
                style={{ width: `${l.len * 100}%` }}
              >
                <Icon size={11} className={now ? "text-gold-300" : ""} />
                {(!narrow || now) && LEGS[l.kind].label}
              </span>
            );
          })}
        </div>
        <div className="relative mt-1.5 flex h-2 overflow-visible rounded-full">
          {job.legs.map((l, k) => (
            <span
              key={k}
              className="h-full first:rounded-l-full last:rounded-r-full"
              style={{
                width: `${l.len * 100}%`,
                background: LEG_TINT[l.kind].sign,
                opacity: 0.55,
              }}
            />
          ))}
          {SETUPS.map((s, i) => (
            <span
              key={s.id}
              ref={(el) => {
                dots.current[i] = el;
              }}
              className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[#0A0908] shadow-[0_0_0_1px_rgb(255_255_255/0.4)]"
              style={{
                left: "0%",
                background: s.color,
                zIndex: s.id === pick ? 2 : 1,
              }}
            />
          ))}
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={race}
          disabled={phase === "countdown" || racing}
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

      {/* The result */}
      {phase === "done" && winner && (
        <Result job={job} winner={winner} runnerUp={runnerUp} pick={pickSetup} order={order} fire={fire} stock={stock} run={run} />
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
  run: Run;
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
