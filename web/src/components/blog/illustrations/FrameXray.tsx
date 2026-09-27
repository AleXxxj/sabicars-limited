"use client";

import { useEffect, useRef, useState } from "react";
import { MoveHorizontal } from "lucide-react";
import { useInView, useReducedMotion, useSpring } from "./motion";
import { Burst, haptic } from "./rewards";

/*
 * Drawn facing right to scale — about 100 px to the metre — on an 800-wide
 * stage: the Highlander (4.9 m long, 1.73 m tall) above, the GX 460 (4.8 m,
 * 1.88 m) below. Each row has its ground at y = 200; the GX row is shifted
 * down 230.
 */
const HL_BODY =
  "M152 160 L150 108 C150 80 158 60 176 44 L196 30 L470 27 C500 28 520 44 548 80 L560 90 L622 104 C634 107 640 118 640 132 L640 160 Z";
const HL_GLASS = "M172 92 L186 56 C192 46 200 40 214 38 L468 36 C492 37 508 50 530 84 L536 92 Z";
const GX_BODY = "M152 150 L151 40 C151 26 158 18 170 16 L452 12 C474 13 486 24 500 50 L512 74 L612 86 C626 89 632 100 632 116 L632 150 Z";
const GX_GLASS = "M166 78 L166 30 C166 26 169 24 174 24 L448 21 C466 22 476 32 488 56 L496 78 Z";

function Wheels({ xs, y, r }: { xs: number[]; y: number; r: number }) {
  return (
    <>
      {xs.map((x) => (
        <g key={x}>
          <circle cx={x} cy={y} r={r + 6} fill="#0B0A09" />
          <circle cx={x} cy={y} r={r} fill="#1a1816" stroke="#3a3632" strokeWidth={5} />
          <circle cx={x} cy={y} r={r * 0.45} fill="#4a4540" />
        </g>
      ))}
    </>
  );
}

/**
 * The difference you cannot see from the kerb: drag a scanner across both
 * SUVs and see what they are built on. The Highlander is one welded shell
 * (unibody); the GX 460's body sits on a separate steel ladder frame.
 */
export function FrameXray() {
  const reduced = useReducedMotion();
  const [ref, seen] = useInView<HTMLDivElement>(0.4);
  const stage = useRef<HTMLDivElement>(null);
  const [target, setTarget] = useState(0.06);
  const [touched, setTouched] = useState(false);
  const [maxSeen, setMaxSeen] = useState(0);
  const [fire, setFire] = useState(0);
  const dragging = useRef(false);
  const scan = useSpring(reduced ? 1 : target, { stiffness: 260, damping: 26 });
  const done = maxSeen >= 0.97 || reduced;

  // A first sweep to show the reader what the scanner does.
  useEffect(() => {
    if (!seen || touched || reduced) return;
    const a = window.setTimeout(() => setTarget(0.42), 350);
    const b = window.setTimeout(() => setTarget(0.24), 1300);
    return () => [a, b].forEach(window.clearTimeout);
  }, [seen, touched, reduced]);

  const move = (to: number) => {
    const v = Math.max(0, Math.min(1, to));
    setTarget(v);
    setTouched(true);
    if (v > maxSeen) {
      setMaxSeen(v);
      if (v >= 0.97 && maxSeen < 0.97) {
        setFire((f) => f + 1);
        haptic([12, 40, 18]);
      }
    }
  };
  const fromPointer = (clientX: number) => {
    const box = stage.current?.getBoundingClientRect();
    if (box) move((clientX - box.left) / box.width);
  };

  const x = scan * 800;
  return (
    <div ref={ref} className="surface-card overflow-hidden p-4 sm:p-6 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-semibold text-text-primary">What each one is built on</p>
        <p className="flex items-center gap-2 text-sm text-text-muted">
          <MoveHorizontal aria-hidden size={16} className={touched ? "" : "animate-pulse text-gold-300"} /> Drag the scanner across
        </p>
      </div>

      <div
        ref={stage}
        className="relative mt-5 cursor-ew-resize touch-pan-y select-none"
        onPointerDown={(e) => {
          dragging.current = true;
          e.currentTarget.setPointerCapture(e.pointerId);
          fromPointer(e.clientX);
        }}
        onPointerMove={(e) => dragging.current && fromPointer(e.clientX)}
        onPointerUp={() => (dragging.current = false)}
        onPointerCancel={() => (dragging.current = false)}
      >
        <svg
          viewBox="0 0 800 450"
          className="block w-full"
          role="img"
          aria-label="Side views of a Toyota Highlander and a Lexus GX 460, with an X-ray scanner showing their structure"
        >
          <defs>
            <linearGradient id="fx-paint" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#4a4540" />
              <stop offset="0.55" stopColor="#2a2724" />
              <stop offset="1" stopColor="#1b1917" />
            </linearGradient>
            <pattern id="fx-grid" width="20" height="20" patternUnits="userSpaceOnUse">
              <path d="M20 0H0V20" fill="none" stroke="rgb(223 198 124 / 0.09)" strokeWidth="1" />
            </pattern>
            <filter id="fx-glow" x="-10%" y="-30%" width="120%" height="160%">
              <feGaussianBlur stdDeviation="3" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <clipPath id="fx-left">
              <rect x="0" y="0" width={x} height="450" />
            </clipPath>
            <clipPath id="fx-right">
              <rect x={x} y="0" width={800 - x} height="450" />
            </clipPath>
          </defs>

          {/* Ground lines */}
          <line x1="20" y1="200" x2="780" y2="200" stroke="rgb(255 255 255 / 0.08)" />
          <line x1="20" y1="430" x2="780" y2="430" stroke="rgb(255 255 255 / 0.08)" />

          {/* As they look: paint and glass, right of the scanner */}
          <g clipPath="url(#fx-right)">
            <g>
              <path d={HL_BODY} fill="url(#fx-paint)" stroke="rgb(255 255 255 / 0.12)" />
              <path d={HL_GLASS} fill="#10151a" stroke="rgb(255 255 255 / 0.1)" />
              <line x1="270" y1="37" x2="270" y2="92" stroke="#2a2724" strokeWidth="7" />
              <line x1="392" y1="36" x2="392" y2="92" stroke="#2a2724" strokeWidth="7" />
              <line x1="160" y1="118" x2="628" y2="118" stroke="rgb(255 255 255 / 0.06)" />
              <rect x="624" y="110" width="16" height="9" rx="3" fill="#e9e3d2" opacity="0.85" />
              <rect x="150" y="98" width="10" height="18" rx="3" fill="#8b2a22" />
              <Wheels xs={[262, 541]} y={163} r={37} />
            </g>
            <g transform="translate(0 230)">
              <path d={GX_BODY} fill="url(#fx-paint)" stroke="rgb(255 255 255 / 0.12)" />
              <path d={GX_GLASS} fill="#10151a" stroke="rgb(255 255 255 / 0.1)" />
              <line x1="270" y1="22" x2="270" y2="78" stroke="#2a2724" strokeWidth="7" />
              <line x1="392" y1="22" x2="392" y2="78" stroke="#2a2724" strokeWidth="7" />
              <line x1="160" y1="104" x2="624" y2="104" stroke="rgb(255 255 255 / 0.06)" />
              <rect x="616" y="94" width="16" height="10" rx="3" fill="#e9e3d2" opacity="0.85" />
              <rect x="151" y="84" width="10" height="22" rx="3" fill="#8b2a22" />
              {/* The frame shows below the sills, as it does on the real thing */}
              <rect x="168" y="152" width="456" height="10" rx="2" fill="#141311" />
              <Wheels xs={[261, 540]} y={162} r={38} />
            </g>
          </g>

          {/* X-ray: what they are built on, left of the scanner */}
          <g clipPath="url(#fx-left)">
            <rect x="0" y="0" width="800" height="450" fill="url(#fx-grid)" />
            {/* Highlander: one welded shell — every member is part of the body */}
            <g filter="url(#fx-glow)" stroke="var(--gold-300)" fill="none" strokeLinejoin="round">
              <path d={HL_BODY} fill="rgb(201 168 76 / 0.16)" strokeWidth="2.6" />
              <path
                d="M176 44 L166 110 L158 160 M270 37 L270 160 M392 36 L392 160 M548 80 L528 160 M200 40 L466 38 M160 95 L560 95 M160 150 L632 150 M176 142 L620 142"
                strokeWidth="1.6"
                opacity="0.9"
              />
              <path d="M560 90 L640 124 M598 100 L598 160 M624 106 L624 160" strokeWidth="1.6" opacity="0.8" />
            </g>
            <g stroke="rgb(223 198 124 / 0.35)" fill="none">
              {[262, 541].map((cx) => (
                <circle key={cx} cx={cx} cy={163} r={37} strokeDasharray="4 5" />
              ))}
            </g>
            {/* GX 460: the body (faint) sits on a separate ladder frame (bright) */}
            <g transform="translate(0 230)">
              <path d={GX_BODY} fill="none" stroke="rgb(245 242 234 / 0.35)" strokeWidth="1.6" strokeDasharray="6 5" />
              <g filter="url(#fx-glow)">
                <rect
                  x="160"
                  y="152"
                  width="468"
                  height="12"
                  rx="3"
                  fill="rgb(201 168 76 / 0.28)"
                  stroke="var(--gold-300)"
                  strokeWidth="2.4"
                />
                {[176, 300, 420, 560, 612].map((cx) => (
                  <rect key={cx} x={cx - 5} y="148" width="10" height="20" rx="2" fill="var(--gold-400)" />
                ))}
                {[200, 336, 476, 596].map((cx) => (
                  <circle key={cx} cx={cx} cy="151" r="5" fill="#0B0A09" stroke="var(--gold-200)" strokeWidth="2" />
                ))}
              </g>
              <g stroke="rgb(223 198 124 / 0.35)" fill="none">
                {[261, 540].map((cx) => (
                  <circle key={cx} cx={cx} cy={162} r={38} strokeDasharray="4 5" />
                ))}
              </g>
            </g>
          </g>

          {/* The scanner */}
          <g pointerEvents="none">
            <line x1={x} y1="0" x2={x} y2="450" stroke="var(--gold-300)" strokeWidth="2" filter="url(#fx-glow)" />
            <rect x={x - 26} y="0" width="26" height="450" fill="url(#fx-grid)" opacity="0.3" />
          </g>
        </svg>

        {/* Labels in real text, so they stay readable on a phone; placed in the drawing's own coordinates */}
        {[
          { x: 780, y: 30, text: "Toyota Highlander", end: true, show: 0, strong: true },
          { x: 780, y: 326, text: "Lexus GX 460", end: true, show: 0, strong: true },
          { x: 318, y: 124, text: "One welded shell", show: 0.55 },
          { x: 316, y: 418, text: "A separate steel ladder frame", show: 0.6 },
          { x: 180, y: 366, text: "Body mounts", show: 0.45 },
        ].map((l) => (
          <span
            key={l.text}
            aria-hidden
            className={`pointer-events-none absolute text-[0.68rem] leading-none whitespace-nowrap transition-opacity duration-500 sm:text-xs ${l.strong ? "font-semibold text-gold-200" : "text-text-primary"} ${l.end ? "-translate-x-full" : ""} -translate-y-full`}
            style={{ left: `${(l.x / 800) * 100}%`, top: `${(l.y / 450) * 100}%`, opacity: scan > l.show ? 1 : l.strong ? 0.5 : 0 }}
          >
            {l.text}
          </span>
        ))}

        {/* The handle: a real slider for keyboards and screen readers */}
        <div
          role="slider"
          tabIndex={0}
          aria-label="X-ray scanner"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(target * 100)}
          aria-valuetext={`${Math.round(target * 100)}% scanned`}
          onKeyDown={(e) => {
            if (e.key === "ArrowRight" || e.key === "ArrowUp") move(target + 0.05);
            else if (e.key === "ArrowLeft" || e.key === "ArrowDown") move(target - 0.05);
            else if (e.key === "End") move(1);
            else if (e.key === "Home") move(0);
            else return;
            e.preventDefault();
          }}
          className="absolute top-1/2 flex size-9 -translate-x-1/2 -translate-y-1/2 sm:size-12 items-center justify-center rounded-full border-2 border-gold-300 bg-surface-0/90 text-gold-200 shadow-[0_0_24px_rgb(201_168_76/0.55)] outline-none focus-visible:ring-4 focus-visible:ring-gold-500/40"
          style={{ left: `${scan * 100}%` }}
        >
          <MoveHorizontal aria-hidden size={20} />
          <Burst fire={fire} />
        </div>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {[
          {
            title: "Built like a car",
            name: "Highlander",
            text: "Body and frame are one piece. Lighter, quieter and smoother on tarmac — and lighter on fuel.",
          },
          {
            title: "Built like a truck",
            name: "GX 460",
            text: "The body rides on a steel ladder frame, with full-time 4WD and low range. Shrugs off bad roads.",
          },
        ].map((c, i) => (
          <div
            key={c.name}
            className={`rounded-2xl border p-4 transition-all duration-500 ${done ? "pop-in border-gold-500/35 bg-gold-500/[0.06]" : "border-white/[0.06] opacity-45"}`}
            style={{ animationDelay: `${i * 140}ms` }}
          >
            <p className="text-xs font-semibold tracking-[0.14em] text-gold-300 uppercase">{c.name}</p>
            <p className="mt-1 font-semibold text-text-primary">{c.title}</p>
            <p className="mt-1 text-sm text-text-secondary">{c.text}</p>
          </div>
        ))}
      </div>
      {!done && <p className="mt-3 text-center text-xs text-text-muted">Scan all the way across to see what it means.</p>}
    </div>
  );
}
