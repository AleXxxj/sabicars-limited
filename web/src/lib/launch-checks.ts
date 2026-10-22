import "server-only";
import { siteUrl } from "@/lib/site";
import { and, count, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { db } from "@/db";
import journal from "@/db/migrations/meta/_journal.json";
import { askAnswers, blogPosts, dealers, emailOutbox, pushSubscriptions, staff, vehicleMedia, vehicles } from "@/db/schema";
import { backupStatus } from "@/lib/backup";
import { emailConfigured } from "@/lib/email";
import { openIncidentCount } from "@/lib/incidents";
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

/** A day as the site prints it, in Lagos. */
function lagosDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-NG", { day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Lagos" });
}

/** The weekly backup is late once it is older than a week and a day. */
const BACKUP_STALE_DAYS = 8;

/** The last copy of the database Sabicars holds itself (lib/backup.ts). */
async function backupCheck(): Promise<Check> {
  const g = "Settings" as const;
  const label = "Last backup";
  try {
    const { last, lastError } = await backupStatus(await sabicarsDealerId());
    if (lastError)
      return {
        group: g,
        label,
        status: "missing",
        detail: `The last run, on ${lagosDate(lastError.at)}, failed: ${lastError.error.replace(/\.?\s*$/, ".")}${last ? ` The last good copy is from ${lagosDate(last.at)}.` : ""}`,
        fix: "Put right what the error names, then wait for Sunday's run or open /api/cron/backup from the scheduler. Until it succeeds, download a copy from this page.",
      };
    if (!last)
      return {
        group: g,
        label,
        status: "warn",
        detail: "The weekly backup has not run yet; schedule /api/cron/backup.",
        fix: "Add /api/cron/backup to the scheduler, Sundays at 02:00 UTC, with the same Authorization header as the other jobs. Until it runs, download a copy from this page.",
      };
    const ageDays = (Date.now() - new Date(last.at).getTime()) / 86_400_000;
    const rows = Object.values(last.counts).reduce((a, b) => a + b, 0);
    const where = last.publicId ? "in Sabicars' Cloudinary account (Media Library → backups), private" : "not uploaded";
    return {
      group: g,
      label,
      status: ageDays <= BACKUP_STALE_DAYS ? "ok" : "warn",
      detail: `${lagosDate(last.at)}, ${(last.bytes / 1e6).toFixed(1)} MB, ${rows.toLocaleString("en-NG")} rows, ${where}.`,
      fix:
        ageDays <= BACKUP_STALE_DAYS
          ? undefined
          : `No backup for ${Math.floor(ageDays)} days. Check the scheduler's /api/cron/backup job, and download a copy from this page meanwhile.`,
    };
  } catch (e) {
    return { group: g, label, status: "warn", detail: `Could not read the backup record: ${(e as Error).message.slice(0, 120)}` };
  }
}

/** Errors the site has seen and nobody has marked dealt with (lib/incidents.ts). */
async function incidentCheck(): Promise<Check> {
  const g = "Settings" as const;
  const label = "Open errors";
  try {
    const n = await openIncidentCount();
    return {
      group: g,
      label,
      status: n > 0 ? "warn" : "ok",
      detail: n > 0 ? `${n} ${n === 1 ? "error is" : "errors are"} open on this page.` : "None open. Every server error, browser error and failed deploy check lands here.",
      fix: n > 0 ? "Read each one under Errors below. When it is dealt with, mark it resolved; if it happens again it reopens on the same row." : undefined,
    };
  } catch (e) {
    return {
      group: g,
      label,
      status: "warn",
      detail: `Could not count errors: ${(e as Error).message.slice(0, 120)}`,
      fix: "If the Database check above says schema updates are not applied, apply them first.",
    };
  }
}

/** An email waiting longer than this means the minute job is not draining the outbox. */
const OUTBOX_STALE_MINUTES = 15;

const plural = (n: number, one: string, many: string) => `${n.toLocaleString("en-NG")} ${n === 1 ? one : many}`;

/**
 * The email outbox (lib/email.ts): every email is written down first and sent
 * by the minute job when Resend is busy. Healthy means nothing has waited
 * longer than a quarter of an hour and nothing failed or expired in the last
 * day. Exported for scripts/verify-outbox.mts, which proves it against a
 * real outbox.
 */
export async function outboxCheck(): Promise<Check> {
  const g = "Settings" as const;
  const label = "Email outbox";
  // The Email check above already says what to set; this one only says that nothing is queued.
  if (!emailConfigured()) return { group: g, label, status: "warn", detail: "Email is not set up, so nothing is queued or sent. See Email above." };
  try {
    // Counted here rather than with outboxStatus() from lib/email, for two reasons. Every window is worked out by
    // the database (now() - interval), so no Date is bound as a raw parameter, which postgres.js cannot send. And an
    // email expires once it is a day old, so "expired in the last day" means created one to two days ago.
    const [s] = await db
      .select({
        pending: sql<number>`count(*) filter (where ${emailOutbox.status} in ('pending', 'sending'))::int`,
        failed: sql<number>`count(*) filter (where ${emailOutbox.status} = 'failed' and ${emailOutbox.createdAt} > now() - interval '1 day')::int`,
        expired: sql<number>`count(*) filter (where ${emailOutbox.status} = 'expired' and ${emailOutbox.createdAt} > now() - interval '2 days')::int`,
        sentToday: sql<number>`count(*) filter (where ${emailOutbox.status} = 'sent' and ${emailOutbox.sentAt} > now() - interval '1 day')::int`,
        waitingMinutes: sql<number>`coalesce(floor(extract(epoch from now() - min(${emailOutbox.createdAt}) filter (where ${emailOutbox.status} in ('pending', 'sending'))) / 60), 0)::int`,
      })
      .from(emailOutbox);
    const { pending, failed, expired, sentToday, waitingMinutes } = s ?? { pending: 0, failed: 0, expired: 0, sentToday: 0, waitingMinutes: 0 };
    const stale = pending > 0 && waitingMinutes > OUTBOX_STALE_MINUTES;
    const sent = `${plural(sentToday, "email", "emails")} sent in the last day.`;
    if (!stale && !failed && !expired)
      return {
        group: g,
        label,
        status: "ok",
        detail: pending ? `${plural(pending, "email is", "emails are")} waiting their turn, none for long. ${sent}` : `Nothing waiting. ${sent}`,
      };
    const found = [
      pending ? `${plural(pending, "email is", "emails are")} waiting${stale ? `, the oldest for ${plural(waitingMinutes, "minute", "minutes")}` : ""}.` : null,
      failed ? `${plural(failed, "email was", "emails were")} refused by Resend in the last day.` : null,
      expired ? `${plural(expired, "email", "emails")} expired unsent after a day.` : null,
      sent,
    ];
    const fixes = [
      stale || expired
        ? "The minute job /api/cron/outbox may not be running: check the scheduler has it every minute, with the same Authorization header as the other jobs, and that its last runs answered 200. If they did, Resend has been busy or down; the outbox keeps trying for a day."
        : null,
      failed
        ? "A refused email is usually a mistyped address and needs nothing more. If many are refused, open Resend → Logs for the reason."
        : null,
    ];
    return { group: g, label, status: "warn", detail: found.filter(Boolean).join(" "), fix: fixes.filter(Boolean).join(" ") };
  } catch (e) {
    return {
      group: g,
      label,
      status: "warn",
      detail: `Could not read the outbox: ${(e as Error).message.slice(0, 120)}`,
      fix: "If the Database check above says schema updates are not applied, apply them first.",
    };
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
  const address = siteUrl();
  const preview = /\.vercel\.app$/.test(new URL(address).hostname);
  const settings: Check[] = [
    ...(await databaseChecks()),
    {
      group: "Settings",
      label: "Site address",
      status: address === "https://sabicars.com" ? "ok" : "warn",
      detail:
        address === "https://sabicars.com"
          ? "https://sabicars.com"
          : preview
            ? `${address} — Vercel's address, used until sabicars.com is added as the project's domain. Right for the rehearsal.`
            : `Set to ${address} — links in emails and search results will point there.`,
      fix:
        address === "https://sabicars.com"
          ? undefined
          : preview
            ? "On switch day: add sabicars.com as the project's domain in Vercel, then redeploy."
            : "For the live site, remove NEXT_PUBLIC_SITE_URL (or set it to https://sabicars.com).",
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
      "The email outbox, escalation, viewing reminders, the Friday digest, the daily payouts check and the weekly backup can run.",
      "Add a long random CRON_SECRET, and point a scheduler at /api/cron/outbox (every minute), /api/cron/escalate (every 5 minutes), /api/cron/viewings (daily 06:30 UTC), /api/cron/digest (Fridays), /api/cron/payouts (daily 06:00 UTC) and /api/cron/backup (Sundays 02:00 UTC). Paystack's webhook, /api/payments/paystack/webhook, needs no scheduler: set the URL in the Paystack dashboard. Also point a free uptime monitor (UptimeRobot or cron-job.org) at /api/health every minute, to email the owner and the developer whenever it does not answer 200 — nothing inside the site can check that for itself.",
    ),
    setting(
      "Email",
      ["RESEND_API_KEY", "RESEND_FROM_EMAIL"],
      "Staff alerts, buyer alerts and the newsletter can send.",
      "Create a Resend account, verify sabicars.com, and add RESEND_API_KEY and RESEND_FROM_EMAIL.",
    ),
    await outboxCheck(),
    (() => {
      const c = setting(
        "Partner payouts (Paystack)",
        ["PAYSTACK_SECRET_KEY"],
        "Commissions can be paid by Paystack transfer, and bank accounts are verified automatically.",
        "Add PAYSTACK_SECRET_KEY (live key) in Vercel; until then payouts are recorded as bank transfers and accounts are confirmed by a manager.",
        true,
      );
      if (c.status === "ok" && (process.env.PAYSTACK_SECRET_KEY?.trim() ?? "").startsWith("sk_test_"))
        return {
          ...c,
          status: "warn" as const,
          detail: "A Paystack test key is set: transfers settle instantly and no real money moves. Right for the rehearsal.",
          fix: "For the live site, replace it with the live secret key from Paystack → Settings → API Keys & Webhooks.",
        };
      return c;
    })(),
    setting(
      "Customer push notifications",
      ["NEXT_PUBLIC_ONESIGNAL_APP_ID", "ONESIGNAL_REST_API_KEY"],
      "New arrivals and price drops reach subscribers.",
      "Copy the App ID and REST API key from OneSignal → Settings → Keys & IDs.",
    ),
    await assistantCheck(),
    await backupCheck(),
    await incidentCheck(),
  ];
  const [content, addresses] = await Promise.all([contentChecks(), addressChecks(base)]);
  return [...settings, ...content, ...addresses];
}
