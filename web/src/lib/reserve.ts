import "server-only";
import { randomBytes } from "node:crypto";
import { after } from "next/server";
import { and, desc, eq, inArray, lt, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { leads, reservations, staff, vehicles, type Reservation } from "@/db/schema";
import { notifyManagers, pushToStaff } from "@/lib/alerts";
import type { StaffMember } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { emailConfigured, esc, sendEmail } from "@/lib/email";
import { sabicarsDealerId, saveLead } from "@/lib/leads";
import { formatNaira } from "@/lib/money";
import {
  initializeTransaction,
  PAYSTACK_MAX_MINOR,
  paystackConfigured,
  PayoutError,
  refundsFor,
  refundTransaction,
  verifyTransaction,
  type PaymentOutcome,
} from "@/lib/paystack";
import { refreshPublicPages } from "@/lib/public-pages";
import { referenceFor } from "@/lib/reference";
import {
  depositChoices,
  holdDaysFor,
  holdLabel,
  holdsUntil,
  PENDING_MINUTES,
  refundFor,
  stillHolding,
  type DepositChoice,
  type ReservationStatus,
} from "@/lib/reservations";
import { site, siteUrl, whatsappLink } from "@/lib/site";
import { vehicleTitle } from "@/lib/vehicle";

/**
 * Reserving a car with a deposit, end to end: the quote on the reserve page,
 * the start of a payment on Paystack, the confirmation when the money lands
 * (from the buyer coming back, or from the webhook — whichever is first, and
 * only once), the hold running out, and what staff do with a reservation.
 * The policy itself is lib/reservations.ts.
 *
 * Two rules keep the money honest. A payment Paystack confirms is always
 * recorded, whatever state the row is in by then: a late bank transfer on a
 * cancelled attempt holds the car again if it is free, or is handed to the
 * managers if it is not. And a row that stops holding the car (an attempt
 * nobody paid for in 30 minutes, a hold that ran out) is moved on before
 * anyone else is let in, so the database's one-buyer-per-car rule and the
 * policy's clock never disagree.
 */

export type ReserveBlock = "sold" | "reserved" | "unpriced" | "offsite" | "unlisted";

export interface ReserveQuote {
  vehicle: { id: string; slug: string; title: string; priceMinor: number | null; status: string };
  /** Why the car cannot be reserved online right now, or null. */
  blocked: ReserveBlock | null;
  /** The deposits on offer; `online` is false where it cannot be paid on Paystack in one payment (or payments are off). */
  choices: (DepositChoice & { online: boolean })[];
  /** Whether online payment is switched on at all (Paystack key present). */
  paymentsOn: boolean;
}

/**
 * Rows that have stopped holding the car are moved on: an unpaid attempt
 * older than 30 minutes is cancelled, a paid hold past its date is expired.
 * Run for one car before letting a new buyer in, and for all cars by the
 * hourly job. Returns what it moved, so callers can tell people.
 */
export async function sweepStale(vehicleId: string | null, now = new Date()): Promise<{ id: string; dealerId: string; vehicleId: string; buyerName: string; amountMinor: number; was: "pending" | "held" }[]> {
  const pendingBefore = new Date(now.getTime() - PENDING_MINUTES * 60_000);
  const rows = await db
    .update(reservations)
    .set({
      status: sql`case when ${reservations.status} = 'pending' then 'cancelled'::reservation_status else 'expired'::reservation_status end`,
      releasedAt: now,
      updatedAt: now,
      note: sql`case when ${reservations.status} = 'pending' then coalesce(${reservations.note} || ' ', '') || 'Not paid within ${sql.raw(String(PENDING_MINUTES))} minutes.' else ${reservations.note} end`,
    })
    .where(
      and(
        vehicleId ? eq(reservations.vehicleId, vehicleId) : sql`true`,
        or(
          and(eq(reservations.status, "pending"), lt(reservations.createdAt, pendingBefore)),
          and(eq(reservations.status, "held"), lt(reservations.holdsUntil, now)),
        ),
      ),
    )
    .returning({
      id: reservations.id,
      dealerId: reservations.dealerId,
      vehicleId: reservations.vehicleId,
      buyerName: reservations.buyerName,
      amountMinor: reservations.amountMinor,
      status: reservations.status,
    });
  return rows.map((r) => ({ ...r, was: r.status === "expired" ? "held" : "pending" }));
}

/** The live reservation holding a car, if any: one that is paid and within its hold, or an attempt under way. */
export async function liveReservationFor(vehicleId: string, now = new Date()): Promise<Reservation | null> {
  const rows = await db
    .select()
    .from(reservations)
    .where(and(eq(reservations.vehicleId, vehicleId), inArray(reservations.status, ["pending", "held"])))
    .orderBy(desc(reservations.createdAt))
    .limit(3);
  return rows.find((r) => stillHolding(r, now)) ?? null;
}

export async function reserveQuote(vehicle: { id: string; slug: string; year: number; make: string; model: string; priceMinor: number | null; status: string; heldOffsite: boolean }): Promise<ReserveQuote> {
  const title = vehicleTitle(vehicle);
  const paymentsOn = paystackConfigured();
  const base = { vehicle: { id: vehicle.id, slug: vehicle.slug, title, priceMinor: vehicle.priceMinor, status: vehicle.status }, paymentsOn };
  if (vehicle.status === "sold") return { ...base, blocked: "sold", choices: [] };
  if (vehicle.status !== "available" && vehicle.status !== "reserved") return { ...base, blocked: "unlisted", choices: [] };
  if (vehicle.status === "reserved" || (await liveReservationFor(vehicle.id))) return { ...base, blocked: "reserved", choices: [] };
  if (vehicle.heldOffsite) return { ...base, blocked: "offsite", choices: [] };
  if (!vehicle.priceMinor) return { ...base, blocked: "unpriced", choices: [] };
  return {
    ...base,
    blocked: null,
    choices: depositChoices(vehicle.priceMinor).map((c) => ({ ...c, online: paymentsOn && c.amountMinor <= PAYSTACK_MAX_MINOR })),
  };
}

/** `scr_` and twelve letters and digits: ours, and what Paystack is given. */
function newReference(): string {
  const alphabet = "abcdefghjkmnpqrstuvwxyz23456789";
  const bytes = randomBytes(12);
  return `scr_${Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("")}`;
}

/** The lead row just filed under a reference, so a reservation can point at it. */
async function leadIdFor(dealerId: string, reference: string): Promise<string | null> {
  const recent = await db.select({ id: leads.id }).from(leads).where(eq(leads.dealerId, dealerId)).orderBy(desc(leads.createdAt)).limit(5);
  return recent.find((l) => referenceFor(l.id) === reference)?.id ?? null;
}

export type BeginResult =
  | { ok: true; kind: "pay"; url: string; reference: string }
  | { ok: true; kind: "arranged"; reference: string }
  | { ok: false; error: string };

const HELD_BY_ANOTHER = "Another buyer is holding this car right now. Ask us to tell you if it comes free.";

/**
 * A buyer's deposit, started. Within Paystack's limit the buyer goes to the
 * checkout; above it, or with payments off, the team arranges a bank
 * transfer and nothing is held until the money lands. The reservation row
 * is taken first — the database refuses a second buyer — and only then is
 * the enquiry filed, so a refused attempt leaves no "reserving…" lead behind.
 */
export async function beginReservation(input: {
  slug: string;
  amountMinor: number;
  name: string;
  phone: string;
  email: string;
  landingPath: string;
}): Promise<BeginResult> {
  const dealerId = await sabicarsDealerId();
  const [vehicle] = await db
    .select({ id: vehicles.id, slug: vehicles.slug, year: vehicles.year, make: vehicles.make, model: vehicles.model, priceMinor: vehicles.priceMinor, status: vehicles.status, heldOffsite: vehicles.heldOffsite })
    .from(vehicles)
    .where(and(eq(vehicles.dealerId, dealerId), eq(vehicles.slug, input.slug)))
    .limit(1);
  if (!vehicle) return { ok: false, error: "This car is no longer listed." };
  await sweepStale(vehicle.id);
  const quote = await reserveQuote(vehicle);
  if (quote.blocked === "sold") return { ok: false, error: "This car has been sold." };
  if (quote.blocked === "reserved") return { ok: false, error: HELD_BY_ANOTHER };
  if (quote.blocked === "unlisted") return { ok: false, error: "This car is no longer listed." };
  if (quote.blocked) return { ok: false, error: "This car cannot be reserved online. Please call us." };
  const price = vehicle.priceMinor!;
  const holdDays = holdDaysFor(input.amountMinor, price);
  if (holdDays === null) return { ok: false, error: "Choose one of the deposits offered." };
  const title = vehicleTitle(vehicle);
  const amount = formatNaira(input.amountMinor);
  const online = quote.paymentsOn && input.amountMinor <= PAYSTACK_MAX_MINOR;

  if (!online) {
    const reference = await saveLead({
      dealerId,
      type: "reservation",
      channel: "web_form",
      vehicleId: vehicle.id,
      name: input.name,
      phone: input.phone,
      email: input.email || null,
      message: `Wants to reserve the ${title} with ${amount} (holds it ${holdLabel(holdDays)}) by bank transfer. Send the account details and confirm when the money lands.`,
      preferredContact: "phone",
      landingPath: input.landingPath,
    });
    return { ok: true, kind: "arranged", reference };
  }

  const reference = newReference();
  let rowId: string;
  try {
    const [row] = await db
      .insert(reservations)
      .values({
        dealerId,
        vehicleId: vehicle.id,
        buyerName: input.name,
        buyerPhone: input.phone,
        buyerEmail: input.email || null,
        amountMinor: input.amountMinor,
        priceMinor: price,
        holdDays,
        status: "pending",
        reference,
        source: "online",
      })
      .returning({ id: reservations.id });
    rowId = row.id;
  } catch (e) {
    // The one-per-car index: another buyer started first.
    console.error("[reserve] could not hold the car", e instanceof Error ? e.message : e);
    return { ok: false, error: HELD_BY_ANOTHER };
  }

  const leadReference = await saveLead({
    dealerId,
    type: "reservation",
    channel: "web_form",
    vehicleId: vehicle.id,
    name: input.name,
    phone: input.phone,
    email: input.email || null,
    message: `Reserving the ${title} with ${amount} (holds it ${holdLabel(holdDays)}). Paying on Paystack, reference ${reference}.`,
    preferredContact: "phone",
    landingPath: input.landingPath,
  });
  const leadId = await leadIdFor(dealerId, leadReference);
  if (leadId) await db.update(reservations).set({ leadId }).where(eq(reservations.id, rowId));

  try {
    const checkout = await initializeTransaction({
      email: input.email,
      amountMinor: input.amountMinor,
      reference,
      // Bare: Paystack appends ?trxref=…&reference=… itself.
      callbackUrl: `${siteUrl()}/reserve/done`,
      channels: ["card", "bank_transfer"],
      metadata: {
        cancel_action: `${siteUrl()}/vehicles/${vehicle.slug}`,
        custom_fields: [
          { display_name: "Car", variable_name: "car", value: title },
          { display_name: "Reference", variable_name: "reference", value: reference },
          { display_name: "Buyer", variable_name: "buyer", value: `${input.name} · ${input.phone}` },
        ],
      },
    });
    return { ok: true, kind: "pay", url: checkout.authorizationUrl, reference };
  } catch (e) {
    await db.update(reservations).set({ status: "cancelled", releasedAt: new Date(), note: "Paystack could not start the payment.", updatedAt: new Date() }).where(eq(reservations.id, rowId));
    console.error("[reserve] paystack initialize failed", e instanceof PayoutError ? e.message : e);
    return { ok: false, error: `The payment could not be started. Please try again, or call ${site.phones[0].display} and we will reserve it for you.` };
  }
}

export type ConfirmOutcome =
  /** Paid: the car is held. */
  | "held"
  /** Nothing to do: the row had already moved on (and no new money arrived). */
  | "already"
  /** Paystack is still processing (a bank transfer on its way). */
  | "in_flight"
  /** The payment failed or was abandoned; the attempt is closed so the buyer can try again. */
  | "not_paid"
  /** Money arrived, but not the amount asked for, or not in naira: recorded, car freed, managers told. */
  | "mismatch"
  /** Money arrived after the attempt was cancelled or the hold ran out: recorded; the car is held again if free, else managers decide. */
  | "late"
  | "unknown";

const IN_FLIGHT = new Set(["ongoing", "pending", "processing", "queued"]);
const DEAD = new Set(["failed", "abandoned", "reversed"]);

/**
 * What Paystack says about a payment, applied to its row. Safe to call twice
 * — from the buyer's return and from the webhook — because every change is
 * conditional on the state it expects, so only one of two callers wins.
 */
export async function confirmReservation(payment: PaymentOutcome): Promise<ConfirmOutcome> {
  const [row] = await db.select().from(reservations).where(eq(reservations.reference, payment.reference)).limit(1);
  if (!row) return "unknown";
  const now = new Date();

  if (payment.status !== "success") {
    if (row.status !== "pending") return "already";
    if (IN_FLIGHT.has(payment.status)) return "in_flight";
    if (DEAD.has(payment.status)) {
      // Closed, so the buyer's own attempt no longer stands in their way when they try again.
      await db
        .update(reservations)
        .set({ status: "cancelled", releasedAt: now, note: `Payment ${payment.status}.`, updatedAt: now })
        .where(and(eq(reservations.id, row.id), eq(reservations.status, "pending")));
      return "not_paid";
    }
    return "in_flight";
  }

  // From here Paystack has the money. Whatever the row's state, that is recorded.
  if (row.paidAt) return "already";
  const paidAt = payment.paidAt ?? now;
  const received = { paidAt, paidMinor: payment.amountMinor, channel: payment.channel, feeMinor: payment.feeMinor };
  const [vehicle] = await db
    .select({ id: vehicles.id, slug: vehicles.slug, year: vehicles.year, make: vehicles.make, model: vehicles.model, status: vehicles.status })
    .from(vehicles)
    .where(eq(vehicles.id, row.vehicleId))
    .limit(1);
  const title = vehicle ? vehicleTitle(vehicle) : "the car";

  if (payment.currency !== "NGN" || payment.amountMinor < row.amountMinor) {
    // Short, or the wrong money: the attempt is closed so the car is not stuck, the money is on record, and a manager decides.
    await db
      .update(reservations)
      .set({ ...received, status: "cancelled", releasedAt: now, updatedAt: now, note: `Paid ${formatNaira(payment.amountMinor)} ${payment.currency} of the ${formatNaira(row.amountMinor)} asked for.` })
      .where(and(eq(reservations.id, row.id), eq(reservations.status, row.status)));
    console.error("[reserve] payment does not match the reservation", { reference: payment.reference, paid: payment.amountMinor, expected: row.amountMinor, currency: payment.currency });
    await notifyManagers(row.dealerId, {
      title: `A deposit does not match: ${title}`,
      body: `${row.buyerName} paid ${formatNaira(payment.amountMinor)} ${payment.currency}; the deposit was ${formatNaira(row.amountMinor)}. Decide: hold the car, or refund.`,
      url: "/admin/reservations",
      tag: `reservation-mismatch:${row.id}`,
    }).catch((e) => console.error("[reserve] mismatch alert failed", e));
    return "mismatch";
  }

  const until = holdsUntil(paidAt, row.holdDays);
  const late = row.status !== "pending";
  if (late) {
    // Money after the attempt was closed. If the car is free, the payment holds it after all; if not, the managers decide.
    await sweepStale(row.vehicleId, now);
    const other = await liveReservationFor(row.vehicleId, now);
    const free = !other && vehicle?.status === "available";
    await db
      .update(reservations)
      .set({
        ...received,
        ...(free ? { status: "held" as const, holdsUntil: until, releasedAt: null } : {}),
        updatedAt: now,
        note: [row.note, free ? "Paid after the attempt had closed; the car was free, so it is held." : "Paid after the attempt had closed, and the car was no longer free."].filter(Boolean).join(" "),
      })
      .where(and(eq(reservations.id, row.id), sql`${reservations.paidAt} IS NULL`));
    if (!free) {
      await notifyManagers(row.dealerId, {
        title: `Late payment on the ${title}`,
        body: `${row.buyerName} paid ${formatNaira(payment.amountMinor)} after their attempt closed, and the car is not free. Hold it for them, or refund.`,
        url: "/admin/reservations",
        tag: `reservation-late:${row.id}`,
      }).catch((e) => console.error("[reserve] late-payment alert failed", e));
      return "late";
    }
  } else {
    const won = await db
      .update(reservations)
      .set({ ...received, status: "held", holdsUntil: until, updatedAt: now })
      .where(and(eq(reservations.id, row.id), eq(reservations.status, "pending")))
      .returning({ id: reservations.id });
    if (!won.length) return "already";
  }

  if (vehicle?.status === "available") {
    await db.update(vehicles).set({ status: "reserved", updatedAt: now }).where(and(eq(vehicles.id, row.vehicleId), eq(vehicles.status, "available")));
  } else if (vehicle && vehicle.status !== "reserved") {
    // Paid for a car that is no longer on offer: the hold stands on record; a manager sorts it out with the buyer.
    await notifyManagers(row.dealerId, {
      title: `Deposit paid on a car that is ${vehicle.status}: ${title}`,
      body: `${row.buyerName} paid ${formatNaira(payment.amountMinor)}. Call them: ${row.buyerPhone}.`,
      url: "/admin/reservations",
      tag: `reservation-conflict:${row.id}`,
    }).catch((e) => console.error("[reserve] conflict alert failed", e));
  }

  after(async () => {
    try {
      if (vehicle) refreshPublicPages(vehicle.slug);
    } catch (e) {
      console.error("[reserve] could not refresh the car's pages", e);
    }
    try {
      const people = await db.select({ id: staff.id }).from(staff).where(and(eq(staff.dealerId, row.dealerId), eq(staff.isActive, true), eq(staff.receivesAlerts, true)));
      await pushToStaff(
        people.map((p) => p.id),
        {
          title: `Deposit paid: ${formatNaira(payment.amountMinor)} on the ${title}`,
          body: `${row.buyerName} · ${row.buyerPhone}. Held until ${until.toLocaleDateString("en-GB", { day: "numeric", month: "long", timeZone: "Africa/Lagos" })}.`,
          url: row.leadId ? `/admin/leads/${row.leadId}` : "/admin/reservations",
          tag: `reservation:${row.id}`,
        },
      );
      if (row.buyerEmail && emailConfigured()) {
        const sent = await sendEmail(receiptEmail({ ...row, paidAt, holdsUntil: until }, title, vehicle?.slug ?? null), { dedupeKey: `reservation-receipt:${row.id}` });
        if (!sent.ok) console.error("[reserve] receipt email failed", row.reference, sent.error);
      }
    } catch (e) {
      console.error("[reserve] after-payment alerts failed", e);
    }
  });
  return late ? "late" : "held";
}

/** The buyer is back from Paystack: ask Paystack what happened, and act on it. */
export async function settleReturn(reference: string): Promise<{ outcome: ConfirmOutcome | "error"; reservation: Reservation | null; title: string | null; slug: string | null }> {
  const [row] = await db.select().from(reservations).where(eq(reservations.reference, reference)).limit(1);
  if (!row) return { outcome: "unknown", reservation: null, title: null, slug: null };
  const [vehicle] = await db.select({ year: vehicles.year, make: vehicles.make, model: vehicles.model, slug: vehicles.slug }).from(vehicles).where(eq(vehicles.id, row.vehicleId)).limit(1);
  const title = vehicle ? vehicleTitle(vehicle) : null;
  const slug = vehicle?.slug ?? null;
  // Already paid (the webhook got here first), or closed without money: nothing to ask Paystack.
  if (row.paidAt || (row.status !== "pending" && !paystackConfigured())) return { outcome: "already", reservation: row, title, slug };
  try {
    const payment = await verifyTransaction(reference);
    const outcome = await confirmReservation(payment);
    const [fresh] = await db.select().from(reservations).where(eq(reservations.id, row.id)).limit(1);
    return { outcome, reservation: fresh ?? row, title, slug };
  } catch (e) {
    console.error("[reserve] verify failed", reference, e instanceof Error ? e.message : e);
    return { outcome: "error", reservation: row, title, slug };
  }
}

/**
 * Holds that have run out, and attempts nobody paid for: moved on, the cars
 * put back on offer, the managers told about the holds. The deposit stays
 * recorded; what happens to it is the team's call.
 */
export async function expireReservations(now = new Date()): Promise<number> {
  const moved = await sweepStale(null, now);
  for (const vehicleId of new Set(moved.map((r) => r.vehicleId))) await releaseVehicle(vehicleId, now);
  const ran = moved.filter((r) => r.was === "held");
  for (const r of ran) {
    const [vehicle] = await db.select({ year: vehicles.year, make: vehicles.make, model: vehicles.model }).from(vehicles).where(eq(vehicles.id, r.vehicleId)).limit(1);
    await notifyManagers(r.dealerId, {
      title: `A hold has run out: ${vehicle ? vehicleTitle(vehicle) : "a car"}`,
      body: `${r.buyerName}'s ${formatNaira(r.amountMinor)} deposit no longer holds it. The car is back on offer; decide on the deposit.`,
      url: "/admin/reservations",
      tag: `reservation-expired:${r.id}`,
    }).catch((e) => console.error("[reserve] expiry alert failed", e));
  }
  return ran.length;
}

/** A reserved car with nobody holding it any more is available again. */
async function releaseVehicle(vehicleId: string, now = new Date()): Promise<void> {
  if (await liveReservationFor(vehicleId, now)) return;
  const [v] = await db
    .update(vehicles)
    .set({ status: "available", updatedAt: now })
    .where(and(eq(vehicles.id, vehicleId), eq(vehicles.status, "reserved")))
    .returning({ slug: vehicles.slug });
  if (v) refreshPublicPages(v.slug);
}

/* ── What staff do ────────────────────────────────────────────────────── */

type Result = { ok: true } | { ok: false; error: string };

/** A deposit taken at the showroom — cash, POS, or a transfer to the bank — recorded so the car is held for that buyer everywhere. */
export async function recordShowroomReservation(
  me: StaffMember,
  input: { vehicleId: string; name: string; phone: string; email: string | null; amountMinor: number; channel: "cash" | "pos" | "bank"; note: string | null },
): Promise<Result> {
  const [vehicle] = await db
    .select({ id: vehicles.id, slug: vehicles.slug, year: vehicles.year, make: vehicles.make, model: vehicles.model, priceMinor: vehicles.priceMinor, status: vehicles.status, heldOffsite: vehicles.heldOffsite })
    .from(vehicles)
    .where(and(eq(vehicles.id, input.vehicleId), eq(vehicles.dealerId, me.dealerId)))
    .limit(1);
  if (!vehicle) return { ok: false, error: "That car is not in the inventory." };
  if (vehicle.status === "sold") return { ok: false, error: "That car is sold." };
  if (vehicle.status !== "available" && vehicle.status !== "reserved") return { ok: false, error: "That car is not on sale (draft or unlisted)." };
  await sweepStale(vehicle.id);
  if (await liveReservationFor(vehicle.id)) return { ok: false, error: "Another buyer is already holding that car." };
  if (!vehicle.priceMinor) return { ok: false, error: "Give the car a price first." };
  const holdDays = holdDaysFor(input.amountMinor, vehicle.priceMinor);
  if (holdDays === null) return { ok: false, error: `The deposit must be at least ${formatNaira(Math.min(vehicle.priceMinor, 500_000 * 100))} and not more than the price.` };
  const now = new Date();
  const reference = newReference();
  let rowId: string;
  try {
    const [row] = await db
      .insert(reservations)
      .values({
        dealerId: me.dealerId,
        vehicleId: vehicle.id,
        buyerName: input.name,
        buyerPhone: input.phone,
        buyerEmail: input.email,
        amountMinor: input.amountMinor,
        priceMinor: vehicle.priceMinor,
        holdDays,
        status: "held",
        reference,
        source: "showroom",
        channel: input.channel,
        paidAt: now,
        paidMinor: input.amountMinor,
        holdsUntil: holdsUntil(now, holdDays),
        note: input.note,
        createdBy: me.id,
      })
      .returning({ id: reservations.id });
    rowId = row.id;
  } catch (e) {
    console.error("[reserve] showroom reservation failed", e);
    return { ok: false, error: "Could not record the deposit. Is another buyer holding the car?" };
  }
  const leadReference = await saveLead({
    dealerId: me.dealerId,
    type: "reservation",
    channel: "walk_in",
    vehicleId: vehicle.id,
    name: input.name,
    phone: input.phone,
    email: input.email,
    message: `Deposit of ${formatNaira(input.amountMinor)} taken at the showroom (${input.channel}); holds the ${vehicleTitle(vehicle)} ${holdLabel(holdDays)}.${input.note ? ` ${input.note}` : ""}`,
    preferredContact: "phone",
    landingPath: null,
  });
  const leadId = await leadIdFor(me.dealerId, leadReference);
  if (leadId) await db.update(reservations).set({ leadId }).where(eq(reservations.id, rowId));
  await db.update(vehicles).set({ status: "reserved", updatedAt: now }).where(and(eq(vehicles.id, vehicle.id), eq(vehicles.status, "available")));
  refreshPublicPages(vehicle.slug);
  await audit(me, "reservation", rowId, "create", { amountMinor: input.amountMinor, channel: input.channel, vehicleId: vehicle.id });
  return { ok: true };
}

/** Where the money came from, and what a refund returns: the amount received, or the deposit asked for. */
function paidAmount(row: Reservation): number {
  return row.paidMinor ?? row.amountMinor;
}

/**
 * A reservation ended by staff: cancelled (nothing was paid, or the buyer
 * walked away and the deposit stays with Sabicars), or refunded (the money
 * back less the 18% charge; sent through Paystack for an online deposit,
 * recorded for a showroom one). A refund already on Paystack's books is
 * reused, never sent twice.
 */
export async function endReservation(me: StaffMember, id: string, how: "cancel" | "refund", note: string | null): Promise<Result> {
  const [row] = await db.select().from(reservations).where(and(eq(reservations.id, id), eq(reservations.dealerId, me.dealerId))).limit(1);
  if (!row) return { ok: false, error: "That reservation is not here." };
  if (row.status === "refunded" || row.status === "completed") return { ok: false, error: "That reservation is already finished." };
  const now = new Date();
  if (how === "refund") {
    if (!row.paidAt) return { ok: false, error: "Nothing was paid on this reservation, so there is nothing to refund. Cancel it instead." };
    const { refundMinor } = refundFor(paidAmount(row));
    let sent = "";
    if (row.source === "online") {
      if (!paystackConfigured()) return { ok: false, error: "Paystack is not set up: add PAYSTACK_SECRET_KEY in Vercel before refunding an online deposit, or refund it from the bank and cancel the reservation with a note." };
      try {
        const earlier = (await refundsFor(row.reference)).find((r) => r.status !== "failed");
        if (earlier) {
          sent = `Paystack refund ${earlier.status} (sent earlier, ${formatNaira(earlier.amountMinor)}).`;
        } else {
          const r = await refundTransaction(row.reference, refundMinor, `Sabicars deposit refund, less the 18% charge. Reference ${row.reference}.`);
          sent = `Paystack refund ${r.status}.`;
        }
      } catch (e) {
        return { ok: false, error: e instanceof PayoutError ? e.message : "Paystack could not send the refund." };
      }
    }
    await db
      .update(reservations)
      .set({ status: "refunded", refundMinor, refundedAt: now, releasedAt: row.releasedAt ?? now, note: [row.note, note, sent].filter(Boolean).join(" ") || null, updatedAt: now })
      .where(eq(reservations.id, id));
    await audit(me, "reservation", id, "refund", { refundMinor, note });
  } else {
    if (row.status === "cancelled") return { ok: false, error: "That reservation is already cancelled." };
    await db
      .update(reservations)
      .set({ status: "cancelled", releasedAt: row.releasedAt ?? now, note: [row.note, note].filter(Boolean).join(" ") || null, updatedAt: now })
      .where(eq(reservations.id, id));
    await audit(me, "reservation", id, "cancel", { note });
  }
  await releaseVehicle(row.vehicleId, now);
  return { ok: true };
}

/**
 * Paystack's word on a refund we sent: failed means the money did not move,
 * so the row goes back to what it was and a manager is told; processed needs
 * no change. Returns what was done, for the webhook's log.
 */
export async function applyRefundEvent(reference: string, status: "processed" | "failed" | "pending" | "processing" | "needs-attention", detail: string | null): Promise<"updated" | "unchanged" | "unknown"> {
  const [row] = await db.select().from(reservations).where(eq(reservations.reference, reference)).limit(1);
  if (!row) return "unknown";
  if (status !== "failed" && status !== "needs-attention") return "unchanged";
  if (row.status !== "refunded") return "unchanged";
  const now = new Date();
  const back: ReservationStatus = row.holdsUntil && row.holdsUntil > now ? "held" : "expired";
  await db
    .update(reservations)
    .set({ status: back, refundMinor: null, refundedAt: null, note: [row.note, `Paystack refund ${status}${detail ? `: ${detail}` : ""}. The money did not reach the buyer.`].filter(Boolean).join(" "), updatedAt: now })
    .where(eq(reservations.id, row.id));
  await notifyManagers(row.dealerId, {
    title: "A deposit refund did not go through",
    body: `${row.buyerName}'s refund of ${formatNaira(row.refundMinor ?? refundFor(paidAmount(row)).refundMinor)} ${status}. Paystack: ${detail ?? "no reason given"}.`,
    url: "/admin/reservations",
    tag: `reservation-refund:${row.id}`,
  }).catch((e) => console.error("[reserve] refund alert failed", e));
  return "updated";
}

/**
 * The buyer paid the rest: the reservation is complete and the car is kept
 * off the market. The sale itself — the price, the commission — is recorded
 * on the car's own page, as every sale is.
 */
export async function completeReservation(me: StaffMember, id: string): Promise<Result> {
  const [row] = await db.select().from(reservations).where(and(eq(reservations.id, id), eq(reservations.dealerId, me.dealerId))).limit(1);
  if (!row) return { ok: false, error: "That reservation is not here." };
  const now = new Date();
  const won = await db
    .update(reservations)
    .set({ status: "completed", updatedAt: now })
    .where(and(eq(reservations.id, id), inArray(reservations.status, ["held", "expired"]), sql`${reservations.paidAt} IS NOT NULL`))
    .returning({ id: reservations.id });
  if (!won.length) return { ok: false, error: "Only a paid reservation can be completed." };
  const [v] = await db
    .update(vehicles)
    .set({ status: "reserved", updatedAt: now })
    .where(and(eq(vehicles.id, row.vehicleId), eq(vehicles.status, "available")))
    .returning({ slug: vehicles.slug });
  if (v) refreshPublicPages(v.slug);
  await audit(me, "reservation", id, "complete");
  return { ok: true };
}

export interface ReservationRow extends Reservation {
  vehicleTitle: string;
  vehicleSlug: string;
}

/** Every reservation, newest first, with the car named. Stale rows are moved on first, so the list is true. */
export async function reservationsFor(dealerId: string, limit = 200): Promise<ReservationRow[]> {
  await sweepStale(null);
  const rows = await db
    .select({ r: reservations, year: vehicles.year, make: vehicles.make, model: vehicles.model, slug: vehicles.slug })
    .from(reservations)
    .innerJoin(vehicles, eq(vehicles.id, reservations.vehicleId))
    .where(eq(reservations.dealerId, dealerId))
    .orderBy(desc(reservations.createdAt))
    .limit(limit);
  return rows.map((x) => ({ ...x.r, vehicleTitle: vehicleTitle(x), vehicleSlug: x.slug }));
}

export const RESERVATION_STATUS_LABEL: Record<ReservationStatus, string> = {
  pending: "Waiting for payment",
  held: "Holding the car",
  expired: "Hold ran out",
  completed: "Completed",
  refunded: "Refunded",
  cancelled: "Cancelled",
};

/* ── The buyer's receipt ──────────────────────────────────────────────── */

const longDate = (d: Date) => d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Lagos" });

function receiptEmail(r: Reservation & { paidAt: Date; holdsUntil: Date }, title: string, slug: string | null) {
  const first = r.buyerName.trim().split(/\s+/)[0];
  const url = slug ? `${siteUrl()}/vehicles/${slug}` : siteUrl();
  const amount = paidAmount(r);
  const { refundMinor } = refundFor(amount);
  const wa = whatsappLink(`Hello Sabicars, about my deposit on the ${title} (reference ${r.reference}).`);
  const text = [
    `Hello ${first},`,
    ``,
    `We received your deposit of ${formatNaira(amount)} on the ${title}.`,
    `The car is held for you until ${longDate(r.holdsUntil)}.`,
    `Reference ${r.reference}.`,
    ``,
    `What happens next: the team calls you to agree how you pay the rest (bank transfer or at the showroom) and when you collect. Bring your ID.`,
    `If you change your mind: the deposit is refunded less 18% (${formatNaira(refundMinor)} back). Tell us on WhatsApp: ${wa}`,
    ``,
    `${site.legalName} · CAC RC ${site.rcNumber} · ${site.address.line1}, ${site.address.line2}, ${site.address.city}`,
  ].join("\n");
  const html = `<!doctype html><html><body style="margin:0;background:#090E0A;font-family:Helvetica,Arial,sans-serif;color:#F2F2EC">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#090E0A"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px">
<tr><td style="padding:0 0 28px"><img src="${esc(siteUrl())}/brand/logo-email.png" width="220" height="45" alt="Sabicars" style="display:block;border:0"><div style="padding-top:14px;font-size:12px;letter-spacing:3px;color:#8DC74D">DEPOSIT RECEIVED</div></td></tr>
<tr><td style="font-size:16px;line-height:1.6;color:#CFD2CC">Hello ${esc(first)},</td></tr>
<tr><td style="padding:12px 0 0;font-weight:bold;letter-spacing:-0.4px;font-size:26px;line-height:1.2;color:#F2F2EC">${esc(formatNaira(amount))} received</td></tr>
<tr><td style="padding:8px 0 0;font-size:16px;line-height:1.6;color:#CFD2CC">The <a href="${esc(url)}" style="color:#A5DB6F">${esc(title)}</a> is held for you until <strong style="color:#F2F2EC">${esc(longDate(r.holdsUntil))}</strong>.</td></tr>
<tr><td style="padding:20px 0 0;font-size:15px;line-height:1.6;color:#CFD2CC">What happens next: the team calls you to agree how you pay the rest, by bank transfer or at the showroom, and when you collect. Bring your ID.</td></tr>
<tr><td style="padding:12px 0 0;font-size:15px;line-height:1.6;color:#CFD2CC">If you change your mind, the deposit is refunded less 18%: ${esc(formatNaira(refundMinor))} back.</td></tr>
<tr><td style="padding:28px 0 18px"><a href="${esc(wa)}" style="display:inline-block;background:#F7801E;color:#090E0A;padding:15px 26px;border-radius:999px;font-size:15px;font-weight:bold;text-decoration:none">Talk to us on WhatsApp</a></td></tr>
<tr><td style="padding:24px 0 0;font-size:13px;line-height:1.6;color:#9FA59E">Reference ${esc(r.reference)}.<br><br>${esc(site.legalName)} · CAC RC ${esc(site.rcNumber)}<br>${esc(site.address.line1)}, ${esc(site.address.line2)}, ${esc(site.address.city)}</td></tr>
</table></td></tr></table></body></html>`;
  return { to: r.buyerEmail ?? "", subject: `Your ${formatNaira(amount)} deposit on the ${title}`, html, text, replyTo: site.email };
}
