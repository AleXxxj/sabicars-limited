/**
 * Phone numbers as people type them, stored one way.
 *
 * The same Lagos number arrives as "0803 123 4567", "08031234567",
 * "2348031234567" or "+234 803 123 4567". Stored in E.164 (+2348031234567) it
 * can be dialled, WhatsApp-linked and de-duplicated. Numbers from abroad —
 * the diaspora buying for family at home — are accepted when written with a
 * country code.
 */
export function normalisePhone(raw: string): string | null {
  const trimmed = raw.trim();
  const digits = trimmed.replace(/\D/g, "");
  if (!digits) return null;

  // Nigerian mobile and landline: 0 + 10 digits, or 234 + 10 digits.
  if (/^0\d{10}$/.test(digits)) return `+234${digits.slice(1)}`;
  if (/^234\d{10}$/.test(digits)) return `+${digits}`;
  // Anywhere else, written with its country code.
  if ((trimmed.startsWith("+") || trimmed.startsWith("00")) && /^\d{8,15}$/.test(digits.replace(/^00/, ""))) {
    return `+${digits.replace(/^00/, "")}`;
  }
  return null;
}

/** +2348031234567 -> "0803 123 4567"; foreign numbers are left in international form. */
export function displayPhone(e164: string): string {
  const m = e164.match(/^\+234(\d{3})(\d{3})(\d{4})$/);
  return m ? `0${m[1]} ${m[2]} ${m[3]}` : e164;
}
