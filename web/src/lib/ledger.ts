import "server-only";
import { randomUUID } from "node:crypto";
import { and, asc, count, desc, eq, inArray, isNotNull, lte, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { commissions, leads, partners, payouts, staff, vehicles, type Commission, type Partner, type Payout } from "@/db/schema";
import { audit } from "@/lib/audit";
import { can, type StaffMember } from "@/lib/auth";
import { commissionFor, isPayable, maskAccount, nameMatches, payoutReference, transferFeeMinor } from "@/lib/ledger-rules";
import { balanceMinor, createRecipient, initiateTransfer, paystackConfigured, PayoutError, resolveAccount, verifyTransfer, type TransferStatus } from "@/lib/paystack";
import { vehicleTitle } from "@/lib/vehicle";

/**
 * The commission ledger: every write to a commission or a payout goes
 * through here, so the rules in lib/ledger-rules.ts and the database's own
 * constraints are the only two places a rule lives.
 *
 * Money never sits with a partner inside the platform. A commission is a
 * record of what Sabicars owes; a payout is the record of Sabicars paying it,
 * by Paystack transfer from its own balance or by a bank transfer recorded
 * by hand. Either way the partner is paid once, into an account in their
 * own name.
 */

const TOKEN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

/* ── Reading ────────────────────────────────────────────────────────────── */

export interface CommissionRow {
  id: string;
  vehicleId: string;
  vehicleTitle: string;
  vehicleSlug: string;
  salePriceMinor: number;
  amountMinor: number;
  status: Commission["status"];
  /** A pending commission whose cooling-off has passed. */
  payable: boolean;
  earnedAt: Date;
  payableAt: Date;
  paidAt: Date | null;
  voidReason: string | null;
  source: string;
}

export interface PayoutRow {
  id: string;
  commissionId: string;
  partnerId: string;
  partnerName: string;
  partnerCode: string;
  vehicleTitle: string;
  amountMinor: number;
  feeMinor: number | null;
  method: string;
  status: Payout["status"];
  reference: string;
  transferCode: string | null;
  bankReference: string | null;
  bankName: string | null;
  accountMasked: string | null;
  accountName: string | null;
  failureReason: string | null;
  paidAt: Date | null;
  recordedByName: string | null;
  createdAt: Date;
}

/** The bank account as anyone but the partner sees it. */
export interface BankAccountView {
  bankName: string;
  bankCode: string;
  accountMasked: string;
  /** The name the bank holds, when Paystack could resolve it. */
  accountName: string | null;
  verifiedAt: Date | null;
  /** Null when the match was automatic; the manager's name when confirmed by hand. */
  verifiedBy: string | null;
  recipientReady: boolean;
}

export interface Totals {
  pendingMinor: number;
  payableMinor: number;
  paidMinor: number;
}

async function commissionRows(where: ReturnType<typeof and>, now: Date): Promise<CommissionRow[]> {
  const rows = await db
    .select({ c: commissions, year: vehicles.year, make: vehicles.make, model: vehicles.model, slug: vehicles.slug })
    .from(commissions)
    .innerJoin(vehicles, eq(vehicles.id, commissions.vehicleId))
    .where(where)
    .orderBy(desc(commissions.earnedAt));
  return rows.map(({ c, year, make, model, slug }) => ({
    id: c.id,
    vehicleId: c.vehicleId,
    vehicleTitle: vehicleTitle({ year, make, model }),
    vehicleSlug: slug,
    salePriceMinor: c.salePriceMinor,
    amountMinor: c.amountMinor,
    status: c.status,
    payable: isPayable(c, now),
    earnedAt: c.earnedAt,
    payableAt: c.payableAt,
    paidAt: c.paidAt,
    voidReason: c.voidReason,
    source: c.source,
  }));
}

function totalsOf(rows: CommissionRow[]): Totals {
  return rows.reduce(
    (t, r) => {
      if (r.status === "paid") t.paidMinor += r.amountMinor;
      else if (r.status === "pending") {
        if (r.payable) t.payableMinor += r.amountMinor;
        else t.pendingMinor += r.amountMinor;
      }
      return t;
    },
    { pendingMinor: 0, payableMinor: 0, paidMinor: 0 },
  );
}

async function bankAccountView(p: Partner): Promise<BankAccountView | null> {
  if (!p.accountNumber || !p.bankCode || !p.bankName) return null;
  let verifiedBy: string | null = null;
  if (p.accountVerifiedBy) {
    const [s] = await db.select({ fullName: staff.fullName, email: staff.email }).from(staff).where(eq(staff.id, p.accountVerifiedBy)).limit(1);
    verifiedBy = s?.fullName ?? s?.email ?? "a manager";
  }
  return {
    bankName: p.bankName,
    bankCode: p.bankCode,
    accountMasked: maskAccount(p.accountNumber),
    accountName: p.accountName,
    verifiedAt: p.accountVerifiedAt,
    verifiedBy,
    recipientReady: Boolean(p.paystackRecipientCode),
  };
}

export interface PartnerStatement {
  partner: { id: string; name: string; code: string; phone: string; email: string | null; status: Partner["status"]; createdAt: Date };
  bank: BankAccountView | null;
  enquiries: { total: number; won: number };
  commissions: CommissionRow[];
  payouts: PayoutRow[];
  totals: Totals;
}

/** A partner's own page, by the private token in their link. Null for anything that is not a live token. */
export async function partnerByToken(token: string, now = new Date()): Promise<PartnerStatement | null> {
  if (!TOKEN.test(token)) return null;
  const [p] = await db.select().from(partners).where(eq(partners.accessToken, token)).limit(1);
  if (!p) return null;
  return statementFor(p, now);
}

/** The same statement, for the admin's partner page. */
export async function partnerStatement(dealerId: string, partnerId: string, now = new Date()): Promise<PartnerStatement | null> {
  if (!TOKEN.test(partnerId)) return null;
  const [p] = await db.select().from(partners).where(and(eq(partners.id, partnerId), eq(partners.dealerId, dealerId))).limit(1);
  if (!p) return null;
  return statementFor(p, now);
}

async function statementFor(p: Partner, now: Date): Promise<PartnerStatement> {
  const [rows, bank, [enq], payoutRows] = await Promise.all([
    commissionRows(and(eq(commissions.partnerId, p.id)), now),
    bankAccountView(p),
    db
      .select({ total: count(), won: sql<number>`count(*) filter (where ${leads.status} = 'won')::int` })
      .from(leads)
      .where(eq(leads.partnerId, p.id)),
    payoutRowsWhere(and(eq(payouts.partnerId, p.id))),
  ]);
  return {
    partner: { id: p.id, name: p.name, code: p.code, phone: p.phone, email: p.email, status: p.status, createdAt: p.createdAt },
    bank,
    enquiries: { total: enq?.total ?? 0, won: enq?.won ?? 0 },
    commissions: rows,
    payouts: payoutRows,
    totals: totalsOf(rows),
  };
}

/** The private link a partner opens their page with. Staff share it; it is never printed in public. */
export async function partnerAccessToken(dealerId: string, partnerId: string): Promise<string | null> {
  const [p] = await db.select({ token: partners.accessToken }).from(partners).where(and(eq(partners.id, partnerId), eq(partners.dealerId, dealerId))).limit(1);
  return p?.token ?? null;
}

async function payoutRowsWhere(where: ReturnType<typeof and>): Promise<PayoutRow[]> {
  const rows = await db
    .select({ p: payouts, partnerName: partners.name, partnerCode: partners.code, year: vehicles.year, make: vehicles.make, model: vehicles.model, byName: staff.fullName, byEmail: staff.email })
    .from(payouts)
    .innerJoin(partners, eq(partners.id, payouts.partnerId))
    .innerJoin(commissions, eq(commissions.id, payouts.commissionId))
    .innerJoin(vehicles, eq(vehicles.id, commissions.vehicleId))
    .leftJoin(staff, eq(staff.id, payouts.recordedBy))
    .where(where)
    .orderBy(desc(payouts.createdAt));
  return rows.map(({ p, partnerName, partnerCode, year, make, model, byName, byEmail }) => ({
    id: p.id,
    commissionId: p.commissionId,
    partnerId: p.partnerId,
    partnerName,
    partnerCode,
    vehicleTitle: vehicleTitle({ year, make, model }),
    amountMinor: p.amountMinor,
    feeMinor: p.feeMinor,
    method: p.method,
    status: p.status,
    reference: p.reference,
    transferCode: p.transferCode,
    bankReference: p.bankReference,
    bankName: p.bankName,
    accountMasked: p.accountNumber ? maskAccount(p.accountNumber) : null,
    accountName: p.accountName,
    failureReason: p.failureReason,
    paidAt: p.paidAt,
    recordedByName: byName ?? byEmail ?? null,
    createdAt: p.createdAt,
  }));
}

export interface PartnerSummary {
  id: string;
  name: string;
  code: string;
  phone: string;
  email: string | null;
  status: Partner["status"];
  createdAt: Date;
  enquiries: number;
  won: number;
  bankStatus: "none" | "unverified" | "verified";
  totals: Totals;
}

/** Every partner with what they have brought in and what they are owed, for the admin list. */
export async function partnerOverview(dealerId: string, now = new Date()): Promise<PartnerSummary[]> {
  const [people, enq, comms] = await Promise.all([
    db.select().from(partners).where(eq(partners.dealerId, dealerId)).orderBy(desc(partners.createdAt)),
    db
      .select({ partnerId: leads.partnerId, total: count(), won: sql<number>`count(*) filter (where ${leads.status} = 'won')::int` })
      .from(leads)
      .where(and(eq(leads.dealerId, dealerId), isNotNull(leads.partnerId)))
      .groupBy(leads.partnerId),
    db.select().from(commissions).where(eq(commissions.dealerId, dealerId)),
  ]);
  const enquiriesBy = new Map(enq.map((e) => [e.partnerId, e]));
  const commissionsBy = new Map<string, Commission[]>();
  for (const c of comms) (commissionsBy.get(c.partnerId) ?? commissionsBy.set(c.partnerId, []).get(c.partnerId)!).push(c);
  return people.map((p) => {
    const mine = commissionsBy.get(p.id) ?? [];
    const totals = mine.reduce(
      (t, c) => {
        if (c.status === "paid") t.paidMinor += c.amountMinor;
        else if (c.status === "pending") {
          if (isPayable(c, now)) t.payableMinor += c.amountMinor;
          else t.pendingMinor += c.amountMinor;
        }
        return t;
      },
      { pendingMinor: 0, payableMinor: 0, paidMinor: 0 },
    );
    return {
      id: p.id,
      name: p.name,
      code: p.code,
      phone: p.phone,
      email: p.email,
      status: p.status,
      createdAt: p.createdAt,
      enquiries: enquiriesBy.get(p.id)?.total ?? 0,
      won: enquiriesBy.get(p.id)?.won ?? 0,
      bankStatus: !p.accountNumber ? "none" : p.accountVerifiedAt ? "verified" : "unverified",
      totals,
    };
  });
}

export interface QueueRow extends CommissionRow {
  partnerId: string;
  partnerName: string;
  partnerCode: string;
  partnerStatus: Partner["status"];
  bank: BankAccountView | null;
  /** Why "Pay via Paystack" is not offered, or null when it can go. */
  blocked: string | null;
}

export interface PayoutQueue {
  /** Pending, cooling-off passed: ready to pay. */
  payable: QueueRow[];
  /** Pending, still in the cooling-off. */
  cooling: QueueRow[];
  /** Transfers Paystack has not settled yet. */
  processing: PayoutRow[];
  /** Transfers that failed or were returned; the commission is still owed. */
  failed: PayoutRow[];
  /** The latest payments made. */
  recent: PayoutRow[];
  paystack: { configured: boolean; balanceMinor: number | null; error: string | null };
}

/** Everything the admin needs to pay partners, in one read. */
export async function payoutQueue(dealerId: string, now = new Date()): Promise<PayoutQueue> {
  const [pending, processing, failed, recent] = await Promise.all([
    db
      .select({ c: commissions, p: partners, year: vehicles.year, make: vehicles.make, model: vehicles.model, slug: vehicles.slug })
      .from(commissions)
      .innerJoin(partners, eq(partners.id, commissions.partnerId))
      .innerJoin(vehicles, eq(vehicles.id, commissions.vehicleId))
      .where(and(eq(commissions.dealerId, dealerId), eq(commissions.status, "pending")))
      .orderBy(asc(commissions.payableAt)),
    payoutRowsWhere(and(eq(payouts.dealerId, dealerId), inArray(payouts.status, ["pending", "processing"]))),
    payoutRowsWhere(and(eq(payouts.dealerId, dealerId), inArray(payouts.status, ["failed", "reversed"]))),
    payoutRowsWhere(and(eq(payouts.dealerId, dealerId), eq(payouts.status, "paid"))),
  ]);
  const configured = paystackConfigured();
  let balance: number | null = null;
  let balanceError: string | null = null;
  if (configured) {
    try {
      balance = await balanceMinor();
    } catch (e) {
      balanceError = e instanceof PayoutError ? e.message : "Could not read the Paystack balance.";
    }
  }
  const live = new Set(processing.map((p) => p.commissionId));
  const rows: QueueRow[] = [];
  for (const { c, p, year, make, model, slug } of pending) {
    const bank = await bankAccountView(p);
    const payable = isPayable(c, now);
    const blocked = !payable
      ? "In its cooling-off."
      : live.has(c.id)
        ? "A transfer is already on its way."
        : p.status !== "active"
          ? "The partner is suspended."
          : !bank
            ? "No bank account registered yet."
            : !bank.verifiedAt
              ? "The bank account is not verified yet."
              : !configured
                ? "Paystack is not set up: record a bank transfer instead."
                : balance !== null && balance < c.amountMinor + transferFeeMinor(c.amountMinor)
                  ? "Sabicars' Paystack balance is too low for this one."
                  : null;
    rows.push({
      id: c.id,
      vehicleId: c.vehicleId,
      vehicleTitle: vehicleTitle({ year, make, model }),
      vehicleSlug: slug,
      salePriceMinor: c.salePriceMinor,
      amountMinor: c.amountMinor,
      status: c.status,
      payable,
      earnedAt: c.earnedAt,
      payableAt: c.payableAt,
      paidAt: c.paidAt,
      voidReason: c.voidReason,
      source: c.source,
      partnerId: p.id,
      partnerName: p.name,
      partnerCode: p.code,
      partnerStatus: p.status,
      bank,
      blocked,
    });
  }
  return {
    payable: rows.filter((r) => r.payable && !live.has(r.id)),
    cooling: rows.filter((r) => !r.payable),
    processing,
    failed: failed.filter((f) => !live.has(f.commissionId)),
    recent: recent.slice(0, 30),
    paystack: { configured, balanceMinor: balance, error: balanceError },
  };
}

/** How many commissions are ready to pay — the admin nav badge. */
export async function payableCount(dealerId: string, now = new Date()): Promise<number> {
  const [r] = await db
    .select({ n: count() })
    .from(commissions)
    .where(and(eq(commissions.dealerId, dealerId), eq(commissions.status, "pending"), lte(commissions.payableAt, now)));
  return r?.n ?? 0;
}

/** The commission on a vehicle (not voided), with its partner, for the admin vehicle page. */
export async function commissionForVehicle(dealerId: string, vehicleId: string, now = new Date()): Promise<(CommissionRow & { partnerId: string; partnerName: string; partnerCode: string }) | null> {
  const [row] = await db
    .select({ c: commissions, p: partners, year: vehicles.year, make: vehicles.make, model: vehicles.model, slug: vehicles.slug })
    .from(commissions)
    .innerJoin(partners, eq(partners.id, commissions.partnerId))
    .innerJoin(vehicles, eq(vehicles.id, commissions.vehicleId))
    .where(and(eq(commissions.dealerId, dealerId), eq(commissions.vehicleId, vehicleId), ne(commissions.status, "void")))
    .limit(1);
  if (!row) return null;
  const { c, p, year, make, model, slug } = row;
  return {
    id: c.id,
    vehicleId: c.vehicleId,
    vehicleTitle: vehicleTitle({ year, make, model }),
    vehicleSlug: slug,
    salePriceMinor: c.salePriceMinor,
    amountMinor: c.amountMinor,
    status: c.status,
    payable: isPayable(c, now),
    earnedAt: c.earnedAt,
    payableAt: c.payableAt,
    paidAt: c.paidAt,
    voidReason: c.voidReason,
    source: c.source,
    partnerId: p.id,
    partnerName: p.name,
    partnerCode: p.code,
  };
}

/* ── The sale side ──────────────────────────────────────────────────────── */

/**
 * The partner a sold vehicle's buyer came through: the earliest won enquiry
 * on that vehicle that carries a partner, unless the buyer is that partner
 * (a partner's own purchase earns the partner price, not a commission).
 */
async function attributedLead(dealerId: string, vehicleId: string): Promise<{ leadId: string; partnerId: string } | null> {
  // A suspended partner earns nothing new; what was already on record stays on record.
  const rows = await db
    .select({ leadId: leads.id, partnerId: leads.partnerId, leadPhone: leads.phone, partnerPhone: partners.phone })
    .from(leads)
    .innerJoin(partners, and(eq(partners.id, leads.partnerId), eq(partners.status, "active")))
    .where(and(eq(leads.dealerId, dealerId), eq(leads.vehicleId, vehicleId), eq(leads.status, "won"), isNotNull(leads.partnerId)))
    .orderBy(asc(leads.createdAt));
  const first = rows.find((r) => r.partnerId && r.leadPhone !== r.partnerPhone);
  return first?.partnerId ? { leadId: first.leadId, partnerId: first.partnerId } : null;
}

export type RecordResult = { ok: true; commissionId: string; created: boolean; partnerId: string } | { ok: false; reason: "not_sold" | "no_price" | "no_attribution" | "partner_unknown" | "partner_is_buyer" | "already_recorded" };

/**
 * Records the commission a sale earns. Called when a vehicle is marked sold
 * with its price (source "link": the buyer's own enquiry carries the
 * partner), or by a manager attributing a showroom sale to a partner's code
 * (source "manual"). Safe to call again: a vehicle that already has a live
 * commission keeps it.
 */
export async function recordCommissionForSale(
  dealerId: string,
  vehicleId: string,
  opts: { source: "link" } | { source: "manual"; partnerId: string; actor: StaffMember },
): Promise<RecordResult> {
  const [v] = await db
    .select({ id: vehicles.id, status: vehicles.status, soldPriceMinor: vehicles.soldPriceMinor, soldAt: vehicles.soldAt })
    .from(vehicles)
    .where(and(eq(vehicles.id, vehicleId), eq(vehicles.dealerId, dealerId)))
    .limit(1);
  if (!v || v.status !== "sold") return { ok: false, reason: "not_sold" };
  if (!v.soldPriceMinor) return { ok: false, reason: "no_price" };

  let partnerId: string;
  let leadId: string | null = null;
  if (opts.source === "manual") {
    const [p] = await db
      .select({ id: partners.id, phone: partners.phone })
      .from(partners)
      .where(and(eq(partners.id, opts.partnerId), eq(partners.dealerId, dealerId), eq(partners.status, "active")))
      .limit(1);
    if (!p) return { ok: false, reason: "partner_unknown" };
    // A partner cannot be paid for selling a car to themselves: any enquiry on this car from their own number refuses it.
    const [own] = await db
      .select({ id: leads.id })
      .from(leads)
      .where(and(eq(leads.vehicleId, vehicleId), eq(leads.phone, p.phone)))
      .limit(1);
    if (own) return { ok: false, reason: "partner_is_buyer" };
    partnerId = p.id;
  } else {
    const found = await attributedLead(dealerId, vehicleId);
    if (!found) return { ok: false, reason: "no_attribution" };
    partnerId = found.partnerId;
    leadId = found.leadId;
  }

  const earnedAt = v.soldAt ?? new Date();
  const terms = commissionFor(v.soldPriceMinor, earnedAt);
  const [inserted] = await db
    .insert(commissions)
    .values({
      dealerId,
      partnerId,
      vehicleId,
      leadId,
      source: opts.source,
      salePriceMinor: v.soldPriceMinor,
      rateBps: terms.rateBps,
      amountMinor: terms.amountMinor,
      earnedAt,
      payableAt: terms.payableAt,
      createdBy: opts.source === "manual" ? opts.actor.id : null,
    })
    .onConflictDoNothing({ target: commissions.vehicleId, where: sql`${commissions.status} <> 'void'` })
    .returning({ id: commissions.id });
  if (!inserted) {
    const [existing] = await db
      .select({ id: commissions.id, partnerId: commissions.partnerId })
      .from(commissions)
      .where(and(eq(commissions.vehicleId, vehicleId), ne(commissions.status, "void")))
      .limit(1);
    return existing ? { ok: true, commissionId: existing.id, created: false, partnerId: existing.partnerId } : { ok: false, reason: "already_recorded" };
  }
  if (opts.source === "manual") await audit(opts.actor, "commission", inserted.id, "create", { vehicleId, partnerId, amountMinor: terms.amountMinor, source: "manual" });
  return { ok: true, commissionId: inserted.id, created: true, partnerId };
}

/**
 * A sale that has been unwound (the vehicle is no longer sold) owes nothing:
 * its pending commission is voided. A commission already paid cannot be
 * taken back here; it is returned so managers are told.
 */
export async function voidCommissionsForVehicle(dealerId: string, vehicleId: string, reason: string, actor?: StaffMember): Promise<{ voided: string[]; alreadyPaid: string[] }> {
  const now = new Date();
  const voided = await db
    .update(commissions)
    .set({ status: "void", voidedAt: now, voidReason: reason, updatedAt: now })
    .where(and(eq(commissions.dealerId, dealerId), eq(commissions.vehicleId, vehicleId), eq(commissions.status, "pending")))
    .returning({ id: commissions.id });
  const paid = await db
    .select({ id: commissions.id })
    .from(commissions)
    .where(and(eq(commissions.dealerId, dealerId), eq(commissions.vehicleId, vehicleId), eq(commissions.status, "paid")));
  if (actor) for (const c of voided) await audit(actor, "commission", c.id, "void", { reason });
  return { voided: voided.map((c) => c.id), alreadyPaid: paid.map((c) => c.id) };
}

/** A manager voids a pending commission by hand, with a reason the partner can read. */
export async function voidCommission(actor: StaffMember, commissionId: string, reason: string): Promise<Result<{ partnerId: string }>> {
  if (!can.payPartners(actor)) return { ok: false, error: "Only a manager or the owner can void a commission." };
  if (!TOKEN.test(commissionId)) return { ok: false, error: "That commission does not exist." };
  const text = reason.trim();
  if (text.length < 3) return { ok: false, error: "Give the reason — the partner will read it." };
  const now = new Date();
  const [row] = await db
    .update(commissions)
    .set({ status: "void", voidedAt: now, voidReason: text, updatedAt: now })
    .where(and(eq(commissions.id, commissionId), eq(commissions.dealerId, actor.dealerId), eq(commissions.status, "pending")))
    .returning({ id: commissions.id, partnerId: commissions.partnerId });
  if (!row) return { ok: false, error: "That commission is not pending." };
  await audit(actor, "commission", commissionId, "void", { reason: text });
  return { ok: true, partnerId: row.partnerId };
}

/* ── The partner's bank account ─────────────────────────────────────────── */

export type BankSaveResult = { ok: true; accountName: string | null; verified: boolean } | { ok: false; error: string };

/**
 * Saves the one account a partner is paid into and checks whose it is.
 * With Paystack set up, the bank is asked for the account holder's name and
 * the account is verified on the spot when that name is the partner's;
 * otherwise it waits for a manager to confirm. Any change to the account
 * starts the verification again.
 */
export async function saveBankAccount(partnerId: string, input: { bankCode: string; bankName: string; accountNumber: string }): Promise<BankSaveResult> {
  const accountNumber = input.accountNumber.replace(/\D/g, "");
  if (!/^[0-9]{10}$/.test(accountNumber)) return { ok: false, error: "A Nigerian account number has ten digits." };
  const bankCode = input.bankCode.trim();
  const bankName = input.bankName.trim();
  if (!bankCode || !bankName) return { ok: false, error: "Choose the bank." };
  const [p] = await db.select().from(partners).where(eq(partners.id, partnerId)).limit(1);
  if (!p) return { ok: false, error: "Partner not found." };
  if (p.status !== "active") return { ok: false, error: "This account cannot be changed right now. Please call Sabicars." };

  let accountName: string | null = null;
  let verified = false;
  if (paystackConfigured()) {
    try {
      accountName = (await resolveAccount(accountNumber, bankCode)).accountName;
    } catch (e) {
      // A bank that cannot be reached is not the partner's fault: save the details and let a manager confirm.
      if (e instanceof PayoutError && !e.retryable) return { ok: false, error: e.message };
    }
    verified = accountName !== null && nameMatches(p.name, accountName);
  }

  const unchanged = p.accountNumber === accountNumber && p.bankCode === bankCode;
  const now = new Date();
  let recipientCode: string | null = unchanged ? p.paystackRecipientCode : null;
  const wasVerified = unchanged && Boolean(p.accountVerifiedAt);
  if ((verified || wasVerified) && !recipientCode && paystackConfigured()) {
    try {
      recipientCode = (await createRecipient({ name: p.name, accountNumber, bankCode })).recipientCode;
    } catch (e) {
      console.error("[ledger] could not create the Paystack recipient", e);
    }
  }
  await db
    .update(partners)
    .set({
      bankCode,
      bankName,
      accountNumber,
      accountName,
      accountVerifiedAt: verified ? now : wasVerified ? p.accountVerifiedAt : null,
      accountVerifiedBy: verified ? null : wasVerified ? p.accountVerifiedBy : null,
      paystackRecipientCode: recipientCode,
      updatedAt: now,
    })
    .where(eq(partners.id, partnerId));
  return { ok: true, accountName, verified: verified || wasVerified };
}

/** A manager confirms, having checked, that the registered account is the partner's own. */
export async function confirmBankAccount(actor: StaffMember, partnerId: string): Promise<Result> {
  if (!can.payPartners(actor)) return { ok: false, error: "Only a manager or the owner can confirm a bank account." };
  const [p] = await db.select().from(partners).where(and(eq(partners.id, partnerId), eq(partners.dealerId, actor.dealerId))).limit(1);
  if (!p) return { ok: false, error: "Partner not found." };
  if (!p.accountNumber || !p.bankCode) return { ok: false, error: "The partner has not registered a bank account yet." };
  let recipientCode = p.paystackRecipientCode;
  if (!recipientCode && paystackConfigured()) {
    try {
      recipientCode = (await createRecipient({ name: p.name, accountNumber: p.accountNumber, bankCode: p.bankCode })).recipientCode;
    } catch (e) {
      console.error("[ledger] could not create the Paystack recipient", e);
    }
  }
  const now = new Date();
  await db
    .update(partners)
    .set({ accountVerifiedAt: now, accountVerifiedBy: actor.id, paystackRecipientCode: recipientCode, updatedAt: now })
    .where(eq(partners.id, partnerId));
  await audit(actor, "partner", partnerId, "bank_account_confirmed", { accountMasked: maskAccount(p.accountNumber), bank: p.bankName });
  return { ok: true };
}

/** Suspends or reactivates a partner. A suspended partner's link stops attributing and nothing is paid out. */
export async function setPartnerStatus(actor: StaffMember, partnerId: string, status: Partner["status"]): Promise<Result> {
  if (!can.payPartners(actor)) return { ok: false, error: "Only a manager or the owner can change a partner's status." };
  const [row] = await db
    .update(partners)
    .set({ status, updatedAt: new Date() })
    .where(and(eq(partners.id, partnerId), eq(partners.dealerId, actor.dealerId)))
    .returning({ id: partners.id });
  if (!row) return { ok: false, error: "Partner not found." };
  await audit(actor, "partner", partnerId, "status_change", { status });
  return { ok: true };
}

/* ── Paying ─────────────────────────────────────────────────────────────── */

export type PayResult = { ok: true; payoutId: string; status: Payout["status"] } | { ok: false; error: string };

/** The checks every payout passes before a single kobo moves. */
async function payableCommission(actor: StaffMember, commissionId: string): Promise<{ ok: true; c: Commission; p: Partner } | { ok: false; error: string }> {
  if (!can.payPartners(actor)) return { ok: false, error: "Only a manager or the owner can pay a partner." };
  if (!TOKEN.test(commissionId)) return { ok: false, error: "That commission does not exist." };
  const [row] = await db
    .select({ c: commissions, p: partners })
    .from(commissions)
    .innerJoin(partners, eq(partners.id, commissions.partnerId))
    .where(and(eq(commissions.id, commissionId), eq(commissions.dealerId, actor.dealerId)))
    .limit(1);
  if (!row) return { ok: false, error: "That commission does not exist." };
  if (row.c.status !== "pending") return { ok: false, error: `This commission is ${row.c.status}.` };
  if (!isPayable(row.c)) return { ok: false, error: "This commission is still in its cooling-off." };
  if (row.p.status !== "active") return { ok: false, error: "The partner is suspended." };
  if (!row.p.accountNumber || !row.p.bankCode || !row.p.bankName) return { ok: false, error: "The partner has not registered a bank account." };
  if (!row.p.accountVerifiedAt) return { ok: false, error: "The partner's bank account is not verified yet." };
  return { ok: true, c: row.c, p: row.p };
}

/**
 * Pays a commission from Sabicars' Paystack balance. The payout row, with
 * its reference, exists before Paystack is called, and the same reference
 * is what Paystack is given, so a retry after a dropped connection can only
 * ever find the same transfer. The commission is marked paid when Paystack
 * reports success — at once in test mode, otherwise usually by webhook.
 */
export async function payByPaystack(actor: StaffMember, commissionId: string): Promise<PayResult> {
  const check = await payableCommission(actor, commissionId);
  if (!check.ok) return check;
  const { c, p } = check;
  if (!paystackConfigured()) return { ok: false, error: "Paystack is not set up: record a bank transfer instead." };

  let recipientCode = p.paystackRecipientCode;
  if (!recipientCode) {
    try {
      recipientCode = (await createRecipient({ name: p.name, accountNumber: p.accountNumber!, bankCode: p.bankCode! })).recipientCode;
      await db.update(partners).set({ paystackRecipientCode: recipientCode, updatedAt: new Date() }).where(eq(partners.id, p.id));
    } catch (e) {
      return { ok: false, error: e instanceof PayoutError ? e.message : "Could not register the account with Paystack." };
    }
  }

  const fee = transferFeeMinor(c.amountMinor);
  try {
    const balance = await balanceMinor();
    if (balance < c.amountMinor + fee) return { ok: false, error: "Sabicars' Paystack balance is too low for this payout. Top it up on the Paystack dashboard, then try again." };
  } catch (e) {
    return { ok: false, error: e instanceof PayoutError ? e.message : "Could not read the Paystack balance." };
  }

  // The row first, then the call: a live payout per commission is enforced by the database.
  const reference = payoutReference(c.id, randomUUID());
  let payoutId: string;
  try {
    const [row] = await db
      .insert(payouts)
      .values({
        dealerId: actor.dealerId,
        commissionId: c.id,
        partnerId: p.id,
        amountMinor: c.amountMinor,
        method: "paystack",
        status: "pending",
        reference,
        feeMinor: fee,
        bankName: p.bankName,
        accountNumber: p.accountNumber,
        accountName: p.accountName,
        recordedBy: actor.id,
      })
      .returning({ id: payouts.id });
    payoutId = row.id;
  } catch (e) {
    const pg = (e as { cause?: { code?: string } }).cause ?? (e as { code?: string });
    if (pg && typeof pg === "object" && "code" in pg && pg.code === "23505") return { ok: false, error: "A payout for this commission is already on its way." };
    throw e;
  }

  try {
    const sent = await initiateTransfer({ amountMinor: c.amountMinor, recipientCode, reference, reason: `Sabicars commission · ${c.id.slice(0, 8)}` });
    const status = await applyTransferEvent({ reference, status: sent.status, transferCode: sent.transferCode });
    await audit(actor, "payout", payoutId, "paystack_transfer", { commissionId: c.id, amountMinor: c.amountMinor, reference, status: sent.status });
    return { ok: true, payoutId, status: status.payoutStatus ?? "processing" };
  } catch (e) {
    // Paystack may have accepted the transfer even though the reply never arrived: ask before giving up.
    if (!(e instanceof PayoutError) || e.retryable) {
      try {
        const seen = await verifyTransfer(reference);
        const status = await applyTransferEvent({ reference, status: seen.status, transferCode: seen.transferCode ?? undefined, reason: seen.failureReason ?? undefined });
        return { ok: true, payoutId, status: status.payoutStatus ?? "processing" };
      } catch (ve) {
        if (!(ve instanceof PayoutError && !ve.retryable)) {
          // Paystack could not be asked either. It may hold the transfer, so the row stays pending —
          // listed as "with the bank", blocking a second send — until the daily check settles it.
          await audit(actor, "payout", payoutId, "paystack_unconfirmed", { commissionId: c.id, reference });
          return {
            ok: false,
            error: "Paystack did not answer. The transfer is listed as with the bank and the daily payouts check settles it; do not send it again.",
          };
        }
        // Paystack answered that it holds no such transfer: safe to call this attempt failed.
      }
    }
    const reason = e instanceof PayoutError ? e.message : "Paystack did not accept the transfer.";
    await db
      .update(payouts)
      .set({ status: "failed", failureReason: reason, updatedAt: new Date() })
      .where(and(eq(payouts.id, payoutId), eq(payouts.status, "pending")));
    await audit(actor, "payout", payoutId, "paystack_failed", { commissionId: c.id, reason });
    return { ok: false, error: reason };
  }
}

/** Records a commission paid by bank transfer outside the platform: the reference is the proof. */
export async function recordBankTransfer(actor: StaffMember, commissionId: string, input: { bankReference: string; paidOn: Date; note?: string }): Promise<PayResult> {
  const check = await payableCommission(actor, commissionId);
  if (!check.ok) return check;
  const { c, p } = check;
  const bankReference = input.bankReference.trim();
  if (bankReference.length < 4) return { ok: false, error: "Enter the bank's reference or teller number for the transfer." };
  if (Number.isNaN(input.paidOn.getTime()) || input.paidOn.getTime() > Date.now() + 60_000) return { ok: false, error: "The payment date cannot be in the future." };
  const now = new Date();
  const reference = payoutReference(c.id, randomUUID());
  try {
    const payoutId = await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(payouts)
        .values({
          dealerId: actor.dealerId,
          commissionId: c.id,
          partnerId: p.id,
          amountMinor: c.amountMinor,
          method: "bank_transfer",
          status: "paid",
          reference,
          bankReference,
          bankName: p.bankName,
          accountNumber: p.accountNumber,
          accountName: p.accountName,
          paidAt: input.paidOn,
          recordedBy: actor.id,
          note: input.note?.trim() || null,
        })
        .returning({ id: payouts.id });
      await tx
        .update(commissions)
        .set({ status: "paid", paidAt: input.paidOn, updatedAt: now })
        .where(and(eq(commissions.id, c.id), eq(commissions.status, "pending")));
      return row.id;
    });
    await audit(actor, "payout", payoutId, "bank_transfer_recorded", { commissionId: c.id, amountMinor: c.amountMinor, bankReference });
    return { ok: true, payoutId, status: "paid" };
  } catch (e) {
    const pg = (e as { cause?: { code?: string } }).cause ?? (e as { code?: string });
    if (pg && typeof pg === "object" && "code" in pg && pg.code === "23505") return { ok: false, error: "A payout for this commission is already on record." };
    throw e;
  }
}

/**
 * What Paystack says about a transfer, applied to its payout: from the
 * reply to the transfer request, from a webhook, or from a verify call.
 * Idempotent: a state already reached is left alone, and a paid payout is
 * never downgraded.
 */
export async function applyTransferEvent(input: { reference: string; status: TransferStatus; transferCode?: string; reason?: string }): Promise<{ outcome: "updated" | "unchanged" | "unknown"; payoutStatus?: Payout["status"]; payoutId?: string; commissionId?: string }> {
  // Only a Paystack payout can be moved by Paystack, and only the transfer it was given.
  const [row] = await db.select().from(payouts).where(and(eq(payouts.reference, input.reference), eq(payouts.method, "paystack"))).limit(1);
  if (!row) return { outcome: "unknown" };
  const unchanged = { outcome: "unchanged" as const, payoutStatus: row.status, payoutId: row.id, commissionId: row.commissionId };
  if (input.transferCode && row.transferCode && input.transferCode !== row.transferCode) return unchanged;
  const now = new Date();
  const next: Payout["status"] =
    input.status === "success" ? "paid" : input.status === "failed" || input.status === "abandoned" ? "failed" : input.status === "reversed" ? "reversed" : "processing";
  // Returned money is final: a late or replayed "success" cannot close the commission again.
  if (row.status === "reversed") return unchanged;
  if (row.status === "paid" && next !== "reversed") return unchanged;
  if (row.status === next && (row.transferCode || !input.transferCode)) return unchanged;

  await db.transaction(async (tx) => {
    await tx
      .update(payouts)
      .set({
        status: next,
        transferCode: input.transferCode ?? row.transferCode,
        failureReason: next === "failed" || next === "reversed" ? (input.reason ?? row.failureReason ?? "Paystack reported the transfer as not completed.") : row.failureReason,
        paidAt: next === "paid" ? (row.paidAt ?? now) : row.paidAt,
        updatedAt: now,
      })
      .where(eq(payouts.id, row.id));
    if (next === "paid") {
      await tx
        .update(commissions)
        .set({ status: "paid", paidAt: now, updatedAt: now })
        .where(and(eq(commissions.id, row.commissionId), eq(commissions.status, "pending")));
    } else if (next === "reversed" && row.status === "paid") {
      // The money came back after Paystack had called it paid: the commission is owed again.
      await tx
        .update(commissions)
        .set({ status: "pending", paidAt: null, updatedAt: now })
        .where(and(eq(commissions.id, row.commissionId), eq(commissions.status, "paid")));
    }
  });
  return { outcome: "updated", payoutStatus: next, payoutId: row.id, commissionId: row.commissionId };
}

/**
 * Asks Paystack about every transfer still in flight — a safety net for a
 * webhook that never arrived. Returns what changed so the caller can tell
 * the partner or the managers.
 */
export async function reconcileProcessingPayouts(dealerId: string): Promise<{ checked: number; updated: number; settled: { payoutId: string; status: Payout["status"] }[] }> {
  if (!paystackConfigured()) return { checked: 0, updated: 0, settled: [] };
  const rows = await db
    .select({ reference: payouts.reference })
    .from(payouts)
    .where(and(eq(payouts.dealerId, dealerId), eq(payouts.method, "paystack"), inArray(payouts.status, ["pending", "processing"])));
  const settled: { payoutId: string; status: Payout["status"] }[] = [];
  for (const r of rows) {
    try {
      const seen = await verifyTransfer(r.reference);
      const res = await applyTransferEvent({ reference: r.reference, status: seen.status, transferCode: seen.transferCode ?? undefined, reason: seen.failureReason ?? undefined });
      if (res.outcome === "updated" && res.payoutId && res.payoutStatus) settled.push({ payoutId: res.payoutId, status: res.payoutStatus });
    } catch (e) {
      console.error(`[ledger] could not verify transfer ${r.reference}`, e instanceof Error ? e.message : e);
    }
  }
  return { checked: rows.length, updated: settled.length, settled };
}
