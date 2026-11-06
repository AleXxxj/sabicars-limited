"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { settings, vehicleMedia, vehicles } from "@/db/schema";
import { audit } from "@/lib/audit";
import { requireStaff } from "@/lib/auth";
import { videoSource } from "@/lib/blog/video";
import { shareImageUrl } from "@/lib/media";
import { createBroadcast, deliver } from "@/lib/newsletter";
import { postNotification } from "@/lib/notifications";
import { TODAY_VIDEO_KEY } from "@/lib/repositories/today";

export interface AnnounceResult {
  ok: boolean;
  error?: string;
  /** What happened, in words staff can read at a glance. */
  outcome?: string;
}

const schema = z.object({
  title: z.string().trim().min(4, "Give it a headline").max(90, "Keep the headline under 90 characters"),
  message: z.string().trim().min(10, "Say a little more").max(1200),
  vehicleId: z.preprocess((v) => (v === "" ? undefined : v), z.uuid().optional()),
  kind: z.enum(["offer", "system"]).catch("offer"),
  push: z.preprocess((v) => v === "on", z.boolean()),
  email: z.preprocess((v) => v === "on", z.boolean()),
});

/**
 * An announcement by hand — an offer, an event, a holiday closing. It goes to
 * the bell on every page, and, if chosen, to every phone with alerts on and to
 * every newsletter subscriber. Arrivals and price drops never need this: the
 * platform posts those itself.
 */
export async function postAnnouncement(_prev: AnnounceResult | null, formData: FormData): Promise<AnnounceResult> {
  const me = await requireStaff();
  if (me.role === "sales") return { ok: false, error: "Only a manager can send announcements to the whole audience." };
  const parsed = schema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form." };
  const v = parsed.data;

  let link: string | null = null;
  let imageUrl: string | null = null;
  if (v.vehicleId) {
    const [car] = await db
      .select({ slug: vehicles.slug, cover: vehicleMedia.url })
      .from(vehicles)
      .leftJoin(vehicleMedia, and(eq(vehicleMedia.vehicleId, vehicles.id), eq(vehicleMedia.position, 0)))
      .where(and(eq(vehicles.id, v.vehicleId), eq(vehicles.dealerId, me.dealerId)))
      .limit(1);
    if (!car) return { ok: false, error: "That vehicle is no longer listed." };
    link = `/vehicles/${car.slug}`;
    imageUrl = car.cover ? shareImageUrl(car.cover) : null;
  }

  const posted = await postNotification({
    dealerId: me.dealerId,
    title: v.title,
    message: v.message,
    kind: v.kind,
    link,
    vehicleId: v.vehicleId ?? null,
    imageUrl,
    createdBy: me.id,
    push: v.push,
  });
  if (!posted) return { ok: false, error: "That could not be posted. Please try again." };
  await audit(me, "notification", posted.id, "create", { title: v.title, push: v.push, email: v.email });

  const parts = ["On the bell on every page"];
  if (v.push)
    parts.push(
      posted.pushed
        ? "pushed to phones"
        : posted.pushError === "not_configured"
          ? "not pushed — phone alerts are not set up on the server yet"
          : `push failed (${posted.pushError})`,
    );
  if (v.email) {
    const sendId = await createBroadcast(me.dealerId, me.id, v.title, v.message, v.vehicleId ? [v.vehicleId] : []);
    after(() => deliver(sendId).catch((e) => console.error("[audience] broadcast failed", e)));
    parts.push("emailing subscribers now");
  }
  revalidatePath("/admin/audience");
  return { ok: true, outcome: parts.join(" · ") + "." };
}

const videoSchema = z.object({
  url: z.string().trim().max(500, "That link is too long"),
  line: z.string().trim().max(140, "Keep the line under 140 characters"),
  clear: z.preprocess((v) => v === "on" || v === "1", z.boolean()),
});

/**
 * The day's video from the park, shown on the homepage with one line from
 * the founder. Setting it again replaces it; clearing it takes it off. The
 * homepage drops it by itself after two weeks (repositories/today.ts).
 */
export async function setTodayVideo(_prev: AnnounceResult | null, formData: FormData): Promise<AnnounceResult> {
  const me = await requireStaff();
  if (me.role === "sales") return { ok: false, error: "Only a manager can set the day's video." };
  const parsed = videoSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form." };
  const v = parsed.data;

  if (v.clear || !v.url) {
    await db.delete(settings).where(and(eq(settings.dealerId, me.dealerId), eq(settings.key, TODAY_VIDEO_KEY)));
    await audit(me, "setting", TODAY_VIDEO_KEY, "delete");
    revalidatePath("/");
    revalidatePath("/admin/audience");
    return { ok: true, outcome: "Taken off the homepage." };
  }

  const source = videoSource(v.url);
  if (!source) return { ok: false, error: "Paste the full link to a video: YouTube, TikTok, Facebook, Instagram, or a video file." };
  const value = { url: v.url, line: v.line, at: new Date().toISOString() };
  await db
    .insert(settings)
    .values({ dealerId: me.dealerId, key: TODAY_VIDEO_KEY, value })
    .onConflictDoUpdate({ target: [settings.dealerId, settings.key], set: { value, updatedAt: new Date() } });
  await audit(me, "setting", TODAY_VIDEO_KEY, "update", { url: v.url, line: v.line });
  revalidatePath("/");
  revalidatePath("/admin/audience");
  return { ok: true, outcome: `On the homepage now as today's video (${source.kind === "file" ? "video file" : source.kind}).` };
}
