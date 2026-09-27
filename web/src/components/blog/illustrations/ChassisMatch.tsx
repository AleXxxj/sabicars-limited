"use client";

import { useState } from "react";
import { Check, RotateCcw } from "lucide-react";
import { Burst, haptic, usePulse } from "./rewards";

/**
 * Three chassis numbers, each stamped on a truck and typed on its papers.
 * Plausible 17-character numbers (Volvo, MAN, Mercedes-Benz prefixes) that
 * belong to no real vehicle.
 */
const ROUNDS: { plate: string; papers: string; lesson: string }[] = [
  {
    plate: "YV2AS02A8JA812345",
    papers: "YV2AS02A8JA812845",
    lesson:
      "A 3 turned into an 8. Read the chassis and the papers one character at a time — out loud if it helps. One changed character is all a forger needs.",
  },
  {
    plate: "WMA06XZZ4HP093671",
    papers: "WMA06XZZ4HPO93671",
    lesson:
      "The papers say the letter O where the chassis says zero. A real 17-character chassis number never uses the letters O, I or Q — so an O proves the papers are wrong.",
  },
  {
    plate: "WDB9340321L284196",
    papers: "WDB9340321L284196",
    lesson:
      "They match, character for character. Now check the engine number the same way — and that the name on the papers is the seller’s.",
  },
];

function Strip({
  label,
  text,
  metal,
  state,
  onPick,
}: {
  label: string;
  text: string;
  metal: boolean;
  state: (i: number) => "found" | "missed" | null;
  onPick: (i: number) => void;
}) {
  return (
    <div>
      <p className="text-xs font-semibold tracking-[0.14em] text-text-muted uppercase">{label}</p>
      <div
        className={`mt-2 grid grid-cols-[repeat(17,minmax(0,1fr))] gap-[2px] rounded-xl p-2 ${metal ? "bg-[linear-gradient(180deg,#9a968f,#5f5b55)] shadow-[inset_0_1px_0_rgb(255_255_255/0.35),0_6px_16px_-8px_rgb(0_0_0/0.8)]" : "bg-[#eee8da] shadow-[0_6px_16px_-8px_rgb(0_0_0/0.8)]"}`}
      >
        {[...text].map((ch, i) => {
          const s = state(i);
          return (
            <button
              key={i}
              type="button"
              onClick={() => onPick(i)}
              aria-label={`Character ${i + 1}: ${ch}`}
              className={`relative flex aspect-[3/5] items-center justify-center rounded-[4px] font-mono text-[clamp(0.78rem,3.3vw,1.3rem)] font-bold transition-colors ${
                metal
                  ? "text-[#26241f] [text-shadow:0_1px_0_rgb(255_255_255/0.4)] hover:bg-white/15"
                  : "text-[#2b2b2b] hover:bg-black/[0.06]"
              } ${s === "found" ? "!bg-gold-400/80 !text-[#0A0908]" : s === "missed" ? "shake !bg-danger/40" : ""}`}
            >
              {ch}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * The check that stops most fraud: the chassis number on the truck must match
 * the papers exactly. Three rounds — one easy, one that teaches a rule, and one
 * where the right answer is that nothing is wrong.
 */
export function ChassisMatch() {
  const [round, setRound] = useState(0);
  const [found, setFound] = useState(false);
  const [missed, setMissed] = useState<number | null>(null);
  const [misses, setMisses] = useState(0);
  const [shake, setShake] = useState(0);
  const [fire, setFire] = useState(0);
  const shaking = usePulse(shake);
  const finished = round >= ROUNDS.length;
  const r = ROUNDS[Math.min(round, ROUNDS.length - 1)];
  const diff = [...r.plate].findIndex((c, i) => c !== r.papers[i]);

  const win = () => {
    setFound(true);
    setMissed(null);
    setFire((f) => f + 1);
    haptic([12, 40, 20]);
  };
  const miss = (i: number | null) => {
    setMissed(i);
    setMisses((m) => m + 1);
    setShake((s) => s + 1);
    haptic([30, 50, 30]);
  };
  const pick = (i: number) => {
    if (found) return;
    if (i === diff) win();
    else miss(i);
  };
  const theyMatch = () => {
    if (found) return;
    if (diff === -1) win();
    else miss(null);
  };
  const next = () => {
    setRound((n) => n + 1);
    setFound(false);
    setMissed(null);
  };
  const restart = () => {
    setRound(0);
    setFound(false);
    setMissed(null);
    setMisses(0);
  };

  const state = (i: number) => (found && i === diff ? "found" : missed === i && shaking ? "missed" : null);

  return (
    <div className="surface-card p-4 sm:p-6 md:p-8">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-text-primary">
          {finished ? "All three checked" : `Check ${round + 1} of ${ROUNDS.length}`}
        </p>
        <div className="flex gap-1.5" aria-hidden>
          {ROUNDS.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 w-8 rounded-full ${i < round ? "bg-gold-400" : i === round && !finished ? "bg-gold-400/40" : "bg-white/10"}`}
            />
          ))}
        </div>
      </div>

      {!finished ? (
        <>
          <p className="mt-3 text-sm text-text-secondary">Tap the character that does not match — or, if nothing is wrong, say so.</p>
          <div className="relative mt-5 grid gap-5">
            <Strip label="Stamped on the chassis" text={r.plate} metal state={state} onPick={pick} />
            <Strip label="On the customs papers" text={r.papers} metal={false} state={state} onPick={pick} />
            {found && diff >= 0 && (
              <span className="pointer-events-none absolute top-1/2" style={{ left: `${((diff + 0.5) / 17) * 100}%` }}>
                <Burst fire={fire} />
              </span>
            )}
          </div>

          {!found ? (
            <div className="mt-5 flex flex-wrap items-center gap-4">
              <button
                type="button"
                onClick={theyMatch}
                className={`inline-flex min-h-11 items-center gap-2 rounded-full border border-white/[0.15] px-5 text-sm font-semibold text-text-primary hover:border-gold-500/50 ${missed === null && shaking ? "shake" : ""}`}
              >
                They match
              </button>
              {shake > 0 && <p className="text-sm text-text-muted">Not that one — compare them one character at a time.</p>}
            </div>
          ) : (
            <div className="pop-in relative mt-5 rounded-2xl border border-gold-500/30 bg-gold-500/[0.06] p-4" aria-live="polite">
              <p className="flex items-center gap-2 font-semibold text-text-primary">
                <Check aria-hidden size={17} className="text-gold-300" /> {diff === -1 ? "Right — nothing to find." : "Found it."}
              </p>
              <p className="mt-1 text-sm text-text-secondary">{r.lesson}</p>
              {diff === -1 && (
                <span className="absolute top-4 left-6">
                  <Burst fire={fire} />
                </span>
              )}
              <button
                type="button"
                onClick={next}
                className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-full bg-[linear-gradient(180deg,var(--gold-300),var(--gold-500))] px-5 text-sm font-semibold text-[#0A0908] active:scale-95"
              >
                {round + 1 < ROUNDS.length ? "Next truck" : "Finish"}
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="pop-in mt-6 rounded-2xl border border-gold-500/35 bg-gold-500/[0.06] p-6 text-center">
          <p className="font-display text-[3rem] leading-none text-gold-200">3/3</p>
          <p className="mt-2 text-text-primary">
            {misses === 0
              ? "Not one wrong tap. You would catch doctored papers."
              : `Done, with ${misses} wrong ${misses === 1 ? "tap" : "taps"} on the way — that is why you check twice.`}
          </p>
          <button
            type="button"
            onClick={restart}
            className="mt-4 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-gold-300 hover:text-gold-200"
          >
            <RotateCcw aria-hidden size={15} /> Try again
          </button>
        </div>
      )}
    </div>
  );
}
