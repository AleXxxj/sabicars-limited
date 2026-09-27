import { Inline } from "@/components/blog/Inline";

const BULLET = /^\s*(?:[-•]|\*(?!\*))\s+/;
const NUMBERED = /^\s*\d+[.)]\s+/;

/**
 * The assistant's words: paragraphs, bullet and numbered lists, and the
 * blog's three inline marks. Never HTML — the text is data. Used by the
 * chat window and by the published answers on /ask, so both read alike.
 */
export function MessageText({ text }: { text: string }) {
  const blocks = text
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
                  <span aria-hidden className="absolute top-[0.62em] left-0 size-1.5 rounded-full bg-gold-400" />
                  <Inline text={l.replace(BULLET, "")} />
                </li>
              ))}
            </ul>
          );
        if (lines.every((l) => NUMBERED.test(l)))
          return (
            <ol key={i} className="grid list-decimal gap-1.5 pl-5 marker:font-semibold marker:text-gold-300">
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
