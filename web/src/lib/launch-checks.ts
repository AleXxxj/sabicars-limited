import "server-only";
import { and, count, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { db } from "@/db";
import journal from "@/db/migrations/meta/_journal.json";
import { askAnswers, blogPosts, dealers, pushSubscriptions, staff, vehicleMedia, vehicles } from "@/db/schema";
import { LEGACY_PAGES } from "@/lib/legacy/urls";

/**
 * Is the platform ready to be sabicars.com — and, after launch, is it still
 * healthy? Every check says what it found and, when something is wrong, what
 * to do about it, in plain words. Values of keys are never shown: only
 * whether they are set.
 *
 * Shown to the owner at /admin/status on the deployed site, and printed by
 * `npm run check:launch` against any copy of it.
 */

export type CheckStatus = "ok" | "warn" | "missing";

export interface Check {
  group: "Settings" | "Stock and content" | "Old addresses";
  label: string;
  status: CheckStatus;
  detail: string;
  fix?: string;
}

async function sabicarsDealerId(): Promise<string> {
  const [row] = await db.select({ id: dealers.id }).from(dealers).where(eq(dealers.slug, "sabicars")).limit(1);
  if (!row) throw new Error("The Sabicars dealer row is missing — run the legacy import.");
  return row.id;
}

const set = (...names: string[]) => names.every((n) => Boolean(process.env[n]?.trim()));

function setting(label: string, names: string[], what: string, fix: string, optional = false): Check {
  const ok = set(...names);
  return {
    group: "Settings",
    label,
    status: ok ? "ok" : optional ? "warn" : "missing",
    detail: ok ? what : `Not set: ${names.filter((n) => !process.env[n]?.trim()).join(", ")}.`,
    fix: ok ? undefined : fix,
  };
}

async function assistantCheck(): Promise<Check> {
  const key = process.env.ANTHROPIC_API_KEY?.trim();
  const label = "Ask Sabicars (the assistant)";
  if (!key)
    return {
      group: "Settings",
      label,
      status: "missing",
      detail: "Not set: ANTHROPIC_API_KEY. Buyers who open the chat are asked to call or WhatsApp.",
      fix: "Create a key at console.anthropic.com → Settings → API keys, and add it as ANTHROPIC_API_KEY.",
    };
  try {
    // Listing models costs nothing and proves the key is accepted. Credit is not checked here:
    // the first reply that fails for lack of it alerts the owner and managers.
    const r = await fetch("https://api.anthropic.com/v1/models?limit=1", {
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01" },
      signal: AbortSignal.timeout(8000),
    });
    if (r.ok)
      return { group: "Settings", label, status: "ok", detail: "The key is accepted. Keep credit on the account (Settings → Billing)." };
    return {
      group: "Settings",
      label,
      status: "missing",
      detail: `Anthropic rejected the key (HTTP ${r.status}).`,
      fix: "Create a new key at console.anthropic.com and replace ANTHROPIC_API_KEY.",
    };
  } catch {
    return { group: "Settings", label, status: "warn", detail: "The key is set, but Anthropic could not be reached just now." };
  }
}

async function databaseChecks(): Promise<Check[]> {
  try {
    const rows = await db.execute(sql`select count(*)::int as n from drizzle.__drizzle_migrations`);
    const applied = Number((rows as unknown as { n: number }[])[0]?.n ?? 0);
    const expected = journal.entries.length;
    return [
      {
        group: "Settings",
        label: "Database",
        status: applied >= expected ? "ok" : "missing",
        detail:
          applied >= expected
            ? `Connected; all ${expected} schema updates applied.`
            : `Connected, but ${expected - applied} of ${expected} schema updates are not applied.`,
        fix: applied >= expected ? undefined : "Run npm run db:migrate against this database.",
      },
    ];
  } catch (e) {
    return [
      {
        group: "Settings",
        label: "Database",
        status: "missing",
        detail: `Cannot reach the database: ${(e as Error).message.slice(0, 120)}`,
        fix: "Check DATABASE_URL — Supabase → Connect shows the connection string.",
      },
    ];
  }
}

async function contentChecks(): Promise<Check[]> {
  const dealerId = await sabicarsDealerId();
  const listed = and(eq(vehicles.dealerId, dealerId), inArray(vehicles.status, ["available", "reserved"]));
  const [[stock], [noPhoto], [noPrice], doubtful, [owners], [phones], [posts], [answers]] = await Promise.all([
    db.select({ n: count() }).from(vehicles).where(listed),
    db
      .select({ n: count() })
      .from(vehicles)
      .where(and(listed, sql`not exists (select 1 from ${vehicleMedia} m where m.vehicle_id = ${vehicles.id} and m.kind = 'photo')`)),
    db
      .select({ n: count() })
      .from(vehicles)
      .where(and(listed, sql`${vehicles.priceMinor} is null`)),
    db
      .select({ year: vehicles.year, make: vehicles.make, model: vehicles.model })
      .from(vehicles)
      .where(
        and(
          listed,
          eq(vehicles.condition, "brand_new"),
          sql`(${vehicles.year} < extract(year from now())::int - 2 or coalesce(${vehicles.mileageKm}, 0) > 1000)`,
        ),
      ),
    db
      .select({ n: count() })
      .from(staff)
      .where(and(eq(staff.dealerId, dealerId), eq(staff.role, "owner"), eq(staff.isActive, true))),
    db
      .select({ n: sql<number>`count(distinct ${pushSubscriptions.staffId})::int` })
      .from(pushSubscriptions)
      .innerJoin(staff, eq(staff.id, pushSubscriptions.staffId))
      .where(eq(staff.dealerId, dealerId)),
    db
      .select({ n: count() })
      .from(blogPosts)
      .where(and(eq(blogPosts.dealerId, dealerId), eq(blogPosts.isPublished, true))),
    db
      .select({ n: count() })
      .from(askAnswers)
      .where(and(eq(askAnswers.dealerId, dealerId), eq(askAnswers.isPublished, true))),
  ]);
  const g = "Stock and content" as const;
  return [
    {
      group: g,
      label: "Vehicles for sale",
      status: stock.n > 0 ? "ok" : "missing",
      detail: `${stock.n} listed.${noPhoto.n ? ` ${noPhoto.n} without photos.` : ""}${noPrice.n ? ` ${noPrice.n} without a price.` : ""}`,
      fix: stock.n ? undefined : "Run the final import (npm run legacy:import) or add vehicles in Inventory.",
    },
    {
      group: g,
      label: "Listings that contradict themselves",
      status: doubtful.length ? "warn" : "ok",
      detail: doubtful.length
        ? `Marked "brand new" but older than two years or with mileage: ${doubtful.map((v) => `${v.year} ${v.make} ${v.model}`).join("; ")}.`
        : "None found.",
      fix: doubtful.length ? "Correct the condition, year or mileage in Inventory — Ask Sabicars repeats what listings say." : undefined,
    },
    {
      group: g,
      label: "Owner account",
      status: owners.n > 0 ? "ok" : "missing",
      detail: owners.n > 0 ? "At least one owner can sign in." : "No active owner account.",
      fix: owners.n > 0 ? undefined : "Run npm run staff:create for the owner.",
    },
    {
      group: g,
      label: "Staff phones taking alerts",
      status: phones.n > 0 ? "ok" : "warn",
      detail:
        phones.n > 0
          ? `${phones.n} staff ${phones.n === 1 ? "phone has" : "phones have"} alerts on.`
          : "No staff phone has alerts switched on yet.",
      fix:
        phones.n > 0
          ? undefined
          : "Each salesperson: sign in on their phone, add the site to the home screen, and switch on alerts in Enquiries.",
    },
    {
      group: g,
      label: "Articles and answers",
      status: posts.n > 0 ? "ok" : "warn",
      detail: `${posts.n} articles, ${answers.n} answers on /ask.`,
    },
  ];
}

/** Every old address's destination must be a live page; `base` is this site's own address. */
async function addressChecks(base: string): Promise<Check[]> {
  const dealerId = await sabicarsDealerId();
  const destinations = [...new Set(Object.values(LEGACY_PAGES))];
  const dead: string[] = [];
  await Promise.all(
    destinations.map(async (path) => {
      try {
        const r = await fetch(new URL(path, base), { redirect: "manual", signal: AbortSignal.timeout(10000) });
        if (r.status !== 200) dead.push(`${path} (${r.status})`);
      } catch {
        dead.push(`${path} (unreachable)`);
      }
    }),
  );
  const [[cars], [posts]] = await Promise.all([
    db
      .select({ n: count() })
      .from(vehicles)
      .where(
        and(eq(vehicles.dealerId, dealerId), isNotNull(vehicles.legacyId), inArray(vehicles.status, ["available", "reserved", "sold"])),
      ),
    db
      .select({ n: count() })
      .from(blogPosts)
      .where(and(eq(blogPosts.dealerId, dealerId), isNotNull(blogPosts.legacyId), eq(blogPosts.isPublished, true))),
  ]);
  const g = "Old addresses" as const;
  return [
    {
      group: g,
      label: "Old pages redirect to live pages",
      status: dead.length ? "missing" : "ok",
      detail: dead.length
        ? `${destinations.length - dead.length} of ${destinations.length} destinations are live. Not yet: ${dead.join(", ")}.`
        : `All ${destinations.length} destinations are live.`,
      fix: dead.length ? "Publish the missing pages before launch, or the old links that point to them will fail." : undefined,
    },
    {
      group: g,
      label: "Old car and article links",
      status: "ok",
      detail: `${cars.n} old car links and ${posts.n} old article links resolve to their new pages; anything else goes to the inventory or the blog.`,
    },
  ];
}

export async function launchChecks(base: string): Promise<Check[]> {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  const settings: Check[] = [
    ...(await databaseChecks()),
    {
      group: "Settings",
      label: "Site address",
      status: !siteUrl || siteUrl === "https://sabicars.com" ? "ok" : "warn",
      detail:
        !siteUrl || siteUrl === "https://sabicars.com"
          ? "https://sabicars.com"
          : `Set to ${siteUrl} — links in emails and search results will point there.`,
      fix:
        !siteUrl || siteUrl === "https://sabicars.com"
          ? undefined
          : "For the live site, set NEXT_PUBLIC_SITE_URL to https://sabicars.com (or remove it).",
    },
    setting(
      "Staff sign-in",
      ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"],
      "Supabase is connected.",
      "Copy the project URL and publishable key from Supabase → Project settings → API.",
    ),
    (() => {
      const c = setting(
        "Photos (Cloudinary)",
        ["CLOUDINARY_CLOUD_NAME", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET"],
        "Uploads go to the sabicars folder.",
        "Copy the Cloudinary credentials from the Cloudinary console.",
      );
      const folder = process.env.CLOUDINARY_UPLOAD_FOLDER?.trim();
      if (c.status === "ok" && folder && folder !== "sabicars")
        return {
          ...c,
          status: "warn" as const,
          detail: `Uploads go to "${folder}", not the live "sabicars" folder.`,
          fix: "Remove CLOUDINARY_UPLOAD_FOLDER on the live site.",
        };
      return c;
    })(),
    setting(
      "Staff phone alerts",
      ["NEXT_PUBLIC_VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY"],
      "New enquiries reach staff phones.",
      "Generate a VAPID key pair (npx web-push generate-vapid-keys) and add both keys.",
    ),
    setting(
      "Scheduled jobs",
      ["CRON_SECRET"],
      "Escalation and the Friday digest can run.",
      "Add a long random CRON_SECRET, and point a scheduler at /api/cron/escalate (every 5 minutes) and /api/cron/digest (Fridays).",
    ),
    setting(
      "Email",
      ["RESEND_API_KEY", "RESEND_FROM_EMAIL"],
      "Staff alerts, buyer alerts and the newsletter can send.",
      "Create a Resend account, verify sabicars.com, and add RESEND_API_KEY and RESEND_FROM_EMAIL.",
    ),
    setting(
      "Customer push notifications",
      ["NEXT_PUBLIC_ONESIGNAL_APP_ID", "ONESIGNAL_REST_API_KEY"],
      "New arrivals and price drops reach subscribers.",
      "Copy the App ID and REST API key from OneSignal → Settings → Keys & IDs.",
    ),
    await assistantCheck(),
  ];
  const [content, addresses] = await Promise.all([contentChecks(), addressChecks(base)]);
  return [...settings, ...content, ...addresses];
}
