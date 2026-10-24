#!/usr/bin/env node
/**
 * Carries a wording change in src/content (the /ask answers and the articles)
 * into the database rows the seed scripts made, without overwriting what staff
 * edited.
 *
 * The seeders insert what is missing and keep every existing row unless run
 * with --force, which would also throw away staff's edits in the admin. This
 * instead reads the change from git (each changed line of an answer, question
 * or article text, old and new) and replaces the old wording with the new
 * wherever a stored row still contains it word for word: in /ask questions and
 * answers, and in the text of articles' blocks. A row whose wording staff have
 * since changed no longer contains it and is left alone, and the run says so.
 *
 *   node --env-file=.env.local scripts/sync-content.mjs <git-ref>           dry run
 *   node --env-file=.env.local scripts/sync-content.mjs <git-ref> --apply
 *
 * <git-ref> is the commit whose content the database holds (for example the
 * commit before the wording change). Run against production with the live
 * connection string, as for a migration: dry run first, then --apply.
 */

import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

const here = dirname(fileURLToPath(import.meta.url));
const [base] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const apply = process.argv.includes("--apply");
if (!base) {
  console.error("Name the commit whose content the database holds: scripts/sync-content.mjs <git-ref> [--apply]");
  process.exit(1);
}
const diff = execFileSync("git", ["diff", "-U0", base, "--", "src/content"], { cwd: join(here, ".."), encoding: "utf8" });

/** The string on a changed source line: after `key: "` or `key: \``, up to its closing quote when that is on the same line. */
function valueOf(line) {
  const m = line.slice(1).match(/^\s*(?:text|a|q|answer|question|title|standfirst):\s*(["`])(.*)$/);
  if (!m) return null;
  let v = m[2];
  const close = v.lastIndexOf(m[1]);
  if (close >= 0 && /^[",`]*\s*,?\s*$/.test(v.slice(close))) v = v.slice(0, close);
  return v;
}

const lines = diff.split("\n");
const pairs = [];
for (let i = 0; i < lines.length; i++) {
  if (!lines[i].startsWith("-") || lines[i].startsWith("---")) continue;
  const minus = [];
  while (lines[i]?.startsWith("-") && !lines[i].startsWith("---")) minus.push(lines[i++]);
  const plus = [];
  while (lines[i]?.startsWith("+") && !lines[i].startsWith("+++")) plus.push(lines[i++]);
  i--;
  if (minus.length !== plus.length) throw new Error(`A changed block adds or removes lines; carry it over by hand: ${minus[0]?.slice(0, 80)}`);
  for (let k = 0; k < minus.length; k++) {
    const from = valueOf(minus[k]);
    const to = valueOf(plus[k]);
    if (from === null || to === null) throw new Error(`Not an answer or article text line; carry it over by hand: ${minus[k].slice(0, 80)}`);
    if (from !== to) pairs.push({ from, to });
  }
}
console.log(`${pairs.length} wording changes since ${base} (${apply ? "applying" : "dry run"})`);

const sql = postgres(process.env.DIRECT_URL ?? process.env.DATABASE_URL, { max: 1, prepare: false, onnotice: () => {} });
const found = new Set();
let changed = 0;
try {
  for (const r of await sql`select id, slug, question, answer from ask_answers`) {
    let { question, answer } = r;
    for (const [n, p] of pairs.entries()) {
      if (question.includes(p.from)) {
        question = question.split(p.from).join(p.to);
        found.add(n);
      }
      if (answer.includes(p.from)) {
        answer = answer.split(p.from).join(p.to);
        found.add(n);
      }
    }
    if (question === r.question && answer === r.answer) continue;
    changed++;
    console.log(`  /ask  ${r.slug}`);
    if (apply) await sql`update ask_answers set question = ${question}, answer = ${answer}, updated_at = now() where id = ${r.id}`;
  }
  for (const r of await sql`select id, slug, blocks from blog_posts`) {
    // Blocks are JSON: compare and replace the strings as JSON writes them.
    const before = JSON.stringify(r.blocks);
    let after = before;
    for (const [n, p] of pairs.entries()) {
      const from = JSON.stringify(p.from).slice(1, -1);
      if (after.includes(from)) {
        after = after.split(from).join(JSON.stringify(p.to).slice(1, -1));
        found.add(n);
      }
    }
    if (after === before) continue;
    changed++;
    console.log(`  /blog ${r.slug}`);
    if (apply) await sql`update blog_posts set blocks = ${sql.json(JSON.parse(after))}, updated_at = now() where id = ${r.id}`;
  }
  for (const [n, p] of pairs.entries()) if (!found.has(n)) console.log(`  not found, left alone (edited in the admin, or never seeded): "${p.from.slice(0, 70)}…"`);
  console.log(`${changed} rows ${apply ? "updated" : "would change"}.`);
} finally {
  await sql.end();
}
