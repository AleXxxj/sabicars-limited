# The Sabicars Project Book

*How the platform is made: for the owner, a partner, or the next developer. The first half is for anyone; the second half is for whoever opens the code. Written 8 November 2026 from the `platform` branch, checked against the code that day (every command, table and job named here exists). The day-by-day record of decisions is [HISTORY.md](HISTORY.md). Keep this book in step whenever a service, table, route or key changes.*

---

## 1. What Sabicars is, and the two sites

Sabicars Limited is a registered car dealer in Lagos. It sells its own cars and buses, sells other dealers' buses on consignment, buys cars, and arranges finance through Autochek (the "Drive Plan"). The website is the dealership's front desk: it shows the stock, takes every enquiry, books viewings, holds a car against a deposit, pays people who send buyers, answers questions day and night, and tells the owner when something is wrong.

Two sites exist today:

| | Address | What it is | Where it runs |
|---|---|---|---|
| **Old site** | `https://sabicars.com` (and `www`) | Static HTML pages in the repo root, plus a separate Express/MongoDB API at `https://sabicars-api.onrender.com` | GitHub Pages (pages) and Render (API). Render's free plan sleeps, so the first visit after a quiet spell is slow. |
| **New platform** | `https://sabicars.vercel.app` | The `web/` app described in this book | Vercel, with a Supabase database. Becomes `sabicars.com` on switch day. |

On switch day only two DNS records change (see `docs/LAUNCH.md`, part B). The old site is never deleted, so switching back is the same two records put back.

## 2. The languages and tools

- **TypeScript** — the language the platform is written in: JavaScript with types, so a wrong price field is caught before the site is built, not by a buyer.
- **React** — the way screens are built: small reusable pieces (a car card, a form, a chat window).
- **Next.js** (version 16) — the framework around React: pages and addresses, the server side, image resizing, redirects from the old addresses, and the hooks Vercel runs.
- **Tailwind** (v4) — the styling system. Colours come from one palette file, so the orange and green are the same on every page.
- **Drizzle** — the layer that talks to the database in TypeScript and keeps the schema and its migrations in the repo.
- **PostgreSQL** — the database itself (version 17), hosted by Supabase in production and run locally from `node_modules` for development.
- **Playwright** — the browser robot that walks the site as a buyer and as staff after every deploy, and drives the money paths on every push.
- **Node** — runs the JavaScript on the server and the scripts.
- **npm** — installs the libraries and runs the named commands (`npm run build`, `npm run test:smoke`).
- **git / GitHub** — the history of every change, the public repo `AleXxxj/sabicars-limited`, and GitHub Actions for the automatic checks.
- **Claude Code** — the AI coding assistant the platform was built with; the `CLAUDE.md`, `AGENTS.md` and memory notes in the repo are its instructions.

## 3. The services the site rents

| Service | What it does for Sabicars | What breaks without it | Where it is set up | Cost (as the docs state it) |
|---|---|---|---|---|
| **Vercel** | Hosts and builds the site on every push to `platform`; can resize photos (`NEXT_PUBLIC_IMAGE_DELIVERY=vercel`). | No site. | vercel.com → project `sabicars`, root `web`, production branch `platform`. Environment variables live here. | ~$20/month Pro (free plan forbids commercial use). |
| **Supabase** | The Postgres database, and staff sign-in (Supabase Auth). | No data, no admin. | supabase.com → project → Connect (connection strings), Project settings → API (keys). Tables are locked to its Data API by `src/db/lock.sql`. | ~$25/month Pro; ~$30 with a Small compute instance, the dial for a viral day. |
| **Cloudinary** | Stores every vehicle photo (folder `sabicars`) and the weekly private database backup; resizes photos today. | No new photos; the backup has nowhere to go. | cloudinary.com console. | Free plan: 25 credits per rolling 30 days (1 credit = 1,000 resizes, 1 GB stored or delivered). A full catalogue outgrows it unless Vercel resizes. |
| **Resend** | Sends every email: staff alerts, buyer confirmations, reminders, partner welcomes, the Friday digest. | Nothing is emailed or queued. | resend.com, with `sabicars.com` verified. | Free plan 100 emails/day; move to Pro before the first viral day. |
| **Paystack** | Pays partner commissions by bank transfer from Sabicars' balance, checks whose name a bank account is in, and takes reservation deposits. | Payouts are recorded as manual bank transfers and a manager confirms each account by hand; online deposits do not work. | dashboard.paystack.com → Settings → API Keys & Webhooks; webhook and approval URLs point at the site. | Per transaction. |
| **cron-job.org** | The clock. Calls the seven `/api/cron/*` jobs on schedule with the `CRON_SECRET` header. | No emails drain, no escalation, reminders, digest, payouts check, backup or Monday review. | cron-job.org account. Its free plan waits 30 s and disables a job after 25 failures. | Free. |
| **UptimeRobot** | Calls `/api/health` every 5 minutes; alerts the owner and developer when it is not 200. | Nobody knows the site is down until a buyer says so. | uptimerobot.com. | Free. |
| **Anthropic** | The model behind Ask Sabicars and its weekly self-review. | The chat asks buyers to call or WhatsApp instead; the owner is alerted. | console.anthropic.com → API keys and Billing (keep credit on it). | A few to tens of dollars a month; rate-limited per visitor, capped per day. |
| **OneSignal** | Push to customers who subscribed on the old site (new arrivals, price drops); same account, so subscribers carry over. | Customer push stops; staff alerts are unaffected (browser Web Push). | onesignal.com → Settings → Keys & IDs; Site URL must be `https://sabicars.com`. | Not stated. |
| **Autochek** | Partner, not a service: finances the Drive Plan balance. Its deposit tiers by model year are coded in `lib/drive-plan.ts`. | — | — | — |
| **GitHub Actions** | Runs the two workflows: the deploy walkthrough and the end-to-end money paths. | Changes ship untested. | github.com → repo → Actions; secrets under Settings → Secrets and variables. | Free for a public repo. |
| **Google Play** | Lists the Android app (`android/`), a shell that opens the website full screen. | No app in the store; the website itself is unaffected. | play.google.com/console, an organisation account in Sabicars Limited's name (needs a D-U-N-S number). Steps in `docs/PLAY-STORE.md`. | US$25 once. |

DNS for `sabicars.com` is at GoDaddy; email (MX) runs on Google Workspace.

## 4. The folder map

### Repository root (`/Users/mologstics/sabicars-limited`)

- `*.html`, `theme.css`, `theme.js`, `notifications.js`, `OneSignalSDKWorker.js`, `manifest.json`, `CNAME`, `robots.txt`, `sitemap.xml`, `blog/`, `images/` — the **old site**, served by GitHub Pages. Do not edit; it is what buyers see until switch day.
- `brand/` — the identity: logo files, the generated marks (`npm run brand`).
- `docs/` — `ARCHITECTURE.md` (why it is built this way, phase by phase), `LAUNCH.md` (the switch-day checklist and everything measured), `PLAY-STORE.md` (the Android app and the Play Console steps), `HOMEPAGE-PLATFORM.md`, `SURVIVAL-PLAN.md`, `TRAINEE-TEST.md`.
- `android/` — the **Google Play app**: a Trusted Web Activity made with Google's Bubblewrap. `twa-manifest.json` is the recipe (package `com.sabicars.app`, opens `https://sabicars.com`, Android 7.0+); the rest is the generated Android project; `store/` holds the listing screenshots and feature graphic. The signing key is **not** here (see `docs/PLAY-STORE.md`). The site proves it owns the app through `web/public/.well-known/assetlinks.json`.
- `.github/workflows/` — `smoke.yml` (walk the live site after each deploy), `e2e.yml` (money paths on a throwaway database).
- `.vscode/` — editor settings.
- `web/` — the new platform. Everything below is inside it.

### `web/` top level

`package.json` (commands and libraries), `next.config.ts` (image rules, old-URL redirects, `noindex` on the Vercel address), `playwright.config.ts`, `drizzle.config.ts`, `.env.example` (variable names, documented), `AGENTS.md`/`CLAUDE.md`, `public/` (OneSignal worker, staff service worker, placeholder image), `scripts/`, `e2e/`, `src/`.

### `src/app` — the pages and addresses

**Public site** — `(site)/`: `page.tsx` (home), `vehicles/[slug]` (the stock and one car), `buy/[term]` (search-term pages such as "Highlander"), `compare/[pair]`, `reserve/[slug]` and `reserve/done`, `drive-plan/`, `hummer-bus/` (Hiace family guide), `fleet/`, `find/` (Sourcing Desk), `sell/`, `saved/`, `ask/[slug]`, `blog/[slug]` (Insights), `partners/` (the programme), `partner/` (account: `cars` to share, `pin`, `forgot`, `[token]` set-up link), `review/[token]`, `v/[code]` (Verified inspection report), `about/`, `contact/`, `privacy/`, `unsubscribe/[token]`.

**Referral links** — `r/[code]` and `r/[code]/[slug]`: record the partner, then forward. **Old addresses** — `car-detail.html/`, `blog-post.html/`: look up the old Mongo id and redirect permanently. Also `llms.txt`, `robots.ts`, `sitemap.ts`, `manifest.ts`, `error.tsx`.

**Admin** — `admin/login`, `admin/seal/[id]` (print the Verified seal), and `admin/(app)/`: `leads` (Enquiries), `vehicles` (+ `new`, `[id]`, `[id]/inspection`), `reservations`, `requests` (Sourcing Desk), `conversations`, `ask` (Answers + weekly lesson), `reviews`, `blog`, `audience`, `consignors`, `partners`, `payouts`, `status` (System status, errors, backup download). `lib/admin-nav.ts` decides who sees what: Sales the first five; Owner and Manager all.

**API** — `api/health` (uptime check; returns the running commit), `api/assistant` (+ `[id]/messages`, `[id]/typing`), `api/admin/conversations/[id]/live|typing`, `api/viewings/[reference]/calendar.ics`, `api/notifications`, `api/unsubscribe/[token]`, `api/payments/paystack/webhook` and `approve`, `api/ops/alert` and `api/ops/client-error`.

**Cron** — `api/cron/outbox`, `escalate`, `viewings`, `digest`, `payouts`, `learn`, `backup`.

### `src/lib` — the rules and the plumbing

- **Business rules, no database, proved at build**: `money.ts` (kobo integers), `reservations.ts`, `referral.ts`, `ledger-rules.ts`, `drive-plan.ts`, `viewings.ts`, `showroom-hours.ts`, `partner-pin.ts`, `hiace-family.ts`, `matching.ts`.
- **Money and partners**: `ledger.ts`, `ledger-notify.ts`, `paystack.ts`, `banks.ts`, `partners.ts` (codes, first-touch cookie), `partner-session.ts`, `partner-pin-links.ts`, `partner-flag.ts`, `referral-link.ts`, `share-caption.ts`, `brand-photo.ts`, `reserve.ts` (deposit: quote → Paystack → confirm once → expire).
- **Leads and messaging**: `leads.ts`, `lead-labels.ts`, `deadline.ts`, `reference.ts`, `sourcing*.ts`, `watch-engine.ts`, `viewing-reminders.ts`, `alerts.ts` (Web Push to staff, then email), `email.ts` (the outbox), `newsletter.ts`, `notifications.ts` and `onesignal-client.ts` (customer push).
- **Assistant** (`assistant/`): `prompt.ts` (voice and limits), `knowledge.ts` (what it may know, live from the DB), `parts.ts` (cards), `memory.ts`, `vault.ts` (encryption), `seller.ts`/`seller-room.ts` (Chat with seller), `learn.ts` (Monday review), `summarise.ts`, `health.ts`, `dev-reply.ts` (local stand-in).
- **Operations**: `launch-checks.ts` (System status), `incidents.ts`, `rate-limit.ts`, `cron.ts`, `backup.ts`, `audit.ts`, `auth.ts` (`requireStaff`), `supabase/`, `cache-tags.ts`, `public-pages.ts`.
- **Content and presentation**: `site.ts` (business facts, one place), `navigation.ts`, `theme.ts`, `fonts.ts`, `media.ts`, `cloudinary.ts` (signed direct uploads), `vehicle*.ts`, `inventory-filters.ts`, `compare.ts`, `fleet.ts`, `sell.ts`, `saved.ts`, `device-list.ts`, `phone.ts`, `blog/`, `inspection/checklist.ts`, `seo/`, `legacy/` (old URLs and redirects).
- **`actions/`** — the server actions forms and admin buttons call. **`repositories/`** — the read queries pages use.

### `src/components`

Grouped by where they appear: `site/` (header, footer, phone tab bar, bell), `home/`, `inventory/`, `vehicle/` (enquiry sheet), `reserve/`, `compare/`, `forms/`, `partner/`, `referral/`, `reviews/`, `saved/`, `subscribe/`, `assistant/` (chat window, Hiace race), `blog/` (blocks, illustrations, video), `admin/` (every admin form and button), `brand/`, `ui/`, plus `VehicleCard`, `VehicleImage`, `Logo`, `ThemeToggle`.

### `src/content`, `src/db`, `src/styles`

- `content/articles/` (seven articles as code), `content/ask-answers.ts` (first /ask answers), `listing-corrections.json` and `notification-corrections.json` (fixes to old-site records that the legacy import re-applies, only while the old record still says what was corrected). Seeded with `blog:seed` and `ask:seed`; wording changes carried in with `content:sync` without overwriting staff edits.
- `db/schema.ts` (every table), `db/migrations/` (0000–0023), `db/lock.sql` (closes tables to Supabase's Data API), `db/index.ts` (the connection).
- `styles/palette.json` → generated `tokens.css`; `article.css`, `assistant.css`, `motion.css`.
- `instrumentation.ts` (every server error becomes an incident), `proxy.ts` (signed-out visitors sent away from `/admin`).

### `scripts/` and `e2e/`

Scripts: `local-db.mjs`, `migrate.mjs`, `import-legacy.mts`, `create-staff.mjs`, `check-auth.mjs`, `check-launch.mts`, `seed-*.mts`, `sync-content.mjs`, `restore-backup.mts`, `build-tokens.mjs`, `check-contrast.mjs`, `build-brand.mjs` (+ `fonts/`), and the `verify-*` gates (schema, money, hours, viewings, seller, reservations, drive-plan, ledger, pin, backup, outbox, chat).

Tests: `e2e/smoke/` (fifteen read-only walks, one per public area plus admin and api), `e2e/flows/` (`money-path`, `sign-in`, `throttle`), `fixtures.ts`, `helpers.ts`.

## 5. The database

| Table | Holds |
|---|---|
| `dealers` | Each dealer (Sabicars first; a second dealer is a second row), with its CAC registration. |
| `locations` | Parks and showrooms where cars are kept. |
| `consignors` | People whose vehicles Sabicars sells for them. |
| `staff` | Staff accounts and roles (owner, manager, sales); paired with Supabase Auth. |
| `vehicles` | Every car and bus: make, model, year, price in kobo, status, owner, keeper, location. |
| `vehicle_media` | Photos and videos of each vehicle, on Cloudinary. |
| `inspections` | Sabicars Verified reports; the evidence behind the seal. |
| `leads` | Every enquiry, call-back, viewing, fleet, sell and Drive Plan request, with its SC- reference. |
| `vehicle_requests` | Sourcing Desk: standing requests for cars not in stock. |
| `request_matches` | Each vehicle offered against a request, once. |
| `vehicle_watches` | Buyers watching a car for a price drop. |
| `lead_activity` | Everything that happened to a lead, in order. |
| `push_subscriptions` | Staff phones subscribed to Web Push alerts. |
| `partners` | Refer & Earn partners: code, bank account, PIN hash. |
| `partner_sessions` | Partner log-ins, one per phone (hash only). |
| `commissions` | One per sold vehicle: 1.5% frozen at the sale. |
| `reservations` | Cars held by a deposit; one live row per car. |
| `payouts` | Every attempt to pay a commission, with its idempotent reference. |
| `reviews` | Customer reviews, approved by staff. |
| `blog_posts` | Insights articles as blocks. |
| `blog_comments` | Comments, published or hidden by staff. |
| `subscribers` | Newsletter list with unsubscribe tokens. |
| `notifications` | The bell feed: new arrivals, price cuts, staff posts. |
| `newsletter_sends` | Every newsletter email sent; a week's digest goes out once. |
| `settings` | Small key/value settings (hero video, the day's video, daily alert claims). |
| `assistant_conversations` | Every Ask Sabicars chat, including those that became nothing. |
| `assistant_messages` | The words of each chat, encrypted when the key is set. |
| `assistant_reviews` | The Monday lesson reports for the owner. |
| `ask_answers` | Published answers on /ask. |
| `audit_log` | Who changed which field, before and after. |
| `incidents` | Distinct errors, counted, redacted. |
| `rate_limits` | Form-use counts per hashed address and window. |
| `email_outbox` | Every transactional email, written down before it is sent. |

## 6. The main flows

**A buyer enquires**
1. On a car's page the buyer picks call-back, question or viewing and submits (`actions/enquiry.ts`).
2. The server checks the bot trap, the per-connection ceiling and the phone number, then saves a `leads` row with an SC- reference, attributed to a partner if their cookie is present.
3. Staff phones get a Web Push at once; an email follows through the outbox.
4. The buyer sees the reference and a WhatsApp option quoting it.
5. If nobody takes the lead within the showroom-hours limit, the escalation job tells the managers.
6. Staff work it in Enquiries; every call and note lands in `lead_activity`.

**A buyer books a viewing**
1. The enquiry card offers hour slots from the showroom's published hours: up to a week ahead, at least two hours from now, two per hour.
2. The server re-checks the slot against the same rules before saving.
3. The buyer gets a confirmation with the place (the car's park, the showroom, or "to be agreed" for a car held elsewhere) and a calendar file (`/api/viewings/[reference]/calendar.ics`).
4. At 06:30 UTC the `viewings` job emails each buyer a reminder for today and sends staff the day's list; running twice sends nothing twice.

**A buyer reserves a car**
1. `/reserve/[slug]` quotes the policy: ₦500,000 holds a week, 40% or more holds a month, refund minus 18%.
2. The server creates a pending `reservations` row (one live row per car) and starts a Paystack payment with our `scr_` reference.
3. The buyer pays on Paystack; the payment is confirmed once, by whichever arrives first: the buyer returning, or Paystack's webhook.
4. The car shows as reserved; an attempt nobody paid in 30 minutes, or a hold that ran out, is released before anyone else is let in.
5. Staff manage holds, refunds and showroom deposits in Reservations.

**A partner shares a car and earns**
1. A partner registers on `/partners`, chooses a six-digit PIN, and gets a code like `ADA7K3`.
2. From `/partner/cars` they share a car: a photo with the Sabicars strip and a caption ending in their link `/r/CODE/car-slug`.
3. A buyer taps it; the site records the partner in a 90-day cookie (first touch wins) and shows the car. Any enquiry that buyer leaves is attributed to the partner.
4. When staff mark the car sold and attribute the sale, 1.5% of the sale price is frozen in `commissions`.
5. After the 48-hour cooling-off the daily payouts job tells managers it is due; a manager pays by Paystack transfer (account name checked against the partner's) or records a bank transfer.
6. The partner is told, and sees it on their statement.

**Staff add a car with photos**
1. Inventory → New: make, model, year, price (typed as naira, stored as kobo), condition, body type, owner/consignor, location.
2. Photos go straight from the phone to Cloudinary; the server only signs the upload and verifies the result.
3. On save the inventory cache is expired, so the public page changes at once, and every field change is written to `audit_log`.
4. The engines run after the save: matching Sourcing Desk requests are offered the car; a price cut tells the watchers; a "new arrival" lands in the bell and goes out by OneSignal push.
5. `vehicle-quality.ts` lists what is still missing (photos, price, description) in the admin.

**The weekly email**
1. Friday 08:00 UTC, cron-job.org calls `/api/cron/digest`.
2. The job gathers the week's new arrivals; a week with none sends nothing.
3. Emails go through Resend in batches of 100, each with one-click unsubscribe.
4. `newsletter_sends` records each recipient, keyed on the week, so a rerun sends nothing twice.
5. Staff can also preview and send a broadcast from Audience.

**The scheduled jobs** (each called by cron-job.org with the `CRON_SECRET` header; each answers within 25 seconds and is safe to run twice)
1. `outbox` every minute — drains queued email.
2. `escalate` every 5 minutes — late leads to managers.
3. `payouts` daily 06:00 UTC — Paystack transfers in flight; commissions due.
4. `viewings` daily 06:30 UTC — reminders and the day's list.
5. `digest` Fridays 08:00 UTC — the newsletter.
6. `learn` Mondays 06:00 UTC — the assistant's report.
7. `backup` Sundays 02:00 UTC — the private database copy to Cloudinary.

**Ask Sabicars answers a question**
1. A buyer opens the chat from any page, sometimes with the question pre-filled.
2. `knowledge.ts` assembles what it may know from the live database: every car, price, Drive Plan deposit, the published answers.
3. The model (Anthropic, `ASSISTANT_MODEL`) replies within the limits in `prompt.ts`: no invented prices, no finance promises.
4. The reply streams in; directives like `[[cars: …]]` become car cards, comparisons or a call-back form.
5. The chat is saved (encrypted when the key is set) and summarised for staff; a call-back becomes a lead.
6. In "Chat with seller" mode staff phones ring and a person answers; Sabi steps in only if nobody is free.
7. On Monday `learn` reads the week's chats and files drafts the owner can publish on `/ask`.

**A deploy**
1. A developer pushes to `platform` (after `npm run build` passes locally).
2. Vercel builds `web/` and, if the build passes, makes it live at `sabicars.vercel.app` (later `sabicars.com`).
3. GitHub Actions `e2e.yml` starts a throwaway Postgres, seeds it, runs the gates, proves backup and outbox, builds and starts the site, and drives the money paths.
4. `smoke.yml` waits for Vercel's status to turn green, then for `/api/health` to report that exact commit, then walks the live site on desktop and phone as a buyer and as staff.
5. If anything fails it posts to `/api/ops/alert`: managers are pushed and emailed and the failure appears under Errors on System status.

**An outage**
1. UptimeRobot calls `/api/health` every 5 minutes; it checks the database and answers 200 with the running commit, or not.
2. On a non-200, UptimeRobot emails and pushes the owner and the developer.
3. Meanwhile every server error is recorded as an incident and the managers told the first time it is seen.
4. The owner opens `/admin/status`: every setting, the outbox, the last backup and the open errors, each with a plain-English fix.
5. If the site cannot be fixed quickly, part C of `LAUNCH.md` puts the two DNS records back to the old site.

## 7. Environment keys

Names only. Vercel = Project → Settings → Environment Variables. Local = `web/.env.local` (gitignored). CI = GitHub repo secrets/variables.

| Name | For | Lives in |
|---|---|---|
| `DATABASE_URL` | Postgres connection (session pooler, port 5432) | Vercel, local, CI |
| `DIRECT_URL` | Same pooler, used by migrations | Vercel, local, CI |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Staff sign-in | Vercel, local, CI |
| `SUPABASE_SERVICE_ROLE_KEY` | Creating staff accounts and the CI seed only; **not** in Vercel | local, CI |
| `NEXT_PUBLIC_SITE_URL` | Overrides the site address; leave unset on Vercel | local, CI |
| `NEXT_PUBLIC_IMAGE_DELIVERY` | `vercel` to have Vercel resize photos (Pro only) | Vercel |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | Photo uploads and the backup | Vercel, local |
| `CLOUDINARY_UPLOAD_FOLDER` | Alternative folder for rehearsals; unset live | local |
| `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `RESEND_FROM_NAME` | Email | Vercel, local |
| `RESEND_API_URL` | Test stand-in only; **never** in Vercel | tests only |
| `PAYSTACK_SECRET_KEY` | Payouts, account checks, deposits | Vercel only |
| `CRON_SECRET` | Authorises the cron jobs and `/api/ops/alert` | Vercel, CI |
| `RATE_LIMIT_SECRET` | Hashes visitor addresses (falls back to `CRON_SECRET`) | Vercel |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | Staff phone alerts (Web Push) | Vercel, local |
| `ASSISTANT_MESSAGES_KEY` | Encrypts chat text; keep with the backups | Vercel |
| `ANTHROPIC_API_KEY`, `ASSISTANT_MODEL`, `ASSISTANT_SUMMARY_MODEL`, `ASSISTANT_DAILY_CAP` | Ask Sabicars | Vercel, local (optional) |
| `NEXT_PUBLIC_ONESIGNAL_APP_ID`, `ONESIGNAL_REST_API_KEY` | Customer push | Vercel |
| `NEXT_PUBLIC_GA_ID` | Google Analytics measurement id | Vercel |
| `LEGACY_MONGO_URI` | Read-only import from the old API, until cutover | local |
| `STAFF_EMAIL`, `STAFF_NAME`, `STAFF_ROLE`, `STAFF_PHONE`, `STAFF_PASSWORD` | One-off inputs to `npm run staff:create` | shell only |
| `SMOKE_BASE_URL`, `E2E_BASE_URL`, `E2E_STAFF_EMAIL`, `E2E_STAFF_PASSWORD`, `E2E_ALLOW_REMOTE` | The test suites | CI, local by hand |
| `VERCEL_*`, `CI`, `NODE_ENV`, `NEXT_RUNTIME` | Set by Vercel/CI themselves | automatic |

The old API on Render has its own set (`MONGO_URI`, `CLOUDINARY_*`, `JWT_SECRET`, `BLOG_PIN`, `INVENTORY_PIN`, `RESEND_*`, `SITE_URL`, `ONESIGNAL_*`), see `sabicars-backend/CLAUDE.md`.

## 8. Run, test, build, deploy, see errors

**Run locally** (in `web/`): `npm install`; `cp .env.example .env.local` and fill it; `npm run db:local` (real Postgres 17 from `node_modules`); `npm run db:migrate`; `npm run legacy:import` or `npm run e2e:seed` for data; `npm run dev` → `http://localhost:3000`. Without an Anthropic key the chat uses `dev-reply.ts`.

**Test**: `npm run build` runs the eleven gates and fails on any. `npm run test:smoke` walks a running site read-only. `npm run test:e2e` drives the money paths against the database in `.env.local` (seed first). `test:backup`, `test:outbox`, `test:chat` prove those parts against a local database. `npm run check:launch` prints the System status checks. `npm run typecheck`, `npm run lint`.

**Build and deploy**: push to `platform`; Vercel builds `web/` with `next build` and goes live. There is no manual deploy step. On switch day, follow `docs/LAUNCH.md` part B.

**Android app** (in `android/`): Bubblewrap, Java 17 and the Android SDK live on Alex's Mac under `~/sabicars-android/tools` and `~/.bubblewrap/` (no Homebrew there). Raise `appVersionCode` in `twa-manifest.json`, then `bubblewrap update --skipVersionUpgrade --directory . --manifest ./twa-manifest.json` and `bubblewrap build --directory . --skipPwaValidation` with the key password in `BUBBLEWRAP_KEYSTORE_PASSWORD` and `BUBBLEWRAP_KEY_PASSWORD`. Upload `app-release-bundle.aab` in the Play Console. Full steps in `docs/PLAY-STORE.md`.

**Where to look when something is wrong**: `/admin/status` first (settings, outbox, backup, open errors with fixes); Vercel → Deployments (build and function logs); GitHub → Actions (the failed run and its Playwright report, kept 14 days); Resend → Logs; cron-job.org job history; UptimeRobot; Anthropic console for credit.

## 9. Rules that must not be broken

- **Never put a proxy (Cloudflare orange cloud or any other) in front of `sabicars.com`.** The rate limiter trusts Vercel's real-IP header; behind a proxy every visitor shares a few addresses and real buyers get refused.
- **Never commit `.env.local`, `.env.live`, the Android keystore or any key.** `.env.example` holds placeholders only; the Play upload key stays in `~/sabicars-android/keys` and a password manager. Keep the live connection string in `web/.env.live`, never `.env.production.local` (Next loads that automatically and would point local tests at production).
- **Never run the flows suite, `e2e:seed`, `test:backup` or `test:outbox` against the live database.** The scripts refuse a Supabase address; do not force them. Do not fire load at production either: the Nano database stalled under it (30 Oct 2026).
- **Use the session pooler (port 5432) for both `DATABASE_URL` and `DIRECT_URL`;** the transaction pooler loses replies and hangs admin pages.
- **Do not set `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_URL` or `NEXT_PUBLIC_SITE_URL` in Vercel.**
- **Never touch the MX records**; email runs on Google Workspace. No second DMARC record. On switch day change only the four `@` A records and the `www` CNAME, old values written down first.
- **Do not edit the old site on `main` or the repo root.** It is the fallback.
- **`tokens.css` is generated** from `palette.json`; never hand-edit it.
- **Money is integer kobo**, never floats; every figure shown goes through `lib/money.ts`.
- **Business facts live in `lib/site.ts`** (plus the showroom row in `locations` and the showroom answer on `/ask`). Print "Amazing Grace, Km 13", never "Shopping Complex" or "Plaza".
- **Every admin page and server action calls `requireStaff()` itself;** the proxy and the nav are not the security boundary.
- **Every cron job must answer within 25 seconds** (`answerInTime`, `lib/cron.ts`) or cron-job.org disables it.
- **Check SQL from `drizzle-kit generate` by hand** before committing; it was wrong for the chat migrations.
- **Old API quirks** (`sabicars-backend`): `models/comment.js` is lowercase on purpose; literal routes like `/admin/all` must come before `/:id`.
- **Plain English on every page**, one stated job per page; never remove what a live page had without a data-backed replacement.
