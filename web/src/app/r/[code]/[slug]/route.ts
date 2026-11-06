import type { NextRequest } from "next/server";
import { referralRedirect } from "@/lib/referral-link";

const SLUG = /^[a-z0-9-]{1,120}$/;

/**
 * One car, shared by a partner: sabicars.com/r/ADA7K3/2014-toyota-hiace-hummer-1.
 * Shorter than ?to=, and it reads as what it is. It records the partner and
 * lands on the car's page; WhatsApp follows it to draw the car's photo in the
 * chat, so the picture itself is what the buyer taps.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ code: string; slug: string }> }) {
  const { code, slug } = await params;
  const destination = new URL(SLUG.test(slug) ? `/vehicles/${slug}` : "/", req.url);
  return referralRedirect(req, code, destination);
}
