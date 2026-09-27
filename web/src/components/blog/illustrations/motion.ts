"use client";

import { useEffect, useRef, useState } from "react";

/** True once the element has scrolled into view (and stays true), or at once for reduced motion. */
export function useInView<T extends Element>(threshold = 0.35) {
  const ref = useRef<T>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) {
      const t = window.setTimeout(() => setSeen(true), 0);
      return () => window.clearTimeout(t);
    }
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setSeen(true);
          io.disconnect();
        }
      },
      { threshold },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [threshold]);
  return [ref, seen] as const;
}

/** A number that counts up to `target` once `active` — eased, so it settles rather than stops. */
export function useCountUp(target: number, active: boolean, ms = 1400) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!active) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const t = window.setTimeout(() => setValue(target), 0);
      return () => window.clearTimeout(t);
    }
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, Math.max(0, (now - start) / ms));
      const eased = 1 - Math.pow(1 - p, 4);
      setValue(Math.round(target * eased));
      if (p < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, active, ms]);
  return value;
}

/** The element's drawn width in pixels, kept current as the screen turns or resizes. */
export function useWidth<T extends Element>(fallback: number) {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.round(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

/** Whether the reader asked their phone for less motion. */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(mq.matches);
    const t = window.setTimeout(update, 0);
    mq.addEventListener("change", update);
    return () => {
      window.clearTimeout(t);
      mq.removeEventListener("change", update);
    };
  }, []);
  return reduced;
}

/**
 * How far the reader has scrolled through a tall "scroll story", from 0 as it
 * pins at the top of the screen to 1 as it lets go. Drives scenes that play
 * out as the reader scrolls, instead of on a timer they cannot control.
 */
export function useScrollProgress<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const r = el.getBoundingClientRect();
      const run = r.height - window.innerHeight;
      setProgress(run > 0 ? Math.min(1, Math.max(0, -r.top / run)) : 0);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      cancelAnimationFrame(frame);
    };
  }, []);
  return [ref, progress] as const;
}

/** A number that glides from its last value to the new one whenever the target changes. */
export function useTween(target: number, ms = 600) {
  const [value, setValue] = useState(target);
  const from = useRef(target);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const t = window.setTimeout(() => setValue(target), 0);
      from.current = target;
      return () => window.clearTimeout(t);
    }
    const start = performance.now();
    const origin = from.current;
    let frame = 0;
    const tick = (now: number) => {
      const p = Math.min(1, Math.max(0, (now - start) / ms));
      const eased = 1 - Math.pow(1 - p, 3);
      const v = origin + (target - origin) * eased;
      from.current = v;
      setValue(v);
      if (p < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, ms]);
  return value;
}

/**
 * A value that follows `target` like something on a spring: it overshoots a
 * little and settles. For things with weight — a balance tipping, a truck body
 * dropping onto its chassis, a podium rising — where an eased tween would feel
 * weightless.
 */
export function useSpring(target: number, { stiffness = 170, damping = 16, mass = 1 } = {}) {
  const [value, setValue] = useState(target);
  const state = useRef({ x: target, v: 0 });
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      state.current = { x: target, v: 0 };
      const t = window.setTimeout(() => setValue(target), 0);
      return () => window.clearTimeout(t);
    }
    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.032, Math.max(0, (now - last) / 1000));
      last = now;
      const s = state.current;
      // Small fixed steps keep the spring stable on 60 Hz and 120 Hz screens alike.
      const steps = Math.max(1, Math.ceil(dt / 0.004));
      for (let i = 0; i < steps; i++) {
        const h = dt / steps;
        const a = (-stiffness * (s.x - target) - damping * s.v) / mass;
        s.v += a * h;
        s.x += s.v * h;
      }
      if (Math.abs(s.v) > 0.002 || Math.abs(s.x - target) > 0.002) {
        setValue(s.x);
        frame = requestAnimationFrame(tick);
      } else {
        state.current = { x: target, v: 0 };
        setValue(target);
      }
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, stiffness, damping, mass]);
  return value;
}
