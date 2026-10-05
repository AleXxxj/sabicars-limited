"use client";

import { useEffect, useImperativeHandle, useMemo, useRef, useState, type Ref } from "react";
import { Wrench } from "lucide-react";
import type { BusShape } from "@/lib/hiace-family";
import { useReducedMotion, useWidth } from "../motion";
import { haptic } from "../rewards";
import { BUS_ASPECT, Bus, BusDefs, WHEEL_SHARE, busRear, passengerClip } from "./Bus";
import { LEG_ICON, LEG_LABEL, LEG_TINT, Roadside, SKYLINE_TILE, Skyline, type LegKind } from "./scenery";

/**
 * The road every race runs on: buses side-on in lanes, a Lagos skyline
 * scrolling slower than the road, a sign at each leg, a camera that keeps the
 * pack in shot, start lights, live places, and a map of the whole run so
 * nobody is lost off the edge of a phone.
 *
 * It knows nothing about why one bus is faster than another. The caller says
 * how long each bus takes over each leg, and what it should show while it
 * does — stop-start in traffic, smoke, a spanner, passengers boarding — and
 * starts and resets it through `handle`.
 */

export type Phase = "ready" | "countdown" | "racing" | "done";

export interface Racer {
  id: string;
  label: string;
  /** A second line on the lane: "2.7 · 18 seats". */
  sub?: string;
  color: string;
  shape: BusShape;
  seats?: number;
}

export interface RaceLeg {
  kind: LegKind;
  /** Share of the run; the legs add up to 1. */
  len: number;
  label?: string;
}

export interface Note {
  text: string;
  tone: "good" | "bad" | "mid";
}

export interface RaceSpec {
  /** Changes when the run changes; the caller resets the track when it does. */
  key: string;
  from: string;
  to: string;
  legs: RaceLeg[];
  /** How long each bus takes over each leg, in ms: [bus][leg]. */
  durations: number[][];
  /** The share of a leg a bus spends standing still first, as when boarding: [bus][leg]. */
  hold?: number[][];
  /** Struggling on this leg: stop-start in traffic, sputtering at a pump, bouncing hard on a bad road. */
  struggle?: boolean[][];
  /** Flying on this leg: speed lines on the open road. */
  cruise?: boolean[][];
  /** What a bus says as it enters each leg. */
  notes?: (Note | null)[][];
  /** Passengers aboard. With a hold on the first leg, they board there. */
  loaded?: boolean;
}

export interface TrackHandle {
  start: () => void;
  reset: () => void;
}

/** A standing start: the buses pull away over the first half-second. */
const GETAWAY_MS = 500;
const warp = (t: number) => (t < GETAWAY_MS ? (t * t) / (2 * GETAWAY_MS) : t - GETAWAY_MS / 2);
const TAU = Math.PI * 2;
const PLACES = ["1st", "2nd", "3rd", "4th", "5th", "6th"];
const TRAFFIC: LegKind[] = ["goslow", "stops", "city"];

export function RaceTrack({
  racers,
  spec,
  pick = null,
  honk = 0,
  compact = false,
  handle,
  onPhase,
  onFinish,
}: {
  racers: Racer[];
  spec: RaceSpec;
  pick?: string | null;
  honk?: number;
  compact?: boolean;
  handle: Ref<TrackHandle>;
  onPhase?: (phase: Phase) => void;
  onFinish?: (order: string[]) => void;
}) {
  const reduced = useReducedMotion();
  const [phase, setPhaseState] = useState<Phase>("ready");
  const [lights, setLights] = useState(0);
  const [legOf, setLegOf] = useState<number[]>(racers.map(() => -1));
  const [live, setLive] = useState<string[]>([]);
  const [order, setOrder] = useState<string[]>([]);
  const [view, width] = useWidth<HTMLDivElement>(640);

  // The geometry follows the width of the screen.
  const narrow = width < 560;
  const busW = Math.round(Math.min(compact ? 96 : 116, Math.max(compact ? 60 : 72, width * 0.21)));
  const busH = Math.round(busW * BUS_ASPECT);
  const laneH = compact ? 46 : narrow ? 56 : 66;
  const sky = compact ? 64 : narrow ? 84 : 104;
  const track = Math.round(Math.max(width * 3, 960));
  const START = 10;
  const camMax = track + 56 - width;

  const timing = useMemo(() => {
    const starts = spec.legs.reduce<number[]>((a, l, i) => [...a, i ? a[i - 1] + spec.legs[i - 1].len : 0], []);
    const enters = spec.durations.map((d) => d.reduce<number[]>((a, _, i) => [...a, i ? a[i - 1] + d[i - 1] : 0], []));
    const totals = spec.durations.map((d) => d.reduce((a, b) => a + b, 0));
    return { starts, enters, totals };
  }, [spec]);

  const world = useRef<HTMLDivElement>(null);
  const skyline = useRef<HTMLDivElement>(null);
  const buses = useRef<(HTMLDivElement | null)[]>([]);
  const wheels = useRef<(SVGGElement | null)[][]>(racers.map(() => []));
  const brakes = useRef<(SVGPathElement | null)[]>([]);
  const fills = useRef<(SVGRectElement | null)[]>([]);
  const counters = useRef<(HTMLSpanElement | null)[]>([]);
  const dots = useRef<(HTMLSpanElement | null)[]>([]);
  const frame = useRef(0);
  const timers = useRef<number[]>([]);
  const cam = useRef(0);
  const geo = useRef({ busW, track, START, camMax, width });
  useEffect(() => {
    geo.current = { busW, track, START, camMax, width };
  }, [busW, track, camMax, width]);

  const setPhase = (p: Phase) => {
    setPhaseState(p);
    onPhase?.(p);
  };

  /**
   * Where a bus is, as a share of the run, at race time `t`. A leg's time is
   * the caller's; within the leg the pace has a shape — standing to board,
   * stop-start in traffic, a pull-in and pull-out at the pump and the
   * mechanic — so a reader sees why a bus is losing time, not only that it is.
   */
  const locate = (i: number, t: number): { x: number; leg: number; fill: number } => {
    const tt = warp(t);
    const enters = timing.enters[i];
    const boarding = spec.hold?.[i]?.[0] ?? 0;
    const fill = !spec.loaded ? 0 : boarding > 0 ? Math.min(1, tt / (spec.durations[i][0] * boarding)) : 1;
    if (tt >= timing.totals[i]) return { x: 1, leg: spec.legs.length - 1, fill };
    let k = enters.length - 1;
    while (k > 0 && tt < enters[k]) k--;
    const q = Math.min(1, (tt - enters[k]) / spec.durations[i][k]);
    const leg = spec.legs[k];
    const hold = spec.hold?.[i]?.[k] ?? 0;
    const struggling = spec.struggle?.[i]?.[k] ?? false;
    let u = q;
    if (hold > 0) {
      const s = q <= hold ? 0 : (q - hold) / (1 - hold);
      u = s * s * (3 - 2 * s);
    } else if (TRAFFIC.includes(leg.kind)) {
      const a = struggling ? 0.88 : 0.22;
      const n = leg.kind === "goslow" ? 4 : 3;
      u = q - (a * Math.sin(TAU * n * q)) / (TAU * n);
    } else if (leg.kind === "pump" || leg.kind === "mechanic") {
      u = q + (0.82 * Math.sin(TAU * q)) / TAU;
    }
    return { x: timing.starts[k] + leg.len * u, leg: k, fill };
  };

  /** Draws every bus at `xs` (shares of the run), fills its seats, and points the camera. */
  const paint = (xs: number[], seated: number[], camera: number, extra?: (i: number, px: number) => void) => {
    const g = geo.current;
    const left = (x: number) => g.START + x * (g.track - g.busW - g.START);
    if (world.current) world.current.style.transform = `translate3d(${-camera}px,0,0)`;
    if (skyline.current) skyline.current.style.transform = `translate3d(${-((camera * 0.3) % SKYLINE_TILE)}px,0,0)`;
    xs.forEach((x, i) => {
      const px = left(x);
      dots.current[i]?.style.setProperty("left", `${x * 100}%`);
      fills.current[i]?.setAttribute("width", String(passengerClip(racers[i].shape, seated[i])));
      const el = buses.current[i];
      if (!el) return;
      el.style.left = `${px}px`;
      const turn = (px / (g.busW * WHEEL_SHARE)) * (180 / Math.PI);
      wheels.current[i].forEach((w) => w?.style.setProperty("transform", `rotate(${turn}deg)`));
      extra?.(i, px);
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
    const boards = (spec.hold?.[0]?.[0] ?? 0) > 0;
    cam.current = done ? Math.max(0, camMax) : 0;
    paint(
      racers.map(() => (done ? 1 : 0)),
      racers.map(() => (spec.loaded && (done || !boards) ? 1 : 0)),
      cam.current,
    );
    brakes.current.forEach((b) => b?.setAttribute("opacity", "0.15"));
    buses.current.forEach((b) => b?.style.setProperty("transform", "none"));
    counters.current.forEach((c) => c?.style.setProperty("opacity", "0"));
    // paint is rebuilt each render but reads its geometry from a ref; these are what change the picture.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, width, spec, racers, camMax]);

  const reset = () => {
    clear();
    setPhase("ready");
    setLights(0);
    setLegOf(racers.map(() => -1));
    setLive([]);
    setOrder([]);
  };

  const finish = (finalOrder: string[]) => {
    setOrder(finalOrder);
    setLive(finalOrder);
    setPhase("done");
    haptic([12, 50, 12, 50, 24]);
    onFinish?.(finalOrder);
  };

  const start = () => {
    reset();
    const byTime = racers.map((r, i) => ({ id: r.id, t: timing.totals[i] })).sort((a, b) => a.t - b.t);
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
        const begun = performance.now();
        let last = begun;
        let lastLegs = racers.map(() => -1).join();
        let lastOrder = "";
        let finished = 0;
        const prev = racers.map(() => 0);
        const speeds = racers.map(() => 0);
        const boarded = racers.map(() => -1);
        const tick = (now: number) => {
          const t = now - begun;
          const dt = Math.max(1, now - last);
          last = now;
          const at = racers.map((_, i) => locate(i, t));
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

          paint(
            xs,
            at.map((p) => p.fill),
            cam.current,
            (i, px) => {
              // Brake lights when a bus is crawling; a nod of the nose as it brakes.
              const v = (xs[i] - prev[i]) / dt;
              const avg = 1 / timing.totals[i];
              const slowing = speeds[i] - v;
              speeds[i] += (v - speeds[i]) * 0.3;
              prev[i] = xs[i];
              const moving = xs[i] < 1 && at[i].fill >= 1;
              brakes.current[i]?.setAttribute("opacity", xs[i] < 1 && v < avg * 0.45 ? "1" : "0.15");
              const k = at[i].leg;
              const kind = spec.legs[k].kind;
              const struggling = spec.struggle?.[i]?.[k] ?? false;
              const sputter = kind === "pump" && struggling && xs[i] < 1 ? Math.sin(t / 24 + i) * 1.4 : 0;
              const bump = kind === "potholes" && moving ? Math.abs(Math.sin(px / 9 + i)) * -(struggling ? 3 : 1.4) : 0;
              const nod = Math.max(-1.6, Math.min(1.6, (slowing / avg) * 2.2));
              const idle = Math.sin(t / 95 + i * 1.7) * 0.5;
              buses.current[i]?.style.setProperty("transform", `translateY(${idle + sputter + bump}px) rotate(${moving ? nod : 0}deg)`);
              // The seat count, while passengers board.
              const seats = racers[i].seats ?? 0;
              const counter = counters.current[i];
              const boardMs = (spec.hold?.[i]?.[0] ?? 0) * (spec.durations[i][0] ?? 0);
              if (counter && seats && boardMs > 0) {
                const n = Math.round(at[i].fill * seats);
                counter.style.opacity = warp(t) < boardMs + 700 ? "1" : "0";
                if (n !== boarded[i]) {
                  counter.textContent = `${n}/${seats}`;
                  if (n > 0 && n % 3 === 0) haptic(2);
                  boarded[i] = n;
                }
              }
            },
          );

          const legs = at.map((p, i) => (xs[i] >= 1 ? spec.legs.length : p.leg)).join();
          if (legs !== lastLegs) {
            lastLegs = legs;
            setLegOf(legs.split(",").map(Number));
          }
          const nowDone = byTime.filter((b) => warp(t) >= b.t).length;
          const running = racers
            .map((r, i) => ({ id: r.id, x: xs[i], t: timing.totals[i] }))
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
          if (finished < racers.length) frame.current = requestAnimationFrame(tick);
          else finish(byTime.map((b) => b.id));
        };
        frame.current = requestAnimationFrame(tick);
      }, 4 * 420),
    );
  };

  useImperativeHandle(handle, () => ({ start, reset }));

  const racing = phase === "racing";
  const lead = racers.findIndex((r) => r.id === live[0]);
  const leadLeg = lead >= 0 ? legOf[lead] : -1;
  const pickIndex = racers.findIndex((r) => r.id === pick);

  return (
    <>
      <div
        ref={view}
        className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-[#1c1b19] select-none"
        style={{ height: sky + laneH * racers.length }}
        aria-hidden
      >
        <BusDefs />
        {/* Sky and skyline, scrolled slower than the road */}
        <div className="absolute inset-x-0 top-0 bg-[linear-gradient(180deg,#0f1522,#221d28_62%,#3b2a1d)]" style={{ height: sky }}>
          <div ref={skyline} className="absolute inset-0 will-change-transform">
            <Skyline height={sky} />
          </div>
        </div>

        {/* The world: everything that scrolls with the road */}
        <div ref={world} className="absolute top-0 left-0 h-full will-change-transform" style={{ width: track + 160 }}>
          {spec.legs.map((l, k) => {
            const x = timing.starts[k] * track;
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
                          {spec.from}
                        </span>
                      )}
                      <span
                        className="flex items-center gap-1 rounded-[4px] px-1.5 py-0.5 text-[0.62rem] font-extrabold tracking-wide whitespace-nowrap uppercase shadow-[0_2px_6px_rgb(0_0_0/0.4)]"
                        style={{ background: tint.sign, color: tint.ink }}
                      >
                        <Icon size={11} strokeWidth={2.6} />
                        {l.label ?? (l.kind === "expressway" ? `${spec.to} →` : LEG_LABEL[l.kind])}
                      </span>
                    </span>
                    <span className="ml-2 h-6 w-0.5 bg-white/30" />
                  </div>
                </div>
                <div className="absolute inset-x-0 bottom-0" style={{ top: sky, background: tint.road }} />
                {l.kind === "potholes" && (
                  <div
                    className="absolute inset-x-0 bottom-0 bg-[radial-gradient(ellipse_at_center,rgb(0_0_0/0.55)_0_45%,transparent_48%)] bg-[length:58px_18px] opacity-80"
                    style={{ top: sky + 10, backgroundPosition: "12px 30px" }}
                  />
                )}
                <div className="absolute bottom-0 left-0 w-px bg-white/[0.08]" style={{ top: sky }} />
              </div>
            );
          })}
          {/* Lanes */}
          <div className="absolute inset-x-0 h-0.5 bg-white/25" style={{ top: sky }} />
          {racers.slice(1).map((_, i) => (
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
          {/* The destination stands at the roadside by the line, clear of the leg signs above */}
          <div className="absolute flex -translate-x-full flex-col items-end" style={{ left: track + 10, top: sky - 30 }}>
            <span className="rounded-[4px] bg-[linear-gradient(180deg,var(--gold-200),var(--gold-500))] px-2 py-0.5 text-[0.62rem] font-extrabold tracking-wide whitespace-nowrap text-[#0A0908] uppercase shadow-[0_2px_8px_rgb(0_0_0/0.5)]">
              {spec.to}
            </span>
            <span className="mr-1 h-2.5 w-0.5 bg-white/40" />
          </div>

          {/* The buses */}
          {racers.map((r, i) => {
            const k = legOf[i];
            const inLeg = k >= 0 && k < spec.legs.length ? spec.legs[k] : null;
            const moving = racing && k < spec.legs.length;
            const struggling = inLeg ? (spec.struggle?.[i]?.[k] ?? false) : false;
            const flying = inLeg ? (spec.cruise?.[i]?.[k] ?? false) : false;
            const note = inLeg ? (spec.notes?.[i]?.[k] ?? null) : null;
            const rear = busRear(r.shape) * 100;
            return (
              <div
                key={r.id}
                ref={(el) => {
                  buses.current[i] = el;
                }}
                className="absolute origin-bottom"
                style={{ left: START, top: sky + laneH * (i + 1) - busH - 5, width: busW, height: busH }}
              >
                {/* Speed on the open road; smoke at a bad pump; a spanner at the mechanic */}
                {moving && flying && (
                  <span className="absolute top-[30%] flex flex-col gap-1.5" style={{ left: `${rear - 6}%` }}>
                    {[0, 1, 2].map((n) => (
                      <span
                        key={n}
                        className="speed-line block h-0.5 w-5 rounded-full bg-white/50"
                        style={{ animationDelay: `${n * 110}ms` }}
                      />
                    ))}
                  </span>
                )}
                {moving && inLeg?.kind === "pump" && struggling && (
                  <span className="absolute bottom-[8%]" style={{ left: `${rear - 2}%` }}>
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
                  <span className="absolute top-[18%] left-[55%] grid size-5 place-items-center rounded-full bg-[#f2d23c] text-[#0A0908] shadow-[0_2px_6px_rgb(0_0_0/0.5)]">
                    <Wrench size={11} strokeWidth={2.8} className={struggling ? "animate-spin" : ""} />
                  </span>
                )}
                <Bus
                  shape={r.shape}
                  color={r.color}
                  passengers={spec.loaded}
                  wheels={(el, w) => {
                    wheels.current[i][w] = el;
                  }}
                  brake={(el) => {
                    brakes.current[i] = el;
                  }}
                  fill={(el) => {
                    fills.current[i] = el;
                  }}
                />
                {/* Passengers boarding: the seat count */}
                {spec.loaded && r.seats ? (
                  <span
                    ref={(el) => {
                      counters.current[i] = el;
                    }}
                    className="figures absolute bottom-[30%] left-full ml-1.5 rounded-full bg-white/90 px-1.5 py-px text-[0.6rem] font-bold whitespace-nowrap text-[#0A0908] opacity-0 transition-opacity"
                  >
                    0/{r.seats}
                  </span>
                ) : null}
                {/* What the bus is going through, as it enters each leg */}
                {moving && note && (
                  <span
                    key={`${spec.key}-${k}`}
                    className={`bus-bubble absolute right-0 bottom-full mb-1 rounded-full px-2 py-0.5 text-[0.62rem] font-bold whitespace-nowrap shadow-[0_2px_8px_rgb(0_0_0/0.5)] ${note.tone === "good" ? "bg-[#1f6b3a] text-white" : note.tone === "bad" ? "bg-[#9e2a22] text-white" : "bg-white/85 text-[#0A0908]"}`}
                  >
                    {note.tone === "good" ? "▲ " : note.tone === "bad" ? "▼ " : ""}
                    {note.text}
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
        {racers.map((r, i) => {
          const place = live.indexOf(r.id);
          const done = order.includes(r.id);
          return (
            <span
              key={r.id}
              className={`pointer-events-none absolute left-2 flex items-center gap-1.5 rounded-full bg-black/50 py-0.5 pr-1.5 pl-1 font-semibold text-white/85 ${compact ? "text-[0.58rem]" : "text-[0.62rem]"}`}
              style={{ top: sky + laneH * i + 4 }}
            >
              <span className="size-2 rounded-full border border-white/40" style={{ background: r.color }} />
              {r.label}
              {r.sub && !compact && <span className="font-normal text-white/55">{r.sub}</span>}
              {(racing || phase === "done") && place >= 0 && (
                <span
                  key={`${place}-${done}`}
                  className={`pop-in rounded-full px-1.5 py-px text-[0.6rem] font-bold ${place === 0 ? "bg-[linear-gradient(180deg,var(--gold-200),var(--gold-500))] text-[#0A0908]" : "bg-white/15 text-text-primary"}`}
                >
                  {PLACES[place]}
                </span>
              )}
              {r.id === pick && <span className="text-gold-300">· yours</span>}
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
          {spec.legs.map((l, k) => {
            const Icon = LEG_ICON[l.kind];
            const now = racing && k === leadLeg;
            return (
              <span
                key={k}
                className={`flex items-center justify-center gap-1 text-[0.62rem] whitespace-nowrap transition-colors ${now ? "font-semibold text-gold-200" : "text-text-muted"}`}
                style={{ width: `${l.len * 100}%` }}
              >
                <Icon size={11} className={now ? "text-gold-300" : ""} />
                {(!(narrow || compact) || now) && (l.label ?? LEG_LABEL[l.kind])}
              </span>
            );
          })}
        </div>
        <div className="relative mt-1.5 flex h-2 overflow-visible rounded-full">
          {spec.legs.map((l, k) => (
            <span
              key={k}
              className="h-full first:rounded-l-full last:rounded-r-full"
              style={{ width: `${l.len * 100}%`, background: LEG_TINT[l.kind].sign, opacity: 0.55 }}
            />
          ))}
          {racers.map((r, i) => (
            <span
              key={r.id}
              ref={(el) => {
                dots.current[i] = el;
              }}
              className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[#0A0908] shadow-[0_0_0_1px_rgb(255_255_255/0.4)]"
              style={{ left: "0%", background: r.color, zIndex: r.id === pick ? 2 : 1 }}
            />
          ))}
        </div>
      </div>
    </>
  );
}
