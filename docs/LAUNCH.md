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
8. **A day before:** lower the TTL of the domain's A and `www` records to 300 seconds. Both the switch and any switch-back will then take effect within minutes.

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
   - If Paystack is set up: change the Live Webhook URL to `https://sabicars.com/api/payments/paystack/webhook` (A.4b), and point the `/api/cron/payouts` scheduler at the new address along with the other three.
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
