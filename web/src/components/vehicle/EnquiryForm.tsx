"use client";

import { useActionState, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { CalendarPlus, ExternalLink } from "lucide-react";
import { submitEnquiry, type EnquiryKind } from "@/lib/actions/enquiry";
import { bookableDays, calendarFileUrl, googleCalendarUrl, slotLabel } from "@/lib/viewings";
import { Button, ButtonAnchor } from "@/components/ui/Button";
import { fieldClass as field } from "@/components/forms/field";
import { PrivacyLink } from "@/components/forms/shared";
import { announceEnquiry } from "./enquired";

function FieldError({ message }: { message?: string }) {
  return message ? <p className="text-sm text-danger">{message}</p> : null;
}

/**
 * The three ways to enquire, side by side, so no one of them can be mistaken
 * for the whole. Each has a hash, so a button anywhere on the page can open
 * the card on that way: "Book a viewing" lands on the day-and-time picker,
 * not on a choice.
 */
const WAYS: { value: EnquiryKind; label: string; hash: string }[] = [
  { value: "callback", label: "Call me back", hash: "#call-me-back" },
  { value: "question", label: "Ask a question", hash: "#ask-question" },
  { value: "viewing", label: "Book a viewing", hash: "#book-viewing" },
];

const wayForHash = (hash: string) => WAYS.find((w) => w.hash === hash)?.value;

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

/**
 * Which phone this is, for the order of the calendar buttons. Read once from
 * the browser; the server's answer is "other", so the first paint agrees.
 */
type PhoneKind = "iphone-safari" | "iphone-other" | "android" | "other";

function detectPhone(): PhoneKind {
  const ua = navigator.userAgent;
  // iPadOS reports itself as a Mac; the touch points give it away.
  const ios = /iPhone|iPad|iPod/.test(ua) || (ua.includes("Mac") && navigator.maxTouchPoints > 1);
  if (ios) {
    // Chrome, Firefox, Edge (including an iPad asking for the desktop site), Brave, and the browsers inside
    // Instagram or WhatsApp cannot hand a file to Calendar; only Safari can.
    const safari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS|Chrome|Chromium|Edg\/|Firefox|Brave|Instagram|FBAN|FBAV|WhatsApp|Line\//.test(ua);
    return safari ? "iphone-safari" : "iphone-other";
  }
  return /Android/.test(ua) ? "android" : "other";
}

const never = () => () => {};
const onServer = (): PhoneKind => "other";

function usePhoneKind(): PhoneKind {
  return useSyncExternalStore(never, detectPhone, onServer);
}

/**
 * Two ways into a calendar, ordered for the phone in hand. On an iPhone in
 * Safari, the file opens Apple Calendar over the page (a real address, same
 * tab: a data: link, a download attribute or a new tab each break it). On
 * Android, the file only downloads, so Google Calendar — a link that opens
 * the app — comes first. Inside Instagram's or WhatsApp's browser on an
 * iPhone, the file goes nowhere, so Google Calendar leads and a line says
 * what to do.
 */
function CalendarLinks({ file, google }: { file: string; google: string }) {
  const phone = usePhoneKind();
  const googleFirst = phone === "android" || phone === "iphone-other";
  const fileButton = (
    <ButtonAnchor key="file" href={file} variant={googleFirst ? "secondary" : "primary"} className="w-full sm:w-auto">
      <CalendarPlus aria-hidden size={18} /> {phone === "android" ? "Calendar file" : "Add to my calendar"}
    </ButtonAnchor>
  );
  const googleButton = (
    <ButtonAnchor key="google" href={google} target="_blank" rel="noopener noreferrer" variant={googleFirst ? "primary" : "secondary"} className="w-full sm:w-auto">
      {googleFirst ? <CalendarPlus aria-hidden size={18} /> : null} Google Calendar {googleFirst ? null : <ExternalLink aria-hidden size={16} />}
    </ButtonAnchor>
  );
  return (
    <>
      {googleFirst ? [googleButton, fileButton] : [fileButton, googleButton]}
      {phone === "iphone-other" && (
        <p className="w-full text-xs text-text-muted">Inside Instagram or WhatsApp, the calendar file may not open. Open this page in Safari and it will.</p>
      )}
    </>
  );
}

/**
 * One card, three ways to enquire: a call-back from a number alone, a
 * question, or a viewing at a chosen time. Every way is saved before anything
 * else happens, and the customer is given a reference. WhatsApp is still
 * offered — some people will always prefer it — but as a next step that
 * carries the reference, so the conversation can be matched to its record
 * instead of vanishing into one person's phone.
 */
export function EnquiryForm({
  vehicleId,
  vehicleTitle,
  landingPath,
  whatsappBase,
  taken,
  address,
  offsite = false,
  frame = "card",
}: {
  vehicleId: string;
  vehicleTitle: string;
  landingPath: string;
  whatsappBase: string;
  /** Viewings already booked per slot (ISO), so full times are not offered. */
  taken: Record<string, number>;
  /** Where the viewing happens, for the confirmation and the calendar links. */
  address: string;
  /** A car held away from the showroom: the place is agreed, not fixed. */
  offsite?: boolean;
  /** "card" draws its own raised card; "plain" is for inside a sheet that already is one. */
  frame?: "card" | "plain";
}) {
  const chrome = frame === "card" ? "surface-card p-5 md:p-8" : "";
  const doneChrome = frame === "card" ? "surface-card !border-green-500/30 p-7 md:p-9" : "rounded-2xl border border-green-500/30 bg-green-500/[0.06] p-5 md:p-6";
  const [state, action, pending] = useActionState(submitEnquiry, null);
  const [type, setType] = useState<EnquiryKind>("callback");
  const [slot, setSlot] = useState("");
  // Captured once, when the form first renders — the anti-bot timing check.
  const [renderedAt] = useState(() => Date.now());
  const confirmation = useRef<HTMLDivElement>(null);

  // A link to one of the ways — from the buttons under the photos, the phone bar, or an address shared
  // with the hash — opens the card on that way. Clicks are watched as well as the hash, because clicking
  // the same link twice changes no hash, and must still work.
  useEffect(() => {
    const open = (hash: string) => {
      const way = wayForHash(hash);
      if (way) setType(way);
    };
    open(window.location.hash);
    const onHash = () => open(window.location.hash);
    const onClick = (e: MouseEvent) => {
      const link = (e.target as Element | null)?.closest?.("a[href^='#']");
      if (link) open(link.getAttribute("href") ?? "");
    };
    window.addEventListener("hashchange", onHash);
    document.addEventListener("click", onClick);
    return () => {
      window.removeEventListener("hashchange", onHash);
      document.removeEventListener("click", onClick);
    };
  }, []);

  // Saved: bring the thank-you into view (it is shorter than the form it replaces, which would leave the
  // screen on whatever came next), and tell the rest of the page.
  useEffect(() => {
    if (!state?.ok) return;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    confirmation.current?.scrollIntoView({ behavior: still ? "auto" : "smooth", block: "center" });
    if (state.reference) announceEnquiry(state.reference);
  }, [state?.ok, state?.reference]);

  // The three hashes land here, on whichever the card is showing: the ways, or the thank-you after one was sent.
  const anchors = (
    <>
      <span id="call-me-back" className="absolute top-0 scroll-mt-24" aria-hidden />
      <span id="ask-question" className="absolute top-0 scroll-mt-24" aria-hidden />
      <span id="book-viewing" className="absolute top-0 scroll-mt-24" aria-hidden />
    </>
  );

  if (state?.ok) {
    const at = state.viewingAt ? new Date(state.viewingAt) : null;
    const reference = state.reference ?? "";
    const wa = `${whatsappBase}?text=${encodeURIComponent(
      at
        ? `Hello Sabicars, I booked a viewing of the ${vehicleTitle} for ${slotLabel(at)} (reference ${reference}).`
        : `Hello Sabicars, I just enquired about the ${vehicleTitle} on your website (reference ${reference}).`,
    )}`;
    return (
      <div className="relative">
        {anchors}
        {state.kind === "callback" ? (
          <div ref={confirmation} role="status" className={`scroll-mt-24 ${doneChrome}`}>
            <p className="kicker">Call me back</p>
            <h3 className="mt-3 text-display-3">We will call {state.phone || "you"} shortly.</h3>
            <p className="mt-4 text-text-secondary">
              About the {vehicleTitle}. Your reference is <strong className="figures text-text-primary">{reference}</strong>. If we call outside
              opening hours, it will be first thing in the morning.
            </p>
          </div>
        ) : (
          <div ref={confirmation} role="status" className={`scroll-mt-24 ${doneChrome}`}>
            <p className="kicker">{at ? "Viewing booked" : "Enquiry received"}</p>
            <h3 className="mt-3 text-display-3">Thank you, {state.name}.</h3>
            {at ? (
              <p className="mt-4 text-text-secondary">
                We will see you on <strong className="text-text-primary">{slotLabel(at)}</strong> at {address}, to see the {vehicleTitle}. Your
                reference is <strong className="figures text-text-primary">{reference}</strong>. Bring your mechanic if you like. If your plans
                change, tell us on WhatsApp.
              </p>
            ) : (
              <p className="mt-4 text-text-secondary">
                Your reference is <strong className="figures text-text-primary">{reference}</strong>. A member of the Sabicars team will contact
                you about the {vehicleTitle}.
              </p>
            )}
            <div className="mt-8 flex flex-wrap gap-3">
              {at && <CalendarLinks file={calendarFileUrl(reference)} google={googleCalendarUrl(at, vehicleTitle, address, reference)} />}
              {/* Long enough to wrap on a phone: allowed to, rather than pushing the page sideways. */}
              <ButtonAnchor href={wa} target="_blank" rel="noopener noreferrer" variant="secondary" arrow className="w-full py-3 text-center !whitespace-normal sm:w-auto">
                Continue on WhatsApp with your reference
              </ButtonAnchor>
            </div>
          </div>
        )}
      </div>
    );
  }

  const way = (w: (typeof WAYS)[number]) => (
    <label
      key={w.value}
      // 13px on a phone, so the three names take as little room as they can; they may still sit on two lines.
      className={`flex min-h-11 cursor-pointer items-center justify-center rounded-full px-1 text-center text-[0.8125rem] font-semibold leading-tight transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-[var(--focus)] sm:text-sm ${
        type === w.value
          ? "bg-[linear-gradient(180deg,var(--green-300),var(--green-500))] text-[#090E0A] shadow-[inset_0_1px_0_rgb(255_255_255/0.4)]"
          : "text-text-secondary hover:text-text-primary"
      }`}
    >
      <input type="radio" name="enquiryKind" value={w.value} checked={type === w.value} onChange={() => setType(w.value)} className="sr-only" />
      {w.label}
    </label>
  );

  const callback = type === "callback";
  const lead = callback
    ? "Leave your number. We call you about this car."
    : type === "question"
      ? "Tell us what you want to know. We reply by phone or WhatsApp."
      : offsite
        ? "Pick a day and time. We confirm the place with you."
        : "Pick a day and time to see it at the showroom.";

  return (
    <div className="relative">
      {anchors}
      {/* Every field stays mounted whichever way is chosen, so what a buyer typed on one way is still there on
          another. The fields a way does not need are hidden and disabled (a disabled control is left out of the
          form data); the server ignores a name on a call-back in any case. */}
      <form id="enquiry-card" action={action} className={`relative grid gap-6 ${chrome}`} noValidate>
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

        <fieldset>
          <legend className="sr-only">How would you like to enquire?</legend>
          <div className="grid grid-cols-3 gap-1 rounded-full border border-border-default bg-surface-1 p-1">{WAYS.map(way)}</div>
          <p className="mt-4 text-sm text-text-secondary">{lead}</p>
        </fieldset>

        {state?.error && (
          <p role="alert" className="border-l-2 border-danger bg-surface-2 px-4 py-3 text-sm text-danger">
            {state.error}
          </p>
        )}

        {/* The time first: it is what "Book a viewing" promised, and the details follow. */}
        {type === "viewing" && (
          <>
            <input type="hidden" name="viewingAt" value={slot} />
            <SlotPicker taken={taken} chosen={slot} onChoose={setSlot} error={state?.fieldErrors?.viewingAt} />
          </>
        )}

        <div className={`grid gap-6 ${callback ? "" : "sm:grid-cols-2"}`}>
          <label hidden={callback} className="grid gap-2">
            <span className="text-sm font-medium text-text-secondary">Your name</span>
            <input name="name" autoComplete="name" required disabled={callback} defaultValue={state?.values?.name} className={field} />
            <FieldError message={state?.fieldErrors?.name} />
          </label>
          <label className="grid gap-2">
            <span className="text-sm font-medium text-text-secondary">Phone number</span>
            <input
              name="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              required
              maxLength={40}
              placeholder="0803 123 4567"
              defaultValue={state?.values?.phone}
              aria-invalid={Boolean(state?.fieldErrors?.phone) || undefined}
              className={`figures ${field}`}
            />
            <FieldError message={state?.fieldErrors?.phone} />
          </label>
        </div>

        <fieldset hidden={callback} disabled={callback} className="grid gap-6">
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
            <span className="text-sm font-medium text-text-secondary">{type === "viewing" ? "Email (optional), for your booking details" : "Email (optional)"}</span>
            <input name="email" type="email" autoComplete="email" defaultValue={state?.values?.email} className={field} />
            <FieldError message={state?.fieldErrors?.email} />
          </label>
        </fieldset>

        <div>
          <Button type="submit" size="lg" disabled={pending} className="w-full sm:w-auto">
            {pending ? "Sending…" : callback ? "Call me back" : type === "viewing" ? "Book the viewing" : "Send my question"}
          </Button>
          <p className="mt-4 text-xs text-text-muted">
            {callback ? "We call about this car only." : "Your details are used only to reply to this enquiry."} <PrivacyLink />
          </p>
        </div>
      </form>
    </div>
  );
}
