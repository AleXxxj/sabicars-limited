import { Inline } from "@/components/blog/Inline";

const BULLET = /^\s*(?:[-•]|\*(?!\*))\s+/;
const NUMBERED = /^\s*\d+[.)]\s+/;

/**
 * The assistant's words: paragraphs, bullet and numbered lists, and the
 * blog's three inline marks. Never HTML — the text is data. Used by the
 * chat window and by the published answers on /ask, so both read alike.
 */
/**
 * While a reply streams in, a link or a bold mark can be half here — "[2013
 * Toyota Highl" — and would show as raw brackets until the rest lands. The
 * unfinished tail is held back; the next chunk completes it.
 */
export function settled(text: string): string {
  const link = text.lastIndexOf("[");
  if (link !== -1 && !/\]\([^)\s]*\)/.test(text.slice(link))) return text.slice(0, link);
  const bold = text.lastIndexOf("**");
  if (bold !== -1 && (text.match(/\*\*/g)?.length ?? 0) % 2 === 1) return text.slice(0, bold);
  return text;
}

export function MessageText({ text, streaming = false }: { text: string; streaming?: boolean }) {
  const blocks = (streaming ? settled(text) : text)
    .trim()
    .split(/\n{2,}/)
    .map((b) => b.split("\n").filter((l) => l.trim()))
    .filter((b) => b.length);
  return (
    <div className="grid gap-3">
      {blocks.map((lines, i) => {
        if (lines.every((l) => BULLET.test(l)))
          return (
            <ul key={i} className="grid gap-1.5">
              {lines.map((l, j) => (
                <li key={j} className="relative pl-4">
                  <span aria-hidden className="absolute top-[0.62em] left-0 size-1.5 rounded-full bg-green-400" />
                  <Inline text={l.replace(BULLET, "")} />
                </li>
              ))}
            </ul>
          );
        if (lines.every((l) => NUMBERED.test(l)))
          return (
            <ol key={i} className="grid list-decimal gap-1.5 pl-5 marker:font-semibold marker:text-green-300">
              {lines.map((l, j) => (
                <li key={j}>
                  <Inline text={l.replace(NUMBERED, "")} />
                </li>
              ))}
            </ol>
          );
        return (
          <p key={i}>
            {lines.map((l, j) => (
              <span key={j}>
                {j > 0 && <br />}
                <Inline text={l} />
              </span>
            ))}
          </p>
        );
      })}
    </div>
  );
}
