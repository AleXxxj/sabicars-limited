"use client";

import { useId } from "react";
import type { BusShape } from "@/lib/hiace-family";

/**
 * Side views of the Hiace family, facing right: the square-faced old Hiace,
 * the short standard-roof Hiace, the high-roof Hummer and the taller, longer
 * Hummer 3. All share one frame, front wheels aligned, so a short bus really
 * looks short beside a Hummer 3.
 *
 * Drawn facing left and mirrored. Wheels sit outside the mirror so turning
 * them clockwise rolls the bus forwards; the caller turns them, lights the
 * brake light, and fills the windows with passengers.
 */

interface Geometry {
  body: string;
  windscreen: string;
  windows: [number, number, number, number][];
  pillars: string;
  stripe: string;
  lamp: string;
  tail: string;
  brake: string;
  /** Rear wheel centre, in the drawing's own (unmirrored) units. */
  rearWheel: number;
  rearX: number;
  /** Where passengers' heads show in the side windows. */
  heads: { y: number; r: number; xs: number[] };
}

const GEOMETRY: Record<BusShape, Geometry> = {
  hummer: {
    body: "M78 300 L70 246 C70 222 80 206 104 200 L164 88 C172 72 186 66 206 65 L700 60 C724 60 734 72 736 94 L744 272 C745 292 734 300 716 300 L656 300 A56 56 0 0 0 544 300 L232 300 A56 56 0 0 0 120 300 Z",
    windscreen: "M174 96 L256 93 L256 184 L126 186 Z",
    windows: [
      [280, 91, 114, 91],
      [414, 89, 124, 93],
      [552, 87, 136, 95],
    ],
    pillars: "M262 90 L262 298 M406 86 L406 298",
    stripe: "M406 210 L740 205",
    lamp: "M72 232 L96 226 L100 238 L74 244 Z",
    tail: "M736 200 L744 200 L745 240 L737 240 Z",
    brake: "M732 196 L748 196 L749 244 L733 244 Z",
    rearWheel: 600,
    rearX: 744,
    heads: { y: 136, r: 15, xs: [312, 362, 446, 500, 590, 650] },
  },
  "hummer-tall": {
    body: "M78 300 L70 246 C70 222 80 206 104 200 L168 76 C176 58 190 52 210 51 L746 46 C770 46 780 58 782 80 L790 272 C791 292 780 300 762 300 L702 300 A56 56 0 0 0 590 300 L232 300 A56 56 0 0 0 120 300 Z",
    windscreen: "M178 84 L262 80 L262 184 L128 186 Z",
    windows: [
      [286, 76, 116, 106],
      [418, 74, 128, 108],
      [562, 72, 170, 110],
    ],
    pillars: "M268 78 L268 298 M410 74 L410 298",
    stripe: "M410 210 L786 205",
    lamp: "M72 232 L96 226 L100 238 L74 244 Z",
    tail: "M782 200 L790 200 L791 240 L783 240 Z",
    brake: "M778 196 L794 196 L795 244 L779 244 Z",
    rearWheel: 646,
    rearX: 790,
    heads: { y: 130, r: 15, xs: [318, 370, 452, 508, 600, 664] },
  },
  short: {
    body: "M78 300 L70 246 C70 222 80 206 104 200 L146 138 C154 124 166 118 186 117 L598 114 C620 114 630 124 632 144 L640 272 C641 292 630 300 612 300 L552 300 A56 56 0 0 0 440 300 L232 300 A56 56 0 0 0 120 300 Z",
    windscreen: "M156 140 L250 136 L250 184 L124 186 Z",
    windows: [
      [278, 134, 130, 48],
      [424, 132, 176, 50],
    ],
    pillars: "M260 134 L260 298 M412 132 L412 298",
    stripe: "M412 210 L636 206",
    lamp: "M72 232 L96 226 L100 238 L74 244 Z",
    tail: "M632 200 L640 200 L641 240 L633 240 Z",
    brake: "M628 196 L644 196 L645 244 L629 244 Z",
    rearWheel: 496,
    rearX: 640,
    heads: { y: 150, r: 11, xs: [314, 366, 470, 540] },
  },
  square: {
    body: "M84 300 L78 250 C78 236 80 222 84 214 L94 100 C96 88 104 84 118 84 L664 82 C688 82 698 94 700 114 L704 272 C705 292 694 300 676 300 L620 300 A56 56 0 0 0 508 300 L232 300 A56 56 0 0 0 120 300 Z",
    windscreen: "M104 104 L240 100 L240 186 L96 188 Z",
    windows: [
      [262, 98, 124, 86],
      [400, 96, 130, 88],
      [544, 94, 140, 90],
    ],
    pillars: "M250 96 L250 298 M392 94 L392 298",
    stripe: "M392 212 L700 208",
    lamp: "M80 216 L100 216 L100 234 L80 234 Z M80 244 L104 244 M80 252 L104 252",
    tail: "M696 200 L704 200 L705 240 L697 240 Z",
    brake: "M692 196 L708 196 L709 244 L693 244 Z",
    rearWheel: 564,
    rearX: 704,
    heads: { y: 142, r: 15, xs: [296, 350, 434, 488, 580, 636] },
  },
};

/** The shared frame: every shape fits, front wheels in the same place. Width : height = 2.5 : 1. */
export const BUS_VIEWBOX = "20 36 744 298";
export const BUS_ASPECT = 298 / 744;
/** Where the back of each shape sits, as a share of the frame from the left: for smoke and speed lines. */
export const busRear = (shape: BusShape) => (820 - GEOMETRY[shape].rearX - 20) / 744;
/** The wheel's radius as a share of the frame's width, for turning it by the distance rolled. */
export const WHEEL_SHARE = 38 / 744;

export function Bus({
  shape,
  color,
  passengers = false,
  wheels,
  brake,
  fill,
}: {
  shape: BusShape;
  color: string;
  /** Draw heads in the windows, revealed by `fill`. */
  passengers?: boolean;
  wheels?: (el: SVGGElement | null, i: number) => void;
  brake?: (el: SVGPathElement | null) => void;
  /** The clip that reveals the passengers, front to back: the caller sets its width (0 to `rearX`). */
  fill?: (el: SVGRectElement | null) => void;
}) {
  const g = GEOMETRY[shape];
  const clip = useId();
  const dark = color === "#24262a";
  return (
    <svg viewBox={BUS_VIEWBOX} className="block h-full w-full overflow-visible" aria-hidden>
      <g transform="matrix(-1 0 0 1 820 0)">
        <path d={g.body} fill={color} stroke={dark ? "rgb(255 255 255 / 0.35)" : "rgb(0 0 0 / 0.35)"} strokeWidth="4" />
        <path d={g.body} fill="url(#hr-shade)" />
        <g fill="#141a22" stroke="rgb(255 255 255 / 0.18)" strokeWidth="2">
          <path d={g.windscreen} />
          {g.windows.map(([x, y, w, h]) => (
            <rect key={x} x={x} y={y} width={w} height={h} rx="7" />
          ))}
        </g>
        {passengers && (
          <>
            <clipPath id={clip}>
              <rect ref={fill} x="0" y="0" width="0" height="320" />
            </clipPath>
            <g clipPath={`url(#${clip})`} fill="rgb(240 220 190 / 0.55)">
              {g.heads.xs.map((x) => (
                <g key={x}>
                  <circle cx={x} cy={g.heads.y} r={g.heads.r} />
                  <rect
                    x={x - g.heads.r * 1.3}
                    y={g.heads.y + g.heads.r + 2}
                    width={g.heads.r * 2.6}
                    height={g.heads.r * 1.6}
                    rx={g.heads.r * 0.8}
                  />
                </g>
              ))}
            </g>
          </>
        )}
        <path d={g.pillars} stroke="rgb(0 0 0 / 0.3)" strokeWidth="3" />
        <path d={g.stripe} stroke="rgb(201 168 76 / 0.75)" strokeWidth="6" />
        <path d={g.lamp} fill="#fff4cf" stroke="#fff4cf" strokeWidth={shape === "square" ? 3 : 0} />
        <path d={g.tail} fill="#7a1a14" />
        <path ref={brake} d={g.brake} fill="#ff3b2f" opacity="0.15" style={{ filter: "drop-shadow(0 0 10px #ff3b2f)" }} />
      </g>
      {[176, g.rearWheel].map((x, i) => {
        const cx = 820 - x;
        return (
          <g key={x} ref={(el) => wheels?.(el, i)} style={{ transformBox: "fill-box", transformOrigin: "center" }}>
            <circle cx={cx} cy="286" r="38" fill="#0d0d0e" />
            <circle cx={cx} cy="286" r="18" fill="#9a9ea5" />
            <path d={`M${cx - 17} 286 H${cx + 17} M${cx} 269 V303`} stroke="#3a3c40" strokeWidth="5" />
          </g>
        );
      })}
    </svg>
  );
}

/** How far to open the passenger clip for a share of seats filled. */
export const passengerClip = (shape: BusShape, share: number) => Math.max(0, Math.min(1, share)) * GEOMETRY[shape].rearX;

/** The shade every bus shares. Render once per page that draws buses. */
export function BusDefs() {
  return (
    <svg width="0" height="0" className="absolute" aria-hidden>
      <defs>
        <linearGradient id="hr-shade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="rgb(0 0 0 / 0)" />
          <stop offset="1" stopColor="rgb(0 0 0 / 0.32)" />
        </linearGradient>
      </defs>
    </svg>
  );
}
