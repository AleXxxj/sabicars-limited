import type { Block } from "./blocks";

/**
 * Turns an old-site post into blocks. The old editor produced a small, known
 * set of tags — p, h2, h3, ul/li, strong, a, img — and some posts were pasted
 * in as plain lines with "•" bullets. This reads exactly those and drops
 * anything else, rather than trusting stored HTML.
 *
 * `mapLink` rewrites old-site links (cars.html, car-detail.html?id=…) to the
 * new pages.
 */
export function blocksFromHtml(html: string, mapLink: (href: string) => string = (h) => h): Block[] {
  const decode = (s: string) =>
    s
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;|&rsquo;|&lsquo;/g, "'")
      .replace(/&ldquo;|&rdquo;/g, '"')
      .replace(/&mdash;/g, "—")
      .replace(/&ndash;/g, "–");

  /** Inline HTML → the blocks' inline syntax (**bold**, *italic*, [text](href)). */
  const inline = (s: string) =>
    decode(
      s
        .replace(/<(strong|b)>([\s\S]*?)<\/\1>/gi, "**$2**")
        .replace(/<(em|i)>([\s\S]*?)<\/\1>/gi, "*$2*")
        .replace(
          /<a\s[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi,
          (_, href: string, label: string) => `[${label.replace(/<[^>]+>/g, "")}](${mapLink(href)})`,
        )
        .replace(/<br\s*\/?>/gi, " ")
        .replace(/<[^>]+>/g, ""),
    )
      .replace(/\s+/g, " ")
      .trim();

  const blocks: Block[] = [];

  /** Text outside any tag: one line per paragraph, "•" lines as lists, short label lines as subheads. */
  const loose = (chunk: string) => {
    let list: string[] = [];
    const flush = () => {
      if (list.length) blocks.push({ type: "list", items: list });
      list = [];
    };
    for (const raw of decode(chunk.replace(/<[^>]+>/g, "")).split("\n")) {
      const line = raw.trim();
      if (!line) continue;
      const bullet = line.match(/^[•·▪◦\-–*]\s*(.+)$/);
      if (bullet) {
        list.push(bullet[1].trim());
        continue;
      }
      flush();
      // A short question standing on its own line is a section heading.
      if (line.endsWith("?") && line.length <= 90) {
        blocks.push({ type: "h2", text: line });
        continue;
      }
      // "Price Range", "Why Nigerians Love It": a label, not a sentence.
      const label = line.length <= 40 && !/[.!?:,]$/.test(line) && line.split(" ").length <= 6;
      blocks.push({ type: "p", text: label ? `**${line}**` : line });
    }
    flush();
  };

  const element = /<(h2|h3|p|ul|ol)(\s[^>]*)?>([\s\S]*?)<\/\1>|<img\s[^>]*>/gi;
  let at = 0;
  for (const m of html.matchAll(element)) {
    if (m.index! > at) loose(html.slice(at, m.index));
    at = m.index! + m[0].length;

    if (m[0].toLowerCase().startsWith("<img")) {
      const src = m[0].match(/src="([^"]+)"/i)?.[1];
      const alt = decode(m[0].match(/alt="([^"]*)"/i)?.[1] ?? "");
      if (src?.startsWith("https://")) blocks.push({ type: "image", url: src, alt: alt || "Illustration" });
      continue;
    }
    const [, tag, attrs = "", body] = m;
    const t = tag.toLowerCase();
    if (t === "p" && /class="img-caption"/i.test(attrs)) {
      const last = blocks[blocks.length - 1];
      if (last?.type === "image") last.caption = inline(body);
      continue;
    }
    if (t === "ul" || t === "ol") {
      const items = [...body.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)].map((li) => inline(li[1])).filter(Boolean);
      if (items.length) blocks.push({ type: "list", ordered: t === "ol", items });
      continue;
    }
    const content = inline(body);
    if (!content) continue;
    if (t === "h2" || t === "h3") blocks.push({ type: t, text: content.replace(/\*\*/g, "") });
    else blocks.push({ type: "p", text: content });
  }
  if (at < html.length) loose(html.slice(at));
  return blocks;
}
