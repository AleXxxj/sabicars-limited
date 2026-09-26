#!/usr/bin/env node
/**
 * Imports everything from the legacy Express/Mongo API into the new database.
 *
 * Safe to run repeatedly, right up to cutover: every row is keyed on its Mongo
 * _id, so a second run updates rather than duplicates. Staff keep using the
 * legacy admin until cutover day; the final run then picks up whatever they
 * added in the meantime.
 *
 * The legacy database is only ever READ — the Mongo client below calls
 * nothing but find(). The new database is written in one transaction: the
 * import lands completely or not at all.
 *
 *   node --env-file=.env.local --import tsx scripts/import-legacy.mts --dry-run
 *   node --env-file=.env.local --import tsx scripts/import-legacy.mts
 *
 * Needs LEGACY_MONGO_URI, plus DATABASE_URL unless --dry-run.
 * Writes a report of every record that needs a person's attention to
 * .data/legacy-import-report.md.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { MongoClient, type Document } from "mongodb";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { and, eq, inArray, sql } from "drizzle-orm";
import * as schema from "../src/db/schema";
import { normaliseLegacyCar, slugify, tidy, type LegacyCar, type Normalised } from "../src/lib/legacy/normalise";
import { site } from "../src/lib/site";
import { formatNaira } from "../src/lib/money";

const dryRun = process.argv.includes("--dry-run");

const mongoUri = process.env.LEGACY_MONGO_URI;
if (!mongoUri) {
  console.error("Set LEGACY_MONGO_URI (the legacy API's MONGO_URI) in .env.local.");
  process.exit(1);
}
if (!dryRun && !process.env.DATABASE_URL) {
  console.error("Set DATABASE_URL, or pass --dry-run to only produce the report.");
  process.exit(1);
}

// ── Read the legacy database ────────────────────────────────────────────────
const mongo = new MongoClient(mongoUri, { readPreference: "secondaryPreferred" });
await mongo.connect();
const legacy = mongo.db();
const read = async (name: string): Promise<Document[]> => legacy.collection(name).find({}).toArray();

const [cars, enquiries, reviews, posts, comments, subs, notifs, settings] = await Promise.all([
  read("cars"),
  read("enquiries"),
  read("reviews"),
  read("blogposts"),
  read("comments"),
  read("subscribers"),
  read("notifications"),
  read("sitesettings"),
]);
await mongo.close();

const idOf = (d: Document) => String(d._id);

// ── Clean the vehicles ──────────────────────────────────────────────────────
const cleaned: Normalised[] = cars.map((c) =>
  normaliseLegacyCar({ ...(c as unknown as LegacyCar), _id: idOf(c) }),
);
const unusable = cleaned.filter((n) => !n.vehicle.year);

// ── Report ──────────────────────────────────────────────────────────────────
function report(): string {
  const needsAttention = cleaned.filter((n) => n.warnings.length);
  const lines: string[] = [
    `# Legacy import report`,
    ``,
    `Generated ${new Date().toISOString()}${dryRun ? " (dry run — nothing written)" : ""}.`,
    ``,
    `| Source | Records |`,
    `| --- | --- |`,
    `| Vehicles | ${cars.length} (${cleaned.filter((n) => n.vehicle.status === "available").length} available, ${cleaned.filter((n) => n.vehicle.status === "sold").length} sold) |`,
    `| Enquiries | ${enquiries.length} |`,
    `| Reviews | ${reviews.length} |`,
    `| Blog posts / comments | ${posts.length} / ${comments.length} |`,
    `| Subscribers | ${subs.length} |`,
    `| Notifications | ${notifs.length} |`,
    ``,
    `## Vehicles needing a person's attention (${needsAttention.length} of ${cleaned.length})`,
    ``,
    `Each of these imports, but has something a salesperson should check or fill in from the new admin.`,
    ``,
  ];
  for (const n of needsAttention) {
    const v = n.vehicle;
    lines.push(`### ${v.year ?? "?"} ${v.make} ${v.model} — ${v.priceMinor ? formatNaira(v.priceMinor) : "price on request"}`);
    for (const w of n.warnings) lines.push(`- ${w}`);
    lines.push("");
  }
  const fixed = cleaned.filter((n) => n.fixes.length);
  lines.push(`## Corrections made automatically (${fixed.length})`, ``);
  for (const n of fixed) for (const f of n.fixes) lines.push(`- ${n.vehicle.year} ${n.vehicle.make} ${n.vehicle.model}: ${f}`);
  if (unusable.length) {
    lines.push(``, `## Not imported (${unusable.length})`, ``);
    for (const n of unusable) lines.push(`- ${n.vehicle.make} ${n.vehicle.model}: no valid year.`);
  }
  return lines.join("\n") + "\n";
}

mkdirSync(".data", { recursive: true });
writeFileSync(".data/legacy-import-report.md", report(), "utf8");

console.log(
  `Read ${cars.length} vehicles, ${enquiries.length} enquiries, ${reviews.length} reviews, ` +
    `${posts.length} posts, ${comments.length} comments, ${subs.length} subscribers, ${notifs.length} notifications.`,
);
console.log(`${cleaned.filter((n) => n.warnings.length).length} vehicles need attention — see .data/legacy-import-report.md`);

if (dryRun) process.exit(0);

// ── Write the new database ──────────────────────────────────────────────────
const client = postgres(process.env.DATABASE_URL!, { max: 1, prepare: false });
const db = drizzle(client, { schema });
const counts: Record<string, number> = {};
const skipped: string[] = [];

try {
  await db.transaction(async (tx) => {
    // The dealer and its showroom.
    const [dealer] = await tx
      .insert(schema.dealers)
      .values({ slug: "sabicars", name: site.name, legalName: site.legalName, rcNumber: site.rcNumber })
      .onConflictDoUpdate({ target: schema.dealers.slug, set: { name: site.name, legalName: site.legalName, rcNumber: site.rcNumber } })
      .returning();
    const D = dealer.id;

    const [existingLocation] = await tx.select().from(schema.locations).where(and(eq(schema.locations.dealerId, D), eq(schema.locations.name, "Sabicars showroom")));
    const locationId =
      existingLocation?.id ??
      (
        await tx
          .insert(schema.locations)
          .values({ dealerId: D, name: "Sabicars showroom", addressLine1: site.address.line1, addressLine2: site.address.line2, city: site.address.city, state: "Lagos", phone: site.phones[0].e164 })
          .returning()
      )[0].id;

    // Vehicles. A vehicle that already has an address keeps it, so a URL that
    // has been shared or indexed never changes on a re-run.
    const existing = await tx.select({ legacyId: schema.vehicles.legacyId, slug: schema.vehicles.slug }).from(schema.vehicles).where(eq(schema.vehicles.dealerId, D));
    const slugByLegacy = new Map(existing.map((r) => [r.legacyId, r.slug]));
    const taken = new Set(existing.map((r) => r.slug));

    for (const { vehicle: v } of cleaned) {
      if (!v.year) continue;
      let slug = slugByLegacy.get(v.legacyId);
      if (!slug) {
        const base = slugify(v.year, v.make, v.model);
        slug = base;
        for (let i = 2; taken.has(slug); i++) slug = `${base}-${i}`;
        taken.add(slug);
      }
      // Everything but the slug, which is set once and never overwritten.
      const fields = {
        dealerId: D,
        legacyId: v.legacyId,
        locationId,
        make: v.make,
        model: v.model,
        year: v.year,
        body: v.body,
        segment: v.segment,
        condition: v.condition,
        mileageKm: v.mileageKm,
        fuel: v.fuel,
        transmission: v.transmission,
        transmissionDetail: v.transmissionDetail,
        drivetrain: v.drivetrain,
        engine: v.engine,
        horsepower: v.horsepower,
        exteriorColour: v.exteriorColour,
        interiorColour: v.interiorColour,
        seats: v.seats,
        priceMinor: v.priceMinor,
        status: v.status,
        badge: v.badge,
        isFeatured: v.isFeatured,
        inHero: v.inHero,
        description: v.description,
        autochekUrl: v.autochekUrl,
        features: v.features,
        createdAt: v.createdAt,
        updatedAt: v.updatedAt,
        publishedAt: v.createdAt,
        soldAt: v.status === "sold" ? v.updatedAt : null,
      };
      const [saved] = await tx
        .insert(schema.vehicles)
        .values({ ...fields, slug })
        .onConflictDoUpdate({ target: schema.vehicles.legacyId, set: fields })
        .returning({ id: schema.vehicles.id });

      // Photos are replaced wholesale: until cutover the legacy admin is the
      // source of truth for them.
      await tx.delete(schema.vehicleMedia).where(eq(schema.vehicleMedia.vehicleId, saved.id));
      if (v.images.length) {
        await tx.insert(schema.vehicleMedia).values(
          v.images.map((url, position) => ({
            vehicleId: saved.id,
            url,
            position,
            cloudinaryPublicId: url.match(/\/upload\/(?:v\d+\/)?(.+?)\.[a-z0-9]+$/i)?.[1] ?? null,
            alt: `${v.year} ${v.make} ${v.model}${position ? ` — photo ${position + 1}` : ""}`,
          })),
        );
      }
      counts.vehicles = (counts.vehicles ?? 0) + 1;
      counts.photos = (counts.photos ?? 0) + v.images.length;
    }

    // Enquiries -> leads. One that left neither a phone nor an email cannot be
    // followed up, and the leads table refuses it by design.
    for (const e of enquiries) {
      const phone = tidy(e.phone) || null;
      const email = tidy(e.email) || null;
      const name = tidy(e.name);
      if (!name || (!phone && !email)) {
        skipped.push(`Enquiry ${idOf(e)}: no name, or no way to reply.`);
        continue;
      }
      const values = {
        dealerId: D,
        legacyId: idOf(e),
        type: "contact" as const,
        channel: "legacy_import" as const,
        status: e.read ? ("contacted" as const) : ("new" as const),
        name,
        phone,
        email,
        message: [tidy(e.subject), tidy(e.message)].filter(Boolean).join(" — ") || null,
        createdAt: new Date(e.createdAt ?? Date.now()),
      };
      await tx.insert(schema.leads).values(values).onConflictDoUpdate({ target: schema.leads.legacyId, set: values });
      counts.leads = (counts.leads ?? 0) + 1;
    }

    for (const r of reviews) {
      const rating = Math.min(5, Math.max(1, Number(r.rating) || 5));
      const values = {
        dealerId: D,
        legacyId: idOf(r),
        name: tidy(r.name) || "Customer",
        location: tidy(r.location) || null,
        rating,
        message: tidy(r.message),
        // Keep what was already live; new reviews from now on wait for approval.
        isApproved: r.approved !== false,
        createdAt: new Date(r.createdAt ?? Date.now()),
      };
      if (!values.message) continue;
      await tx.insert(schema.reviews).values(values).onConflictDoUpdate({ target: schema.reviews.legacyId, set: values });
      counts.reviews = (counts.reviews ?? 0) + 1;
    }

    const postIdByLegacy = new Map<string, string>();
    for (const p of posts) {
      const published = Boolean(p.published);
      const values = {
        dealerId: D,
        legacyId: idOf(p),
        slug: tidy(p.slug) || slugify(p.title),
        title: tidy(p.title),
        category: tidy(p.category) || "Industry News",
        excerpt: tidy(p.excerpt),
        content: String(p.content ?? ""),
        coverImageUrl: tidy(p.coverImage) || null,
        author: tidy(p.author) || "Sabicars Team",
        readMinutes: Number(String(p.readTime ?? "").match(/\d+/)?.[0]) || null,
        isPublished: published,
        publishedAt: published ? new Date(p.publishedAt ?? p.createdAt ?? Date.now()) : null,
        views: Number(p.views) || 0,
        shares: Number(p.shares) || 0,
        reactions: p.reactions ?? {},
        createdAt: new Date(p.createdAt ?? Date.now()),
      };
      const [saved] = await tx
        .insert(schema.blogPosts)
        .values(values)
        .onConflictDoUpdate({ target: schema.blogPosts.legacyId, set: values })
        .returning({ id: schema.blogPosts.id });
      postIdByLegacy.set(idOf(p), saved.id);
      counts.posts = (counts.posts ?? 0) + 1;
    }

    for (const c of comments) {
      const postId = postIdByLegacy.get(String(c.postId));
      if (!postId) {
        skipped.push(`Comment ${idOf(c)}: its post no longer exists.`);
        continue;
      }
      const values = {
        postId,
        legacyId: idOf(c),
        name: tidy(c.name) || "Reader",
        message: tidy(c.message),
        isApproved: c.approved !== false,
        createdAt: new Date(c.createdAt ?? Date.now()),
      };
      await tx.insert(schema.blogComments).values(values).onConflictDoUpdate({ target: schema.blogComments.legacyId, set: values });
      counts.comments = (counts.comments ?? 0) + 1;
    }

    for (const s of subs) {
      const email = tidy(s.email).toLowerCase();
      if (!email.includes("@")) {
        skipped.push(`Subscriber ${idOf(s)}: not an email address.`);
        continue;
      }
      const values = {
        dealerId: D,
        legacyId: idOf(s),
        email,
        name: tidy(s.name) || null,
        topics: Array.isArray(s.topics) && s.topics.length ? s.topics : ["cars", "blog", "offers"],
        isActive: s.active !== false,
        createdAt: new Date(s.createdAt ?? Date.now()),
      };
      await tx.insert(schema.subscribers).values(values).onConflictDoUpdate({ target: schema.subscribers.legacyId, set: values });
      counts.subscribers = (counts.subscribers ?? 0) + 1;
    }

    for (const n of notifs) {
      const values = {
        dealerId: D,
        legacyId: idOf(n),
        title: tidy(n.title),
        message: String(n.message ?? "").trim(),
        kind: ["car", "blog", "offer", "system"].includes(n.type) ? n.type : "system",
        link: tidy(n.link) || null,
        createdAt: new Date(n.createdAt ?? Date.now()),
      };
      await tx.insert(schema.notifications).values(values).onConflictDoUpdate({ target: schema.notifications.legacyId, set: values });
      counts.notifications = (counts.notifications ?? 0) + 1;
    }

    const heroVideo = settings.find((s) => s.key === "heroVideoUrl");
    if (heroVideo) {
      await tx
        .insert(schema.settings)
        .values({ dealerId: D, key: "hero_video_url", value: tidy(heroVideo.value) || null })
        .onConflictDoUpdate({ target: [schema.settings.dealerId, schema.settings.key], set: { value: tidy(heroVideo.value) || null, updatedAt: sql`now()` } });
    }

    // Legacy vehicles deleted from Mongo since the last run are unlisted here,
    // not deleted: a sold car's page and its history stay on record.
    const liveIds = cleaned.map((n) => n.vehicle.legacyId);
    if (liveIds.length) {
      await tx
        .update(schema.vehicles)
        .set({ status: "unlisted", updatedAt: sql`now()` })
        .where(and(eq(schema.vehicles.dealerId, D), sql`${schema.vehicles.legacyId} IS NOT NULL`, sql`NOT (${inArray(schema.vehicles.legacyId, liveIds)})`, sql`${schema.vehicles.status} IN ('available','reserved')`));
    }

    await tx.insert(schema.auditLog).values({ dealerId: D, entity: "legacy_import", entityId: new Date().toISOString(), action: "import", diff: { counts, skipped } });
  });

  console.log("Imported:", counts);
  if (skipped.length) console.log(`Skipped ${skipped.length}:`, skipped);
} catch (e) {
  console.error("Import failed — nothing was written:", (e as Error).message);
  process.exitCode = 1;
} finally {
  await client.end();
}
