/**
 * How Ask Sabicars shows things instead of only describing them.
 *
 * The model writes ordinary text and, on a line of its own, a directive:
 *
 *   [[cars: slug, slug]]      up to three vehicle cards
 *   [[compare: slug, slug]]   a side-by-side comparison of two or three
 *   [[callback]]              the "have someone call me" form
 *   [[race: family]]          the Hiace family race: old Hiace, short Hiace, Hummer 1, 2, 3
 *   [[race: powertrain]]      the Hummer race: petrol or diesel, manual or automatic
 *
 * The server lifts directives out of the stream, checks every slug against the
 * live inventory and sends the widget structured parts in their place. A slug
 * the model got wrong never reaches the page, and a card is always a car that
 * is actually for sale today.
 *
 * Shared by the server and the widget, so it imports nothing server-only.
 */

/** Exactly what the widget may show about a vehicle — never the chassis number, owner or custodian. */
export interface AssistantCar {
  slug: string;
  title: string;
  priceMinor: number | null;
  wasPriceMinor: number | null;
  depositMinor: number | null;
  year: number;
  condition: string;
  body: string | null;
  mileageKm: number | null;
  engine: string | null;
  transmission: string | null;
  drivetrain: string | null;
  fuel: string | null;
  seats: number | null;
  coverUrl: string | null;
  reserved: boolean;
}

export type Part =
  | { kind: "text"; text: string }
  | { kind: "cars"; cars: AssistantCar[] }
  | { kind: "compare"; cars: AssistantCar[]; href: string }
  | { kind: "callback" }
  | { kind: "race"; race: RaceKind };

/** The races the chat can show: the same ones the Hummer buyer's guide has. */
export type RaceKind = "family" | "powertrain";

export type Directive = { kind: "cars" | "compare"; slugs: string[] } | { kind: "callback" } | { kind: "race"; race: RaceKind };

const MAX_CARDS = 3;

export function parseDirective(inner: string): Directive | null {
  const m = /^\s*(cars|compare|callback|race)\s*(?::\s*([\s\S]*))?$/i.exec(inner);
  if (!m) return null;
  const kind = m[1].toLowerCase();
  if (kind === "callback") return { kind: "callback" };
  if (kind === "race") {
    const arg = (m[2] ?? "").trim().toLowerCase();
    if (/family|hiace|hummer|generation/.test(arg)) return { kind: "race", race: "family" };
    if (/powertrain|petrol|diesel|manual|automatic|gearbox|fuel/.test(arg)) return { kind: "race", race: "powertrain" };
    return null;
  }
  const slugs = [
    ...new Set(
      (m[2] ?? "")
        .split(/[,\s]+/)
        .map((s) => s.trim().toLowerCase())
        .filter((s) => /^[a-z0-9]+(-[a-z0-9]+)*$/.test(s)),
    ),
  ].slice(0, MAX_CARDS);
  if (!slugs.length) return null;
  return { kind: kind as "cars" | "compare", slugs };
}

/**
 * Splits a streamed reply into text and directives. A directive is held back
 * until it is complete, so the visitor never sees half of one flash past; text
 * that only looked like the start of one is released as text.
 */
export class DirectiveSplitter {
  private held = "";

  push(chunk: string): (string | Directive)[] {
    this.held += chunk;
    const out: (string | Directive)[] = [];
    for (;;) {
      const start = this.held.indexOf("[[");
      if (start === -1) {
        // A lone "[" at the end may be the first half of "[[".
        const keep = this.held.endsWith("[") ? 1 : 0;
        const text = this.held.slice(0, this.held.length - keep);
        if (text) out.push(text);
        this.held = this.held.slice(this.held.length - keep);
        return out;
      }
      if (start > 0) {
        out.push(this.held.slice(0, start));
        this.held = this.held.slice(start);
      }
      const end = this.held.indexOf("]]");
      if (end === -1) {
        // Nothing that long is a directive: let it through as text.
        if (this.held.length > 240) {
          out.push(this.held);
          this.held = "";
        }
        return out;
      }
      const directive = parseDirective(this.held.slice(2, end));
      if (directive) out.push(directive);
      this.held = this.held.slice(end + 2);
    }
  }

  /** The end of the reply: an unfinished directive is dropped, anything else is text. */
  flush(): string[] {
    const rest = this.held.startsWith("[[") ? "" : this.held;
    this.held = "";
    return rest ? [rest] : [];
  }
}

/** A reply as a person reads it: directives named, not shown as syntax (staff transcripts, summaries). */
export function describeDirectives(text: string, titleFor: (slug: string) => string = (s) => s): string {
  return text.replace(/\[\[([^\]]*)\]\]/g, (_, inner: string) => {
    const d = parseDirective(inner);
    if (!d) return "";
    if (d.kind === "callback") return "[offered a callback]";
    if (d.kind === "race") return d.race === "family" ? "[showed the Hiace family race]" : "[showed the petrol/diesel race]";
    return `[${d.kind === "compare" ? "compared" : "showed"}: ${d.slugs.map(titleFor).join(", ")}]`;
  });
}

/** The comparison page for two or three vehicles: one address whatever order they were named in. */
export function comparePath(slugs: string[]): string {
  return `/compare/${[...slugs].sort().join("-vs-")}`;
}
