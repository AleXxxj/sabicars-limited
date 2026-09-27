"use client";

import { useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";
import { useInView, useReducedMotion, useTween } from "./motion";
import { Burst, haptic } from "./rewards";

type Kind = "tipper" | "container" | "tanker" | "flatbed" | "reefer";

const KINDS: { id: Kind; cargo: string; name: string; carries: string; action: string; undo: string; checks: string[] }[] = [
  {
    id: "tipper",
    cargo: "Sand and gravel",
    name: "Tipper",
    carries: "Sand, gravel, laterite and earth for building sites and roadworks — tipped out where it is needed.",
    action: "Tip it",
    undo: "Lower it",
    checks: [
      "Raise the body with a load if you can: it should rise smoothly and hold.",
      "Look for oil around the hydraulic ram and its hoses.",
      "Check the body floor and the rear springs for cracks and patching.",
    ],
  },
  {
    id: "container",
    cargo: "Containers",
    name: "Prime mover and trailer",
    carries: "A tractor unit that pulls a trailer — 20ft and 40ft containers between the ports, depots and warehouses.",
    action: "Uncouple",
    undo: "Couple up",
    checks: [
      "Check the fifth wheel (the coupling plate) for wear and play.",
      "Look along the frame behind the cab for cracks and old welds.",
      "The trailer has its own papers and chassis number: check them too.",
    ],
  },
  {
    id: "tanker",
    cargo: "Fuel and water",
    name: "Tanker",
    carries: "Liquids — diesel, petrol, water — in a sealed tank with its own valves and compartments.",
    action: "Fill it",
    undo: "Empty it",
    checks: [
      "Look for dents, patched welds and weeping at the valves and seams.",
      "Ask what it last carried. Fuel tankers need the right permits to operate.",
      "Check the bands that hold the tank to the chassis.",
    ],
  },
  {
    id: "flatbed",
    cargo: "Machinery",
    name: "Flatbed",
    carries: "Machinery, steel, pipes and anything too big or awkward for a box — tied down on an open deck.",
    action: "Load it",
    undo: "Unload",
    checks: [
      "Check the deck for rot and cracks, and the chassis beneath it for sagging.",
      "Look at the stakes and every tie-down point.",
      "Heavy loads are hard on springs: check them for broken leaves.",
    ],
  },
  {
    id: "reefer",
    cargo: "Frozen food",
    name: "Refrigerated truck",
    carries: "Frozen and chilled food and medicines, kept cold from the port to the shop by its own fridge unit.",
    action: "Cool it",
    undo: "Warm up",
    checks: [
      "Start the fridge unit from cold and watch it pull the temperature down.",
      "Check the door seals and the box for damage to the insulation.",
      "Ask for the fridge unit's service record — it is a machine of its own.",
    ],
  },
];

const RIGID_WHEELS = [300, 360, 780];
const TRACTOR_WHEELS = [580, 640, 780];
const TRAILER_WHEELS = [110, 160, 210];

function Wheel({ x }: { x: number }) {
  return (
    <g>
      <circle cx={x} cy="286" r="23" fill="#0B0A09" />
      <circle cx={x} cy="286" r="14" fill="#2b2926" stroke="#6b645a" strokeWidth="2" />
      <circle cx={x} cy="286" r="4" fill="#9a9184" />
    </g>
  );
}

function Cab() {
  return (
    <g>
      <path
        d="M700 276 L700 164 C700 155 706 149 716 149 L800 149 C812 149 820 155 824 165 L834 214 L836 262 C836 270 832 276 824 276 Z"
        fill="#e8e4da"
        stroke="rgb(0 0 0 / 0.25)"
      />
      <path d="M760 159 L806 159 C811 159 814 161 815 165 L825 208 L760 208 Z" fill="#1b2630" />
      <line x1="756" y1="160" x2="756" y2="270" stroke="rgb(0 0 0 / 0.2)" />
      {[232, 242, 252].map((y) => (
        <line key={y} x1="826" y1={y} x2="836" y2={y} stroke="#6b645a" strokeWidth="2.5" />
      ))}
      <rect x="826" y="258" width="10" height="7" rx="2" fill="#fff4cf" />
      <rect x="698" y="270" width="144" height="12" rx="3" fill="#3a3632" />
      <rect x="744" y="222" width="12" height="4" rx="2" fill="#6b645a" />
    </g>
  );
}

/**
 * Start with the load. The reader picks what they will carry; the right body
 * drops onto the chassis with a thud and a puff of dust, and each one has
 * something to try — tip the sand, fill the tank, chill the box.
 */
export function TruckBuilder() {
  const reduced = useReducedMotion();
  const [ref, seen] = useInView<HTMLDivElement>(0.45);
  const [kind, setKind] = useState<Kind>("tipper");
  const [shown, setShown] = useState<Kind>("tipper");
  const [leaving, setLeaving] = useState(false);
  const [drop, setDrop] = useState(0);
  const [active, setActive] = useState(false);
  const [fire, setFire] = useState(0);
  const timers = useRef<number[]>([]);
  const k = KINDS.find((x) => x.id === shown)!;
  const level = useTween(shown === "tanker" && active ? 1 : 0, 1800);
  const temp = useTween(shown === "reefer" && active ? -18 : 28, 2200);
  const tip = useTween(shown === "tipper" && active ? 1 : 0, 1100);
  const hitch = useTween(shown === "container" && !active ? 1 : 0, 900);

  useEffect(() => {
    const list = timers.current;
    return () => list.splice(0).forEach(window.clearTimeout);
  }, []);

  // The first body drops in when the reader reaches it.
  useEffect(() => {
    if (!seen || reduced) return;
    const t = window.setTimeout(() => setDrop((d) => d || 1), 150);
    return () => window.clearTimeout(t);
  }, [seen, reduced]);

  const celebrate = (after: number) =>
    timers.current.push(
      window.setTimeout(
        () => {
          setFire((f) => f + 1);
          haptic([10, 30, 16]);
        },
        reduced ? 0 : after,
      ),
    );

  const choose = (next: Kind) => {
    if (next === kind) return;
    setKind(next);
    haptic(8);
    if (reduced) {
      setShown(next);
      setActive(false);
      return;
    }
    setLeaving(true);
    timers.current.push(
      window.setTimeout(() => {
        setShown(next);
        setActive(false);
        setLeaving(false);
        setDrop((d) => d + 1);
      }, 280),
      window.setTimeout(() => haptic(18), 280 + 420),
    );
    // A trailer arriving couples with a clack.
    if (next === "container") celebrate(280 + 900);
  };

  const act = () => {
    const next = !active;
    setActive(next);
    haptic(10);
    // The reward comes when the job is done: coupled, tipped, full, loaded, cold.
    if (shown === "container" ? !next : next) celebrate(shown === "reefer" ? 2200 : shown === "tanker" ? 1800 : 900);
  };

  const articulated = shown === "container";
  const wheels = articulated ? TRACTOR_WHEELS : RIGID_WHEELS;
  // Until the reader arrives, the body waits out of sight, so its first entrance is a drop.
  const bodyClass = leaving ? "truck-leave" : drop ? "truck-drop" : reduced ? "" : "opacity-0";

  // Where the burst goes, as a share of the stage.
  const burstAt: Record<Kind, [number, number]> = {
    tipper: [12, 82],
    container: [68, 74],
    tanker: [44, 50],
    flatbed: [44, 60],
    reefer: [44, 40],
  };

  return (
    <div ref={ref} className="surface-card overflow-hidden p-4 sm:p-6 md:p-8">
      <p className="text-sm font-semibold text-text-primary">What will it carry?</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {KINDS.map((x) => (
          <button
            key={x.id}
            type="button"
            aria-pressed={x.id === kind}
            onClick={() => choose(x.id)}
            className={`min-h-11 rounded-full border px-4 text-sm transition-all active:scale-95 ${x.id === kind ? "border-gold-400 bg-gold-500/15 font-semibold text-gold-100" : "border-white/[0.12] text-text-secondary hover:border-gold-500/40 hover:text-text-primary"}`}
          >
            {x.cargo}
          </button>
        ))}
      </div>

      <div className="relative mt-5 overflow-hidden rounded-2xl border border-white/[0.06] bg-[linear-gradient(180deg,#1f1d1a,#141311)]">
        <svg viewBox="0 0 900 330" className="block w-full" role="img" aria-label={`A ${k.name.toLowerCase()}`}>
          <defs>
            <clipPath id="tb-tank">
              <rect x="150" y="168" width="490" height="88" rx="44" />
            </clipPath>
          </defs>
          <line x1="0" y1="309" x2="900" y2="309" stroke="rgb(255 255 255 / 0.1)" />

          {/* Trailer (containers only): rolls in and couples */}
          {articulated && (
            <g style={{ transform: `translateX(${(1 - hitch) * -70}px)`, opacity: leaving ? 0 : 1, transition: "opacity 260ms" }}>
              <rect x="60" y="244" width="580" height="12" rx="2" fill="#3a3632" />
              <rect x="530" y="256" width="8" height={active ? 44 : 30} fill="#6b645a" />
              <g>
                <rect x="70" y="118" width="550" height="126" rx="3" fill="#8e3b2f" stroke="rgb(0 0 0 / 0.3)" />
                {Array.from({ length: 22 }, (_, i) => (
                  <line key={i} x1={82 + i * 24.5} y1="124" x2={82 + i * 24.5} y2="238" stroke="rgb(0 0 0 / 0.22)" strokeWidth="3" />
                ))}
                <text
                  x="345"
                  y="190"
                  textAnchor="middle"
                  fontSize="22"
                  fontWeight="700"
                  fill="rgb(255 255 255 / 0.6)"
                  fontFamily="var(--font-sans)"
                >
                  40FT
                </text>
              </g>
              {TRAILER_WHEELS.map((x) => (
                <Wheel key={x} x={x} />
              ))}
            </g>
          )}

          {/* Chassis and running gear */}
          <g className={drop && !leaving ? "truck-squash" : ""}>
            <rect x={articulated ? 520 : 110} y="262" width={articulated ? 310 : 720} height="14" rx="3" fill="#2b2926" />
            <rect x="610" y="266" width="56" height="24" rx="8" fill="#4a4540" />
            {articulated && <rect x="575" y="252" width="80" height="10" rx="3" fill="#6b645a" />}
            {wheels.map((x) => (
              <Wheel key={x} x={x} />
            ))}
            <Cab />
          </g>

          {/* The body */}
          {!articulated && (
            <g key={`${shown}-${drop}`} className={bodyClass}>
              {shown === "tipper" && (
                <g>
                  {/* The ram, visible as the body rises */}
                  <line
                    x1="520"
                    y1="262"
                    x2={520 - 65 * tip}
                    y2={262 - 214 * tip}
                    stroke="#9a9184"
                    strokeWidth="10"
                    strokeLinecap="round"
                    opacity={tip > 0.02 ? 1 : 0}
                  />
                  <g style={{ transform: `rotate(${-34 * tip}deg)`, transformOrigin: "140px 260px" }}>
                    <path d="M140 260 L140 176 L644 176 L656 190 L656 260 Z" fill="#c9a84c" stroke="rgb(0 0 0 / 0.3)" />
                    {[190, 240, 290, 340, 390, 440, 490, 540, 590].map((x) => (
                      <line key={x} x1={x} y1="180" x2={x} y2="256" stroke="rgb(0 0 0 / 0.18)" strokeWidth="4" />
                    ))}
                    <rect x="136" y="170" width="524" height="10" rx="2" fill="#a8883a" />
                    <path d="M150 176 Q 300 150 450 168 Q 560 150 640 176 Z" fill="#b8905a" opacity={1 - tip} />
                  </g>
                  {/* Sand pouring and piling */}
                  {tip > 0.6 && (
                    <g>
                      {Array.from({ length: 14 }, (_, i) => (
                        <circle
                          key={i}
                          className="sand-grain"
                          cx={96 + (i % 5) * 7}
                          cy="206"
                          r={3 + (i % 3)}
                          fill="#c9a067"
                          style={{ animationDelay: `${i * 70}ms` }}
                        />
                      ))}
                    </g>
                  )}
                  <ellipse cx="96" cy="306" rx={70 * tip} ry={26 * tip} fill="#b8905a" />
                </g>
              )}
              {shown === "tanker" && (
                <g>
                  <rect x="150" y="168" width="490" height="88" rx="44" fill="#d8d4cc" stroke="rgb(0 0 0 / 0.3)" />
                  <g clipPath="url(#tb-tank)">
                    <rect x="150" y={256 - 88 * level} width="490" height={88 * level + 4} fill="rgb(70 130 180 / 0.55)" />
                    <path
                      className="tank-wave"
                      d={`M100 ${256 - 88 * level} q 20 -6 40 0 t 40 0 t 40 0 t 40 0 t 40 0 t 40 0 t 40 0 t 40 0 t 40 0 t 40 0 t 40 0 t 40 0 t 40 0 t 40 0 V 260 H 100 Z`}
                      fill="rgb(120 180 220 / 0.5)"
                    />
                  </g>
                  {[240, 330, 420, 510].map((x) => (
                    <rect key={x} x={x} y="166" width="6" height="92" fill="rgb(0 0 0 / 0.18)" />
                  ))}
                  {[260, 400, 540].map((x) => (
                    <rect key={x} x={x - 16} y="156" width="32" height="14" rx="4" fill="#b9b4aa" />
                  ))}
                  <text
                    x="395"
                    y="222"
                    textAnchor="middle"
                    fontSize="18"
                    fontWeight="700"
                    fill="rgb(20 30 40 / 0.55)"
                    fontFamily="var(--font-sans)"
                  >
                    {level > 0.98 ? "FULL" : level > 0.02 ? `${Math.round(level * 100)}%` : ""}
                  </text>
                </g>
              )}
              {shown === "flatbed" && (
                <g>
                  <rect x="140" y="248" width="516" height="14" rx="2" fill="#6b4f36" />
                  {[150, 220, 290, 360, 430, 500, 570, 640].map((x) => (
                    <rect key={x} x={x} y="230" width="7" height="18" fill="#4a4540" />
                  ))}
                  {active && (
                    <g className="truck-drop">
                      <rect x="300" y="222" width="220" height="26" rx="13" fill="#2b2926" />
                      {[315, 350, 385, 420, 455, 490].map((x) => (
                        <circle key={x} cx={x} cy="235" r="7" fill="#4a4540" />
                      ))}
                      <rect x="380" y="160" width="92" height="62" rx="6" fill="#d9a62b" />
                      <rect x="404" y="168" width="44" height="30" rx="3" fill="#1b2630" />
                      <path
                        d="M384 186 L306 128 L246 168 L258 198 L276 190 L262 170 L306 146 L380 200 Z"
                        fill="#d9a62b"
                        stroke="rgb(0 0 0 / 0.25)"
                      />
                      <path
                        className="chain"
                        d="M300 248 L330 224 M520 248 L492 224"
                        stroke="#9a9184"
                        strokeWidth="3"
                        strokeDasharray="4 3"
                      />
                    </g>
                  )}
                </g>
              )}
              {shown === "reefer" && (
                <g>
                  <rect x="140" y="140" width="520" height="120" rx="4" fill="#ecebe6" stroke="rgb(0 0 0 / 0.25)" />
                  {[270, 400, 530].map((x) => (
                    <line key={x} x1={x} y1="144" x2={x} y2="256" stroke="rgb(0 0 0 / 0.08)" strokeWidth="3" />
                  ))}
                  <rect
                    x="140"
                    y="140"
                    width="520"
                    height="120"
                    rx="4"
                    fill="rgb(150 205 255)"
                    opacity={Math.max(0, (28 - temp) / 46) * 0.28}
                  />
                  <rect x="660" y="148" width="34" height="64" rx="4" fill="#3a3632" />
                  {[160, 172, 184, 196].map((y) => (
                    <line key={y} x1="664" y1={y} x2="690" y2={y} stroke="#6b645a" strokeWidth="2" />
                  ))}
                  <rect x="330" y="176" width="140" height="48" rx="6" fill="#0b0d0c" />
                  <text
                    x="400"
                    y="209"
                    textAnchor="middle"
                    fontSize="26"
                    fontWeight="700"
                    fill={temp < 0 ? "#9fd8ff" : "#b8f5cf"}
                    fontFamily="var(--font-sans)"
                  >
                    {`${Math.round(temp)}°C`}
                  </text>
                  {temp < 0 &&
                    [
                      [160, 150],
                      [250, 146],
                      [560, 150],
                      [640, 180],
                      [180, 246],
                      [610, 246],
                    ].map(([x, y], i) => (
                      <path
                        key={i}
                        className="frost"
                        d={`M${x} ${y - 7} L${x} ${y + 7} M${x - 7} ${y} L${x + 7} ${y} M${x - 5} ${y - 5} L${x + 5} ${y + 5} M${x - 5} ${y + 5} L${x + 5} ${y - 5}`}
                        stroke="#dff3ff"
                        strokeWidth="1.6"
                        style={{ animationDelay: `${i * 160}ms` }}
                      />
                    ))}
                </g>
              )}
            </g>
          )}

          {/* Dust as a body lands */}
          {drop > 0 && !leaving && (
            <g key={`dust-${drop}`}>
              {wheels
                .slice(0, 2)
                .map((x) =>
                  [-18, 0, 18].map((dx) => (
                    <circle key={`${x}${dx}`} className="dust-puff" cx={x + dx} cy="304" r="10" fill="rgb(200 180 150 / 0.45)" />
                  )),
                )}
            </g>
          )}
        </svg>
        <span className="absolute" style={{ left: `${burstAt[shown][0]}%`, top: `${burstAt[shown][1]}%` }}>
          <Burst fire={fire} />
        </span>
      </div>

      <div className="mt-5 grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] md:items-start">
        <div>
          <p key={shown} className="pop-in font-display text-[1.8rem] leading-tight text-text-primary">
            {k.name}
          </p>
          <p className="mt-2 text-sm text-text-secondary">{k.carries}</p>
          <button
            type="button"
            onClick={act}
            className="mt-4 inline-flex min-h-12 items-center gap-2 rounded-full bg-[linear-gradient(180deg,var(--gold-300),var(--gold-500))] px-6 font-semibold text-[#0A0908] transition-transform active:scale-95"
          >
            {active ? k.undo : k.action}
          </button>
        </div>
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4">
          <p className="text-xs font-semibold tracking-[0.14em] text-gold-300 uppercase">Before you buy one</p>
          <ul className="mt-2 grid gap-2 text-sm text-text-secondary">
            {k.checks.map((c) => (
              <li key={c} className="flex gap-2">
                <Check aria-hidden size={15} className="mt-0.5 shrink-0 text-gold-300" />
                {c}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
