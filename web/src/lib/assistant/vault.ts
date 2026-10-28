import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { and, eq, lt, notLike, sql } from "drizzle-orm";
import { db } from "@/db";
import { assistantConversations, assistantMessages } from "@/db/schema";

/**
 * The words of a chat, kept so that a copy of the database alone cannot read
 * them. Each message is sealed with AES-256-GCM under a key that lives only
 * in the site's settings (ASSISTANT_MESSAGES_KEY, 32 random bytes in base64),
 * never in the database. Without the key the rows are noise; with it, the
 * site reads them as before. A message is stored as "enc1:<iv>:<sealed>",
 * so an unsealed row from before the key existed is still read as itself,
 * and the hourly housekeeping seals the backlog.
 *
 * Keep the key with the backups: a backup holds sealed rows.
 */
const PREFIX = "enc1:";

function key(): Buffer | null {
  const raw = process.env.ASSISTANT_MESSAGES_KEY?.trim();
  if (!raw) return null;
  const k = Buffer.from(raw, "base64");
  return k.length === 32 ? k : null;
}

/** Whether the key is set and usable. */
export const vaultReady = (): boolean => key() !== null;

/** The stored form of a message: sealed when the key is set, as typed when it is not. */
export function sealMessage(text: string): string {
  const k = key();
  if (!k) return text;
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", k, iv);
  const sealed = Buffer.concat([cipher.update(text, "utf8"), cipher.final(), cipher.getAuthTag()]);
  return `${PREFIX}${iv.toString("base64")}:${sealed.toString("base64")}`;
}

/** The message as written. A sealed row without the key reads as a placeholder, never as an error on the page. */
export function openMessage(stored: string | null | undefined): string {
  if (!stored) return "";
  if (!stored.startsWith(PREFIX)) return stored;
  const k = key();
  if (!k) return "[sealed — the chat key is not set on this site]";
  try {
    const [ivB64, sealedB64] = stored.slice(PREFIX.length).split(":");
    const sealed = Buffer.from(sealedB64, "base64");
    const decipher = createDecipheriv("aes-256-gcm", k, Buffer.from(ivB64, "base64"));
    decipher.setAuthTag(sealed.subarray(sealed.length - 16));
    return Buffer.concat([decipher.update(sealed.subarray(0, sealed.length - 16)), decipher.final()]).toString("utf8");
  } catch {
    return "[sealed — could not be opened with this site's key]";
  }
}

/** Seals messages written before the key existed, a batch at a time, from the hourly housekeeping. Returns how many. */
export async function sealBacklog(limit = 2000): Promise<number> {
  if (!vaultReady()) return 0;
  const rows = await db
    .select({ id: assistantMessages.id, content: assistantMessages.content })
    .from(assistantMessages)
    .where(notLike(assistantMessages.content, `${PREFIX}%`))
    .limit(limit);
  for (const r of rows) {
    await db
      .update(assistantMessages)
      .set({ content: sealMessage(r.content) })
      .where(and(eq(assistantMessages.id, r.id), notLike(assistantMessages.content, `${PREFIX}%`)));
  }
  return rows.length;
}

/** How long a conversation is kept: a buyer's search is weeks; a year covers a follow-up and a dispute. */
export const CONVERSATION_RETENTION_DAYS = 365;

/** Removes conversations, and their messages with them, that have been quiet for a year. Returns how many. */
export async function pruneConversations(): Promise<number> {
  const before = new Date(Date.now() - CONVERSATION_RETENTION_DAYS * 86_400_000);
  const gone = await db.delete(assistantConversations).where(lt(assistantConversations.lastMessageAt, before)).returning({ id: assistantConversations.id });
  void sql;
  return gone.length;
}
