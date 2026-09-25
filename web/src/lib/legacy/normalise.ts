/**
 * Turns a vehicle record from the legacy Mongo API into a clean row for the
 * new schema, plus a list of everything a person should look at.
 *
 * The legacy admin was all free-text boxes, so the data is what free-text
 * boxes produce: "Toyota Hiace" typed as the make, "31,000,000Z" as a price,
 * a gearbox in the drivetrain field, "White,Black" as the number of seats.
 *
 * The rule here is: fix what has exactly one sensible reading, and report
 * everything else rather than guess. A wrong guess silently published on the
 * website is worse than a blank field a salesperson is asked to fill in.
 */

export interface LegacyCar {
  _id: string;
  make?: string;
  model?: string;
  year?: string | number;
  category?: string;
  condition?: string;
  bodyType?: string;
  mileage?: string;
  fuel?: string;
  colour?: string;
  price?: string;
  tag?: string;
  description?: string;
  engine?: string;
  horsepower?: string;
  transmission?: string;
  drivetrain?: string;
  interiorColor?: string;
  seats?: string;
  features?: string[];
  images?: string[];
  available?: boolean;
  featured?: boolean;
  showInHero?: boolean;
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

export type Body = "sedan" | "suv" | "bus" | "van" | "pickup" | "truck" | "coupe" | "hatchback" | "wagon" | "convertible" | "other";
export type Segment = "standard" | "luxury" | "commercial";

export interface CleanVehicle {
  legacyId: string;
  make: string;
  model: string;
  year: number | null;
  body: Body | null;
  segment: Segment;
  condition: "foreign_used" | "nigerian_used" | "brand_new";
  mileageKm: number | null;
  fuel: "petrol" | "diesel" | "hybrid" | "electric" | "cng" | "other" | null;
  transmission: "automatic" | "manual" | "other" | null;
  transmissionDetail: string | null;
  drivetrain: "fwd" | "rwd" | "awd" | "4wd" | null;
  engine: string | null;
  horsepower: number | null;
  exteriorColour: string | null;
  interiorColour: string | null;
  seats: number | null;
  priceMinor: number | null;
  status: "available" | "sold";
  badge: "hot" | "premium" | "fleet_supply" | null;
  isFeatured: boolean;
  inHero: boolean;
  description: string | null;
  features: string[];
  images: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Normalised {
  vehicle: CleanVehicle;
  /** Things a person should check, in plain language, one per line. */
  warnings: string[];
  /** Changes made that a person may want to know about. */
  fixes: string[];
}

/** Collapse runs of whitespace and trim. "  6-Speed  Automatic " -> "6-Speed Automatic". */
export function tidy(v: unknown): string {
  return typeof v === "string" ? v.replace(/\s+/g, " ").trim() : "";
}

/**
 * Marques as they should be written. Keyed by lower-case, space-free form so
 * "lexus", "LEXUS", "Mercedes Benz" and "mercedes-benz" all land in one place.
 */
const MARQUES: Record<string, string> = {
  acura: "Acura", audi: "Audi", bentley: "Bentley", bmw: "BMW", cadillac: "Cadillac",
  changan: "Changan", chevrolet: "Chevrolet", ford: "Ford", gmc: "GMC", honda: "Honda",
  hummer: "Hummer", hyundai: "Hyundai", infiniti: "Infiniti", isuzu: "Isuzu", iveco: "Iveco",
  jeep: "Jeep", kia: "Kia", landrover: "Land Rover", rangerover: "Land Rover", lexus: "Lexus",
  mack: "Mack", man: "MAN", mazda: "Mazda", mercedes: "Mercedes-Benz", mercedesbenz: "Mercedes-Benz",
  mitsubishi: "Mitsubishi", nissan: "Nissan", peugeot: "Peugeot", porsche: "Porsche",
  rollsroyce: "Rolls-Royce", suzuki: "Suzuki", toyota: "Toyota", volkswagen: "Volkswagen",
  vw: "Volkswagen", volvo: "Volvo",
};

/** Marques that place a vehicle in the luxury segment whatever the legacy category said. */
const LUXURY_MARQUES = new Set(["Bentley", "BMW", "Cadillac", "Land Rover", "Lexus", "Mercedes-Benz", "Porsche", "Rolls-Royce"]);

/** Words that describe a vehicle's shape, not its model, when typed after a marque. */
const GENERIC_WORDS = new Set(["truck", "trucks", "bus", "car", "suv", "van"]);

const key = (s: string) => s.toLowerCase().replace(/[\s-]+/g, "");

/**
 * Split "Toyota Land Cruiser Prado" typed as a make into the marque and the
 * model words, and recognise "Mercedes-AMG" as Mercedes-Benz's AMG line.
 */
function splitMake(rawMake: string, rawModel: string, fixes: string[], warnings: string[]) {
  const make = tidy(rawMake);
  let model = tidy(rawModel);

  if (key(make) === "mercedesamg") {
    if (!/\bamg\b/i.test(model)) model = `AMG ${model}`;
    fixes.push(`Make "${make}" recorded as Mercedes-Benz, with AMG in the model.`);
    return { make: "Mercedes-Benz", model };
  }

  const words = make.split(" ");
  // Longest prefix of the typed make that is a known marque: "Land Rover", "Mercedes Benz", "Toyota".
  for (let n = Math.min(words.length, 3); n >= 1; n--) {
    const canonical = MARQUES[key(words.slice(0, n).join(" "))];
    if (!canonical) continue;
    const rest = words.slice(n).filter((w) => !GENERIC_WORDS.has(w.toLowerCase())).join(" ");
    if (rest && !model.toLowerCase().includes(rest.toLowerCase())) model = `${rest} ${model}`.trim();
    if (canonical !== make) {
      fixes.push(
        rest
          ? `Make "${make}" split into make "${canonical}" and model "${model}".`
          : `Make "${make}" written as "${canonical}".`,
      );
    }
    return { make: canonical, model };
  }

  warnings.push(`Unrecognised make "${make}" — kept as typed; check the spelling.`);
  return { make, model };
}

/** Lexus codes: "Gx460" -> "GX 460", "RX350L" -> "RX 350L". Only for Lexus, where the pattern is certain. */
function tidyModel(make: string, model: string): string {
  if (make !== "Lexus") return model;
  return model.replace(/^([a-z]{2})\s?(\d{3}[a-z]?)\b/i, (_, letters: string, num: string) => `${letters.toUpperCase()} ${num.toUpperCase()}`);
}

const BODY_WORDS: Record<string, Body> = {
  sedan: "sedan", saloon: "sedan", suv: "suv", jeep: "suv", bus: "bus", minibus: "bus",
  van: "van", pickup: "pickup", "pick-up": "pickup", truck: "truck", tipper: "truck",
  coupe: "coupe", hatchback: "hatchback", wagon: "wagon", convertible: "convertible",
};

/** "31,000,000Z" -> kobo, with a warning about the Z. No digits at all -> price on request. */
export function parseNaira(raw: unknown, warnings: string[]): number | null {
  const text = tidy(String(raw ?? ""));
  const digits = text.replace(/[^\d]/g, "");
  if (!digits) {
    if (text) warnings.push(`Price "${text}" has no figure — published as "price on request".`);
    return null;
  }
  const stray = text.replace(/[\d,.\s₦]/g, "").replace(/^(ngn|naira|n)$/i, "");
  if (stray) warnings.push(`Price "${text}" had stray characters "${stray}" — read as ₦${Number(digits).toLocaleString("en-NG")}.`);
  const naira = Number(digits);
  if (naira < 100_000) warnings.push(`Price ₦${naira.toLocaleString("en-NG")} looks too low for a vehicle — check it.`);
  return naira * 100;
}

function firstInt(raw: unknown): number | null {
  const m = tidy(String(raw ?? "")).replace(/,/g, "").match(/\d+/);
  return m ? Number(m[0]) : null;
}

export function normaliseLegacyCar(car: LegacyCar): Normalised {
  const warnings: string[] = [];
  const fixes: string[] = [];

  const split = splitMake(car.make ?? "", car.model ?? "", fixes, warnings);
  const make = split.make;
  const model = tidyModel(make, split.model);
  if (model !== split.model) fixes.push(`Model "${split.model}" written as "${model}".`);
  if (/\bhumer\b/i.test(model)) {
    warnings.push(`Model "${model}" — the market name is usually spelled "Hummer"; confirm which Sabicars wants published.`);
  }
  if (/\b(old model|short|long)\b/i.test(model) && model.split(" ").length > 3) {
    warnings.push(`Model "${model}" reads like a description — give it a model name and move the rest to the description.`);
  }

  const yearNum = firstInt(car.year);
  const year = yearNum && yearNum >= 1950 && yearNum <= 2100 ? yearNum : null;
  if (!year) warnings.push(`Year "${tidy(String(car.year ?? ""))}" is not a valid year.`);

  // Shape: the explicit body type first, then what the legacy category implies.
  const bodyTyped = tidy(car.bodyType).toLowerCase();
  const category = tidy(car.category).toLowerCase();
  let body: Body | null = BODY_WORDS[bodyTyped] ?? null;
  if (!body && ["suv", "bus", "truck"].includes(category)) body = BODY_WORDS[category];
  if (!body) warnings.push(`Body type not recorded — choose sedan, SUV, bus, truck…`);

  let segment: Segment = "standard";
  if (body === "bus" || body === "truck" || category === "bus" || category === "truck") segment = "commercial";
  else if (category === "luxury" || LUXURY_MARQUES.has(make)) segment = "luxury";

  const condition =
    car.condition === "brand-new" ? "brand_new" : car.condition === "nigeria-used" ? "nigerian_used" : "foreign_used";
  // "Brand new" on a car several model years old is almost always a slip of
  // the dropdown — and it is a claim a buyer can hold the dealer to.
  // Two model years of grace: unsold new stock from last year is normal.
  if (condition === "brand_new" && year && year < new Date(car.createdAt ?? Date.now()).getFullYear() - 2) {
    warnings.push(`Marked "brand new" but it is a ${year} model — check the condition.`);
  }

  const fuelText = tidy(car.fuel).toLowerCase();
  const fuel =
    fuelText.includes("petrol") || fuelText === "gasoline" ? "petrol"
    : fuelText.includes("diesel") ? "diesel"
    : fuelText.includes("hybrid") ? "hybrid"
    : fuelText.includes("electric") ? "electric"
    : fuelText.includes("cng") || fuelText.includes("gas") ? "cng"
    : null;
  if (fuelText && !fuel) warnings.push(`Fuel "${tidy(car.fuel)}" is not a fuel type — left blank.`);

  const tx = tidy(car.transmission);
  const txLower = tx.toLowerCase();
  const transmission = txLower.includes("manual")
    ? "manual"
    : /automatic|tronic|cvt|dct|dsg|tiptronic|speed/.test(txLower)
      ? "automatic"
      : null;
  // Keep the marketing name ("9G-TRONIC 9-speed") when it says more than the bare type.
  const transmissionDetail = tx && !/^(automatic|manual)$/i.test(tx) ? tx : null;

  const dt = tidy(car.drivetrain).toLowerCase();
  let drivetrain: CleanVehicle["drivetrain"] = null;
  if (/\b(4wd|4x4|four.?wheel)|full.?time/.test(dt)) drivetrain = "4wd";
  else if (/\bawd\b|all.?wheel|4matic/.test(dt)) drivetrain = "awd";
  else if (/\bfwd\b|front/.test(dt)) drivetrain = "fwd";
  else if (/\brwd\b|rear|rare wheel/.test(dt)) drivetrain = "rwd";
  if (dt && !drivetrain) {
    warnings.push(
      /tronic|speed|automatic|manual/.test(dt)
        ? `Drivetrain field contains a gearbox ("${tidy(car.drivetrain)}") — choose FWD, RWD, AWD or 4WD.`
        : `Drivetrain "${tidy(car.drivetrain)}" not recognised — left blank.`,
    );
  }

  const seatsText = tidy(car.seats);
  let seats = firstInt(seatsText);
  if (seatsText && seats === null) warnings.push(`Seats "${seatsText}" is not a number (it looks like a colour) — left blank.`);
  if (/\d\s*,\s*\d/.test(seatsText)) {
    const all = seatsText.match(/\d+/g)!.map(Number);
    seats = Math.max(...all);
    warnings.push(`Seats "${seatsText}" lists several figures — recorded as ${seats}; confirm.`);
  }
  if (seats !== null && (seats < 1 || seats > 80)) {
    warnings.push(`Seats "${seatsText}" is out of range — left blank.`);
    seats = null;
  }

  const mileageKm = firstInt(car.mileage);
  const hp = firstInt(car.horsepower);
  const horsepower = hp !== null && hp >= 20 && hp <= 2500 ? hp : null;

  const badge = car.tag === "hot" ? "hot" : car.tag === "premium" ? "premium" : car.tag === "supply" ? "fleet_supply" : null;

  const features = [...new Set((car.features ?? []).map(tidy).filter(Boolean))];

  const images = (car.images ?? []).map(tidy).filter(Boolean).map((u) => u.replace(/^http:\/\//, "https://"));
  if (!images.length) warnings.push(`No photos — the listing will show the "photos coming soon" card.`);

  const priceMinor = parseNaira(car.price, warnings);

  const description = tidy(car.description) || null;
  if (!description) warnings.push(`No description.`);

  return {
    vehicle: {
      legacyId: String(car._id),
      make,
      model,
      year,
      body,
      segment,
      condition,
      mileageKm,
      fuel,
      transmission,
      transmissionDetail,
      drivetrain,
      engine: tidy(car.engine) || null,
      horsepower,
      exteriorColour: tidy(car.colour) || null,
      interiorColour: tidy(car.interiorColor) || null,
      seats,
      priceMinor,
      status: car.available === false ? "sold" : "available",
      badge,
      isFeatured: Boolean(car.featured),
      inHero: Boolean(car.showInHero),
      description,
      features,
      images,
      createdAt: new Date(car.createdAt ?? Date.now()),
      updatedAt: new Date(car.updatedAt ?? car.createdAt ?? Date.now()),
    },
    warnings,
    fixes,
  };
}

/** "2014 Toyota Land Cruiser Prado" -> "2014-toyota-land-cruiser-prado". */
export function slugify(...parts: (string | number | null | undefined)[]): string {
  return parts
    .filter((p) => p !== null && p !== undefined && String(p).trim() !== "")
    .join(" ")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
