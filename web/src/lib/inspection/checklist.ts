/**
 * The Sabicars Verified inspection: every check, in the order an inspector
 * walks round a car.
 *
 * Keys are stored with each result, so a key never changes once reports exist.
 * Rename a label freely; to retire a check, leave its key here and mark it
 * `retired`, so old reports still read correctly. The owner's mechanic should
 * review this list; it is the standard the seal stands for.
 */

export type Result = "pass" | "attention" | "fail" | "na";

export const RESULT_LABEL: Record<Result, string> = {
  pass: "Good",
  attention: "Needs attention",
  fail: "Fault",
  na: "Not applicable",
};

export interface Check {
  key: string;
  label: string;
  /** Shown to the inspector only: what to look at, and what counts as a problem. */
  how?: string;
  retired?: boolean;
}

export interface Section {
  key: string;
  title: string;
  checks: Check[];
}

export const SECTIONS: Section[] = [
  {
    key: "papers",
    title: "Papers and identity",
    checks: [
      { key: "papers_customs", label: "Customs papers seen, with duty paid", how: "The original papers, not a photocopy. A car with no customs papers is a fault." },
      { key: "vin_matches_papers", label: "Chassis number on the car matches the customs papers", how: "Read it off the frame and compare every character." },
      { key: "vin_matches_plates", label: "Chassis number matches on the frame, door pillar and dashboard", how: "A mismatch or a tampered plate is a fault." },
      { key: "papers_registration", label: "Vehicle licence and number plates", how: "Not applicable for a foreign-used car not yet registered in Nigeria." },
      { key: "keys", label: "Keys handed over", how: "Write how many in the note. One key only is 'needs attention'." },
      { key: "service_history", label: "Service records", how: "Not applicable when none came with the car." },
    ],
  },
  {
    key: "body",
    title: "Body and paint",
    checks: [
      { key: "body_panels", label: "Panel gaps even; doors, bonnet and boot align", how: "Uneven gaps usually mean a repaired accident." },
      { key: "body_paint", label: "Paint matches; no sign of a respray hiding repairs", how: "Look along each panel in daylight, and for overspray on rubber seals." },
      { key: "body_dents", label: "Dents and scratches", how: "Photograph anything a buyer would notice." },
      { key: "body_rust", label: "No rust on the body, sills or wheel arches" },
      { key: "body_glass", label: "Windscreen and windows free of cracks" },
      { key: "body_lights", label: "Headlights, indicators, brake and reverse lights work" },
      { key: "body_mirrors", label: "Mirrors intact and adjusting" },
      { key: "body_bumpers", label: "Bumpers, grille and their mounts secure" },
    ],
  },
  {
    key: "structure",
    title: "Accident and flood signs",
    checks: [
      { key: "struct_chassis", label: "Chassis rails and crumple zones straight, with no repair welds", how: "Look under the bonnet and the boot floor, and under the car." },
      { key: "struct_pillars", label: "Door pillars and roof line undamaged" },
      { key: "flood_carpet", label: "No damp, silt or water marks under the carpets and seats", how: "Lift the carpet edge in the footwells and the boot." },
      { key: "flood_rust", label: "No rust on seat rails, pedal bolts or under the dashboard", how: "Rust inside the cabin is the surest sign of a flooded car." },
      { key: "flood_smell", label: "No damp or mould smell" },
      { key: "airbags", label: "Airbag light comes on at start, then goes off" },
    ],
  },
  {
    key: "engine",
    title: "Engine",
    checks: [
      { key: "eng_oil", label: "Engine oil level and condition", how: "Milky oil is a fault." },
      { key: "eng_coolant", label: "Coolant level, with no oil in it" },
      { key: "eng_leaks", label: "No oil, coolant or fuel leaks" },
      { key: "eng_belts", label: "Belts and hoses free of cracks" },
      { key: "eng_battery", label: "Battery holds charge; terminals clean" },
      { key: "eng_cold_start", label: "Starts from cold without hesitation", how: "Feel the bonnet first: a warmed-up engine hides problems." },
      { key: "eng_smoke", label: "No blue, white or black smoke from the exhaust" },
      { key: "eng_idle", label: "Idles smoothly, with no knock or misfire" },
      { key: "eng_warning", label: "No engine warning lights on the dashboard" },
      { key: "eng_mounts", label: "Engine and gearbox mounts firm" },
    ],
  },
  {
    key: "drive",
    title: "Gearbox and drive",
    checks: [
      { key: "gear_shift", label: "Gear changes smooth, with no slipping or delay" },
      { key: "gear_clutch", label: "Clutch bites cleanly", how: "Not applicable on an automatic." },
      { key: "gear_4wd", label: "Four-wheel drive engages", how: "Not applicable on a two-wheel-drive car." },
      { key: "drive_cv", label: "No clicks from the CV joints; boots not torn" },
      { key: "drive_diff", label: "No leaks from the differential or transfer case" },
    ],
  },
  {
    key: "chassis",
    title: "Steering, brakes and tyres",
    checks: [
      { key: "steer_play", label: "Steering without play, noise or pull" },
      { key: "susp_shocks", label: "Shock absorbers and springs: no bounce or knock" },
      { key: "susp_bushes", label: "Suspension bushes and joints sound" },
      { key: "brake_pads", label: "Brake pads and discs", how: "Write the remaining pad thickness in the note." },
      { key: "brake_hand", label: "Handbrake holds on a slope" },
      { key: "brake_abs", label: "ABS light comes on at start, then goes off" },
      { key: "tyres_tread", label: "Tyre tread, all four", how: "Write the depths in the note. Under 3mm is 'needs attention'." },
      { key: "tyres_age", label: "Tyre age, all four", how: "From the DOT date on the sidewall. Over six years old is 'needs attention'." },
      { key: "tyres_spare", label: "Spare wheel, jack and wheel spanner" },
    ],
  },
  {
    key: "cabin",
    title: "Cabin and electrics",
    checks: [
      { key: "cab_ac", label: "Air conditioning blows cold" },
      { key: "cab_dash", label: "Gauges and warning lights work" },
      { key: "cab_windows", label: "Power windows, door locks and central locking" },
      { key: "cab_seats", label: "Seats, adjusters and seat belts" },
      { key: "cab_screen", label: "Screen, radio and speakers" },
      { key: "cab_camera", label: "Reverse camera and parking sensors", how: "Not applicable when not fitted." },
      { key: "cab_wipers", label: "Wipers and washers" },
      { key: "cab_horn", label: "Horn" },
      { key: "cab_lights", label: "Interior lights" },
      { key: "cab_upholstery", label: "Upholstery and headlining" },
      { key: "cab_odometer", label: "Wear on pedals, wheel and seats fits the odometer reading", how: "Heavy wear on a low reading suggests the odometer was wound back." },
    ],
  },
  {
    key: "road",
    title: "Road test",
    checks: [
      { key: "road_pull", label: "Accelerates cleanly, without hesitation" },
      { key: "road_brake", label: "Brakes straight, without judder" },
      { key: "road_vibration", label: "No vibration at speed" },
      { key: "road_noise", label: "No unusual noise from the engine, gearbox or suspension" },
      { key: "road_temp", label: "Engine temperature stays normal" },
    ],
  },
];

export const CHECKS: Check[] = SECTIONS.flatMap((s) => s.checks.filter((c) => !c.retired));
const BY_KEY = new Map(SECTIONS.flatMap((s) => s.checks.map((c) => [c.key, c] as const)));

export const checkFor = (key: string): Check | undefined => BY_KEY.get(key);

export interface ItemResult {
  result: Result;
  note?: string;
  photo?: { url: string; publicId: string };
}

export type Items = Record<string, ItemResult>;

/** A report older than this keeps its page but no longer earns the Verified badge: tyres, brakes and batteries change. */
export const FRESH_DAYS = 120;

export const isFresh = (inspectedAt: Date, now = new Date()) => now.getTime() - inspectedAt.getTime() <= FRESH_DAYS * 86_400_000;

export interface Tally {
  total: number;
  pass: number;
  attention: number;
  fail: number;
  na: number;
}

export function tally(items: Items): Tally {
  const t: Tally = { total: 0, pass: 0, attention: 0, fail: 0, na: 0 };
  for (const c of CHECKS) {
    const r = items[c.key]?.result;
    if (!r) continue;
    t.total++;
    t[r]++;
  }
  return t;
}

/**
 * What still stops a report from being published, in words the inspector can
 * act on. Every check needs a result, and every problem needs a note and a
 * photograph: a finding without evidence is only an opinion.
 */
export function publishProblems(
  items: Items,
  header: { inspectedAt: Date | null; inspectorName: string | null; odometerKm: number | null },
  now = new Date(),
): string[] {
  const out: string[] = [];
  if (!header.inspectedAt) out.push("Enter the date of the inspection.");
  else if (header.inspectedAt.getTime() > now.getTime() + 86_400_000) out.push("The inspection date is in the future.");
  if (!header.inspectorName?.trim()) out.push("Enter who inspected the car.");
  if (header.odometerKm === null) out.push("Enter the odometer reading.");
  const missing = CHECKS.filter((c) => !items[c.key]?.result);
  if (missing.length) out.push(`${missing.length} check${missing.length === 1 ? " has" : "s have"} no result yet.`);
  for (const c of CHECKS) {
    const it = items[c.key];
    if (it && (it.result === "attention" || it.result === "fail")) {
      if (!it.note?.trim()) out.push(`"${c.label}" needs a note saying what was found.`);
      if (!it.photo) out.push(`"${c.label}" needs a photo.`);
    }
  }
  return out;
}

/** Public codes avoid characters that are misread on a windscreen sticker: no 0/O, 1/I/L. */
export const CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
export const CODE_PATTERN = /^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{6}$/;

/** The chassis number with its last four characters hidden, as shown in public. */
export function maskVin(vin: string): string {
  const v = vin.trim();
  return v.length <= 4 ? "••••" : `${v.slice(0, -4)}••••`;
}
