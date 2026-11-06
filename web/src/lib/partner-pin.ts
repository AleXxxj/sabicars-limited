import { createHash, randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from "node:crypto";

/**
 * The Refer & Earn partner PIN: six digits, typed with the phone number to
 * log in, the way OPay and the banks do it. Rules, hashing and the lock live
 * here, free of the database, so `npm run test:pin` proves them at every build.
 *
 * Six digits are only a million guesses, so the guard is online: five wrong
 * tries in a row lock the PIN (15 minutes, then an hour, then a day), and the
 * log-in form is also throttled per connection. Stored, a PIN is an scrypt
 * hash with its own random salt, so a copy of the database holds no PINs and
 * each one costs real work to guess offline.
 */

export const PIN_LENGTH = 6;
/** Wrong PINs in a row before each lock. */
export const PIN_TRIES = 5;

/** scrypt at 2^15: about a tenth of a second per check on a server, nothing for one log-in. */
const COST = { N: 2 ** 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 } as const;
const KEY_BYTES = 32;

function derive(pin: string, salt: Buffer, opts: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => scrypt(pin, salt, KEY_BYTES, opts, (err, key) => (err ? reject(err) : resolve(key))));
}

/** Why a PIN cannot be used, in plain words, or null when it will do. */
export function pinProblem(pin: string, phoneE164?: string | null): string | null {
  if (!/^[0-9]{6}$/.test(pin)) return "Your PIN must be 6 numbers.";
  if (/^(\d)\1{5}$/.test(pin)) return "That PIN is too easy to guess. Don't use one number six times.";
  if ("01234567890123".includes(pin) || "98765432109876".includes(pin)) return "That PIN is too easy to guess. Don't use numbers in a row.";
  if (/^(\d\d)\1\1$/.test(pin) || /^(\d{3})\1$/.test(pin)) return "That PIN is too easy to guess. Don't repeat a pattern.";
  if (phoneE164 && phoneE164.replace(/\D/g, "").endsWith(pin)) return "Don't use the end of your phone number as your PIN.";
  return null;
}

/** The PIN as stored: scrypt$N$r$p$salt$key, salt and key in base64url. */
export async function hashPin(pin: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derive(pin, salt, COST);
  return `scrypt$${COST.N}$${COST.r}$${COST.p}$${salt.toString("base64url")}$${key.toString("base64url")}`;
}

/** Whether a typed PIN matches the stored hash. Anything malformed is simply not a match. */
export async function verifyPin(pin: string, stored: string | null | undefined): Promise<boolean> {
  if (!stored || !/^[0-9]{6}$/.test(pin)) return false;
  const [scheme, n, r, p, salt64, key64] = stored.split("$");
  if (scheme !== "scrypt" || !salt64 || !key64) return false;
  const N = Number(n), R = Number(r), P = Number(p);
  if (![N, R, P].every((x) => Number.isInteger(x) && x > 0) || N > 2 ** 20) return false;
  const expected = Buffer.from(key64, "base64url");
  if (expected.length !== KEY_BYTES) return false;
  try {
    const key = await derive(pin, Buffer.from(salt64, "base64url"), { N, r: R, p: P, maxmem: COST.maxmem * 2 });
    return timingSafeEqual(key, expected);
  } catch {
    return false;
  }
}

/** After this many wrong PINs in a row, how many minutes the PIN stays locked; null when it does not lock yet. */
export function lockMinutesAfter(failedInARow: number): number | null {
  if (failedInARow <= 0 || failedInARow % PIN_TRIES !== 0) return null;
  const round = failedInARow / PIN_TRIES;
  return round === 1 ? 15 : round === 2 ? 60 : 24 * 60;
}

/** Wrong tries left before the next lock. */
export function triesLeft(failedInARow: number): number {
  return PIN_TRIES - (failedInARow % PIN_TRIES);
}

/** A random secret for a session cookie or a one-time PIN link: 32 bytes, URL-safe. */
export function newSecret(): string {
  return randomBytes(32).toString("base64url");
}

/** What the database keeps of such a secret: its sha256, so a copy of the table opens nothing. */
export function secretHash(secret: string): string {
  return createHash("sha256").update(secret).digest("hex");
}

/** A secret as it can arrive from a cookie or a link: base64url, the length newSecret makes. */
export function looksLikeSecret(value: string | undefined | null): value is string {
  return Boolean(value && /^[A-Za-z0-9_-]{40,64}$/.test(value));
}
