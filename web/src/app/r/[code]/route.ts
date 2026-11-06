import { NextResponse, type NextRequest } from "next/server";
import { sabicarsDealerId } from "@/lib/leads";
import {
  activePartnerByCode,
  firstNameForVisitor,
  PARTNER_COOKIE,
  PARTNER_COOKIE_MAX_AGE,
  REFERRER_NAME_COOKIE,
  REFERRER_WELCOME_COOKIE,
} from "@/lib/partners";

/**
 * A partner's personal link: sabicars.com/r/ADA7K3, optionally with ?to=/vehicles/…
 * to share a particular car. It records who sent the visitor, then gets out of
 * the way. An unknown or suspended code still lands the visitor on the site —
 * a mistyped link should never be a dead end.
 *
 * Three cookies, set together: the code (httpOnly, read by every enquiry form,
 * 90 days), the partner's first name (readable, so the page can say who sent
 * the visitor), and a short-lived flag that has the page welcome them once:
 * "Ada sent you here. Your price stays the same."
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const code = (await params).code.toUpperCase();
  const to = req.nextUrl.searchParams.get("to");
  // Only pages on this site. Resolved and compared by origin, because
  // "//evil.example" and "/\evil.example" both parse as another site.
  const target = to?.startsWith("/") ? new URL(to, req.url) : null;
  const destination = target && target.origin === req.nextUrl.origin ? target : new URL("/", req.url);
  const res = NextResponse.redirect(destination, 307);
  // Personal: the answer carries this visitor's cookies, so no cache may keep it for the next one.
  res.headers.set("Cache-Control", "private, no-store");

  try {
    const dealerId = await sabicarsDealerId();
    const existing = req.cookies.get(PARTNER_COOKIE)?.value;
    // First touch wins: a buyer already brought by an active partner stays theirs.
    if (existing && existing !== code && (await activePartnerByCode(dealerId, existing))) return res;
    const partner = await activePartnerByCode(dealerId, code);
    if (partner) {
      const secure = process.env.NODE_ENV === "production";
      res.cookies.set(PARTNER_COOKIE, code, { maxAge: PARTNER_COOKIE_MAX_AGE, httpOnly: true, sameSite: "lax", secure, path: "/" });
      // Next encodes the value once when it writes the header; the page decodes it once.
      res.cookies.set(REFERRER_NAME_COOKIE, firstNameForVisitor(partner.name), {
        maxAge: PARTNER_COOKIE_MAX_AGE,
        httpOnly: false,
        sameSite: "lax",
        secure,
        path: "/",
      });
      res.cookies.set(REFERRER_WELCOME_COOKIE, "1", { maxAge: 15 * 60, httpOnly: false, sameSite: "lax", secure, path: "/" });
    }
  } catch (e) {
    console.error("[r] partner lookup failed", e);
  }
  return res;
}
