#!/usr/bin/env tsx
/**
 * The Sourcing Desk's matching rule (src/lib/matching.ts), proved on the
 * cases that went wrong or could: a request for a Hummer 2 must not call a
 * Hummer 1 or 3 a match (audit, 9 November 2026); a want that is only a
 * number names no car; a class letter is a version (a GLC is not a C-Class,
 * and a chassis code in brackets is not a class letter); body words are a
 * filter ("Toyota saloon" is the Camry, never a bus); fuel and gearbox words
 * make another fuel or gearbox only "close"; the site's own pre-filled wants
 * find the right cars; amounts, years, engine sizes and seat counts are not
 * versions; the real stock's names read right; the year and budget limits
 * hold. Part of `npm run build`: a wrong rule never ships. The SQL twin is
 * proved against a database by scripts/verify-matching-sql.mts.
 */
import { matchLevel, satisfies, wantWords } from "../src/lib/matching";
import { car, FIXTURES as F } from "./matching-fixtures";

const ask = (want: string, yearFrom: number | null = null, budgetMaxMinor: number | null = null) => ({ want, yearFrom, budgetMaxMinor });

const checks: [string, unknown, unknown][] = [
  // reading the want
  ["words: amounts, years and filler go, the version stays", wantWords("Toyota Hiace Hummer 2 from 2015 under 30000000"), ["toyota", "hiace", "hummer", "2"]],
  ["words: engine size, ₦ amount and two-digit year go", wantWords("Camry 2.4 under ₦20m, 08"), ["camry"]],
  ["words: 20,000,000 and 25 million go", wantWords("Highlander 20,000,000 or 25 million"), ["highlander"]],
  ["words: seats, body, fuel and gearbox leave the name", wantWords("Hiace 18 seater bus, diesel manual"), ["hiace"]],
  ["words: noise goes", wantWords("a clean tokunbo Camry"), ["camry"]],
  ["words: C300 is read as c 300", wantWords("Mercedes C300"), ["mercedes", "c", "300"]],
  ["words: G wagon is the G-Class", wantWords("Mercedes G-Wagon"), ["mercedes", "g"]],
  ["words: A-Class keeps its letter", wantWords("Benz A-Class"), ["benz", "a"]],
  ["words: X5M keeps its 5", wantWords("X5M"), ["x", "5", "m"]],
  ["words: ranges, spaced amounts, 'mill' and 'model' go", ["Camry 20-25m", "Camry n 20m", "Camry under 20 m", "Camry 20mill", "Camry 12 model", "Camry 1.8T"].map(wantWords), [["camry"], ["camry"], ["camry"], ["camry"], ["camry"], ["camry"]]],
  ["words: a truck code is kept", wantWords("MAN TGA 26.414"), ["man", "tga", "26", "414"]],
  // the audit's case
  ["Hummer 2 asked, Hummer 2 in stock: exact", matchLevel(F.hummer2, ask("Toyota Hiace Hummer 2")), "exact"],
  ["Hummer 2 asked, Hummer 1 in stock: close, not a match", matchLevel(F.hummer1, ask("Toyota Hiace Hummer 2")), "close"],
  ["Hummer 2 asked, Hummer 3 in stock: close", matchLevel(F.hummer3, ask("Toyota Hiace Hummer 2")), "close"],
  ["Hummer 2 asked, Hummer 20 in stock: the 2 must stand alone", matchLevel(F.hummer20, ask("Hummer 2")), "close"],
  ["Hummer 2 asked, a Hiace XH10: nothing (the buyer named the Hummer)", matchLevel(F.xh10, ask("Toyota Hiace Hummer 2")), null],
  ["Hummer 2 asked, Camry in stock: nothing", matchLevel(F.camry, ask("Toyota Hiace Hummer 2")), null],
  ["'Humer' in a listing reads as Hummer", matchLevel(F.humer2, ask("Hummer 2")), "exact"],
  ["'Hummer 2 2.5D': the engine size is not a version", matchLevel(F.hummer2, ask("Hummer 2 2.5D")), "exact"],
  // body, fuel and gearbox
  ["the Hummer page's 'Toyota Hiace Hummer bus' finds every Hummer", [F.hummer1, F.hummer2, F.hummer3].map((v) => matchLevel(v, ask("Toyota Hiace Hummer bus"))), ["exact", "exact", "exact"]],
  ["'Hummer bus, diesel manual': a diesel manual Hummer is exact, a petrol automatic one close", [matchLevel(F.hummer2Diesel, ask("Toyota Hiace Hummer bus, diesel manual")), matchLevel(F.hummer2, ask("Toyota Hiace Hummer bus, diesel manual"))], ["exact", "close"]],
  ["a listing with no fuel or gearbox recorded is not ruled out by them", matchLevel(F.noFuel, ask("Hummer 2 diesel manual")), "exact"],
  ["the placeholder's 'Hiace bus' finds every Hiace", [F.hummer1, F.xh10].map((v) => matchLevel(v, ask("Hiace bus"))), ["exact", "exact"]],
  ["'Toyota saloon' is the Camry, never a bus or an SUV", [F.camry, F.hummer2, F.highlanderXle].map((v) => matchLevel(v, ask("Toyota saloon"))), ["exact", null, null]],
  ["'Toyota bus' is never the Camry", [matchLevel(F.camry, ask("Toyota bus")), matchLevel(F.hummer1, ask("Toyota bus"))], [null, "exact"]],
  ["'Lexus SUV' is the RX, never the ES or IS saloons", [F.rx350, F.es350, F.is250].map((v) => matchLevel(v, ask("Lexus SUV"))), ["exact", null, null]],
  ["'Lexus jeep' is an SUV too", matchLevel(F.es350, ask("Lexus jeep")), null],
  ["'Truck' alone finds a truck, not a bus", [matchLevel(F.fl7, ask("Truck")), matchLevel(F.hummer1, ask("Truck"))], ["exact", null]],
  ["'SUV' alone finds an SUV, not a saloon", [matchLevel(F.rx350, ask("SUV")), matchLevel(F.camry, ask("SUV"))], ["exact", null]],
  ["'Highlander hybrid': the petrol Highlander is close; the hybrid RX is not a Highlander", [matchLevel(F.highlanderXle, ask("Highlander hybrid")), matchLevel(F.rx450h, ask("Highlander hybrid"))], ["close", null]],
  // numbers and letters alone
  ["a number alone names no car", matchLevel(F.gle350, ask("350")), null],
  ["E 350 asked, GLE 350 in stock: nothing (the E must stand alone)", matchLevel(F.gle350, ask("E 350")), null],
  ["E 350 asked, E 350 in stock: exact", matchLevel(F.e350, ask("E 350")), "exact"],
  ["Mercedes C 300 asked, GLC 300 in stock: nothing", matchLevel(F.glc300, ask("Mercedes C 300")), null],
  ["Mercedes C 300 asked, C300 in stock: exact", matchLevel(F.c300joined, ask("Mercedes C 300")), "exact"],
  ["Mercedes C 300 asked, GLE 350: nothing (only the make was named)", matchLevel(F.gle350, ask("Mercedes C 300")), null],
  ["'Mercedes C class' asked, GLE 43 Coupe (C292): nothing (a chassis code is not a class)", matchLevel(F.gle43, ask("Mercedes C class")), null],
  ["'Mercedes C class' asked, a C 300: exact", matchLevel(F.c300, ask("Mercedes C-Class")), "exact"],
  ["'Benz A-Class' asked: no Mercedes in stock answers it", [F.gle350, F.g63, F.c300].map((v) => matchLevel(v, ask("Benz A-Class"))), [null, null, null]],
  ["G wagon asked, AMG G 63 in stock: exact", matchLevel(F.g63, ask("G wagon")), "exact"],
  ["G63 asked, AMG G 63 in stock: exact", matchLevel(F.g63, ask("Benz G63")), "exact"],
  ["X5M asked: the X5 M exact, the GLC (X253) nothing", [matchLevel(F.x5m, ask("BMW X5M")), matchLevel(F.glc300, ask("X5M"))], ["exact", null]],
  // trims and the real stock's names
  ["GLE 350 asked, GLE 350 in stock: exact", matchLevel(F.gle350, ask("Mercedes benz GLE 350")), "exact"],
  ["'Mercedez Benz GLE 350' (a common spelling): exact", matchLevel(F.gle350, ask("Mercedez Benz GLE 350")), "exact"],
  ["GLE 350 asked, AMG GLE 43: close", matchLevel(F.gle43, ask("Mercedes benz GLE 350")), "close"],
  ["GLE 350 asked, GLC 300: nothing", matchLevel(F.glc300, ask("Mercedes benz GLE 350")), null],
  ["'GLE 350,450' names two models: each is close, neither exact", [matchLevel(F.gle350, ask("GLE 350,450")), matchLevel(F.gle450, ask("GLE 350,450"))], ["close", "close"]],
  ["'GL 450' is not a GLE 450", matchLevel(F.gle450, ask("GL 450")), null],
  ["GLC 300 4MATIC asked, GLC 300 4MATIC (X253) in stock: exact", matchLevel(F.glc300, ask("GLC 300 4matic")), "exact"],
  ["RX 350 asked, RX 350L in stock: exact", matchLevel(F.rx350l, ask("Lexus RX 350")), "exact"],
  ["RX 350 asked, RX 450h in stock: close", matchLevel(F.rx450h, ask("Lexus RX 350")), "close"],
  ["ES 350 asked, GLE 350 (es inside mercedes): nothing", matchLevel(F.gle350, ask("ES 350")), null],
  ["ES 350 asked, ES 350 in stock: exact", matchLevel(F.es350, ask("ES 350")), "exact"],
  ["ES 350 asked, a Cadillac Escalade: nothing (two letters must be the whole word)", matchLevel(F.escalade, ask("ES 350")), null],
  ["Lexus ES asked, an Escalade: nothing; the ES: exact", [matchLevel(F.escalade, ask("Lexus ES")), matchLevel(F.es350, ask("Lexus ES"))], [null, "exact"]],
  ["'CR-V' is not a Land Cruiser", matchLevel(F.prado, ask("Honda CR-V")), null],
  ["Santa Fe asked: the Santa Fe Sport (fe is a whole word)", matchLevel(F.santaFe, ask("Hyundai Santa Fe")), "exact"],
  ["GX 460 asked, GX 550 in stock: close", matchLevel(F.gx550, ask("Lexus GX 460")), "close"],
  ["RX350 written joined: exact", matchLevel(F.rx350, ask("rx350")), "exact"],
  ["'Merc' finds Mercedes-Benz", matchLevel(F.gle350, ask("Merc")), "exact"],
  ["'Prado' finds the Prado GRJ150L", matchLevel(F.prado, ask("Toyota Prado")), "exact"],
  ["'Toyota Landcruiser Prado' (written joined): exact", matchLevel(F.prado, ask("Toyota Landcruiser Prado")), "exact"],
  ["Land Cruiser V8 asked, a Prado: close", matchLevel(F.prado, ask("Land Cruiser V8")), "close"],
  ["Land Cruiser V8 asked, Land Cruiser V8: exact", matchLevel(F.lcv8, ask("Land Cruiser V8")), "exact"],
  ["Hilux 4x4 asked, Hilux in stock: exact (drive is not in the name)", matchLevel(F.hilux, ask("Hilux 4x4")), "exact"],
  ["'Toyota pick-up' finds the Hilux", matchLevel(F.hilux, ask("Toyota pick-up")), "exact"],
  ["4Runner asked: exact", matchLevel(F.runner, ask("Toyota 4runner")), "exact"],
  ["BMW X5 asked, X5: exact; X3: nothing (another model, not another version)", [matchLevel(F.x5, ask("BMW X5")), matchLevel(F.x3, ask("BMW X5"))], ["exact", null]],
  ["a truck code: exact", matchLevel(F.man, ask("MAN TGA 26.414")), "exact"],
  ["a year in the request is not a version", matchLevel(F.camry, ask("Camry 2012")), "exact"],
  ["an engine size in the request is not a version", matchLevel(F.camry, ask("Camry 2.4")), "exact"],
  ["budget phrasings are not versions", ["Camry 20-25m", "Camry n 20m", "Camry under 20 m", "Camry 20mill", "Camry 12 model", "Camry 1.8T"].map((w) => matchLevel(F.camry, ask(w))), ["exact", "exact", "exact", "exact", "exact", "exact"]],
  ["'Highlander 20 to 25 million': the Highlander is exact", matchLevel(F.highlanderXle, ask("Highlander 20 to 25 million")), "exact"],
  // what a car page asks for ("Tell me when another one arrives"): the family, so a later plain listing answers
  ["a sold Highlander XLE's request finds a Highlander", matchLevel(car("Toyota", "Highlander", 2018, "suv"), ask("Toyota Highlander")), "exact"],
  ["a sold RX 350 F SPORT's request finds an RX 350", matchLevel(F.rx350, ask("Lexus RX 350")), "exact"],
  ["a sold GLE 43's request finds a GLE 350", matchLevel(F.gle350, ask("Mercedes-Benz GLE")), "exact"],
  ["a sold Hummer 2's request finds a Hummer 2, and only calls a Hummer 1 close", [matchLevel(F.hummer2, ask("Toyota Hiace Hummer 2")), matchLevel(F.hummer1, ask("Toyota Hiace Hummer 2"))], ["exact", "close"]],
  // limits
  ["year limit applies", matchLevel(F.hummer1, ask("Hummer 1", 2015)), null],
  ["budget limit applies", matchLevel(F.hummer2, ask("Hummer 2", null, 2_000_000_000)), null],
  ["no price, stated budget: cannot be shown within it", matchLevel(F.noPrice, ask("Hummer 2", null, 5_000_000_000)), null],
  ["the year limit applies to close ones too", matchLevel(F.hummer1, ask("Hummer 2", 2015)), null],
  // what the desk acts on
  ["the desk acts on exact only", [satisfies(F.hummer2, ask("Hummer 2")), satisfies(F.hummer1, ask("Hummer 2"))], [true, false]],
  ["an empty want matches nothing", matchLevel(F.camry, ask("a clean tokunbo car")), null],
];

let failed = 0;
for (const [name, got, want] of checks) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failed++;
  console.log(`${ok ? "ok  " : "FAIL"} ${name}${ok ? "" : `: got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`}`);
}
if (failed) {
  console.error(`${failed} matching check(s) failed.`);
  process.exit(1);
}
console.log(`Matching: ${checks.length} checks passed.`);
