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
   - Email: `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `RESEND_FROM_NAME`. Never set `RESEND_API_URL`: it exists only for `npm run test:outbox`, and set in Vercel it would send every email somewhere other than Resend.
   - Photos: leave `NEXT_PUBLIC_IMAGE_DELIVERY` unset until the project is on Vercel Pro (step 9).
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
   - `/api/cron/outbox` every minute: sends the emails waiting in the outbox (step 9), up to 600 a run in batches of 100, and stops early when Resend is busy. Without it, an email Resend could not take at once is never sent: it expires after a day. Two runs at once send nothing twice.
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
   - **Cloudinary: the arithmetic** (corrected 22 October 2026). One credit is 1,000 resizes, or 1 GB stored, or 1 GB delivered; the free plan has 25 a month. Each upload counts as one resize.
     - Uploads: at ten photos a car, 1,000 cars is about 10,000 photos, about 10 credits to upload.
     - Storage: uploads are now capped at 2000px as they arrive, so a photo is about 0.4–0.5 MB (it was about 1.5 MB). 10,000 photos is about 5 GB, 5 credits a month.
     - Resizing, with Cloudinary doing it (today): each photo is needed in about 4 sizes, in up to 2 formats, so 40–80 credits as the photos are first viewed. The free plan cannot absorb that.
     - Resizing, with `NEXT_PUBLIC_IMAGE_DELIVERY=vercel` on Vercel Pro: Cloudinary makes one copy of each photo (about 10 credits, once), and Vercel resizes it and keeps every size in its cache for 31 days. Vercel Pro charges image transformations from $0.05 per 1,000. Vercel Hobby stops resizing new photos after 5,000 a month: **never switch it on while the project is on Hobby.**
   - **The photo switch, after upgrading to Vercel Pro:** Vercel → Project → Settings → Environment Variables → Production, add `NEXT_PUBLIC_IMAGE_DELIVERY` = `vercel`, then Deployments → the latest production deployment → Redeploy (the setting is read when the site is built). The walkthrough's "has a photograph that really loaded" check (`smoke.yml`, step 10) runs on that deploy and confirms photos still load. To switch back, remove the variable and redeploy.
   - **Resend's plan.** Its free plan sends 100 emails a day. A viral morning of partner welcomes is thousands, and what is over the day's allowance waits in the outbox and expires unsent after a day. Before the first viral day, move to Resend Pro (about $20 a month, 50,000 emails a month, no daily cap); check the figures on resend.com/pricing when you do.
   - Code, then re-run the same load test against the upgraded database with the real mix (browsing, searching, photos, enquiries, registrations together):
     1. **Done 22 October 2026.** Photos through Vercel's image cache instead of straight from Cloudinary: one switch, `NEXT_PUBLIC_IMAGE_DELIVERY` (`web/src/lib/media.ts`), four widths in WebP cached 31 days, and uploads capped at 2000px as they arrive (`web/src/lib/cloudinary.ts`); off until Vercel Pro (above). Proved against Cloudinary itself: a signed 3000×1500 test upload was stored at 2000×1000, its response signature verified, and it was deleted.
     2. **Done 22 October 2026.** Each inventory search result cached for sixty seconds, cleared the moment staff save a car (new uploads appear within a minute at worst, usually at once). Measured on a production build, 200 visits each: `/vehicles?body=suv` went from 12 database transactions per visit to 0 (one refresh of 11 queries a minute); a filtered and sorted inventory 12 → 0; `/blog` 4 → 0; `/find` 4 → 0; `/sell` 5 → 0. Simultaneous visitors arriving as an entry refills share one lookup per server instance. The footer's list of makes has its own cache tag, so a photo upload no longer refreshes every page on the site.
     3. **Done 22 October 2026.** Car and comparison pages built on their first visit and cached, instead of every one pre-built at deploy, so a thousand-car catalogue keeps deploys quick. Measured: the deploy builds 156 pages instead of 205 (the 24 newest cars, 30 comparisons); a car page not pre-built answered its first visit and was served from the cache after.
     4. **Done 22 October 2026.** The public forms throttled per address, and outgoing email queued in an outbox sent at Resend's pace (both below). Measured: 250 emails at once answered in about half a second on a local database, and against a stand-in for Resend that was busy at first, every one was sent exactly once, including emails whose reply was lost on purpose (`npm run test:outbox`, 33 checks, on every push). 31 registrations from one address: the first 30 saved, the 31st refused with the message and nothing saved, bots never counted (`e2e/flows/throttle.spec.ts`).
     5. A free uptime monitor on the site, alerting the owner and the developer within a minute (step 10). Not code: set it up before the switch.

   **The throttles** (`web/src/lib/rate-limit.ts`). Each public form counts how often one connection uses it, in a window shared by every server instance:

   | Form | Allowed per connection |
   |---|---|
   | Enquiries: contact, car enquiries, viewings, fleet, sourcing, sell or trade in, Drive Plan, call-backs, alerts | 30 every 10 minutes |
   | Refer & Earn registration | 30 every 10 minutes |
   | Newsletter sign-up | 30 every 10 minutes |
   | Reviews (through a buyer's private link) | 10 every 10 minutes |
   | Comments on articles | 10 every 10 minutes |
   | A partner changing their bank account | 10 an hour |
   | Staff sign-in | 10 every 15 minutes |

   The limits are generous on purpose. Nigerian mobile networks put thousands of phones behind one public address (carrier-grade NAT), so on a viral day many real people arrive through the same address: a person filling in a form a few times is nowhere near the ceiling, and a script sending hundreds a minute is stopped after the first few dozen. Whoever reaches it is told plainly to try again in a few minutes or call the showroom, and what they typed stays in the form. Reactions and shares on articles have a ceiling too (60 every 10 minutes) and simply stop counting when it is reached. The address is kept only as a keyed hash (an HMAC with the server's `CRON_SECRET`, or `RATE_LIMIT_SECRET` if set), so the table cannot be turned back into addresses. Once a connection is over its limit, each server instance refuses it from memory for the rest of the window, so a flood costs the database almost nothing; the first refusal in each form is put on `/admin/status#errors`, so the owner can see if real buyers are being turned away and raise a limit. If the counter itself cannot be reached, the form is allowed: a broken limiter must never turn real buyers away.
   The address is the one Vercel itself reports (`x-real-ip`), which a visitor cannot forge. That holds only while visitors reach Vercel directly: **never put another proxy, such as Cloudflare with its orange cloud, in front of sabicars.com**, or every visitor would arrive from the proxy's few addresses and share one count.

   **Article reads** are counted per server instance and written once every ten seconds, instead of one database write per reader on the same row: a shared article no longer adds a write for every person who opens it. A few seconds of reads can go uncounted if an instance stops; nothing else depends on the count.

   **The email outbox** (`web/src/lib/email.ts`). Every email the site sends — staff and buyer alerts, viewing reminders, partner welcomes and commission notices — is written down first, then sent at once. When Resend is busy (its default is ten requests a second per account) or down, the email waits, and the minute job (`/api/cron/outbox`, step 7) sends what is waiting in batches of 100, Resend's batch size, stopping after 40 seconds so a run always ends inside its time limit; the next minute carries on. Nothing is sent twice: every request to Resend carries an idempotency key that Resend remembers for 24 hours, the same as the outbox's expiry, and a send whose reply never came (a timeout, a dropped connection) is retried under the same key, so Resend answers "already sent" instead of sending again. `npm run test:outbox` proves this on every push against a stand-in that loses replies on purpose. A failed try waits 1, 2, 4 … minutes before the next, at most an hour. An address Resend refuses for good fails on its own; the rest of its batch is sent. An email still unsent after 24 hours is marked expired, not delivered late, since a day-old welcome or reminder does more harm than good. Partner welcomes go at most once a day per partner, and each commission and payment notice once, so a stranger re-entering someone's phone number cannot flood their inbox. Sent, failed and expired emails are kept 30 days, then removed. The newsletter does not use the outbox: it keeps its own record. `/admin/status` shows the outbox as "Email outbox": anything waiting longer than 15 minutes, refused or expired is flagged there.

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
