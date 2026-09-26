"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { Mail, MessageCircle, Phone } from "lucide-react";
import { ButtonAnchor } from "@/components/ui/Button";
import { addLeadNote, assignLead, claimLead, recordContact, recordReviewRequest, setLeadStatus } from "@/lib/actions/leads-admin";
import { LEAD_STATUS_LABEL, LOST_REASONS } from "@/lib/lead-labels";

const control =
  "min-h-11 w-full border border-border-default bg-surface-0 px-3 text-sm text-text-primary outline-none focus:border-gold-500";
const quietButton = "min-h-11 border border-border-strong px-4 text-sm text-text-primary hover:border-text-primary disabled:opacity-50";

/**
 * Reaching the buyer. Every tap is recorded — the first one is the lead's
 * response time — and the buyer's preferred way of being contacted is the
 * primary button.
 */
export function ContactButtons({
  leadId,
  phone,
  email,
  preferred,
  whatsappText,
  emailSubject,
}: {
  leadId: string;
  phone: string | null;
  email: string | null;
  preferred: string | null;
  whatsappText: string;
  emailSubject: string;
}) {
  const [pending, start] = useTransition();
  const [recorded, setRecorded] = useState(false);
  const record = (how: "call" | "whatsapp" | "email" | "other") =>
    start(async () => {
      const r = await recordContact(leadId, how);
      if (r.ok) setRecorded(true);
    });
  const first = preferred === "whatsapp" && phone ? "whatsapp" : preferred === "email" && email ? "email" : phone ? "call" : "email";
  const variant = (m: string) => (m === first ? "primary" : "secondary");

  return (
    <div>
      <div className="flex flex-wrap gap-3">
        {phone && (
          <ButtonAnchor href={`tel:${phone}`} variant={variant("call")} onClick={() => record("call")}>
            <Phone aria-hidden size={18} /> Call
          </ButtonAnchor>
        )}
        {phone && (
          <ButtonAnchor
            href={`https://wa.me/${phone.replace("+", "")}?text=${encodeURIComponent(whatsappText)}`}
            target="_blank"
            rel="noopener noreferrer"
            variant={variant("whatsapp")}
            onClick={() => record("whatsapp")}
          >
            <MessageCircle aria-hidden size={18} /> WhatsApp
          </ButtonAnchor>
        )}
        {email && (
          <ButtonAnchor
            href={`mailto:${email}?subject=${encodeURIComponent(emailSubject)}`}
            variant={variant("email")}
            onClick={() => record("email")}
          >
            <Mail aria-hidden size={18} /> Email
          </ButtonAnchor>
        )}
      </div>
      <p className="mt-3 text-xs text-text-muted" role="status">
        {pending ? "Recording…" : recorded ? "Recorded." : "Tapping one records that you reached out."}{" "}
        {!pending && (
          <button type="button" onClick={() => record("other")} className="font-semibold text-accent-text hover:text-text-primary">
            I replied another way
          </button>
        )}
      </p>
    </div>
  );
}

/** Who owns the lead: claim it, or — for managers — hand it to someone. */
export function OwnerControl({
  leadId,
  assigneeId,
  assigneeName,
  people,
  canAssign,
}: {
  leadId: string;
  assigneeId: string | null;
  assigneeName: string | null;
  people: { id: string; name: string }[];
  canAssign: boolean;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    start(async () => {
      const r = await fn();
      setError(r.ok ? null : (r.error ?? "That did not save."));
    });

  return (
    <div className="grid gap-3">
      <p className="text-sm">
        {assigneeName ? (
          <>
            <span className="text-text-muted">Handled by </span>
            <span className="text-text-primary">{assigneeName}</span>
          </>
        ) : (
          <span className="text-accent-text">Nobody has taken this yet</span>
        )}
      </p>
      {!assigneeId && (
        <button
          type="button"
          onClick={() => run(() => claimLead(leadId))}
          disabled={pending}
          className="min-h-11 bg-cta px-4 text-sm font-semibold text-cta-fg hover:bg-cta-hover disabled:opacity-50"
        >
          {pending ? "Taking it…" : "I'll take it"}
        </button>
      )}
      {canAssign && (
        <label className="grid gap-1.5">
          <span className="text-xs text-text-muted">Give it to</span>
          <select
            value={assigneeId ?? ""}
            disabled={pending}
            onChange={(e) => run(() => assignLead(leadId, e.target.value))}
            className={control}
          >
            <option value="">Anyone (unclaimed)</option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
      )}
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}

/** Where the lead stands. Losing one asks why — the reasons are how Sabicars learns what to fix. */
export function StatusControl({ leadId, status, lostReason }: { leadId: string; status: string; lostReason: string | null }) {
  const [state, action, pending] = useActionState(setLeadStatus, null);
  const [choice, setChoice] = useState(status);
  return (
    <form action={action} className="grid gap-3">
      <input type="hidden" name="leadId" value={leadId} />
      <label className="grid gap-1.5">
        <span className="text-xs text-text-muted">Status</span>
        <select name="status" value={choice} onChange={(e) => setChoice(e.target.value)} className={control}>
          {Object.entries(LEAD_STATUS_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      {choice === "lost" && (
        <label className="grid gap-1.5">
          <span className="text-xs text-text-muted">Why was it lost?</span>
          <select name="lostReason" defaultValue={lostReason ?? ""} required className={control}>
            <option value="" disabled>
              Choose a reason
            </option>
            {LOST_REASONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>
      )}
      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className={quietButton}>
          {pending ? "Saving…" : "Save status"}
        </button>
        {state?.ok && !pending && <span className="text-xs text-success">Saved</span>}
        {state?.error && <span className="text-xs text-danger">{state.error}</span>}
      </div>
    </form>
  );
}

/** A note for whoever picks the lead up next: what was said, promised, learned. */
export function NoteForm({ leadId }: { leadId: string }) {
  const [state, action, pending] = useActionState(addLeadNote, null);
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) form.current?.reset();
  }, [state]);
  return (
    <form ref={form} action={action} className="grid gap-3">
      <input type="hidden" name="leadId" value={leadId} />
      <label className="grid gap-1.5">
        <span className="sr-only">Add a note</span>
        <textarea
          name="note"
          rows={2}
          required
          maxLength={1000}
          placeholder="What was said, promised or learned…"
          className={`${control} py-2`}
        />
      </label>
      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className={quietButton}>
          {pending ? "Adding…" : "Add note"}
        </button>
        {state?.error && <span className="text-xs text-danger">{state.error}</span>}
      </div>
    </form>
  );
}

/**
 * After a sale: the buyer's private review link, sent in one tap. A review
 * left through it is published as "Verified buyer".
 */
export function ReviewRequest({
  leadId,
  phone,
  whatsappText,
  link,
}: {
  leadId: string;
  phone: string | null;
  whatsappText: string;
  link: string;
}) {
  const [pending, start] = useTransition();
  const [copied, setCopied] = useState(false);
  const record = (how: "whatsapp" | "copied") => start(async () => void (await recordReviewRequest(leadId, how)));
  return (
    <div className="flex flex-wrap items-center gap-3">
      {phone && (
        <a
          href={`https://wa.me/${phone.replace("+", "")}?text=${encodeURIComponent(whatsappText)}`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => record("whatsapp")}
          className="inline-flex min-h-11 items-center bg-cta px-4 text-sm font-semibold text-cta-fg hover:bg-cta-hover"
        >
          Ask on WhatsApp
        </a>
      )}
      <button
        type="button"
        disabled={pending}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(link);
            setCopied(true);
            record("copied");
          } catch {
            window.prompt("Copy the review link:", link);
          }
        }}
        className={quietButton}
      >
        {copied ? "Link copied" : "Copy the link"}
      </button>
    </div>
  );
}
