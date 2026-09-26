import { NextResponse, type NextRequest } from "next/server";
import { sabicarsDealerId } from "@/lib/leads";
import { activePartnerByCode, PARTNER_COOKIE, PARTNER_COOKIE_MAX_AGE } from "@/lib/partners";

/**
 * A partner's personal link: sabicars.com/r/ADA7K3, optionally with ?to=/vehicles/…
 * to share a particular car. It records who sent the visitor, then gets out of
 * the way. An unknown or suspended code still lands the visitor on the site —
 * a mistyped link should never be a dead end.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const code = (await params).code.toUpperCase();
  const to = req.nextUrl.searchParams.get("to");
  // Only pages on this site. Resolved and compared by origin, because
  // "//evil.example" and "/\evil.example" both parse as another site.
  const target = to?.startsWith("/") ? new URL(to, req.url) : null;
  const destination = target && target.origin === req.nextUrl.origin ? target : new URL("/", req.url);
  const res = NextResponse.redirect(destination, 307);

  try {
    const dealerId = await sabicarsDealerId();
    const existing = req.cookies.get(PARTNER_COOKIE)?.value;
    // First touch wins: a buyer already brought by an active partner stays theirs.
    if (existing && existing !== code && (await activePartnerByCode(dealerId, existing))) return res;
    if (await activePartnerByCode(dealerId, code)) {
      res.cookies.set(PARTNER_COOKIE, code, {
        maxAge: PARTNER_COOKIE_MAX_AGE,
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
      });
    }
  } catch (e) {
    console.error("[r] partner lookup failed", e);
  }
  return res;
}
