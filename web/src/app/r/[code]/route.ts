import type { NextRequest } from "next/server";
import { referralRedirect } from "@/lib/referral-link";

/**
 * A partner's personal link: sabicars.com/r/ADA7K3, optionally with ?to=/vehicles/…
 * to share a particular page. It records who sent the visitor, then gets out of
 * the way (lib/referral-link.ts).
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const to = req.nextUrl.searchParams.get("to");
  // Only pages on this site. Resolved and compared by origin, because
  // "//evil.example" and "/\evil.example" both parse as another site.
  const target = to?.startsWith("/") ? new URL(to, req.url) : null;
  const destination = target && target.origin === req.nextUrl.origin ? target : new URL("/", req.url);
  return referralRedirect(req, code, destination);
}
