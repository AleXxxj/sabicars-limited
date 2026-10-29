import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { staff } from "@/db/schema";
import { createClient } from "./supabase/server";
import { authConfigured } from "./supabase/config";

export interface StaffMember {
  id: string;
  dealerId: string;
  email: string;
  fullName: string | null;
  role: "owner" | "manager" | "sales";
}

/**
 * The authorisation boundary. Called by every admin page and every server
 * action — never left to the proxy alone.
 *
 * Two separate checks: Supabase must recognise the session, AND the person
 * must have an active row in `staff`. Signing up for a Supabase account does
 * not make anyone staff; only an existing owner can grant that.
 */
// Shared within one request: the admin frame and the page it holds both ask, and each ask was a round trip
// to Supabase. cache() answers the second from the first.
export const requireStaff = cache(async (): Promise<StaffMember> => {
  // Anything behind this check is per-request by definition. Without this, a
  // build with sign-in unconfigured redirects before reading a cookie, and
  // Next.js freezes the page as a static redirect.
  await connection();
  if (!authConfigured()) redirect("/admin/login");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login");

  const [record] = await db.select().from(staff).where(eq(staff.id, user.id)).limit(1);
  if (!record || !record.isActive) {
    // Authenticated but not authorised: end the session rather than leave
    // them half signed in.
    await supabase.auth.signOut();
    redirect("/admin/login?error=not_staff");
  }

  return { id: record.id, dealerId: record.dealerId, email: record.email, fullName: record.fullName, role: record.role };
});

/**
 * Who may do what. Sales handle customers and cars; money and people are for
 * managers and the owner — not because sales are untrusted, but because a
 * screen you cannot act on is noise, and money screens invite accidents.
 */
export const can = {
  /** Every role: listing and updating cars is the core of the job. */
  editInventory: () => true,
  setPrices: (s: StaffMember) => s.role === "owner" || s.role === "manager",
  seeMoney: (s: StaffMember) => s.role === "owner" || s.role === "manager",
  manageStaff: (s: StaffMember) => s.role === "owner",
  /** Anyone can record an inspection; putting the seal on it in public is a manager's call. */
  publishInspection: (s: StaffMember) => s.role === "owner" || s.role === "manager",
  /** Paying partners, confirming their bank accounts and attributing sales: money, so managers and the owner. */
  payPartners: (s: StaffMember) => s.role === "owner" || s.role === "manager",
  /** The words of a buyer's chat: the owner and managers. Sales see the summary and the buyer's details, which is what a call needs. */
  readTranscripts: (s: StaffMember) => s.role === "owner" || s.role === "manager",
};
