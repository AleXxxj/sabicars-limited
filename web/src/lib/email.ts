import "server-only";

/**
 * Transactional email through Resend — the provider the legacy newsletter
 * already uses. Without keys it reports "not_configured" rather than failing,
 * so an alert simply waits on the staff board until email is set up.
 */
export function emailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL);
}

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
  /** e.g. List-Unsubscribe, which every newsletter must carry. */
  headers?: Record<string, string>;
}

const from = () => `${process.env.RESEND_FROM_NAME ?? "Sabicars"} <${process.env.RESEND_FROM_EMAIL}>`;

export async function sendEmail(message: EmailMessage): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  if (!emailConfigured()) return { ok: false, error: "not_configured" };
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: from(),
        to: [message.to],
        subject: message.subject,
        html: message.html,
        text: message.text,
        reply_to: message.replyTo,
        headers: message.headers,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return { ok: false, error: `Resend ${res.status}: ${(await res.text()).slice(0, 200)}` };
    const body = (await res.json()) as { id?: string };
    return { ok: true, id: body.id ?? "" };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * Up to 100 emails in one request — Resend's batch limit — each with its own
 * recipient, so no subscriber ever sees another's address.
 */
export async function sendBatch(messages: EmailMessage[]): Promise<{ ok: true; sent: number } | { ok: false; error: string }> {
  if (!emailConfigured()) return { ok: false, error: "not_configured" };
  if (messages.length > 100) throw new Error("A batch is at most 100 emails.");
  try {
    const res = await fetch("https://api.resend.com/emails/batch", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify(
        messages.map((m) => ({ from: from(), to: [m.to], subject: m.subject, html: m.html, text: m.text, reply_to: m.replyTo, headers: m.headers })),
      ),
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) return { ok: false, error: `Resend ${res.status}: ${(await res.text()).slice(0, 200)}` };
    return { ok: true, sent: messages.length };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Escapes text for an HTML email body. */
export function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
