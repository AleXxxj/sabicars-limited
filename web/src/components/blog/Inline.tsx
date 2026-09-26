import Link from "next/link";
import type { ReactNode } from "react";

/** Only these link destinations are ever made clickable. */
function safeHref(href: string): string | null {
  if (/^\/(?!\/)/.test(href) || href.startsWith("#")) return href;
  if (/^(https?:|mailto:|tel:)/i.test(href)) return href;
  return null;
}

const TOKEN = /\*\*(.+?)\*\*|\*(.+?)\*|\[([^\]]+)\]\(([^)\s]+)\)/g;

function parse(text: string, key: string): ReactNode[] {
  const out: ReactNode[] = [];
  let at = 0;
  let n = 0;
  for (const m of text.matchAll(TOKEN)) {
    if (m.index! > at) out.push(text.slice(at, m.index));
    const k = `${key}-${n++}`;
    if (m[1] !== undefined) out.push(<strong key={k}>{parse(m[1], k)}</strong>);
    else if (m[2] !== undefined) out.push(<em key={k}>{parse(m[2], k)}</em>);
    else {
      const href = safeHref(m[4]);
      const label = parse(m[3], k);
      if (!href) out.push(<span key={k}>{label}</span>);
      else if (href.startsWith("/") || href.startsWith("#"))
        out.push(
          <Link key={k} href={href}>
            {label}
          </Link>,
        );
      else
        out.push(
          <a key={k} href={href} target="_blank" rel="noopener noreferrer">
            {label}
          </a>,
        );
    }
    at = m.index! + m[0].length;
  }
  if (at < text.length) out.push(text.slice(at));
  return out;
}

/**
 * Article text with its three inline marks — **bold**, *italic* and
 * [links](/vehicles) — and nothing else. Stored text is never treated as HTML.
 */
export function Inline({ text }: { text: string }) {
  return <>{parse(text, "i")}</>;
}
