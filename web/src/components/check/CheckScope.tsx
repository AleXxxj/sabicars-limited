import { Check, X } from "lucide-react";
import { ButtonLink } from "@/components/ui/Button";

/**
 * What the free VIN check shows, what it cannot, and where to go next.
 *
 * The words live here, once, and are said twice on purpose: beside the box
 * before a check, and under every result after one. A free check that only
 * lists what it found reads as "this car is clean" when it has found nothing,
 * and a buyer acts on that. So the limits are always in sight, in the same
 * words, and never worded as if an empty result were a good one.
 *
 * No hooks and no "use client": the page (a Server Component) and the tool
 * (a Client Component) both use these.
 */

/** Where the records come from, and so which cars they know. */
export const WHICH_CARS =
  "This check reads United States government records. It knows cars first sold in America. That is most tokunbo Toyota Highlanders, Camrys, Lexus and Mercedes in Nigeria.";

/** The cars it does not know: said before anyone types a number. */
export const WHICH_CARS_NOT =
  "It does not know cars made for other countries, such as a Toyota Hiace bus, or a chassis number that is not 17 letters and numbers.";

export const SHOWS = [
  "What the car is: year, make, model, engine and where it was built",
  "Its features and safety equipment",
  "Safety recalls for its model, and where to check if one is still open on this car",
  "What owners in America complained about",
  "Crash-test stars",
];

export const CANNOT_SHOW = ["Accidents", "Flood damage", "Auction photos", "Mileage history", "Whether the car was stolen"];

/** The one sentence that goes wherever a result is shown. */
export const CANNOT_SHOW_LINE =
  "This check cannot show accidents, flood damage, auction photos, mileage history, or whether the car was stolen.";

/** The two lists, side by side on a wide screen: what you get, and what you do not. */
export function ScopeLists() {
  return (
    <div className="grid gap-7">
      <div>
        <p className="text-sm font-semibold text-text-primary">What it shows</p>
        <ul className="vc-scope mt-3">
          {SHOWS.map((line) => (
            <li key={line}>
              <Check aria-hidden size={18} strokeWidth={2.25} />
              <span>{line}</span>
            </li>
          ))}
        </ul>
      </div>
      <div>
        <p className="text-sm font-semibold text-text-primary">What it cannot show</p>
        <ul className="vc-scope vc-scope--no mt-3">
          {CANNOT_SHOW.map((line) => (
            <li key={line}>
              <X aria-hidden size={18} strokeWidth={2.25} />
              <span>{line}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/**
 * The next step when the check has no answer, or not the whole answer: a
 * person at Sabicars, or the cars Sabicars has already looked over. `lead` is
 * the screen's one orange button only where nothing else on it is.
 */
export function NextSteps({ lead = false }: { lead?: boolean }) {
  return (
    <div className="vc-actions">
      <ButtonLink href="/contact" variant={lead ? "primary" : "signature"} className="w-full">
        Ask us to check it
      </ButtonLink>
      <ButtonLink href="/vehicles" variant="secondary" arrow className="w-full">
        See cars we have checked
      </ButtonLink>
    </div>
  );
}
