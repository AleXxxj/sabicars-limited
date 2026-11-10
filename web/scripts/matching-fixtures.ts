/**
 * The cars and wants the Sourcing Desk's matching rule is proved on, shared
 * by scripts/verify-matching.ts (the rule, at every build) and
 * scripts/verify-matching-sql.mts (the SQL twin, against a database). Real
 * stock names (RX 350L, AMG G 63, GLC 300 4MATIC (X253 generation), Prado
 * GRJ150L) and the near misses that went wrong or could. Plain data.
 */
import type { MatchableVehicle } from "../src/lib/matching";

export type FixtureCar = MatchableVehicle & { body: string | null; fuel: string | null; transmission: string | null; priceMinor: number | null };

export const car = (
  make: string,
  model: string,
  year: number,
  body: string | null,
  fuel: string | null = "petrol",
  transmission: string | null = "automatic",
  priceMinor: number | null = 2_400_000_000,
): FixtureCar => ({ make, model, year, body, fuel, transmission, priceMinor });

export const FIXTURES = {
  hummer1: car("Toyota", "Hiace Hummer 1", 2013, "bus"),
  hummer2: car("Toyota", "Hiace Hummer 2", 2019, "bus"),
  hummer2Diesel: car("Toyota", "Hiace Hummer 2", 2016, "bus", "diesel", "manual"),
  hummer3: car("Toyota", "Hiace Hummer 3", 2016, "bus"),
  hummer20: car("Toyota", "Hiace Hummer 20", 2016, "bus"),
  humer2: car("Toyota", "Hiace Humer 2", 2015, "bus"),
  xh10: car("Toyota", "Hiace XH10", 2010, "bus"),
  camry: car("Toyota", "Camry SE", 2014, "sedan"),
  highlanderXle: car("Toyota", "Highlander XLE", 2016, "suv"),
  gle350: car("Mercedes-Benz", "GLE 350", 2016, "suv"),
  gle450: car("Mercedes-Benz", "GLE 450 4MATIC", 2024, "suv"),
  gle43: car("Mercedes-Benz", "AMG GLE 43 Coupe 4MATIC (C292)", 2019, "suv"),
  glc300: car("Mercedes-Benz", "GLC 300 4MATIC (X253 generation)", 2017, "suv"),
  c300: car("Mercedes-Benz", "C 300", 2018, "sedan"),
  c300joined: car("Mercedes-Benz", "C300", 2018, "sedan"),
  e350: car("Mercedes-Benz", "E 350", 2017, "sedan"),
  g63: car("Mercedes-Benz", "AMG G 63", 2021, "suv"),
  rx350: car("Lexus", "RX 350", 2017, "suv"),
  rx350l: car("Lexus", "RX 350L", 2019, "suv"),
  rx350f: car("Lexus", "RX 350 F SPORT", 2018, "suv"),
  rx450h: car("Lexus", "RX 450h", 2018, "suv", "hybrid"),
  es350: car("Lexus", "ES 350", 2019, "sedan"),
  is250: car("Lexus", "IS 250 AWD", 2014, "sedan"),
  prado: car("Toyota", "Land Cruiser Prado GRJ150L", 2015, "suv"),
  lcv8: car("Toyota", "Land Cruiser V8", 2014, "suv"),
  hilux: car("Toyota", "Hilux", 2016, "pickup", "diesel", "manual"),
  x5: car("BMW", "X5", 2016, "suv"),
  x5m: car("BMW", "X5 M", 2017, "suv"),
  x3: car("BMW", "X3", 2016, "suv"),
  runner: car("Toyota", "4Runner Limited", 2016, "suv"),
  escalade: car("Cadillac", "Escalade 5th Generation", 2021, "suv"),
  santaFe: car("Hyundai", "Santa Fe Sport", 2016, "suv"),
  gx550: car("Lexus", "GX 550", 2024, "suv"),
  fl7: car("Volvo", "FL7", 2008, "truck", "diesel", "manual"),
  man: car("MAN", "TGA 26.414", 2009, "truck", "diesel", "manual"),
  noFuel: car("Toyota", "Hiace Hummer 2", 2014, "bus", null, null),
  noPrice: car("Toyota", "Hiace Hummer 2", 2019, "bus", "petrol", "automatic", null),
};

/** Wants the SQL twin is compared on: every phrasing the rule checks, plus the site's own pre-filled ones. */
export const WANTS = [
  "Toyota Hiace Hummer 2", "Hummer 2", "Toyota Hiace Hummer bus", "Toyota Hiace Hummer bus, diesel manual", "Hiace bus", "Humer 1",
  "Hummer 2 diesel manual", "Hummer 3 from 2015 under 30000000", "Hummer 2 2.5D", "Lexus RX 350", "RX350", "Lexus RX 350 F Sport",
  "ES 350", "Lexus ES", "350", "E 350", "Mercedes C 300", "Mercedes C300", "Mercedes C class", "Mercedes C-Class", "Benz A-Class",
  "Mercedes G-Wagon", "G wagon", "Benz G63", "GLE 350", "Mercedes benz GLE", "Mercedez Benz GLE 350", "GLE 350,450", "GL 450",
  "GLC 300 4matic", "X5M", "BMW X5", "Merc", "Benz", "Toyota Prado", "Toyota Landcruiser Prado", "Land Cruiser V8", "Honda CR-V",
  "Camry 2.4 under ₦20m, 08", "Camry 20-25m", "Camry n 20m", "Camry under 20 m", "Camry 20mill", "Camry 12 model", "Camry 1.8T",
  "Highlander 20,000,000 or 25 million", "Highlander hybrid", "Toyota saloon", "Toyota bus", "Lexus SUV", "Lexus jeep", "Truck",
  "SUV", "Toyota pick-up", "Hilux 4x4", "Volvo FL7 truck", "MAN TGA 26.414", "Hyundai Santa Fe", "Lexus GX 460", "Toyota 4runner",
  "Toyota Highlander", "Mercedes-Benz GLE", "toyota", "a clean tokunbo car",
];
