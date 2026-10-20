"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { CalendarPlus } from "lucide-react";
import { submitEnquiry } from "@/lib/actions/enquiry";
import { bookableDays, slotLabel, viewingCalendar } from "@/lib/viewings";
import { Button, ButtonAnchor } from "@/components/ui/Button";
import { fieldClass as field } from "@/components/forms/field";
import { PrivacyLink } from "@/components/forms/shared";

function FieldError({ message }: { message?: string }) {
  return message ? <p className="text-sm text-danger">{message}</p> : null;
}

/**
 * The replacement for "WhatsApp us" on every tile.
 *
 * The enquiry is saved before anything else happens, and the customer is given
 * a reference. WhatsApp is still offered — some people will always prefer it —
 * but as a next step that carries the reference, so the conversation can be
 * matched to its record instead of vanishing into one person's phone.
 */
/**
 * The viewing times on offer, worked out in the browser from the showroom's
 * hours and the bookings already made, so the list is right to the minute
 * even when the page itself was cached. The server checks the choice again.
 */
function SlotPicker({ taken, chosen, onChoose, error }: { taken: Record<string, number>; chosen: string; onChoose: (iso: string) => void; error?: string }) {
  const [days] = useState(() => bookableDays(new Date(), taken));
  const [dayKey, setDayKey] = useState(() => days.find((d) => d.slots.some((s) => s.startsAt === chosen))?.key ?? days[0]?.key);
  const day = days.find((d) => d.key === dayKey);
  if (!days.length) return <p className="text-sm text-text-secondary">No viewing times are free this week. Send a question instead and we will arrange one.</p>;
  return (
    // min-w-0: a fieldset is otherwise as wide as its widest row, and the day chips would widen the whole page.
    <fieldset className="grid min-w-0 gap-3">
      <legend className="mb-3 text-sm font-medium text-text-secondary">When would you like to come?</legend>
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
        {days.map((d) => (
          <button
            key={d.key}
            type="button"
            aria-pressed={d.key === dayKey}
            onClick={() => setDayKey(d.key)}
            className={`min-h-11 shrink-0 rounded-full border px-4 text-sm font-semibold transition-colors ${
              d.key === dayKey ? "border-green-400 bg-green-500/15 text-green-100" : "border-border-default text-text-secondary hover:border-border-strong"
            }`}
          >
            {d.label}
          </button>
        ))}
      </div>
      {day && (
        <div role="radiogroup" aria-label={`Times on ${day.label}`} className="grid grid-cols-4 gap-2 sm:grid-cols-6">
          {day.slots.map((s) => (
            <button
              key={s.startsAt}
              type="button"
              role="radio"
              aria-checked={s.startsAt === chosen}
              onClick={() => onChoose(s.startsAt)}
              className={`figures min-h-11 rounded-xl border text-sm font-semibold transition-colors ${
                s.startsAt === chosen ? "border-green-400 bg-green-500/15 text-green-100" : "border-border-default text-text-secondary hover:border-border-strong"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      )}
      <FieldError message={error} />
    </fieldset>
  );
}

export function EnquiryForm({
  vehicleId,
  vehicleTitle,
  landingPath,
  whatsappBase,
  taken,
  address,
}: {
  vehicleId: string;
  vehicleTitle: string;
  landingPath: string;
  whatsappBase: string;
  /** Viewings already booked per slot (ISO), so full times are not offered. */
  taken: Record<string, number>;
  /** Where the viewing happens, for the confirmation and the calendar file. */
  address: string;
}) {
  const [state, action, pending] = useActionState(submitEnquiry, null);
  const [type, setType] = useState<"question" | "viewing">("question");
  const [slot, setSlot] = useState("");
  // Captured once, when the form first renders — the anti-bot timing check.
  const [renderedAt] = useState(() => Date.now());
  const confirmation = useRef<HTMLDivElement>(null);

  // "Book a viewing" anywhere on the page links to #book-viewing: open that tab, not the question.
  useEffect(() => {
    const fromHash = () => {
      if (window.location.hash === "#book-viewing") setType("viewing");
    };
    fromHash();
    window.addEventListener("hashchange", fromHash);
    return () => window.removeEventListener("hashchange", fromHash);
  }, []);

  // The thank-you panel is shorter than the form it replaces, which leaves the
  // screen showing whatever came next. Bring the confirmation into view.
  useEffect(() => {
    if (!state?.ok) return;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    confirmation.current?.scrollIntoView({ behavior: still ? "auto" : "smooth", block: "center" });
  }, [state?.ok]);

  if (state?.ok) {
    const at = state.viewingAt ? new Date(state.viewingAt) : null;
    const wa = `${whatsappBase}?text=${encodeURIComponent(
      at
        ? `Hello Sabicars, I booked a viewing of the ${vehicleTitle} for ${slotLabel(at)} (reference ${state.reference}).`
        : `Hello Sabicars, I just enquired about the ${vehicleTitle} on your website (reference ${state.reference}).`,
    )}`;
    const calendar = at
      ? `data:text/calendar;charset=utf-8,${encodeURIComponent(viewingCalendar(at, vehicleTitle, address, state.reference ?? ""))}`
      : null;
    return (
      <div ref={confirmation} role="status" className="surface-card scroll-mt-24 !border-green-500/30 p-7 md:p-9">
        <p className="kicker">{at ? "Viewing booked" : "Enquiry received"}</p>
        <h3 className="mt-3 text-display-3">Thank you, {state.name}.</h3>
        {at ? (
          <p className="mt-4 text-text-secondary">
            We will see you on <strong className="text-text-primary">{slotLabel(at)}</strong> at {address}, to see the {vehicleTitle}. Your
            reference is <strong className="figures text-text-primary">{state.reference}</strong>. Bring your mechanic if you like. If your
            plans change, tell us on WhatsApp.
          </p>
        ) : (
          <p className="mt-4 text-text-secondary">
            Your reference is <strong className="figures text-text-primary">{state.reference}</strong>. A member of the Sabicars team will
            contact you about the {vehicleTitle}.
          </p>
        )}
        <div className="mt-8 flex flex-wrap gap-3">
          {calendar && (
            <ButtonAnchor href={calendar} download="sabicars-viewing.ics" variant="secondary" className="w-full sm:w-auto">
              <CalendarPlus aria-hidden size={18} /> Add to my calendar
            </ButtonAnchor>
          )}
          {/* Long enough to wrap on a phone: allowed to, rather than pushing the page sideways. */}
          <ButtonAnchor href={wa} target="_blank" rel="noopener noreferrer" variant="secondary" arrow className="w-full py-3 text-center !whitespace-normal sm:w-auto">
            Continue on WhatsApp with your reference
          </ButtonAnchor>
        </div>
      </div>
    );
  }

  const tab = (value: typeof type, label: string) => (
    <label
      className={`flex min-h-11 flex-1 cursor-pointer items-center justify-center rounded-full text-[0.95rem] font-semibold transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-[var(--focus)] ${
        type === value
          ? "bg-[linear-gradient(180deg,var(--green-300),var(--green-500))] text-[#090E0A] shadow-[inset_0_1px_0_rgb(255_255_255/0.4)]"
          : "text-text-secondary hover:text-text-primary"
      }`}
    >
      <input type="radio" name="enquiryKind" value={value} checked={type === value} onChange={() => setType(value)} className="sr-only" />
      {label}
    </label>
  );

  return (
    <form action={action} className="grid gap-6" noValidate>
      <input type="hidden" name="vehicleId" value={vehicleId} />
      {/* What is sent comes from state, not from the tab radios: React resets radios after a failed send,
          which would turn a viewing into a plain question while the screen still showed the viewing. */}
      <input type="hidden" name="type" value={type} />
      <input type="hidden" name="landingPath" value={landingPath} />
      <input type="hidden" name="renderedAt" value={renderedAt} />
      {/* Hidden from people; bots fill it in. */}
      <div aria-hidden className="absolute -left-[9999px]">
        <label>
          Website <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <fieldset id="book-viewing" className="scroll-mt-28">
        <legend className="sr-only">What would you like to do?</legend>
        <div className="flex gap-1 rounded-full border border-border-default bg-surface-1 p-1">
          {tab("question", "Ask a question")}
          {tab("viewing", "Book a viewing")}
        </div>
      </fieldset>

      {state?.error && (
        <p role="alert" className="border-l-2 border-danger bg-surface-2 px-4 py-3 text-sm text-danger">
          {state.error}
        </p>
      )}

      <div className="grid gap-6 sm:grid-cols-2">
        <label className="grid gap-2">
          <span className="text-sm font-medium text-text-secondary">Your name</span>
          <input name="name" autoComplete="name" required defaultValue={state?.values?.name} className={field} />
          <FieldError message={state?.fieldErrors?.name} />
        </label>
        <label className="grid gap-2">
          <span className="text-sm font-medium text-text-secondary">Phone number</span>
          <input name="phone" type="tel" inputMode="tel" autoComplete="tel" required placeholder="0803 123 4567" defaultValue={state?.values?.phone} className={`figures ${field}`} />
          <FieldError message={state?.fieldErrors?.phone} />
        </label>
      </div>

      <fieldset className="grid gap-3">
        <legend className="mb-3 text-sm font-medium text-text-secondary">How should we reach you?</legend>
        <div className="flex flex-wrap gap-6 text-sm text-text-secondary">
          <label className="inline-flex min-h-11 items-center gap-3">
            <input type="radio" name="preferredContact" value="phone" defaultChecked={state?.values?.preferredContact !== "whatsapp"} className="size-4 accent-[var(--green-500)]" /> A phone call
          </label>
          <label className="inline-flex min-h-11 items-center gap-3">
            <input type="radio" name="preferredContact" value="whatsapp" defaultChecked={state?.values?.preferredContact === "whatsapp"} className="size-4 accent-[var(--green-500)]" /> WhatsApp
          </label>
        </div>
      </fieldset>

      {type === "viewing" && (
        <>
          <input type="hidden" name="viewingAt" value={slot} />
          <SlotPicker taken={taken} chosen={slot} onChoose={setSlot} error={state?.fieldErrors?.viewingAt} />
        </>
      )}

      <label className="grid gap-2">
        <span className="text-sm font-medium text-text-secondary">
          {type === "viewing" ? "Anything we should know? (optional)" : "Your question (optional)"}
        </span>
        <textarea
          name="message"
          rows={3}
          maxLength={2000}
          defaultValue={state?.values?.message}
          placeholder={type === "viewing" ? "e.g. I will bring my mechanic" : "e.g. Is the price negotiable? Can it be delivered to Abuja?"}
          className={`${field} py-3`}
        />
        <FieldError message={state?.fieldErrors?.message} />
      </label>

      <label className="grid gap-2">
        <span className="text-sm font-medium text-text-secondary">Email (optional)</span>
        <input name="email" type="email" autoComplete="email" defaultValue={state?.values?.email} className={field} />
        <FieldError message={state?.fieldErrors?.email} />
      </label>

      <div>
        <Button type="submit" size="lg" disabled={pending} className="w-full sm:w-auto">
          {pending ? "Sending…" : type === "viewing" ? "Book the viewing" : "Send enquiry"}
        </Button>
        <p className="mt-4 text-xs text-text-muted">Your details are used only to reply to this enquiry. <PrivacyLink /></p>
      </div>
    </form>
  );
}
