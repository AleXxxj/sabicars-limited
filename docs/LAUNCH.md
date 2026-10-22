# Launch: making sabicars.com the new platform

The order of work for switching sabicars.com from the old GitHub Pages site to the
new platform (`web/`, branch `platform`), and how to switch back within minutes if
anything goes wrong.

**The rule of the day:** the domain stays the same. Only where it points changes.
Every old address answers with a permanent redirect to its new page (see
`web/src/lib/legacy/urls.ts`). So Google keeps the site's standing, shared links
keep working, and no "change of address" is needed in Search Console.

`/admin/status` on the new site is the checklist: it shows each setting as ready,
needing attention, or missing. `npm run check:launch` prints the same list.

---

## A. Before the day (any time, nothing visible to buyers)

1. **Vercel project**
   - Import `AleXxxj/sabicars-limited` and set the root directory to `web`.
   - The framework is Next.js.
   - Set the production branch to `platform`.
2. **Production database**
   - This is the Supabase project's Postgres. Take both connection strings from Supabase → Connect:
     - the transaction pooler, for `DATABASE_URL`;
     - the session pooler, for `DIRECT_URL`.
   - Apply the schema: `npm run db:migrate` with those strings.
3. **Settings in Vercel** (Project → Settings → Environment Variables → Production). Every one listed on `/admin/status`:
   - Database: `DATABASE_URL`, `DIRECT_URL`
   - Supabase: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
   - Cloudinary: `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`. Do **not** set `CLOUDINARY_UPLOAD_FOLDER`; live uploads go to `sabicars/`.
   - Staff phone alerts: `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (`mailto:info@sabicars.com`). Generate a fresh pair: `npx web-push generate-vapid-keys`.
   - Scheduled jobs: `CRON_SECRET`, a long random string.
   - Email: `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `RESEND_FROM_NAME`
   - Customer push: `NEXT_PUBLIC_ONESIGNAL_APP_ID`, `ONESIGNAL_REST_API_KEY`
   - Assistant: `ANTHROPIC_API_KEY`. Use a separate "Sabicars production" key.
   - Partner payouts: `PAYSTACK_SECRET_KEY`, the **live** secret key from Paystack → Settings → API Keys & Webhooks. It unlocks paying commissions by Paystack transfer from Sabicars' balance, and checking whose name a partner's bank account is in the moment they register it. It is set in Vercel only, never in a local `.env`. Without it the platform still works: payouts are recorded as bank transfers made from the bank, and a manager confirms each account by hand. A test key (`sk_test_…`) is fine for the rehearsal: transfers settle instantly and no money moves; `/admin/status` says so.
   - Do not set `NEXT_PUBLIC_SITE_URL`. The site uses the project's production address from Vercel: `sabicars.vercel.app` during the rehearsal, so shared links preview, and `sabicars.com` once that domain is added. Vercel's own address is never indexed (`X-Robots-Tag: noindex`).
4. **Resend:** verify `sabicars.com`.
   - Add the DNS records Resend gives *alongside* the existing ones.
   - **Never touch the MX records.** sabicars.com's email runs on Google Workspace.
4b. **Paystack** (partner payouts; can follow launch, nothing else waits on it).
   - On Paystack's side, before a transfer can go out: the business is registered on the account (CAC documents, the same RC number as the site), **transfers are enabled** (Paystack switches them on once the business is verified; the payouts page says "Transfers are not enabled" until then), and the **balance is funded** (Settings → Balance → Top up, or money Paystack has collected). Each transfer also costs Paystack's fee: ₦10 up to ₦5,000, ₦25 up to ₦50,000, ₦50 above.
   - Settings → Preferences: **turn off "Confirm transfers before sending"** (the OTP on every transfer). With it on, every payout stops at Paystack waiting for a code nobody receives.
   - Settings → API Keys & Webhooks → **Live Webhook URL**: `https://sabicars.com/api/payments/paystack/webhook` (during the rehearsal, the same path on `sabicars.vercel.app`, and change it on switch day). Paystack sends every event to this address; the platform acts on `transfer.success`, `transfer.failed` and `transfer.reversed` and acknowledges the rest. The request is checked against the secret key's signature, so the URL needs no secret of its own.
   - A webhook that never arrives is not fatal: the daily payouts job (step 7) asks Paystack about every transfer still in flight.
5. **Content into the production database**
   - `npm run legacy:import` (with `LEGACY_MONGO_URI`)
   - `npm run blog:seed`
   - `npm run ask:seed`
   - `npm run staff:create` for each member of staff
6. **Rehearse on the Vercel preview address.** All of these must work:
   - `/admin/status` shows nothing missing, except what depends on the domain.
   - Make a test enquiry. The alert must arrive on a staff phone.
   - Ask Sabicars must answer.
   - `/cars.html` and `/car-detail.html?id=…` must redirect.
7. **Schedulers** (cron-job.org, free), each with the header `Authorization: Bearer <CRON_SECRET>`:
   - `/api/cron/escalate` every 5 minutes
   - `/api/cron/digest` on Fridays at 08:00 UTC
   - `/api/cron/viewings` every day at 06:30 UTC (07:30 in Lagos): reminds each buyer with an email of today's viewing, and sends staff the day's list. Running it twice sends nothing twice.
   - `/api/cron/payouts` every day at 06:00 UTC (07:00 in Lagos): checks every Paystack transfer still in flight against Paystack, and tells the owner and managers, once a day, how many commissions have passed their cooling-off and are waiting to be paid. Running it twice alerts nobody twice.
   - `/api/cron/backup` on Sundays at 02:00 UTC (03:00 in Lagos): a private copy of the whole database into Sabicars' own Cloudinary account (step 10). Running it twice stores a second copy.
8. **A day before:** lower the TTL of the domain's A and `www` records to 300 seconds. Both the switch and any switch-back will then take effect within minutes.

9. **Capacity: what was measured, and what to do before the first viral day.**
   The founder's reach (about 300k followers, posts in the millions of views) means a
   spike of tens of thousands of visitors in an hour is a normal day, not a stress
   test. Measured on 22 October 2026 against the live site and the production database:

   | What | Result | Verdict |
   |---|---|---|
   | Pages (cars, home, articles, plan) | Served from Vercel's edge cache; a flood from one address was cut off by Vercel after a few hundred requests, which is its abuse protection working | Holds. A database outage leaves readers on the last good copy; only forms fail. |
   | Sign-ups through the real registration code | 8,000 registrations, all accepted, 500 a second sustained on one server process; slowest answer 1.4 s at 400 at once | Holds. |
   | Database gate (Supabase free tier pooler) | Limit 200 client connections; about 100 free in two separate measurements; each query from Lagos ≈ 0.5 s | **The weak point.** Thousands of submissions in the same few seconds queue here and the tail sees "try again". |
   | Photos (Cloudinary free, 25 credits a month) | Last 30 days: 5.4 credits, 8,650 image views, 2 GB, ≈ ¼ MB per view | **A viral day is ≈ 90 credits**: photos stop loading mid-morning while pages keep working. |
   | Inventory list with filters (`/vehicles?…`) | Rendered live on every visit, one database query per visitor | **The weak page** in a read spike. |
   | Ask Sabicars | Capped at 4,000 answers a day (`ASSISTANT_DAILY_CAP`) | Degrades politely. |

   Before the switch, in this order:
   - **Vercel Pro** (about $20 a month). Required by Vercel's terms for a business; carries the photo traffic below; lifts function limits; proper scheduling.
   - **Supabase Pro with a Small compute instance** (about $40 a month). Roughly doubles the pooler's capacity and is the dial to turn up on the day. Cost grows with the instance chosen, not with user count; the platform is plain Postgres and plain SQL, so another Postgres host later is a connection-string change.
   - **Cloudinary stays on the free plan** once photos are served through Vercel's image cache (code change below): each size of each photo is fetched from Cloudinary once and served from Vercel's edge thereafter, so Cloudinary is storage and uploads only. A thousand more cars at ten photos each is about 3 GB stored, three credits a month. Fallback if the photo path is not changed: Cloudinary Small ($29 a month, 60 credits, $0.55 per extra credit; a viral day ≈ $20 of overage).
   - Code, about two days, then re-run the same load test against the upgraded database with the real mix (browsing, searching, photos, enquiries, registrations together):
     1. Serve photos through Vercel's image cache instead of straight from Cloudinary.
     2. Cache each inventory search result for sixty seconds, cleared the moment staff save a car (new uploads appear within a minute at worst, usually at once; nothing is per car).
     3. Build car and comparison pages on first visit and cache them, instead of pre-building every one at deploy, so a thousand-car catalogue keeps deploys quick.
     4. Throttle the public forms per address, and queue outgoing email in an outbox sent at the provider's pace, so a burst of welcomes, reminders and digests is delayed, never lost.
     5. A free uptime monitor on the site, alerting the owner and the developer within a minute (step 10).

10. **Safety nets.** Three things that watch the site so that nobody has to, and a copy of everything that Sabicars holds itself.

    **The walkthroughs** (GitHub Actions, `.github/workflows/`).
    - `smoke.yml` runs on every production deploy, the moment Vercel reports it live: it opens the deployed site as a buyer and as a member of staff, on a desktop and on a phone, read-only. The public forms are submitted the way a bot would submit them, which the site answers with a plain success without saving anything, so the round trip is proved on the live site and no row is written.
    - `e2e.yml` runs on every push to `platform` and every pull request: it starts an empty Postgres on the runner, applies the schema, seeds fixture rows, builds and starts the site the way Vercel runs it, and drives the money paths end to end — an enquiry, a partner registering and adding a bank account, a car sold with the commission attributed and paid. That database dies with the runner. The live database is never touched.
    - **Secrets to add** (repository → Settings → Secrets and variables → Actions → New repository secret):
      - `CRON_SECRET`, the same value as in Vercel. It lets a failed walkthrough tell the site (below). Without it the run still fails visibly in the Actions tab, but nobody is alerted.
      - For the money-path test's staff screens: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and `E2E_STAFF_EMAIL` / `E2E_STAFF_PASSWORD` for a staff account made for the test alone. Create it with `npm run staff:create` while `.env.local` points at the **local** database (never the production strings): that registers the sign-in with Supabase and writes the staff row into the local database only. The seed script writes the same row into the throwaway database on every run. The live database never gets that row, and a sign-in with no active staff row is refused, so this account cannot open the live admin. Without these five the staff tests are skipped, not failed.
    - **Where to see results:** the repository's Actions tab, two runs per push to `platform`: "Smoke" waits for Vercel's status on the commit, then for the public site to report that commit at `/api/health`, then walks it; "End to end" runs on a throwaway database. A failed run carries a report artifact at the bottom of its page: unzip it and open `e2e-report/index.html` for the Playwright report, with a screenshot of the failure and a trace of every step.
    - **What a failure does:** the managers are pushed and emailed ("Deploy check failed", naming the commit, with a link to the run; or "Deploy failed" when Vercel could not build it and the previous version is still live), and the failure sits on `/admin/status#errors` until someone marks it resolved.
    - The walkthrough needs no Vercel setting: Vercel does not record its deployments on GitHub for this project, so the job starts from the push and reads Vercel's commit status instead. It walks `https://sabicars.vercel.app` by default, the public address, never a deployment's unique address, which Vercel protects with a login. After switch day, add the repository **variable** `SMOKE_BASE_URL` = `https://sabicars.com` (Settings → Secrets and variables → Actions → Variables), so it walks the address buyers use. Before switch day leave it unset: that address is still the old site.

    **The uptime monitor** (UptimeRobot or cron-job.org, both free): `GET https://sabicars.com/api/health` every minute, alerting the owner and the developer — by email, and by WhatsApp where the service offers it — whenever the answer is not 200. The route answers 503 when the database cannot be reached, so a dead database alerts the same way as a dead site. Before switch day, monitor `https://sabicars.vercel.app/api/health` and change the address on the day (B.5). Nothing inside the site can check that the site is up, which is why this one lives outside it.

    **The backup** (`/api/cron/backup`, on the scheduler list in step 7, Sundays at 02:00 UTC). Every table — photos excepted, which already live on Cloudinary and are pointed at by the rows — is written out as one compressed file into Sabicars' own Cloudinary account: Media Library → `backups` folder, delivery type *authenticated*, so no public link serves it; it is downloaded from the Cloudinary console, signed in. The owner can also take a copy at any moment with "Download a backup now" on `/admin/status`. Keep one copy a month somewhere that is not Cloudinary, such as the owner's own drive, so that losing Supabase and Cloudinary at once still leaves a copy. A run that fails alerts the managers and shows as missing on `/admin/status`; the date and size of the last good copy are shown there too.
    To restore, into a **fresh** database: `npm run db:migrate` with that database's connection strings, then `npm run backup:restore -- sabicars-backup-<date>.json.gz --check` to read what the file holds, and the same with `--yes` to load it. The script refuses a Supabase address unless `--production-i-am-sure` is added as well, because the usual reason to restore is a new database, not the live one.
    That a backup restores exactly is not taken on trust: on every push, CI exports its test database through the same code, restores it into an empty one and compares every table row for row (`npm run test:backup`). The first version of the export lost microseconds on timestamps and turned JSON columns into strings on restore; this check is what caught it, and is why the format is now Postgres's own JSON in both directions.
    Keep the live connection string in `web/.env.live` on a development machine, never in `.env.production.local`: Next.js loads the latter automatically for every local `next build` and `next start`, which would quietly point a local test server at the live database.

    **Errors** (`/admin/status#errors`). Every server error, every error a visitor's browser reports and every failed deploy check is recorded there, with where it happened, how many times and when it was last seen. The same error again counts up on one row instead of adding another, so forty failures read as one line, not forty. The managers are pushed and emailed the first time an error is seen, then at most once every six hours while it keeps happening. "Resolve" clears it from the page; if it happens again it reopens on the same row. Account numbers, phone numbers and emails are masked before anything is written.

## B. Switch day (a quiet hour, such as early morning)

1. **Freeze the old admin.**
   - Staff stop adding or editing cars in the old admin.
   - Run `npm run legacy:import` one final time. It updates what changed and is safe to repeat.
2. **Vercel → Domains.**
   - Add `sabicars.com` as the primary domain.
   - Add `www.sabicars.com` redirecting to it, as it does today.
3. **At the domain registrar**, change **only** these two records. Write down the old values first.

   | Record | Now (GitHub Pages) | New (use the values Vercel shows) |
   |---|---|---|
   | `@` A | 185.199.108.153 / .109 / .110 / .111 | Vercel's IP, e.g. 76.76.21.21 |
   | `www` CNAME | alexxxj.github.io | cname.vercel-dns.com |

   Leave the MX, TXT (SPF/DKIM) and all other records alone.
4. **Wait** for Vercel to show the domain as valid and issue the HTTPS certificate. This usually takes minutes.
   Then **Redeploy** the latest production deployment. Pages built before the domain was added still name `sabicars.vercel.app` as their address. After the redeploy, canonical links and link previews say `sabicars.com`.
5. **Check** (a few minutes' work, on a phone and a computer):
   - `https://sabicars.com` and `https://www.sabicars.com` both open the new site.
   - `/cars.html`, `/financing.html`, `/blog.html` and an old `car-detail.html?id=…` link each land on their new pages.
   - `/admin/status` has nothing missing.
   - A test enquiry reaches a staff phone.
   - Ask Sabicars answers.
   - Push notifications: subscribers keep working because the domain and `/OneSignalSDKWorker.js` are unchanged. Confirm that OneSignal → Settings → Web → Site URL is `https://sabicars.com`.
   - If Paystack is set up: change the Live Webhook URL to `https://sabicars.com/api/payments/paystack/webhook` (A.4b), and point the `/api/cron/payouts` scheduler at the new address along with the others.
   - Point the uptime monitor at `https://sabicars.com/api/health`, and add the repository variable `SMOKE_BASE_URL` = `https://sabicars.com` so the deploy walkthrough uses the same address (A.10).
6. **Google Search Console.**
   - Add sabicars.com as a Domain property (verified with a DNS TXT record).
   - Submit `https://sabicars.com/sitemap.xml`.
7. Tell staff: from now on, the admin is `sabicars.com/admin`.

## C. Switching back (if something serious is wrong)

1. At the registrar, restore the two old record values from B.3. With a 300-second TTL, visitors are back on the old site within minutes.
2. Unfreeze the old admin.
3. The old site on `main` was never changed and is still on GitHub Pages, so nothing else needs undoing.

## D. The weeks after

- Watch Search Console → Pages for "Not found (404)". Any old address that shows up there goes into `LEGACY_PAGES`.
- Keep the old API on Render running for 30 days (the final import reads from its database). Then retire it.
- Leave GitHub Pages enabled for a while: `alexxxj.github.io/sabicars-limited/…` links keep forwarding to sabicars.com.
- If `web/` is ever merged into `main` while Pages still publishes `main`, first add a `_config.yml` that excludes `web/` and `docs/`.
- Correct the listings that contradict themselves (flagged on `/admin/status`). Ask Sabicars repeats what listings say.
- Once a month: download a backup from `/admin/status` and keep it somewhere that is not Cloudinary; read the open errors on `/admin/status#errors` and resolve what has been dealt with; read the last few runs in the Actions tab. A red run nobody looked at is a safety net with a hole in it.
