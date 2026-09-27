"use client";

import { useEffect, useState } from "react";

/**
 * The small rewards that make an illustration satisfying to use: a burst of
 * gold when the reader gets something right, digits that roll like a pump
 * counter, and a light tap on the phone. All of them stand down for readers
 * who prefer less motion.
 */

/** A light tap on phones that support it (most Android); silently nothing elsewhere. */
export function haptic(pattern: number | number[] = 12) {
  try {
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) navigator.vibrate?.(pattern);
  } catch {
    /* Not supported: no tap. */
  }
}

const SPARKS = Array.from({ length: 14 }, (_, i) => {
  const angle = (i / 14) * Math.PI * 2 + (i % 2 ? 0.18 : 0);
  const dist = i % 3 === 0 ? 74 : i % 3 === 1 ? 54 : 40;
  return { dx: Math.cos(angle) * dist, dy: Math.sin(angle) * dist, size: i % 3 === 0 ? 7 : 5, delay: (i % 4) * 22 };
});

/**
 * A burst of gold sparks and a ring, centred on its (positioned) parent.
 * Raise `fire` to set it off again; 0 shows nothing.
 */
export function Burst({ fire, className = "" }: { fire: number; className?: string }) {
  if (!fire) return null;
  return (
    <span key={fire} aria-hidden className={`burst pointer-events-none absolute top-1/2 left-1/2 z-10 ${className}`}>
      <span className="burst-ring" />
      {SPARKS.map((s, i) => (
        <span
          key={i}
          className="burst-spark"
          style={
            {
              "--dx": `${s.dx}px`,
              "--dy": `${s.dy}px`,
              width: s.size,
              height: s.size,
              animationDelay: `${s.delay}ms`,
            } as React.CSSProperties
          }
        />
      ))}
    </span>
  );
}

/**
 * A number whose digits roll into place like a fuel-pump counter. The full
 * value is read out once; the rolling strips are decoration.
 */
export function RollingNumber({ value, format, className = "" }: { value: number; format: (n: number) => string; className?: string }) {
  const text = format(value);
  return (
    <span className={`figures relative inline-flex overflow-hidden leading-none ${className}`} aria-label={text}>
      {[...text].map((ch, i) =>
        /\d/.test(ch) ? (
          <span key={`${text.length - i}`} aria-hidden className="roll-col relative inline-block h-[1em] overflow-hidden">
            <span className="roll-strip flex flex-col" style={{ transform: `translateY(-${Number(ch)}em)` }}>
              {"0123456789".split("").map((d) => (
                <span key={d} className="block h-[1em]">
                  {d}
                </span>
              ))}
            </span>
          </span>
        ) : (
          <span key={`${text.length - i}`} aria-hidden className="inline-block">
            {ch}
          </span>
        ),
      )}
    </span>
  );
}

/** True for a moment after `trigger` changes: for a shake on a wrong answer. */
export function usePulse(trigger: number, ms = 450) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (!trigger) return;
    const a = window.setTimeout(() => setOn(true), 0);
    const b = window.setTimeout(() => setOn(false), ms);
    return () => {
      window.clearTimeout(a);
      window.clearTimeout(b);
    };
  }, [trigger, ms]);
  return on;
}
