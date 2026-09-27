"use client";

import { useEffect, useRef, useState } from "react";
import { Check, KeyRound, RotateCcw, X } from "lucide-react";
import { useReducedMotion } from "./motion";
import { Burst, haptic, usePulse } from "./rewards";

type Answer = "normal" | "oil" | "fuel" | "coolant";

const OPTIONS: { id: Answer; label: string }[] = [
  { id: "normal", label: "Normal — it will clear as it warms" },
  { id: "oil", label: "Burning oil" },
  { id: "fuel", label: "Too much fuel, not enough air" },
  { id: "coolant", label: "Coolant getting in" },
];

const ROUNDS: { id: string; smoke: string; puff: number; opacity: number; fades: boolean; answer: Answer; name: string; why: string }[] = [
  {
    id: "black",
    smoke: "rgb(24 24 24)",
    puff: 1,
    opacity: 0.85,
    fades: false,
    answer: "fuel",
    name: "Black smoke",
    why: "Fuel is not burning completely: a blocked air filter, worn injectors, or a turbo not delivering air. A puff under hard acceleration is common in older diesels — black smoke at idle is not.",
  },
  {
    id: "blue",
    smoke: "rgb(150 168 210)",
    puff: 0.9,
    opacity: 0.8,
    fades: false,
    answer: "oil",
    name: "Blue-grey smoke",
    why: "Oil is burning: worn piston rings, tired valve seals, or a turbo leaking oil. It only gets more expensive — price the repair before you price the truck.",
  },
  {
    id: "thin",
    smoke: "rgb(244 244 244)",
    puff: 0.7,
    opacity: 0.45,
    fades: true,
    answer: "normal",
    name: "Thin white vapour that clears",
    why: "On a cold morning this is usually condensation burning off — normal. The test is that it stops as the engine warms, within a minute or so.",
  },
  {
    id: "thick",
    smoke: "rgb(250 250 250)",
    puff: 1.25,
    opacity: 0.95,
    fades: false,
    answer: "coolant",
    name: "Thick white smoke that keeps coming",
    why: "Often with a sweet smell, it can mean coolant is getting into the cylinders — a head gasket, or worse. Unless a mechanic says otherwise, walk away.",
  },
];

const PUFFS = Array.from({ length: 16 }, (_, i) => ({ delay: i * 170, drift: 30 + ((i * 37) % 60), size: 16 + ((i * 13) % 14) }));

/**
 * The cold-start test, as a game. Hold the key to crank a truck, watch what
 * comes out of the stack, and say what it means. Four trucks, four smokes —
 * the four a buyer must be able to read before paying for a diesel.
 */
export function SmokeDoctor() {
  const reduced = useReducedMotion();
  const [round, setRound] = useState(0);
  const [phase, setPhase] = useState<"off" | "cranking" | "running" | "answered">("off");
  const [crank, setCrank] = useState(0);
  const [picked, setPicked] = useState<Answer | null>(null);
  const [score, setScore] = useState(0);
  const [fire, setFire] = useState(0);
  const [wrong, setWrong] = useState(0);
  const [hint, setHint] = useState(false);
  const shaking = usePulse(wrong);
  const frame = useRef(0);
  const finished = round >= ROUNDS.length;
  const r = ROUNDS[Math.min(round, ROUNDS.length - 1)];

  useEffect(() => {
    const f = frame;
    return () => cancelAnimationFrame(f.current);
  }, []);

  const startCrank = () => {
    if (phase !== "off") return;
    setHint(false);
    if (reduced) {
      setPhase("running");
      return;
    }
    setPhase("cranking");
    haptic(8);
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / 1200);
      setCrank(p);
      if (p < 1) frame.current = requestAnimationFrame(tick);
      else {
        setPhase("running");
        haptic([20, 40, 30]);
      }
    };
    frame.current = requestAnimationFrame(tick);
  };
  const stopCrank = () => {
    if (phase !== "cranking") return;
    cancelAnimationFrame(frame.current);
    setPhase("off");
    setCrank(0);
    setHint(true);
  };

  const answer = (a: Answer) => {
    if (phase !== "running") return;
    setPicked(a);
    setPhase("answered");
    if (a === r.answer) {
      setScore((s) => s + 1);
      setFire((f) => f + 1);
      haptic([12, 40, 20]);
    } else {
      setWrong((w) => w + 1);
      haptic([30, 60, 30]);
    }
  };

  const next = () => {
    setRound((n) => n + 1);
    setPhase("off");
    setCrank(0);
    setPicked(null);
  };
  const restart = () => {
    setRound(0);
    setScore(0);
    setPhase("off");
    setCrank(0);
    setPicked(null);
  };

  const running = phase === "running" || phase === "answered";
  return (
    <div className="surface-card overflow-hidden p-4 sm:p-6 md:p-8">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-text-primary">
          {finished ? "All four trucks read" : `Truck ${round + 1} of ${ROUNDS.length}`}
        </p>
        <div className="flex gap-1.5" aria-hidden>
          {ROUNDS.map((x, i) => (
            <span
              key={x.id}
              className={`h-1.5 w-7 rounded-full ${i < round ? "bg-gold-400" : i === round && !finished ? "bg-gold-400/40" : "bg-white/10"}`}
            />
          ))}
        </div>
      </div>

      {!finished ? (
        <>
          <div className="relative mt-5 overflow-hidden rounded-2xl">
            <svg
              viewBox="0 0 700 380"
              className="block w-full"
              role="img"
              aria-label={running ? `The truck is running. ${r.name} is coming from the exhaust.` : "A truck, engine off"}
            >
              <defs>
                <filter id="sd-soft" x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur stdDeviation="5" />
                </filter>
                <linearGradient id="sd-sky" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="#56636f" />
                  <stop offset="1" stopColor="#8b8173" />
                </linearGradient>
              </defs>
              <rect width="700" height="380" fill="url(#sd-sky)" />
              <rect y="338" width="700" height="42" fill="#3f3a33" />
              <g transform="translate(0 80)">
                <g className={phase === "cranking" ? "crank" : running ? "idle" : ""}>
                  {/* Exhaust stack behind the cab */}
                  <rect x="392" y="70" width="14" height="140" rx="4" fill="#b9b4aa" />
                  <rect x="388" y="64" width="22" height="12" rx="3" fill="#8e887c" />
                  {/* Chassis, cab, wheels */}
                  <rect x="140" y="222" width="420" height="14" rx="3" fill="#2b2926" />
                  <path
                    d="M410 238 L410 120 C410 110 417 104 428 104 L512 104 C525 104 533 111 537 121 L548 172 L550 226 C550 234 546 238 538 238 Z"
                    fill="#e8e4da"
                  />
                  <path d="M470 115 L520 115 C525 115 528 117 529 121 L539 168 L470 168 Z" fill="#1b2630" />
                  <rect x="408" y="232" width="150" height="12" rx="3" fill="#3a3632" />
                  <rect x="160" y="150" width="236" height="72" rx="4" fill="#c9a84c" opacity="0.85" />
                  {[210, 300, 500].map((x) => (
                    <g key={x}>
                      <circle cx={x} cy="246" r="22" fill="#0B0A09" />
                      <circle cx={x} cy="246" r="12" fill="#2b2926" stroke="#6b645a" strokeWidth="2" />
                    </g>
                  ))}
                </g>
              </g>
              {/* Smoke from the stack */}
              {running && (
                <g key={`${r.id}-${round}`} className={r.fades ? "smoke-fades" : ""} style={{ opacity: r.opacity }} filter="url(#sd-soft)">
                  {PUFFS.map((p, i) => (
                    <circle
                      key={i}
                      className="smoke-puff"
                      cx="399"
                      cy="140"
                      r={p.size * r.puff}
                      fill={r.smoke}
                      style={{ animationDelay: `${p.delay}ms`, "--drift": `${p.drift}px` } as React.CSSProperties}
                    />
                  ))}
                </g>
              )}
            </svg>
          </div>

          {phase === "off" || phase === "cranking" ? (
            <div className="mt-5 flex flex-col items-center gap-3">
              <button
                type="button"
                onPointerDown={startCrank}
                onPointerUp={stopCrank}
                onPointerLeave={stopCrank}
                onPointerCancel={stopCrank}
                onKeyDown={(e) => {
                  if ((e.key === " " || e.key === "Enter") && !e.repeat) {
                    e.preventDefault();
                    startCrank();
                  }
                }}
                onKeyUp={(e) => (e.key === " " || e.key === "Enter") && stopCrank()}
                className="relative inline-flex size-24 touch-none items-center justify-center rounded-full border-2 border-gold-400 bg-surface-0 text-gold-200 select-none active:scale-95"
                aria-label="Hold to start the engine"
              >
                <svg viewBox="0 0 100 100" className="absolute inset-0 -rotate-90" aria-hidden>
                  <circle cx="50" cy="50" r="46" fill="none" stroke="rgb(201 168 76 / 0.15)" strokeWidth="6" />
                  <circle
                    cx="50"
                    cy="50"
                    r="46"
                    fill="none"
                    stroke="var(--gold-300)"
                    strokeWidth="6"
                    strokeLinecap="round"
                    strokeDasharray={289}
                    strokeDashoffset={289 * (1 - crank)}
                  />
                </svg>
                <KeyRound aria-hidden size={30} />
              </button>
              <p className="text-sm text-text-secondary">
                {phase === "cranking"
                  ? "Cranking…"
                  : hint
                    ? "Keep holding — a cold diesel takes a moment."
                    : "Press and hold the key to start it cold"}
              </p>
            </div>
          ) : (
            <div className="mt-5">
              <p className="text-sm font-semibold text-text-primary">What is this smoke telling you?</p>
              <div className={`mt-3 grid gap-2 sm:grid-cols-2 ${shaking ? "shake" : ""}`}>
                {OPTIONS.map((o) => {
                  const correct = phase === "answered" && o.id === r.answer;
                  const missed = phase === "answered" && o.id === picked && picked !== r.answer;
                  return (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => answer(o.id)}
                      disabled={phase === "answered"}
                      className={`relative flex min-h-12 items-center justify-between gap-3 rounded-xl border px-4 py-2.5 text-left text-sm transition-colors ${correct ? "border-gold-400 bg-gold-500/15 font-semibold text-gold-100" : missed ? "border-danger/60 bg-danger/10 text-text-primary" : "border-white/[0.12] text-text-secondary hover:border-gold-500/40 hover:text-text-primary"} disabled:cursor-default`}
                    >
                      {o.label}
                      {correct && <Check aria-hidden size={17} />}
                      {missed && <X aria-hidden size={17} className="text-danger" />}
                      {correct && picked === r.answer && <Burst fire={fire} />}
                    </button>
                  );
                })}
              </div>
              {phase === "answered" && (
                <div className="pop-in mt-4 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4" aria-live="polite">
                  <p className="font-semibold text-text-primary">
                    {picked === r.answer ? "Right. " : "Not quite. "}
                    {r.name}.
                  </p>
                  <p className="mt-1 text-sm text-text-secondary">{r.why}</p>
                  <button
                    type="button"
                    onClick={next}
                    className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-full bg-[linear-gradient(180deg,var(--gold-300),var(--gold-500))] px-5 text-sm font-semibold text-[#0A0908] active:scale-95"
                  >
                    {round + 1 < ROUNDS.length ? "Start the next truck" : "See your score"}
                  </button>
                </div>
              )}
            </div>
          )}
        </>
      ) : (
        <div className="pop-in relative mt-6 rounded-2xl border border-gold-500/35 bg-gold-500/[0.06] p-6 text-center">
          <p className="font-display text-[3rem] leading-none text-gold-200">
            {score}/{ROUNDS.length}
          </p>
          <p className="mt-2 text-text-primary">
            {score === ROUNDS.length
              ? "Perfect. You would spot a tired engine before the seller finished talking."
              : score >= 2
                ? "Good. Read the ones you missed once more — then take a truck mechanic anyway."
                : "Worth another go — and worth taking a truck mechanic with you."}
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
