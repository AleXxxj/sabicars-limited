"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, Flag, RotateCcw, Trophy } from "lucide-react";
import { formatNaira } from "@/lib/money";
import { useReducedMotion, useSpring } from "./motion";
import { Burst, haptic } from "./rewards";
import { SuvShape } from "./SuvShape";
import { ROADS, SUVS, scoreOn, strengths, type RoadScene, type SuvStock } from "./suvs";

const COLORS: Record<string, string> = {
  highlander: "#9b2f2a",
  gx: "#d8d1c2",
  prado: "#f1efe9",
  gle: "#8fa3b8",
  rrs: "#2a2b2e",
};

type Phase = "ready" | "countdown" | "racing" | "done";

/** Deterministic pothole positions per lane, so every race is run on the same road. */
const HOLES = [0, 1, 2, 3, 4].map((lane) => [18, 36, 55, 71, 84].map((x, i) => x + ((lane * 7 + i * 3) % 9) - 4));

function Scene({ scene, racing }: { scene: RoadScene; racing: boolean }) {
  if (scene === "flood")
    return (
      <div aria-hidden className="absolute inset-y-0 left-[30%] w-[38%] overflow-hidden rounded-lg">
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgb(74_125_160/0.55),rgb(37_76_104/0.7))]" />
        <div className="water-ripples absolute inset-0 opacity-60" />
      </div>
    );
  if (scene === "carpet")
    return (
      <div aria-hidden className="absolute inset-0">
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgb(128_20_28/0.55),rgb(96_14_22/0.65))]" />
        {[20, 40, 60, 80].map((x) => (
          <span key={x} className="absolute top-0 h-full w-px bg-gold-500/30" style={{ left: `${x}%` }} />
        ))}
      </div>
    );
  if (scene === "highway")
    return (
      <div aria-hidden className="absolute inset-0">
        <div className={`highway-dashes absolute inset-0 ${racing ? "is-racing" : ""}`} />
        <span className="absolute top-1 right-[8%] rounded bg-[#1f6b3a] px-1.5 py-0.5 text-[0.6rem] font-bold text-white">ABUJA</span>
      </div>
    );
  if (scene === "city")
    return (
      <div aria-hidden className="absolute inset-0">
        <div className="absolute inset-y-0 left-[48%] w-[7%] bg-[repeating-linear-gradient(0deg,rgb(255_255_255/0.5)_0_6px,transparent_6px_14px)] opacity-60" />
        <span className="absolute top-1 left-[40%] rounded bg-[#c9a84c] px-1.5 py-0.5 text-[0.6rem] font-bold text-[#0A0908]">SCHOOL</span>
      </div>
    );
  return null;
}

/**
 * Pick your road; five SUVs race it. Each one's pace is its rating for that
 * kind of road — a race of judgements, not a road test, and it says so. The
 * start lights, the finish and the podium are there because it is fun, and
 * a reader who is enjoying themselves reads on.
 */
export function SuvRace({ stock }: { stock: SuvStock }) {
  const reduced = useReducedMotion();
  const [roadId, setRoadId] = useState(ROADS[0].id);
  const road = ROADS.find((r) => r.id === roadId)!;
  const [phase, setPhase] = useState<Phase>("ready");
  const [lights, setLights] = useState(0);
  const [pos, setPos] = useState<number[]>(SUVS.map(() => 0));
  const [order, setOrder] = useState<string[]>([]);
  const [fire, setFire] = useState(0);
  const frame = useRef(0);
  const timers = useRef<number[]>([]);

  const scores = SUVS.map((s) => scoreOn(s, road.weights));
  const best = Math.max(...scores);
  const ranking = [...SUVS].map((s, i) => ({ s, score: scores[i] })).sort((a, b) => b.score - a.score);

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

  const reset = (id = roadId) => {
    clear();
    setRoadId(id);
    setPhase("ready");
    setLights(0);
    setPos(SUVS.map(() => 0));
    setOrder([]);
  };

  const finish = (finalOrder: string[]) => {
    setOrder(finalOrder);
    setPhase("done");
    setFire((f) => f + 1);
    haptic([12, 50, 12, 50, 24]);
  };

  const race = () => {
    reset(roadId);
    if (reduced) {
      setPos(SUVS.map(() => 1));
      finish(ranking.map((r) => r.s.id));
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
        const durations = scores.map((sc) => Math.min(6200, 2600 * Math.pow(best / sc, 1.6)));
        // Finishing order is by time, even when two cross the line in the same frame.
        const byTime = SUVS.map((x, i) => ({ id: x.id, d: durations[i] })).sort((a, b) => a.d - b.d);
        let finished = 0;
        const start = performance.now();
        const tick = (now: number) => {
          const elapsed = now - start;
          setPos(
            durations.map((d) => {
              const p = Math.min(1, elapsed / d);
              // A quick getaway, then a steady pace to the line.
              return p < 0.08 ? (p * p) / 0.16 / 0.96 : Math.min(1, (p - 0.04) / 0.96);
            }),
          );
          const nowDone = byTime.filter((x) => x.d <= elapsed).length;
          if (nowDone !== finished) {
            finished = nowDone;
            setOrder(byTime.slice(0, nowDone).map((x) => x.id));
            haptic(5);
          }
          if (finished < SUVS.length) frame.current = requestAnimationFrame(tick);
          else finish(byTime.map((x) => x.id));
        };
        frame.current = requestAnimationFrame(tick);
      }, 4 * 420),
    );
  };

  const winner = SUVS.find((s) => s.id === order[0]);
  const podium = order.slice(0, 3).map((id) => SUVS.find((s) => s.id === id)!);
  const rise = useSpring(phase === "done" ? 1 : 0, { stiffness: 120, damping: 11 });
  const racing = phase === "racing";

  return (
    <div className="surface-card overflow-hidden p-4 sm:p-6 md:p-8">
      <p className="text-sm font-semibold text-text-primary">Pick your road</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {ROADS.map((r) => (
          <button
            key={r.id}
            type="button"
            aria-pressed={r.id === roadId}
            onClick={() => reset(r.id)}
            className={`min-h-11 rounded-full border px-4 text-sm transition-all active:scale-95 ${r.id === roadId ? "border-gold-400 bg-gold-500/15 font-semibold text-gold-100" : "border-white/[0.12] text-text-secondary hover:border-gold-500/40 hover:text-text-primary"}`}
          >
            {r.label}
          </button>
        ))}
      </div>

      {/* The track */}
      <div className="relative mt-5 overflow-hidden rounded-2xl border border-white/[0.08] bg-[#1c1b19]">
        <Scene scene={road.scene} racing={racing} />
        {/* Start and finish */}
        <div aria-hidden className="absolute inset-y-0 left-[3%] w-px bg-white/25" />
        <div
          aria-hidden
          className="absolute inset-y-0 right-[4%] w-2.5 bg-[repeating-conic-gradient(#f5f2ea_0_25%,#0B0A09_0_50%)] bg-[length:10px_10px] opacity-80"
        />
        <ul className="relative">
          {SUVS.map((s, i) => {
            const p = pos[i];
            const inWater = road.scene === "flood" && p > 0.27 && p < 0.66;
            const bob =
              racing && p < 1
                ? road.scene === "potholes"
                  ? Math.sin(p * 90 + i) * (6 - s.ratings.rough) * 0.9
                  : inWater
                    ? Math.sin(p * 60 + i) * (6 - s.ratings.rough) * 0.7
                    : 0
                : 0;
            const place = order.indexOf(s.id);
            return (
              <li key={s.id} className="relative h-14 border-b border-dashed border-white/[0.07] last:border-0 sm:h-16">
                {road.scene === "potholes" &&
                  HOLES[i].map((x) => (
                    <span
                      key={x}
                      aria-hidden
                      className="absolute top-[58%] h-2 w-5 rounded-[50%] bg-black/70 shadow-[0_1px_0_rgb(255_255_255/0.12)]"
                      style={{ left: `${x}%` }}
                    />
                  ))}
                <span className="absolute top-1 left-2 flex items-center gap-1.5 text-[0.65rem] font-semibold tracking-wide text-white/55">
                  {s.short}
                  {place >= 0 && (
                    <span
                      className={`pop-in rounded-full px-1.5 py-px text-[0.62rem] font-bold ${place === 0 ? "bg-[linear-gradient(180deg,var(--gold-200),var(--gold-500))] text-[#0A0908]" : "bg-white/15 text-text-primary"}`}
                    >
                      {["1st", "2nd", "3rd", "4th", "5th"][place]}
                    </span>
                  )}
                </span>
                <div
                  className="absolute bottom-1 w-[16%] max-w-24 min-w-14"
                  style={{ left: `calc(3% + ${p} * (93% - min(max(16%, 3.5rem), 6rem)))`, transform: `translateY(${bob}px)` }}
                >
                  {inWater && racing && <span aria-hidden className="splash absolute -bottom-1 -left-3 h-4 w-8" />}
                  <SuvShape
                    shape={s.shape}
                    color={COLORS[s.id]}
                    turn={p * 1440}
                    className="block w-full drop-shadow-[0_3px_4px_rgb(0_0_0/0.6)]"
                  />
                </div>
              </li>
            );
          })}
        </ul>

        {/* Start lights */}
        {phase === "countdown" || (racing && lights === 4 && pos.every((p) => p < 0.2)) ? (
          <div aria-hidden className="absolute top-3 left-1/2 flex -translate-x-1/2 gap-2 rounded-full bg-black/70 px-3 py-2">
            {[1, 2, 3].map((n) => (
              <span
                key={n}
                className={`size-4 rounded-full transition-colors duration-150 ${lights === 4 ? "bg-[#3ddc84] shadow-[0_0_14px_#3ddc84]" : lights >= n ? "bg-[#ff4b3e] shadow-[0_0_14px_#ff4b3e]" : "bg-white/15"}`}
              />
            ))}
          </div>
        ) : null}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={race}
          disabled={phase === "countdown" || racing}
          className="inline-flex min-h-12 items-center gap-2 rounded-full bg-[linear-gradient(180deg,var(--gold-300),var(--gold-500))] px-6 font-semibold text-[#0A0908] transition-transform active:scale-95 disabled:opacity-50"
        >
          {phase === "done" ? <RotateCcw aria-hidden size={17} /> : <Flag aria-hidden size={17} />}
          {phase === "done" ? "Race again" : phase === "ready" ? "Race them" : "Racing…"}
        </button>
        <p className="text-xs text-text-muted">A race of our ratings for this road, not a road test.</p>
      </div>

      {/* The podium */}
      {phase === "done" && winner && (
        <div className="mt-6 grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:items-end" aria-live="polite">
          <div className="relative flex h-44 items-end justify-center gap-2">
            {[podium[1], podium[0], podium[2]].map((s, i) => {
              const h = [0.62, 1, 0.45][i];
              const first = i === 1;
              return (
                <div key={s.id} className="relative flex w-1/3 max-w-32 flex-col items-center">
                  <SuvShape shape={s.shape} color={COLORS[s.id]} className="mb-1 w-[85%]" />
                  <div
                    className={`flex w-full origin-bottom flex-col items-center justify-start rounded-t-xl pt-2 ${first ? "bg-[linear-gradient(180deg,var(--gold-300),var(--gold-600))] text-[#0A0908]" : "bg-white/10 text-text-primary"}`}
                    style={{ height: `${h * 96 * rise}px` }}
                  >
                    <span className="text-lg font-bold">{["2", "1", "3"][i]}</span>
                  </div>
                  <p className="mt-1.5 text-center text-xs font-semibold text-text-secondary">{s.short}</p>
                  {first && (
                    <span className="absolute top-2 left-1/2">
                      <Burst fire={fire} />
                    </span>
                  )}
                </div>
              );
            })}
          </div>
          <div>
            <p className="flex items-center gap-2 text-xs font-semibold tracking-[0.16em] text-gold-300 uppercase">
              <Trophy aria-hidden size={15} /> {road.label}
            </p>
            <p className="mt-1 font-display text-[1.9rem] leading-tight text-text-primary">{winner.name}</p>
            <p className="mt-2 text-sm text-text-secondary">Won on {strengths(winner, road.weights).join(" and ")}.</p>
            {stock[winner.id]?.count ? (
              <Link
                href={winner.term ? `/buy/${winner.term}` : "/vehicles"}
                className="group mt-4 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-gold-300 hover:text-gold-200"
              >
                {stock[winner.id].count} in the showroom now
                {stock[winner.id].fromMinor ? `, from ${formatNaira(stock[winner.id].fromMinor!)}` : ""}
                <ArrowRight aria-hidden size={16} className="transition-transform group-hover:translate-x-1" />
              </Link>
            ) : (
              <Link
                href={`/find?want=${encodeURIComponent(winner.name)}`}
                className="group mt-4 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-gold-300 hover:text-gold-200"
              >
                Not in the showroom today — ask the Sourcing Desk
                <ArrowRight aria-hidden size={16} className="transition-transform group-hover:translate-x-1" />
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
