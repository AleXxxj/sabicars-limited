# Sabicars — Platform Architecture

Status: **approved 2026-09-23** · Phase 1 built locally, not yet deployed · Last updated: 2026-10-21

This document defines what we are building and why, so decisions are written
down once and not re-litigated, and so a future developer can pick this up
without archaeology. It follows the same method as the Adedayo Aremu Autos
platform (`alexxxj/adedayoaremuautos.com`, `docs/ARCHITECTURE.md`) and reuses
its engine where the problem is the same.

---

## 1. What we are replacing

The current site is 15 hand-authored HTML files on GitHub Pages, reading from an
Express + MongoDB API on Render's free tier.

| Symptom | Root cause |
| --- | --- |
| 48 WhatsApp links and 20 phone links across six pages; 12 on the financing page alone | The website has no way to handle a customer itself. Every path ends in one person's phone. |
| Only one form on the whole site saves a lead (financing), and a new lead alerts nobody | `routes/enquiries.js` writes to the database and stops. A lead waits until someone happens to open the admin. |
| The contact page has no form | Contact means "call or WhatsApp us". Outside working hours, or while that phone is busy, the business is closed. |
| None of the 43 vehicles can be found on Google | Vehicle pages are rendered in the browser from `car-detail.html?id=…`; the sitemap lists six static pages and no vehicles. |
| On most Android phones the menu button is off-screen | Header and footer are copy-pasted into every page; the responsive rule targets a class that does not exist. |
| "Recent deliveries", blog covers and (until Phase 0) hero slides use stock photos | No media pipeline and no discipline about what is real. |
| Prices stored as text (`"38,000,000"`, default `"Call Us"`) | No money type; every calculation (40% down, commission) parses a string. |
| Single shared admin password plus client-side PINs | No staff accounts, roles, or audit trail. |

The site is a brochure pointed at a phone number. We are building a system that
runs the business when nobody is holding the phone.

---

## 2. Core design decisions

### 2.1 The system is the front desk; WhatsApp is one channel, not the funnel

Every customer intent has a path that completes **without a person being
available at that moment**, and every one of them is recorded:

| Visitor wants to… | Today | Platform |
| --- | --- | --- |
| Ask a question at 2am | WhatsApp, answered in the morning if seen | Assistant answers from the live inventory, takes name + phone, files a summarised lead |
| Secure a specific car | Negotiate on WhatsApp | **Reserve online** with a refundable deposit (Paystack); the car shows as reserved and is held for a fixed window |
| See the car in person | Arrange on WhatsApp | **Book a viewing** from real available slots; confirmation and reminder sent automatically |
| Pay a deposit and drive | Enquiry form that alerts nobody | **Drive Plan application** with documents, a staff decision queue, and an instalment ledger once approved |
| Buy 5–50 units for a company or government | Personal relationship only | **Fleet request** → formal quotation → delivery tracking |
| Still wants WhatsApp | 48 buttons | One deliberate entry point, and the click is logged as a lead with the vehicle attached |

Every lead is assigned to a member of staff, alerts them immediately (push +
email, SMS later), and records `first_response_at`, because response time is
the number that predicts whether a lead closes.

### 2.2 A vehicle's owner, keeper and location are three different things

Trucks are owned by an importer in Japan, entrusted to Sabicars, and displayed
at another park because there is no space in ours. That is not an edge case; it
is how a large part of the stock works.

So a vehicle carries `owner` (Sabicars, or a named consignor), `custodian`
(who is responsible for it), and `location` (which park), plus the
consignment terms that decide who is paid what when it sells. A consignor can
be given a read-only view of their own stock and sales.

### 2.3 Dealer is a dimension from day one

Every vehicle, lead, deal and ledger entry belongs to a `dealer`. At launch
there is exactly one: Sabicars. Multi-tenancy (Phase 7) then becomes a
permissions layer over a model that is already correct, rather than a migration
of live data under pressure.

**Where the one dealer is still fixed (2026-10-24).** The dealer's facts —
name, legal name, RC number, address, opening hours, phones, WhatsApp, email,
domain, Instagram — are typed once, in `web/src/lib/site.ts`. Pages, page
descriptions, search-engine data, form error messages, emails, calendar
invites, the admin launch checks and the lead engine's showroom clock read
them from there. Three copies sit outside it, and changing a fact means
changing them too:

- **The showroom's `locations` row.** The legacy import creates it from
  `site.address` once. Car pages, viewing confirmations, calendar files and
  viewing reminders read the row, because a car can sit at another park.
- **The /ask starter answers.** `content/ask-answers.ts` builds them from
  `site.ts`, but `npm run ask:seed` copies them into the database, and /ask,
  llms.txt and the assistant read the database, where staff edit them. Update
  them in the admin; reseeding with `--force` overwrites staff edits.
- **The artwork.** The Verified seal ("CAC RC 1560100 · LAGOS") and the share
  image ("SABICARS.COM · LAGOS") carry the facts as drawn lettering
  (`scripts/build-brand.mjs`, `scripts/fonts/seal-ring.json`).

What still ties the public site to Sabicars, in the order a second dealer
would need it undone:

1. **Which dealer a request is for.** `sabicarsId()` (repositories/vehicles.ts),
   `sabicarsDealerId()` (lib/leads.ts) and the launch checks look the dealer up
   by the fixed slug `"sabicars"`. Every query already filters by dealer; what
   is missing is choosing the dealer per request — by the domain asked for —
   and passing it down.
2. **Where the facts live.** `site` is a code constant. The `dealers` table
   (name, legal_name, rc_number) is not read by the public site, and the
   `locations` table only for a car's own park. The step is to load the
   request's dealer and its main location from those tables (cached), with
   `site.ts` becoming Sabicars' seed row — which also ends the copies above.
3. **The brand in the copy.** "Sabicars" is written into headlines, page
   titles, "Ask Sabicars", the logo and the palette across the site. These are
   brand, not facts; a second dealer needs them per dealer, or a neutral voice.
4. **Sabicars' own offer.** The Hummer bus section and page (and the rule that
   a Hummer is a model containing "Hummer"), the founder's story, quote and
   photo, the Drive Plan with Autochek (the 40%/50% tiers and 2008/2010 years in
   `drive-plan.ts`), Refer & Earn (1.5% and 90 days in `referral.ts`), the
   curated category covers (`CURATED_COVERS`), the home page's fixed
   "Under ₦20M" shortcut, the /ask starter answers and the articles. Each is a
   per-dealer setting, or a feature a dealer turns on.

### 2.4 Every naira paid out is backed by a closed sale or an approved budget

The reward programme has two funding pools and never a third:

- **Commission pool** — 1.5% of a closed, paid sale, attributed to the partner
  whose link introduced the buyer.
- **Marketing pool** — a budget set by the owner, paying for verified leads,
  verified scouting finds and content that produces tracked leads.
- **Never** a payment for recruiting other partners.

Attribution is first-touch with a 90-day window (as in Adedayo's `/r/CODE`),
staff can attribute an offline sale manually, commissions sit in a ledger with
a cooling-off period before payout, and one vehicle pays one commission.

---

## 3. Stack

| Layer | Choice | Why |
| --- | --- | --- |
| Framework | **Next.js (App Router) + TypeScript** | Server-rendered pages Google can index, an authenticated staff app, and API routes in one codebase. Same as Adedayo. |
| Styling | **Tailwind CSS over design tokens** | One source of truth for colour, type and spacing, with contrast checked at build time. |
| Database | **Postgres (Supabase)** | Money, reservations, instalments and commissions need relational integrity and constraints (a car cannot be reserved twice; a ledger must foot). |
| ORM / migrations | **Drizzle** | Typed schema, SQL-first migrations. Same as Adedayo. |
| Auth | **Supabase Auth** | Staff accounts with roles (owner, manager, sales). Partner accounts in Phase 5. |
| Media | **Cloudinary** (kept) | Already holds every vehicle photo; also handles video and on-the-fly resizing for slow networks. |
| Payments | **Paystack** | Deposits, receipts and instalments in NGN. Adedayo already has the integration. |
| Email | **Resend** | Already configured for the newsletter. |
| Assistant | **Claude** via the Anthropic API | Grounded in the live inventory; same guard-rails as Adedayo (no invented prices, no negotiation, no credit promises, never collects BVN or card numbers). |
| Hosting | **Vercel** | GitHub Pages cannot run any of this. |

**Change from earlier advice.** I previously recommended keeping the Express +
Mongo API and rebuilding only the frontend. Having seen what the platform must
do — deposits, instalments, commissions — and that a proven engine already
exists on Postgres, the better call is to move to Postgres and retire the
Express API once its data is migrated. One stack across both dealerships also
means one set of skills to maintain.

---

## 4. Building it without taking the site down

Same approach as Adedayo: the new app lives in `web/` inside this repository.
GitHub Pages keeps serving the current site from the repo root; Vercel deploys
`web/` separately. We verify the new platform on its own URL, and only then
point `sabicars.com` at it. There is never a moment without a working site.

Data moves by an idempotent migration script keyed on the Mongo `_id`: run it
early for development, run it again at cutover. Prices are converted from text
to integer kobo; `"Call Us"` becomes "price on request". The 43 vehicles, their
Cloudinary photos, reviews, blog posts, comments, subscribers and notifications
all come across. Staff keep using the current admin until cutover day.

---

## 5. Data model (outline)

Money is **integer kobo**, never floating point. Rates are basis points.

```
dealers            id, name, slug, rc_number, status            (one row at launch)
locations          id, dealer_id, name, address, geo, hours      (our park, the truck park)
consignors         id, dealer_id, name, contact, terms_bps
vehicles           id, dealer_id, location_id, owner (dealer|consignor_id), custodian_staff_id,
                   make, model, year, trim, body, condition (foreign_used|nigerian_used|brand_new),
                   chassis_no, mileage_km, fuel, transmission, drivetrain, colours, seats,
                   price_minor (nullable = on request), status (draft|available|reserved|sold|unlisted),
                   featured, hero, slug, description, created_at, sold_at
vehicle_media      id, vehicle_id, kind (photo|video), cloudinary_id, position, is_primary
inspections        id, vehicle_id, checklist, inspector, completed_at      ("Sabicars Verified")

staff              id, dealer_id, name, email, phone, role (owner|manager|sales), active
leads              id, dealer_id, type (question|viewing|reservation|drive_plan|fleet|whatsapp|walk_in),
                   channel, vehicle_id, name, phone, email, message, status,
                   assigned_to, partner_id, first_response_at, created_at
conversations      assistant transcripts + staff-facing summary, linked to a lead
viewings           id, vehicle_id, lead_id, slot, status, reminder_sent_at
reservations       id, vehicle_id, lead_id, deposit_minor, paystack_ref, holds_until, status
                   -- constraint: at most one active reservation per vehicle
drive_plans        id, vehicle_id, lead_id, down_minor, tenor_months, documents, decision, decided_by
instalments        id, drive_plan_id, number, due_date, amount_minor, paid_minor, state
payments           id, source (deposit|instalment|sale), amount_minor, paystack_ref, receipt_sent_at
fleet_requests     id, organisation, contact, units, spec, budget_minor, status
fleet_quotes       id, fleet_request_id, lines, total_minor, valid_until, pdf_url

partners           id, dealer_id, name, phone, email, code, status, access_token (their private page),
                   bank_code, bank_name, account_number, account_name, account_verified_at,
                   account_verified_by, paystack_recipient_code
                   -- attribution is leads.partner_id, set by the /r/CODE cookie (first touch, 90 days)
commissions        id, dealer_id, partner_id, vehicle_id, lead_id, source (link|manual),
                   sale_price_minor, rate_bps, amount_minor, status (pending|paid|void),
                   earned_at, payable_at (earned_at + 48h), paid_at, voided_at, void_reason
                   -- constraint: one non-void commission per vehicle
payouts            id, dealer_id, commission_id, partner_id, amount_minor, method (paystack|bank_transfer),
                   status (pending|processing|paid|failed|reversed), reference (ours, Paystack's idempotency key),
                   transfer_code, fee_minor, bank_reference, the account as it was, failure_reason, paid_at, recorded_by
                   -- constraint: one live payout per commission; a failed one is retried with a new row
scout_finds        id, partner_id, vehicle details, photos, owner contact, status, outcome   (not built)

subscribers, campaigns, notifications, push_subscriptions, blog_posts, comments, reviews
audit_log          id, actor, entity, entity_id, action, diff, at
```

---

## 6. Design direction: an institution, not a stall

What makes the current site read as generated and cheap, and the rule that
replaces it:

| Now | Rule |
| --- | --- |
| A strip of pill badges with a phone number above the header | No utility strip. The header carries the name, the navigation and one primary action. Contact details live in the footer and on the contact page. |
| WhatsApp in green on every section | The gold accent is reserved for the one action that matters on each screen. WhatsApp is a single, quiet entry point. |
| Emoji, blinking dots, many badge styles | One icon set, no blinking, one badge style. |
| Stock photography | Only real vehicles and real deliveries. A shared photography standard (angles, light, background) for every listing. |
| White overlay washing out the hero | Dark-first theme; photography and video carry the page. |
| Many font sizes and spacings, chosen per page | A type scale and spacing scale as tokens, contrast-checked at build time. |
| Motion as decoration | Few, slow, purposeful transitions; respects reduced-motion settings. |

The standard to meet is a manufacturer's own site, not a marketplace listing.

---

## 7. Phases

Each phase ships something usable. Cutover happens once Phases 1–3 do
everything the current site does, better.

| Phase | Delivers | Business outcome |
| --- | --- | --- |
| **0 — Triage** | Mobile header, stock photos, hero fixes on the current site (built, awaiting push) | Stops losing Android visitors while the platform is built |
| **1 — Foundation** | `web/` scaffold, design system, schema, staff accounts with roles, data migrated from Mongo | Ground to build on |
| **2 — Inventory** | Staff inventory with photos and video, consignment, statuses; public inventory and vehicle pages rendered on the server with structured data and a full sitemap | Every car findable on Google; staff manage stock without a developer |
| **3 — Lead engine** | Enquiry forms everywhere they belong, assistant, lead inbox with assignment, instant alerts, response-time tracking, WhatsApp clicks logged | No lead lost, day or night. **Cutover point.** |
| **4 — Transactions** | Viewing bookings, reservations with Paystack deposits, Drive Plan applications and instalment ledger, automatic receipts | Customers can commit without waiting for a person |
| **5 — Growth engine** | Partner accounts (referrers, scouts, creators), tiers, `/r/CODE` links, attribution, commission ledger, partner dashboard; broadcasts, weekly digest, push; Google and Facebook/Instagram catalogue feeds | Demand and supply grow without adding staff |
| **6 — Institution** | Fleet and government procurement desk with formal quotes; "Sabicars Verified" inspection reports on every vehicle; media hub for Christ D's content, with video per vehicle | The authority that makes other dealers want in |
| **7 — Dealer network** | Other dealers onboard with their own inventory, dashboard and leads, under Sabicars' verification standard | The marketplace |

### Phase 1 — what was built (2026-09-23)

All in `web/`; see [`web/README.md`](../web/README.md) to run it.

- **Design system.** `palette.json` → generated `tokens.css`; 58 WCAG contrast
  checks gate the build. Gold 500 is the existing brand gold, kept exact.
  Cormorant Garamond for display (the wordmark's face), Archivo for everything
  else, using its width axis for the wide uppercase label voice. Dark by
  default; photography (hero, badges on photos) always takes the dark
  treatment, in both themes. Reference page at `/style`, rendered with live
  inventory.
- **Schema.** 14 tables (§5, phases 1–3 subset). 42 assertions in
  `scripts/verify-schema.mjs` prove the database refuses invalid states.
- **Money.** Integer kobo in `bigint`; percentages in basis points. The Drive
  Plan deposit at both tiers (`scripts/verify-drive-plan.ts`) and the 1.5%
  commission are verified to the kobo on every build.
- **Staff auth.** Supabase session *and* an active `staff` row, checked on
  every admin request; roles owner / manager / sales. Inactive until the
  Supabase project exists, and says so rather than failing.
- **Legacy import.** Everything from the Mongo API — 47 vehicles, 374 photos,
  3 enquiries, 7 reviews, 3 posts, 4 comments, 10 subscribers, 31
  notifications — with free-text fields cleaned and a report of the 26
  vehicles that need a person to check them. Re-runnable up to cutover;
  vehicle URLs are stable across runs.
- **Local development without Docker.** PGlite serves a real Postgres on a
  local port.

Decisions made while building, recorded so they are not re-litigated:

- **Images are resized by Cloudinary**, not by Vercel: every photo already
  lives there, and Cloudinary's edge does WebP/AVIF and per-device widths
  without touching Vercel's metered image optimisation.
- **New reviews and comments wait for approval.** The legacy API published
  them instantly. Everything already live stays live.
- **Vehicle cards carry no WhatsApp or phone button.** The card opens the
  vehicle page, where every enquiry is recorded.
- **"New arrival" is derived from the listing date**, never stored, so it
  cannot go stale.
- **Legacy vehicles that disappear from Mongo are unlisted, not deleted**, so a
  sold car's history stays on record.

### Phase 2 — public inventory (2026-09-25)

- **Inventory** at `/vehicles`: filters for type, luxury, make, price band,
  condition and sort, all in the URL so any view can be shared or crawled;
  plain links and a GET form, so it works with JavaScript blocked; facet
  counts on every option.
- **A page for every vehicle** at `/vehicles/<year-make-model>`: swipeable
  gallery with full-screen view; price and the Drive Plan split at the car's
  own tier (deposit and balance — the rate and term are the lender's, shown
  as Autochek's published ceiling and range; since 2026-10-21 also an
  estimated monthly repayment at that ceiling over a term the buyer picks,
  labelled as an estimate, §8 item 3), or "Full payment only"
  on a car older than 2008; only the
  specifications actually recorded; `Car` + `AutoDealer` structured data;
  1200×630 share image for WhatsApp previews. Pre-rendered at build and
  refreshed every five minutes. Sold vehicles keep their page (not indexed).
- **Enquiries** from every vehicle page are saved as leads with a reference
  (`SC-XXXXXX`); WhatsApp is offered afterwards, carrying the reference. Phone
  numbers are normalised to E.164; spam is caught by a hidden field and a
  minimum fill time; rate-limited by phone, not IP. **Staff alerts are phase 3
  — until then a lead waits in the database, so this must not go live before
  phase 3.**
- **Sitemap** lists every listed vehicle (54 URLs today, against 6 on the
  legacy site) and refreshes hourly; `robots.txt` points to it.
- **Local database** is now real PostgreSQL 17 (embedded-postgres) instead of
  PGlite, which interleaved concurrent clients' queries and crashed on
  disconnect.

### Phase 2 — staff inventory admin (2026-09-26)

Staff sign-in runs on the Supabase project (sign-up closed; accounts created
only by an owner with `npm run staff:create`; `npm run auth:check` verifies the
configuration without printing keys).

- **Inventory list** at `/admin/vehicles`: every status with counts, search,
  and a live "needs attention" check per vehicle (no photos, fewer than five,
  no body type, no description, price on request, "brand new" on an old model,
  no mileage) — the import report's rules, running continuously.
- **Add and edit** with fixed choices for body, condition, fuel, gearbox and
  drivetrain; prices refused unless they are digits (`31,000,000Z` is
  rejected); nothing typed is lost on an error; save bar pinned for phones.
  A vehicle's address is fixed once it has been public. Sold records the sale
  date. Only owners and managers can change prices.
- **Photos** go from the phone straight to Cloudinary, shrunk to 2,400px in the
  browser first; our server signs each upload and verifies Cloudinary's
  signature on the result before recording it. Reorder, set the cover, remove.
  Removal never deletes the file from Cloudinary while the legacy site still
  shows the same images.
- **Consignors** (owner/manager): the truck importer and anyone else whose
  vehicles Sabicars sells on their behalf, with commission.
- **History**: every change is in the audit log — who, what fields, when — and
  shown on the vehicle.

Tested end to end under a real staff session and cleaned up afterwards. Until
cutover the legacy admin remains the source of truth: a legacy re-import
overwrites imported vehicles' fields.

### Direction reset — the homepage has one job (2026-09-26)

Reviewing /about, /fleet and /contact, the owner's developer judged the rebuild
"a lower version of the live site" with "no intentionality". Fair: the pages had
been ported one by one, unverifiable claims removed with nothing put in their
place, and the live site's Refer & Earn, reviews, deliveries, blog, sold list,
calculator and map dropped. Agreed thesis:

> Sabicars' strength is its audience (Christ D's reach and relationships); its
> weakness is stock and staff. The platform turns the audience into recorded
> demand, and demand into deals, without anyone having to be at the park.

Every page now states its one job in its source, and is checked against the
live page it replaces so nothing is lost silently. Built on that basis:

- **Homepage**, ordered by the visitor's questions: is this real (live facts,
  CAC link) → what can I afford (**Drive Plan finder**: type what you can pay
  today, see the live count and the best cars it reaches) → browse → what if
  it isn't here (**Request a car**, the Sourcing Desk's first step) → the
  founder and the reviews → can I earn (**Refer & Earn**, with commission on
  real cars in stock) → visit. Buying in bulk sits beside the Hummer bus (or
  on its own when no Hummer with a photo is listed). *Since 2026-10-24* (two trainees'
  walk-throughs: words too hard, desktop too crowded, one page under several
  names): 10 calmer blocks, at most one orange button in each, three in all.
- **/find — the Sourcing Desk.** A standing request for a car not in stock:
  a `sourcing` lead (one inbox, one reference) plus a `vehicle_requests` row
  with the criteria. On submit it replies at once with any in-stock matches.
  "Most requested right now" appears publicly once 3+ requests are open.
- **/partners — Refer & Earn.** Registration issues a six-character code and
  a link (`/r/CODE`, optional `?to=/vehicles/…`) at once. The link sets a
  90-day first-touch cookie; every lead saved while it is present records
  `partner_id`. A partner's own enquiry is never their referral. The four
  rules (free, paid on sales only, no recruiting, buyer on record) are shown
  before the form.
- The **Record** (dated deliveries and verified-buyer reviews) is next; there
  are no sold vehicles yet to build it from.

### Design pass — "standard" feel (2026-09-26)

Feedback: the structure and content were right, but the feel was "not standard
enough" — the background, text on the background, how easy calls, functions
and navigation are to understand. What changed, site-wide:

- **One look.** The site no longer flips to a plain light version with the
  visitor's phone setting (or a remembered toggle). Dark, art-directed, always.
- **Depth, not flat black.** A warm light from above the page, a trace of
  film grain, raised surfaces lit by a hairline top edge, frosted glass over
  photography. The surface ladder was neutralised (less brown) within the
  contrast gate.
- **Readable type.** Body text 17px. Spaced-out capitals kept only for short
  section labels (now led by a gold rule); every button, label and link is in
  sentence case at a readable size. Model names set in the sans.
- **Obvious calls.** Brushed-gold pill for the one primary action, frosted
  pill for the alternative, arrows and icons (lucide) on every action.
- **Navigation like an app.** One set of names, in `web/src/lib/navigation.ts`,
  read by every surface (*since 2026-10-24*; the buyer-facing names are Cars for
  sale, 40% Drive Plan, Request a car, Refer & Earn, Sell your car, Buy in bulk,
  Compare cars, My saved cars, Ask Sabicars, Buying guides, About, Contact).
  Phones get a bottom tab bar (Home · Cars · Drive Plan · Request a car ·
  Refer & Earn) and a "More" menu with everything else, in two groups, each
  item with an icon and a one-line explanation, plus Call / WhatsApp /
  Directions. From 1024px the header shows the same three sections, a "More"
  pill that opens the same menu as a side panel, and the orange "Cars for sale"
  button. Staff screens keep their own names (the admin's "Sourcing Desk").
- **Photography.** Every vehicle photo passes through Cloudinary `e_improve`
  (auto exposure and colour), chosen after comparing it with a stronger
  outdoor/vibrance treatment on real listings.
- Featured cars swipe sideways on a phone instead of stacking 4,000px deep.
- **/drive-plan** built on the confirmed structure (deposit by model year —
  40% from 2010, 50% on a 2008 or 2009 car, nothing older financed — and
  Autochek finances the rest): finder, four steps, a worked example on a real car,
  straight answers, and an application recorded as a Drive Plan lead.

### Search visibility (2026-09-26)

The owner's aim: the inventory everywhere a related search happens. Built, taking effect once the platform is live and crawled:

- **A landing page per make and model family** with stock (`/buy/toyota-highlander`, `/buy/lexus-rx-350`, `/buy/toyota` …), generated from the inventory: live count, price from, lowest Drive Plan deposit (each car at its own tier), cars, a Sourcing Desk prompt, related models, breadcrumbs and an ItemList. A family that sells out keeps its page, noindexed, off the sitemap. The Hiace Hummer family redirects to /hummer-bus.
- **Image sitemap:** every vehicle entry lists all its photos (~380), as large colour-corrected JPEGs, so Google Images indexes the stock; photo alt text reads "… for sale in Lagos".
- **Structured data:** vehicles are `["Product","Car"]` with offers (price, availability, condition), sku and all images; BreadcrumbList on vehicle and landing pages; the AutoDealer carries logo, image and price range.
- Vehicle titles read "… for sale in Lagos"; a "Popular searches" row in the footer links the busiest model pages from every page.

Needs the business, not code: verify the domain in Google Search Console and submit the sitemap at launch; claim and fill the Google Business Profile for the showroom (photos, hours, link); add the site to every social bio; and consider automatic posting of new arrivals to Instagram/Facebook (Meta business account).

### Phase 3 — the lead engine (2026-09-26)

One rule: no buyer waits. Built:

- **One inbox** (`/admin/leads`, and now the admin's front door) for every enquiry from every form: vehicle questions, viewings, reservations, Drive Plan, fleet, contact, Sourcing Desk and price watches. Views: *Waiting for a reply* (longest wait first), *Mine*, *In progress*, *Closed*, *All*; search by name, phone or the buyer's SC- reference. The nav shows how many are waiting.
- **Claim and assign.** "I'll take it" claims an unclaimed enquiry (atomic, so two people never answer the same buyer). Owners and managers can give it to anyone, who is alerted on their phone. Reaching out to an unclaimed enquiry claims it too.
- **Instant alerts to staff phones** through standard Web Push (VAPID). There is no third-party service and no monthly fee, and it works with the browser closed. Staff turn alerts on per phone in the inbox. On Android, Chrome is enough. On iPhone, the staff side installs as its own home-screen app, "Sabicars Staff", which iOS requires for web push. The inbox explains this on the phone itself. Email alerts to staff follow once Resend is configured. Each staff member can turn off "every new enquiry" and still get the ones handed to them.
- **Response time, measured.** The Call, WhatsApp and Email buttons on each enquiry record the first contact. WhatsApp opens with the greeting and reference already written. There is also an "I replied another way" option. The clock runs on showroom time: an enquiry sent at 2am starts counting at opening (`lib/showroom-hours.ts`, 22 checks on every build). The inbox shows the typical first reply, the share answered within 15 minutes, and, for managers, a per-person breakdown.
- **Escalation.** An enquiry with no reply after 15 showroom minutes alerts the owner and managers, once. The sweep runs on every new enquiry, every inbox visit, and at `/api/cron/escalate`.
- **A trail on every enquiry**: alerts sent, claims, contacts, notes, status changes, and why a lead was lost (a fixed list, so the reasons can be counted).

At cutover: set `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` and `CRON_SECRET` in Vercel (generate fresh keys for production), and give the sweep a timer. Vercel Pro can call `/api/cron/escalate` every 5 minutes via `vercel.json`. On the Hobby plan, which allows only a daily cron, use a free external scheduler such as cron-job.org with the secret as a Bearer token. Without a timer, escalation still runs whenever an enquiry arrives or someone opens the inbox.

### Parity with the live site — reviews, newsletter, notifications (2026-09-26)

The owner asked, rightly, where the live site's reviews, subscribe button, notification bell and push had gone. None may be lost at cutover. Built:

- **Reviews.** The 7 real reviews carry over as published. The three testimonials hard-coded into the old homepage and About page are **not** carried over: the owner confirmed they are not real customers. New reviews wait for a manager (publish anything genuine, including critical reviews; hide spam and abuse), and managers are alerted. Marking an enquiry **Bought** issues the buyer a private link. A review left through it shows as **Verified buyer** with the vehicle, the only verification the page claims. The section sits on the homepage and About page as a slow ticker. It pauses on hover and becomes a swipeable row when reduced motion is on.
- **Newsletter.** There is a subscribe band in the footer of every page and one prompt (below). Existing subscribers carry over. Every **Friday at 9am** the week's new arrivals go out automatically; a week with none sends nothing. Managers can send a broadcast from **Admin → Audience**, which also previews this Friday's email. Every email carries a one-click unsubscribe, both a page and RFC 8058 from the mail app. The old newsletter had none.
- **Notification bell and push.** The bell is in the header on every page and shows the latest 20 posts. **Nobody types "New arrival" any more.** Listing a car, or its first photo on a listed car, posts it once. So does a price cut on a listed car. Each post is pushed through the **same OneSignal account** the old site uses, with the same `OneSignalSDKWorker.js` at the same address, so existing subscribers keep receiving alerts without opting in again. Managers can post offers by hand. The 32 old posts carry over, linked to their cars' new pages.
- **One prompt per visit**, instead of the old site's four popups (newsletter, review, OneSignal, install). It appears after 25 seconds plus a second page or some reading, in this order: subscribe, phone alerts, add to home screen (Android's install prompt, or the iPhone Share hint), then — from the third visit — a review. Each is skipped once done and rests after "Not now".
- Also restored: **recently viewed** (on the device; on the inventory and every car page), **recently sold** (last 90 days; hidden while there are none), and the **any-price calculator** on /drive-plan. The calculator shows the deposit and what Autochek finances for any price or car, at the tier the model year carries (40/60 from 2010, 50/50 for 2008–2009). It showed no monthly figure until 2026-10-21, when the owner decided that every financed balance is shown with an estimated monthly repayment at Autochek's published ceiling, labelled as an estimate because the lender sets the real terms (§8 item 3).

At cutover, set in Vercel:
- `NEXT_PUBLIC_ONESIGNAL_APP_ID` (the old site's app, `6f283e9c-…`) and `ONESIGNAL_REST_API_KEY` (from the OneSignal dashboard; the owner has access)
- `RESEND_API_KEY`, `RESEND_FROM_EMAIL` and `RESEND_FROM_NAME`, with the sabicars.com domain verified in Resend

Schedule `/api/cron/digest` for Fridays at 08:00 UTC; a weekly schedule is allowed on the Hobby plan. "Recent deliveries" waits for confirmed deliveries and photos (item 5).

The three invented testimonials were also removed from the live site (sabicars.com, commit 97ee11c on `main`, with the owner's go-ahead). That change also fixed review text being inserted unescaped, which let anyone who posted a review inject script into the homepage.

### Insights — the blog (2026-09-26)

The owner's brief: magazine-grade, articles you finish once you start, with animation and video. Built:

- **Articles are blocks, not HTML** (`lib/blog/blocks.ts`): paragraph, headings, list, "the short version", pull quote, callout, photo, video, illustration, live cars, table, Q&A and next-step card. Nothing stored is rendered as markup. The three old posts are converted to blocks on import (`lib/blog/from-html.ts`), keeping their views and reactions.
- **Set like a magazine:** a reading column of about 66 characters with figures breaking wider, a gold drop-cap opening, a reading-progress line, and a contents rail that tracks the reader (a dropdown on phones).
- **Animated illustrations, drawn in code** (`components/blog/illustrations`):
  - the Hummer bus anatomy, which draws itself and has six tappable inspection points
  - a live chart of every Hummer in stock by year and price
  - the Drive Plan split on a real bus, at the bus's own tier (40/60 or 50/50)
  - an inspection checklist that stays ticked on the reader's phone
  - a route calculator on the reader's own numbers
  - the Drive Plan journey: a pinned scroll story in which a car drives six steps along a road
  - the deposit stretch: cash vs a Drive Plan deposit (each car at its own tier; cash also reaches the older cars the plan does not cover), racing against live stock to the best car each reaches
  - repayment comfort: the reader's pay, a 30% ring, and a verdict on Autochek's quote
  - the walk-around: a pinned scroll story round a top-down car, seven stops, with the minutes for each
  - the flood detective: water rises and drains, then the reader hunts the six marks it leaves
  - the budget quiz: four questions, a suggested body type and plan, matched to live stock (or the closest car and the Sourcing Desk)
  - the X-ray: a scanner dragged across a Highlander and a GX 460 (drawn to scale) shows unibody against body-on-frame
  - the fuel duel: two pumps roll to each one's monthly fuel bill on the reader's driving and pump price
  - the balance: priorities drop weights that tip towards the Highlander or the GX, with live stock
  - the SUV race: five SUVs race the road the reader picks, from start lights to a podium, paced by editorial ratings (`illustrations/suvs.ts`) that the radar shares
  - the radar: five SUVs as shapes on six ratings; any two morph
  - the truck builder: pick the cargo, the body drops onto the chassis, and each type has an action (tip, couple, fill, load, chill)
  - the smoke doctor: crank a cold truck and diagnose four smokes
  - the chassis match: find the character that differs from the papers

  Shared rewards (`illustrations/rewards.tsx`): spring physics, gold bursts, rolling digits, a shake for a wrong answer, and a light haptic tap on phones. The owner asked for each new set of illustrations to be more engaging than the last.

  All respect reduced motion (scroll stories become still lists) and are readable down to 360 px.
- **Video:** YouTube, TikTok and Instagram links show a poster, and their player loads only when tapped (data-light). Sabicars' own Cloudinary clips play as silent loops when scrolled into view, with a tap for sound.
- **Around each article:** the old site's four reactions, shares, read counts, moderated comments (managers alerted), a subscribe box, related articles, BlogPosting and FAQPage structured data, and sitemap entries.
- **Articles in code** (`src/content/articles`, `npm run blog:seed`):
  - Flagship: "The Toyota Hiace Hummer bus: the complete buyer's guide". Every price in it is live from stock, and it carries the owner's Instagram reel of a manual Hummer 2.
  - The six standalone `blog/*.html` articles of the old site: three are rewritten (Highlander vs GX 460, the best SUVs for Nigerian roads, buying a tokunbo truck), and three redirect into newer articles or `/fleet`.
  - The three old posts, rewritten at their original addresses so links, reads, reactions, comments and dates carry over: "Drive now, pay monthly" (now the Autochek arrangement, with the deposit by model year), "How to inspect a used car in Lagos in 20 minutes", and "Best cars under ₦5 million" (the old model list kept, without market prices that date).
  - The seeder inserts new articles, rewrites an old-site row once (one with no hook line yet), and otherwise leaves admin edits alone unless run with `--force`. The legacy importer now updates only reads, shares and reactions on posts that already exist, so a final import cannot undo the rewrites.
- **Admin → Insights:** a block editor with direct photo upload to Cloudinary (`sabicars/blog`) and draft preview. The first publish announces the article once: bell, push, and an email to blog subscribers. Published articles cannot be deleted, only unpublished, so links never break.
- "Insights" is in the site navigation, the latest articles are on the homepage, and the Hummer bus page links to the guide.

Still open: more video. One Instagram reel is in (the Hummer guide). YouTube and TikTok links are still wanted, and phone clips can be uploaded to Cloudinary for silent loops.

### Ask Sabicars — the assistant (2026-09-27)

The owner's brief: suggest cars straight from the inventory from what the buyer says, compare cars, sound warm, human and real, work as marketing, and help Google ranking. Built on the Adedayo engine, extended:

- **Knowledge, live** (`lib/assistant/knowledge.ts`): every listed car with its price, its own Drive Plan deposit (or that it is cash only), recorded facts, features and the dealer's own notes (marked as possibly wrong), plus hours, contacts, the Drive Plan rules, the Sourcing Desk, Refer & Earn, the articles and the published answers. Built identically for the same stock, so the provider's prompt cache holds it between chats.
- **Voice and limits** (`lib/assistant/prompt.ts`): the best salesperson on the lot. Short, warm, one question at a time; answers in Pidgin, or greets back in Yoruba, Igbo or Hausa, when the buyer does; says it is an AI if asked. Never invents a car, price or spec; never negotiates; never states finance approval or the lender's rate, and gives a monthly figure only as the car's estimate at Autochek's published ceiling; never takes a BVN, card or ID; never claims a condition the listing does not state.
- **It shows, not only tells**: the model writes `[[cars: …]]`, `[[compare: …]]` or `[[callback]]`; the server (`lib/assistant/parts.ts`, `api/assistant`) checks every slug against live stock and streams car cards, a side-by-side comparison or a call-me-back form in their place.
- **Every chat is kept** (`assistant_conversations`, `assistant_messages`, migration 0007). A small model summarises it; once the buyer gives a name and number, it becomes one lead in the Enquiries inbox (channel "Ask Sabicars"), alerted like any other, never duplicated. Rate limits per address and per day protect the bill.
- **The widget** (`components/assistant`): never opens by itself; full-screen on phones, a panel on wider screens; suggestions follow the page; any page can open it with a question (`openAssistant`, `?ask=`). Vehicle pages have "Ask about this car", and the phone price bar gained an Ask button (and now sits above the tab bar, not under it).
- **For search engines**, which cannot talk to a chat: `/compare/[a-vs-b]` pages (each car against its two closest rivals, verdicts computed from recorded facts, in the sitemap; `/compare` has a picker), `/ask` answers with FAQ structured data (twelve to start, `npm run ask:seed`; staff publish more from real chats), and `/llms.txt` for AI answer engines.
- **Admin**: Conversations (summaries, cars shown, the lead, "wants a person" until handled; publish a reply to /ask) and Answers.
- Model: `ASSISTANT_MODEL` (default `claude-sonnet-5`), summaries `ASSISTANT_SUMMARY_MODEL` (default Haiku 4.5), `ASSISTANT_DAILY_CAP`. Needs `ANTHROPIC_API_KEY` in Vercel; without it, production answers "not switched on yet" and development uses a keyword stand-in.

**Site audit (2026-09-27)**: every template at 1280 px and 375 px — no text below WCAG AA contrast, no sideways overflow, no broken images, all 176 internal links resolve; interactive states (quiz results, deposit stretch, repayment verdicts, chat with cards) checked too. The cause of the unreadable gold button (article styles outside Tailwind's layers) is fixed at the root. Spelling: no errors in the site's own copy; three in listing data corrected in the importer. Listing contradictions for the owner are in §8.

### Launch preparation (2026-09-27)

- **Redirects.** Every old address answers with one permanent redirect to its closest new page (`web/src/lib/legacy/urls.ts`). This covers:
  - the pages, with and without `.html`
  - old car and article ids
  - the manifest and icons
  - six standalone articles the old site had under `/blog/*.html`. Two were consolidated into the newer Drive Plan and Hummer articles, and the fleet piece into `/fleet`. Three are to be rewritten at `/blog/toyota-highlander-vs-lexus-gx-460`, `/blog/best-suvs-for-nigerian-roads` and `/blog/buying-a-tokunbo-truck-in-nigeria`. They can't be carried over as they are: they claim "accident-free", "warranty on every vehicle", "drive home same day", an unconfirmed fleet order and an unnamed customer quote.
- **System status.** `/admin/status` and `npm run check:launch` form the launch checklist, and later the health page.
- **Runbook.** `docs/LAUNCH.md` covers before the day, switch day (only the `@` A record and the `www` CNAME change; never the MX), switching back, and the weeks after.

### Market scorecard follow-through (2026-10-20)

A comparison with Jiji, Cars45, Autochek and Cars.ng graded Sabicars 5.2/10 (Autochek 5.9, Cars45 5.6, Jiji 5.3, Cars.ng 3.6). We lead on listing quality, the phone experience, smart tools and the partner network. We trail on stock depth, proof of inspection, selling and trade-in, and life after the sale. The owner asked for every finding to be built, in stages.

**Stage 1, launch blockers (done):**
- **Claims we could not prove are gone.**
  - The hero now reads "Real cars, real prices. Every deal on record." It used to read "Every car verified."
  - "Inspected" became "open to inspection".
  - "Verified luxury cars" is gone from the description, manifest, footer and partner share text.
  - The founder quote is trimmed, with an ellipsis where "accident-free, verified, and exactly as described" was.
  - "Every car verified" may return once every listed car has a published Sabicars Verified report (stage 2).
  - The About page's four Sabicars Verified promises stay, because each is true today.
- **Privacy notice at /privacy (Nigeria Data Protection Act 2023).** It covers every form, chat, cookie, device store and provider the platform actually uses. Supabase and Vercel are in London; Anthropic, Resend, OneSignal and Google are in the US. Every form links to it beside its send button, and so do the chat footer and the site footer. Ask Sabicars knows where it is. **Change the code and this page together.** Have the company's lawyer read it before launch.
- **Google Analytics** (G-K5ZRJ8WNXW, the same property as the legacy site) runs on public pages in Vercel production only. Google's advertising features are denied, so visitor numbers carry across the switch.

**Security (done):** Next.js went from 16.3.0 to 16.3.8, which fixes three critical advisories, including remote code execution in the image optimiser, plus SSRF and cache poisoning. sharp went to 0.35.5. What `npm audit` still reports is development tooling only.

**Stage 2, proof: Sabicars Verified (built):**
- **The standard.** A 60-check inspection in `lib/inspection/checklist.ts`, in eight groups: papers and identity, body, accident and flood signs, engine, gearbox, brakes and tyres, cabin, and road test. Results are Good, Needs attention, Fault or Not applicable. Keys are permanent, and a retired check keeps its key. **The owner's mechanic should review the list.**
- **The rules.** Every check needs a result before a report can be published. Every Needs attention or Fault needs a note and a photo. Publishing requires a date, an inspector and today's odometer reading. Only owners and managers publish; anyone can fill in a draft.
- **In the database (`inspections`, migration 0008).**
  - One live report per car. A new one supersedes the old in the same transaction.
  - Codes use the characters 2–9 and A–Z, without O, I or L, so a sticker is never misread.
  - A published report cannot be edited. Start a new inspection instead.
  - There are 13 new schema assertions.
- **For staff.** The car's admin page links to `/admin/vehicles/[id]/inspection`, which works on a phone: one tap per result, autosaved, with a camera button per check. The page also offers the report history, the public link, withdraw (two-step), and a printable 90 × 130 mm windscreen seal at `/admin/seal/[id]`. The seal carries a QR code to the report and uses the seal's deep tones. It warns that seals should be printed only after the switch to sabicars.com.
- **For buyers.** The report lives at `/v/CODE`, kept out of search. It shows:
  - what was found first, with photos
  - the chassis number with its last four characters hidden
  - the history (source, title, accidents, last odometer on record), flagging an odometer lower than the history records
  - every check
  - "not a warranty"
- **Where it shows.**
  - The car page has a Verified panel under the price.
  - Every card shows "Sabicars Verified" while the report is under 120 days old — never on a car held away from the showroom (§8 item 21).
  - The homepage says "Every car verified" automatically once every car on sale has a fresh report.
  - Ask Sabicars reads each car's report, findings included. It never calls a car without a report inspected.
- **Needs the business.** ~~Who inspects at the park.~~ *Answered 2026-10-21: the Sabicars team, at the showroom, through the admin inspection page; cars held elsewhere are inspected on request and never carry the seal (§8 item 21).* A VIN-history provider account (LegitCar's Carfax report was ₦5,500). A print shop for face-mounted stickers.

**Stage 3a, viewing slots (built):**
- **The rules** live in `lib/viewings.ts` and are tested by `npm run test:viewings` (27 checks, part of the build):
  - Hourly slots from the showroom's hours, from opening until an hour before closing.
  - At least two hours ahead, and up to a week ahead.
  - Two viewings per hour.
- **Reserve this car (stage 3b, built 2026-10-31).** The car page's first button for a priced, available car at the showroom. `/reserve/[slug]` shows the car, the rules and the deposits the policy allows (`lib/reservations.ts`: ₦500,000 holds a week, 40% or more a month, refunds less 18%, one buyer per car; `npm run test:reservations`). `startReservation` (lib/actions/reserve.ts → lib/reserve.ts `beginReservation`) files a `reservation` lead, inserts a `reservations` row (`pending`, our `scr_…` reference, migration 0020; a partial unique index keeps one pending/held row per car) and sends the buyer to Paystack's hosted checkout (card + bank transfer). The buyer returns to `/reserve/done?reference=`, which verifies with Paystack; the webhook's `charge.success` does the same, and `confirmReservation` is idempotent (only a pending row becomes `held`; the vehicle becomes `reserved`; the buyer gets a receipt email; staff phones are pinged). An unpaid attempt keeps its place 30 minutes. Amounts above Paystack's ₦10m per-transaction cap, or any amount while `PAYSTACK_SECRET_KEY` is unset, file the lead and tell the buyer the team will send account details; nothing is held until money lands. Holds that run out are expired by the hourly outbox job (`expireReservations`: the car goes back on offer, managers are told). Admin → Reservations lists holds and lets staff record a showroom deposit (held at once), complete, cancel, or refund (owner/manager; through Paystack for online deposits, recorded for showroom ones).
- **Chat with seller (2026-10-31).** The car's page's "Chat with seller" button (second, under "Reserve this car"; first when the car cannot be reserved online) opens the assistant window as a room with the team in it (`openAssistant(undefined, { seller: true })`; conversation `mode = 'seller'`, migration 0019). A buyer's message is saved at once, `awaiting_since` is set, and every staff member who takes alerts is pinged (`alertStaffAboutChat`, at most once per two minutes per chat). Staff reply from Admin → Conversations (`ChatReply` → `replyInConversation` → `staffReply`; role `staff`, with `staff_id`); the buyer's window polls `/api/assistant/[id]/messages` every few seconds, readable only by the device whose cookie started the chat. If no person answers within the typical wait (`lib/assistant/seller.ts`: 75 s while open, none when closed; `npm run test:seller`), the window asks Sabi to answer (`answer: true`) and the server checks `sabiMayAnswer` before it does; Sabi says the team has been told and never claims to be a person. A seller chat is readable by whoever answers it, including sales; a chat with Sabi alone stays with the owner and managers. The Conversations nav badge counts rooms waiting for a person.
- **The buyer.** The car's page has one enquiry card, in a sheet over the page (`EnquirySheet`; after the description the page goes straight on to similar cars), with three ways side by side: a call-back from a number alone, a question, or a viewing. Under the photos sit "Chat with seller", "Book a viewing" (a link to `#book-viewing`, which opens the sheet on the day-and-time picker) and a line "leave your number and we call you" (`#call-me-back`); the phone bar's "Enquire" (`#enquire`) opens the sheet on whatever way it last showed, and `#ask-question` opens the question. The times are worked out in the browser, so they are right even on a cached page. The server checks the slot again. A lock on the slot means two buyers cannot take its last place. The confirmation gives the time, the place, the reference, an add-to-calendar link and a Google Calendar link. The calendar file is served from `/api/viewings/<reference>/calendar.ics` — a real address, because an iPhone does nothing with a `data:` calendar link — and holds nothing about the buyer. A buyer who gave an email gets the same details by email at once (`confirmViewingByEmail`), and a reminder on the morning. The phone bar (`StickyActions`) steps aside while the page's own buttons or the card are on screen, and shows the reference once an enquiry is saved.
- **Staff.** The phone alert, the inbox row and the enquiry page lead with the booked time, and the inbox opens with "Viewings today".
- **Each morning,** `/api/cron/viewings` emails each buyer with an email address, once, and sends staff the day's list, once (docs/LAUNCH.md has the schedule).
- **Migration 0009** adds `leads.viewing_at` and `leads.viewing_reminded_at`, and the database refuses a time on anything but a viewing.
- **Fixed on the way:**
  - The car page's enquiry section could grow wider than a phone: the column grew to its widest content, and a fieldset grows to its contents.
  - After any error, React reset the tab radios, so re-sending a viewing went in as a plain question. The type now comes from state.
  - The emails' headlines were still in a serif from the gold era. They are now Helvetica bold in Bone.

**Stage 5, sell or trade in (built):**
- **The page.** `/sell` takes the car (make, model, year, mileage, where it is, condition, papers, a price in mind), what the owner wants, and how to reach them. They can sell it to Sabicars, trade it in towards a car on sale (chosen from live stock), or have Sabicars sell it for them.
- **The record.** It lands in the inbox as a new enquiry type, "Sell or trade-in" (migration 0010, `lead_type` gains `sell`), alerted like any other. The details form one readable brief, and the car they want is attached.
- **Photos** are asked for afterwards on WhatsApp with the reference. Public uploads into the Cloudinary account would invite abuse.
- **The promises.** The page promises nothing beyond "we come back to you; nothing is final until we have seen the car". It warns that Sabicars never charges to look at a car.
- **Where it is linked.** "Sell your car" in the More menu on every width (since 2026-10-24), and the footer. Also the Request a car page and the sitemap. Ask Sabicars knows it, and never quotes what a car is worth.
- **Needs the owner's word:** that Sabicars buys cars outright and takes trade-ins, as well as selling on consignment. The three choices are in `lib/sell.ts`.

**Stage 8 groundwork, sale prices (built):**
- **Recording.** Marking a car sold now asks what the buyer actually paid: "Sold for" in the admin, owners and managers only. It is stored in `vehicles.sold_price_minor` (migration 0011). The database refuses it on a car that is not sold, and leaving "sold" clears it.
- **The reminder.** A sold car without the figure appears on its "Needs attention" list.
- **Privacy.** The figure is never shown on its own and no public code reads it.
- **What comes later.** The Sabicars Price Index publishes averages per model family once enough sales are on record, at least three in a year, so no single buyer's price can be worked out. Every sale recorded from now on counts towards it.

**Stage 6, partner payouts (built 2026-10-21):**
- **The model.** Money never sits with a partner inside the platform. A *commission* (`commissions`, migration 0013) is a record of what Sabicars owes: 1.5% of what the car actually sold for (`vehicles.sold_price_minor`), frozen at the sale with its rate, owed to the partner whose link brought the buyer (the earliest won enquiry on the car that carries a `partner_id`), or to a code a manager attributes a showroom sale to. One vehicle pays one commission; a voided one steps aside so a later, real sale can pay. A *payout* (`payouts`) is the record of paying it: by Paystack transfer from Sabicars' balance, or by a bank transfer made outside the platform and recorded with the bank's reference. The payout's reference is ours, made before Paystack is called and sent to it as the idempotency key, so a retry can never pay twice; one live payout per commission is enforced by the database.
- **The rules** (`lib/ledger-rules.ts`, gated by `npm run test:ledger` on every build): a 48-hour cooling-off before anything is paid, so a sale that unwinds owes nothing; the account must be in the partner's own name, checked by Paystack "resolve account" against the partner's registered name (name parts, in any order) or confirmed by a manager; never a payment for recruiting. The database proves the rest in `scripts/verify-schema.mjs` (one commission per vehicle, cooling-off, a reason on every void, the reference's shape, no cash, a bank transfer needs its bank reference, a NUBAN has ten digits, no Paystack recipient on an unverified account).
- **The partner** has no login. Each has a private page at `/partner/<token>` (a uuid, like a buyer's review link): their enquiries and sales, each commission and when it is payable, every payout, and the one bank account they are paid into, shown masked once saved. They are emailed their code and links on joining, when a sale is recorded, when their account is saved, and when they are paid (`lib/ledger-notify.ts`).
- **The admin:** `/admin/partners` (every partner with what they brought in and are owed; confirm an account, suspend, attribute a sale to a code) and `/admin/payouts` (what is payable, what is cooling, transfers in flight, failures to retry; pay by Paystack or record a bank transfer). Owners and managers only.
- **Paystack** (`lib/paystack.ts`): the bank list, resolve account, transfer recipients, transfers, verify, balance, and the webhook at `/api/payments/paystack/webhook` (signature checked; the body never trusted for money: only our reference finds a row). `/api/cron/payouts` runs daily at 07:00 Lagos: it checks every transfer still in flight against Paystack and alerts managers, once a day, to commissions ready to pay. A failed or returned transfer alerts managers with the reason; a paid commission whose sale is unwound alerts them too, since the platform takes nothing back.
- **Needs the business:** the Paystack business account (§8 item 7) with transfers enabled and a funded balance, its live secret key in Vercel, the webhook URL in the Paystack dashboard, and "Confirm transfers before sending" switched off (docs/LAUNCH.md A.4b). Until then, everything works by recorded bank transfer with a manager confirming each account.

**Pre-launch hardening for the founder's traffic (2026-10-22):** one post from Ccristian Dee can bring tens of thousands of visitors in an hour and thousands of sign-ups at once, and the load test on the live stack showed where that breaks: the database gate (the Supabase pooler, about 100 free connections), then photos and the live inventory page. Public pages stop asking the database once per visitor: inventory search results are cached for a minute and cleared when staff save a car, and car and comparison pages are built on first visit instead of all at deploy, so deploys stay quick with a thousand cars. Photos can be resized by Vercel's image cache instead of Cloudinary (`NEXT_PUBLIC_IMAGE_DELIVERY`, on once the project is on Vercel Pro), and uploads are capped at 2000px. Public forms are throttled per connection (`lib/rate-limit.ts`, migration 0015), generously, because carrier-grade NAT puts thousands of real Nigerian phones behind one address. Every transactional email is written to an outbox first (`email_outbox`) and sent at Resend's pace by a minute job, so a burst is delayed, never lost, and never sent twice (`npm run test:outbox` proves it on every push). The arithmetic, the switch and the limits are in docs/LAUNCH.md A.9.

**Later stages, in order** (each needs the business where marked):
- **Stage 3b, reservations:** reserving a car online with a refundable deposit. *Needs: the Paystack account and the reservation policy (§8 item 2).*
- **Stage 4, money:** prequalify. ~~Autochek's indicative monthly figure per car~~ — *answered 2026-10-21: shown as an estimate at Autochek's published ceiling, never as the lender's figure (§8 item 3).*
- ~~**Stage 6:** partner payouts through Paystack.~~ *Built 2026-10-21 (above); only the Paystack account is pending.*
- **Stage 7:** My Sabicars, covering papers, renewals and the service log.
- **Stage 8:** the Sabicars Price Index from recorded sale prices.
- **Stage 9:** the dealer network pilot (Phase 7).

### What Sabicars has that Adedayo does not

Consignment and custody (§2.2), youth scout and creator programmes on top of
referrals (§2.4), the fleet and government procurement desk, published
inspection reports as a trust standard, the media hub, and the dealer network.
Everything else that applies — lead pipeline, assistant, staff roles, payments,
ledger, referrals, campaigns, push, feeds — is proven engine reused, not
reinvented. What is not reused: anything US-specific (TILA disclosures, VIN
decoding, the market switch), and rentals unless Sabicars starts renting.

---

## 8. Open items — needed from the business

These block content and go-live, not architecture. Building continues without them.

1. **Staff list** — who handles sales, who approves Drive Plans, who is owner. Names, phones, emails. Each person's role decides what they see; managers are the ones alerted when an enquiry waits 15 minutes. Every salesperson then installs "Sabicars Staff" on their phone and turns alerts on.
2. **Reservation policy** — deposit amount, how long a car is held, and whether the deposit is refundable.
3. **Drive Plan terms** — *Answered 2026-09-26:* the buyer pays 40%; **Autochek finances the remaining 60%**. Sabicars has an Autochek dealer store; its stock is listed there and each listing already carries its loan configuration (tenor, interest). Loan buyers are profiled and processed by Autochek, and the vehicle must be on the store. Built: a per-vehicle Autochek link (legacy `financeUrl`, empty on all 48 today), "Apply for the 60% on Autochek" on each vehicle (records the buyer first, then sends them to the listing), a request path for vehicles not yet listed, and an admin flag on available vehicles with no link. *Answered 2026-09-26:* the car leaves the showroom only after Autochek approves; the buyer pays the 40% then.

   *Answered 2026-10-20 — the terms depend on the car's year.* Autochek's team told Sabicars: its lenders finance nothing older than 2008; a 2008 or 2009 car needs 50% down; a car from 2010 needs 40%; the buyer shows six months of bank statements; a business owner shows a CAC registration, and a registered business name is enough — Autochek can arrange one for about ₦35,000; the interest rate is "on the site". Verified against Autochek's own pages the same day: every listing, including 2004–2009 cars, shows "40% minimum", so the year tiers and the 50% rule are its lenders' rule, not something Autochek's website states; listings give the rate as "available on request", and the only published figures are in its app-store listing: the 30% a year ceiling, 6–48 month terms, a worked example (₦1,000,000 over 12 months at 30% ≈ ₦97,487 a month, which the build checks is an ordinary amortised loan) and a ₦20,000 processing fee, which the pages quote as Autochek's own; its listings also say "40% minimum (max 70%)"; six months of statements matches its financing pages; the CAC requirement (a BN1 business-name registration) is confirmed; the ₦35,000 could not be verified anywhere Autochek publishes. Decision: the site publishes the stricter lender rule, attributed and dated — the deposit tiers and the year floor "as Autochek's team gave them to Sabicars on 20 October 2026", and only the rate ceiling, the terms, the documents and the fee "as Autochek publishes", never implying Autochek's website states the tiers — never states a rate or a monthly figure as fact, and never offers the plan or computes a deposit on a car older than 2008. `web/src/lib/drive-plan.ts` is the source of record for every figure, and `web/scripts/verify-drive-plan.ts` gates the build (`npm run test:drive-plan`) so no page can state a different rule. The published answers and the Drive Plan article are seeded content: a change to `content/ask-answers.ts` or `content/articles/*.ts` reaches the database with `npm run content:sync -- <commit the database holds>` (dry run, then `--apply`; the live connection string for production, as for a migration). It replaces the changed wording only where a row still holds it word for word, so staff's edits survive; `ask:seed -- --force` / `blog:seed -- --force` would overwrite them, and the seeders otherwise keep existing rows. Still needed from the business, in writing from Autochek: the year tiers and the 50% rule for 2008–2009 cars.

   *Answered 2026-10-21 — the monthly figure: yes, as an estimate; and bank-app statements.* The site shows an estimated monthly repayment on the financed balance: an ordinary amortised loan at Autochek's published ceiling of 30% a year over a term the buyer picks (12, 24, 36 or 48 months; default 48). It is always labelled an estimate at Autochek's published ceiling — never "your repayment is", never the lender's quote — because the lender's offer sets the real rate, which can be lower, and may add insurance, a tracker and maintenance. Source of record: `monthlyAtCeilingMinor` in `web/src/lib/drive-plan.ts`, with `ESTIMATE_MONTHS`, `DEFAULT_ESTIMATE_MONTHS` and `ESTIMATE_NOTE` (the sentence shown under every estimate); gated by `web/scripts/verify-drive-plan.ts` (a ₦24,000,000 car from 2013 finances ₦14,400,000 → ₦518,486 a month over 48 months, ₦1,403,815 over 12; a ₦20,000,000 car from 2009 finances ₦10,000,000 → ₦360,060 over 48). `drivePlanMonthly()` in `lib/vehicle.ts` formats it for a car, and `components/vehicle/RepaymentEstimate.tsx` renders the figure with term chips wherever the buyer can pick a term; where there is no room for chips the figure carries "est.". Bank statements: six months from every applicant. A buyer without a commercial bank account can use statements from the bank app they actually use (`DRIVE_PLAN.statementAlternative`, "a bank app such as OPay"), as long as they show money coming in and going out — as Autochek's team told Sabicars on 20 October 2026, so it is attributed like the deposit tiers and never as something Autochek publishes. House wording: "The last 6 months from the account you actually use — a commercial bank, or a bank app such as OPay — showing money coming in and going out."
4. **Consignment terms** — what the truck importer is paid, and what they should be able to see.
5. **Real delivery photos** — the Highlander, Lexus and Hummer supplies, including the LCDA order.
6. **Which claims are true** — "500+ vehicles sold", "8 years", "36 states", "warranty on every car". Unverifiable claims are a liability, and an institution only publishes what it can stand behind.
7. **Accounts** (created by the business; credentials never pass through a developer's chat): Vercel, Supabase, Paystack business account, Anthropic API key, Resend domain verification for sabicars.com.
8. **Push notifications** — *Answered 2026-09-26:* keep OneSignal for customers. The owner has access, and every existing subscriber is kept. Staff alerts use built-in Web Push (Phase 3).
9. **Email address** — `info@sabicars.ng` is printed 17 times on the live site, but `sabicars.ng` has no mail server (no MX record), so every email sent to it is lost. `sabicars.com` does receive mail (Google Workspace). The platform uses `info@sabicars.com`; the live site should be corrected now.
10. **Address** — the contact page says Km 16, the newsletter template says Km 13. Which is right?
11. **The logo** — two different marks are in use (the gold "S" monogram in the header; "SABICARS · Elite Auto Dealer" in a gold ring as the app icon). Which is the mark, and are there vector (SVG/PDF) originals? The monogram only exists as a 160px image.
12. **"Humer" or "Hummer"** — *Answered 2026-09-26:* "Hummer", the spelling buyers search for. The importer rewrites "Humer" in model names (logged in the import report) and "Humer" stays in the Hummer page's search description. Local slugs were aligned to what a fresh production import generates (`…-hiace-hummer-2`). Six interior or detail covers (including the 2019 Hiace Hummer 2) are corrected on every import by `COVER_CORRECTIONS` in `web/src/lib/legacy/normalise.ts` until staff own covers in the admin after cutover. The 2011 Camry has only one photo, an interior: it needs photographing.
14. **A professional portrait of Ccristian Dee.** The homepage uses the photo from the current About page (casual, football shirt). For the institutional story, a proper portrait session is worth more than any design change.
15. **Fleet figures.** The current About page names orders (70 Hiace buses to Hobbys Circle, 60 to House of Chi, 60 Corollas) and the current homepage different ones (13 Highlanders, 3 Lexus GX). Which are accurate, and may clients be named? The new homepage states no figures until confirmed.
16. **Hero photography.** Of the six vehicles flagged for the homepage hero, the Hiace Humer 2's cover is an interior shot, and the 2022 GLE 350's cover looks like a manufacturer press photo rather than the actual car. Hero vehicles need a daylight exterior three-quarter view.
17. **Refer & Earn operating rules** — *Answered 2026-09-26:* (a) first partner to bring a buyer keeps them for 90 days — built; (b) a partner buying for themselves earns no commission but gets a **partner price** — set at **1.5% off** ("the standard partner discount": the same value as the commission, so Sabicars' margin is identical either way); the staff board flags it; (c) commission is paid **once the deal is fully concluded, after a cooling-off of a day or two**; (d) payout goes **automatically into a bank account registered in the partner's own name**, with identity confirmed before the first payout. Proposed mechanism for (d), to build with the partner dashboard: Paystack "resolve account" to check the account holder's name matches the partner, then Paystack Transfers — so no one can request a cashout on someone else's behalf. Needs the Paystack business account (item 7).

   *Built 2026-10-21 (stage 6):* the whole mechanism is in place — the commission ledger with the 48-hour cooling-off, the partner's private page with the one bank account in their own name, the name check through Paystack "resolve account" (or a manager's confirmation), Paystack transfers with our own idempotent reference, recorded bank transfers as the fallback, the webhook and the daily reconciliation. Only the Paystack business account is pending: registered, transfers enabled, balance funded, live key in Vercel (docs/LAUNCH.md A.4b).
18. **Sourcing to order** — *Answered 2026-09-26:* yes, Sabicars sources on request, depending on how serious the request and the buyer are; staff review every request. Built: the staff Sourcing Desk board (/admin/requests) with review → sourcing → matched → bought/closed, notes, and the grouped sourcing list.
19. **Automatic alerts to buyers** — email alerts are built (Resend) and switch on once `RESEND_API_KEY` and `RESEND_FROM_EMAIL` are set for the platform. Most buyers prefer WhatsApp: fully automatic WhatsApp needs a WhatsApp Business Platform account (Meta business verification and an approved message template), or SMS through a Nigerian provider such as Termii. Until one exists, alerts that cannot be emailed wait on the staff board with the message pre-written — one tap to send.
20. **Listing facts that contradict each other** (found 2026-09-27; Ask Sabicars repeats what listings say, so these matter): "brand new" on the 2013 Toyota Highlander LE, 2016 Lexus GX 460 and 2018 Toyota Highlander XLE; the 2021 Cadillac Escalade is "brand new" with 34,000 km, its engine reads "2L V8" while its description says 6.2L V8 and 2023; the 2024 Lexus GX 550 is "brand new" with 20,000 km; the 2000 Volvo FL7 truck reads "2.5L V4" (an FL7 is a 7-litre engine) its interior colour "Harsh", and its drive "FWD" (it is rear-wheel drive). Correct them in the admin (or the old admin before cutover).
21. **Who inspects, and which cars get the seal** — *Answered 2026-10-21:* the Sabicars team inspects, at the showroom, through the admin inspection page (`/admin/vehicles/[id]/inspection`: every check answered, photos where needed). The Sabicars Verified seal is given only to cars at the Sabicars showroom inspected that way. A car Sabicars lists but holds elsewhere — a partner's or an owner's car — is viewed and inspected on the buyer's request and never carries the seal. Built: `vehicles.held_offsite` (schema and migration 0012); `withCovers()` in `lib/repositories/vehicles.ts` forces `verification` to null on a held-offsite car, so neither its card nor its page can show the seal, and `CardVehicle` carries `heldOffsite`. House wording for a public page: "Not at the Sabicars showroom. Viewing and an inspection by the Sabicars team are arranged on request; this car does not carry the Sabicars Verified seal."
13. **The import report** (`web/.data/legacy-import-report.md`) — 26 vehicles need a salesperson's attention: mostly missing descriptions and body types, one price with a stray "Z", one car with a colour in the seats field. Some cover photos are interiors (e.g. the Acura MDX); covers should be an exterior three-quarter view.

## 9. Cost shape

Rough monthly, at launch volume: Vercel Pro ~$20 (the free plan does not
permit commercial use), Supabase Pro ~$25 (the free plan pauses inactive
projects), assistant usage a few dollars to tens of dollars depending on
traffic (rate-limited per visitor), Resend free tier initially, Cloudinary on
its current plan. Paystack charges per transaction. Render can be retired after
cutover.
