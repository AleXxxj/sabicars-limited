import { Construction, Fuel, Gauge, Store, TrafficCone, Users, Wrench, type LucideIcon } from "lucide-react";

/** The kinds of road a race runs through. Each has a sign, a colour and something beside the road. */
export type LegKind = "stops" | "goslow" | "expressway" | "pump" | "mechanic" | "city" | "potholes";

export const LEG_ICON: Record<LegKind, LucideIcon> = {
  stops: Users,
  goslow: TrafficCone,
  expressway: Gauge,
  pump: Fuel,
  mechanic: Wrench,
  city: Store,
  potholes: Construction,
};

export const LEG_LABEL: Record<LegKind, string> = {
  stops: "Bus stops",
  goslow: "Go-slow",
  expressway: "Expressway",
  pump: "Doubtful fuel",
  mechanic: "Mechanic",
  city: "City roads",
  potholes: "Bad road",
};

/** Each leg's colour: on the road, on the map, on its sign. */
export const LEG_TINT: Record<LegKind, { road: string; sign: string; ink: string }> = {
  stops: { road: "rgb(90 140 255 / 0.07)", sign: "#2f5fb3", ink: "#fff" },
  goslow: { road: "rgb(255 90 70 / 0.08)", sign: "#e0a82e", ink: "#0A0908" },
  expressway: { road: "rgb(61 220 132 / 0.05)", sign: "#1f6b3a", ink: "#fff" },
  pump: { road: "rgb(240 170 40 / 0.08)", sign: "#b8322a", ink: "#fff" },
  mechanic: { road: "rgb(170 180 200 / 0.08)", sign: "#f2d23c", ink: "#0A0908" },
  city: { road: "rgb(201 168 76 / 0.04)", sign: "#4a4e55", ink: "#fff" },
  potholes: { road: "rgb(120 84 50 / 0.16)", sign: "#e0702e", ink: "#0A0908" },
};

/** The Lagos skyline, one tile, drawn behind everything and scrolled slower than the road. */
export const SKYLINE_TILE = 520;
const SKYLINE = (() => {
  const out: { x: number; w: number; h: number; lit: boolean }[] = [];
  for (let x = 0, i = 0; x < SKYLINE_TILE - 10; i++) {
    const w = 16 + ((i * 37) % 26);
    out.push({ x, w, h: 18 + ((i * 53) % 46) + (i % 7 === 3 ? 22 : 0), lit: i % 3 === 0 });
    x += w + 3 + (i % 4);
  }
  return out;
})();

export function Skyline({ height }: { height: number }) {
  return (
    <svg width={SKYLINE_TILE * 3} height={height} className="absolute bottom-0 left-0" aria-hidden>
      {[0, 1, 2].map((copy) =>
        SKYLINE.map((b, i) => (
          <g key={`${copy}-${i}`}>
            <rect x={copy * SKYLINE_TILE + b.x} y={height - b.h} width={b.w} height={b.h} fill="rgb(255 255 255 / 0.055)" />
            {b.lit &&
              [0.3, 0.55].map((f) => (
                <rect
                  key={f}
                  x={copy * SKYLINE_TILE + b.x + b.w * 0.3}
                  y={height - b.h * f}
                  width="3"
                  height="3"
                  fill="rgb(255 214 140 / 0.35)"
                />
              ))}
          </g>
        )),
      )}
    </svg>
  );
}

/** What stands beside the road on each leg: a bridge over the lagoon, shelters, trees, a filling station, a workshop, shops, a broken verge. */
export function Roadside({ kind, width, sky }: { kind: LegKind; width: number; sky: number }) {
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
  if (kind === "city")
    return (
      <div aria-hidden className="absolute bottom-0 left-0 flex h-9 items-end gap-2 overflow-hidden pl-16" style={{ width }}>
        {Array.from({ length: Math.max(2, Math.floor((width - 64) / 46)) }, (_, i) => (
          <span key={i} className="relative block shrink-0 bg-white/[0.07]" style={{ width: 38, height: 22 + ((i * 7) % 3) * 6 }}>
            <span
              className="absolute inset-x-0 top-0 h-1.5"
              style={{ background: ["#b8322a", "#2f5fb3", "#1f6b3a", "#c9a84c"][i % 4], opacity: 0.6 }}
            />
            <span className="absolute bottom-0 left-1/2 h-2.5 w-2 -translate-x-1/2 bg-black/40" />
          </span>
        ))}
      </div>
    );
  if (kind === "potholes")
    return (
      <div aria-hidden className="absolute bottom-0 left-0 h-4" style={{ width }}>
        <div className="absolute inset-x-0 bottom-0 h-3 bg-[radial-gradient(ellipse_at_50%_100%,rgb(120_84_50/0.55)_0_60%,transparent_62%)] bg-[length:54px_12px] bg-repeat-x" />
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
