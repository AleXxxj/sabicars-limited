# Sabicars — Platform Architecture

Status: **approved 2026-09-23** · Phase 1 built locally, not yet deployed · Last updated: 2026-09-23

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
| Pay 40% and drive | Enquiry form that alerts nobody | **Drive Plan application** with documents, a staff decision queue, and an instalment ledger once approved |
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

partners           id, dealer_id, name, phone, code, kind (referrer|scout|creator), tier, status
attributions       id, partner_id, lead_id, vehicle_id, first_touch_at, source (link|manual)
commission_ledger  id, partner_id, vehicle_id, pool (commission|marketing), amount_minor,
                   state (pending|approved|paid|reversed), release_after, paid_ref
scout_finds        id, partner_id, vehicle details, photos, owner contact, status, outcome

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
- **Money.** Integer kobo in `bigint`; percentages in basis points. The 40%
  deposit and 1.5% commission are verified to the kobo on every build.
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
  gallery with full-screen view; price and the 40% Drive Plan split (deposit
  and balance only — no tenor or rate until the terms are confirmed); only the
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
  it isn't here (**Sourcing Desk** first step) → fleet → the founder → can I
  earn (**Refer & Earn**, with commission on real cars in stock) → visit.
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
- **Navigation like an app.** Phones get a bottom tab bar (Home, Cars, Drive
  Plan, Find a car, Earn) and a menu with an icon and a one-line explanation
  per section, plus Call / WhatsApp / Directions. Desktop gets sentence-case
  links and a "Browse cars" button.
- **Photography.** Every vehicle photo passes through Cloudinary `e_improve`
  (auto exposure and colour), chosen after comparing it with a stronger
  outdoor/vibrance treatment on real listings.
- Featured cars swipe sideways on a phone instead of stacking 4,000px deep.
- **/drive-plan** built on the confirmed structure (40% deposit, Autochek
  finances 60%): finder, four steps, a worked example on a real car,
  straight answers, and an application recorded as a Drive Plan lead.

### Search visibility (2026-09-26)

The owner's aim: the inventory everywhere a related search happens. Built, taking effect once the platform is live and crawled:

- **A landing page per make and model family** with stock (`/buy/toyota-highlander`, `/buy/lexus-rx-350`, `/buy/toyota` …), generated from the inventory: live count, price from, 40% deposit, cars, a Sourcing Desk prompt, related models, breadcrumbs and an ItemList. A family that sells out keeps its page, noindexed, off the sitemap. The Hiace Hummer family redirects to /hummer-bus.
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
- Also restored: **recently viewed** (on the device; on the inventory and every car page), **recently sold** (last 90 days; hidden while there are none), and the **any-price calculator** on /drive-plan. The calculator shows the 40% and Autochek's 60% for any price or car. It shows no monthly figure, because Autochek sets the terms.

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
  - the 40/60 Drive Plan split on a real bus
  - an inspection checklist that stays ticked on the reader's phone
  - a route calculator on the reader's own numbers
  - the Drive Plan journey: a pinned scroll story in which a car drives six steps along a road
  - the deposit stretch: cash vs a 40% deposit, racing against live stock to the best car each reaches
  - repayment comfort: the reader's pay, a 30% ring, and a verdict on Autochek's quote
  - the walk-around: a pinned scroll story round a top-down car, seven stops, with the minutes for each
  - the flood detective: water rises and drains, then the reader hunts the six marks it leaves
  - the budget quiz: four questions, a suggested body type and plan, matched to live stock (or the closest car and the Sourcing Desk)

  All respect reduced motion (scroll stories become still lists) and are readable down to 360 px.
- **Video:** YouTube, TikTok and Instagram links show a poster, and their player loads only when tapped (data-light). Sabicars' own Cloudinary clips play as silent loops when scrolled into view, with a tap for sound.
- **Around each article:** the old site's four reactions, shares, read counts, moderated comments (managers alerted), a subscribe box, related articles, BlogPosting and FAQPage structured data, and sitemap entries.
- **Articles in code** (`src/content/articles`, `npm run blog:seed`):
  - Flagship: "The Toyota Hiace Hummer bus: the complete buyer's guide". Every price in it is live from stock, and it carries the owner's Instagram reel of a manual Hummer 2.
  - The three old posts, rewritten at their original addresses so links, reads, reactions, comments and dates carry over: "Drive now, pay monthly" (now the Autochek 40/60 arrangement), "How to inspect a used car in Lagos in 20 minutes", and "Best cars under ₦5 million" (the old model list kept, without market prices that date).
  - The seeder inserts new articles, rewrites an old-site row once (one with no hook line yet), and otherwise leaves admin edits alone unless run with `--force`. The legacy importer now updates only reads, shares and reactions on posts that already exist, so a final import cannot undo the rewrites.
- **Admin → Insights:** a block editor with direct photo upload to Cloudinary (`sabicars/blog`) and draft preview. The first publish announces the article once: bell, push, and an email to blog subscribers. Published articles cannot be deleted, only unpublished, so links never break.
- "Insights" is in the site navigation, the latest articles are on the homepage, and the Hummer bus page links to the guide.

Still open: more video. One Instagram reel is in (the Hummer guide). YouTube and TikTok links are still wanted, and phone clips can be uploaded to Cloudinary for silent loops.

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
18. **Sourcing to order** — *Answered 2026-09-26:* yes, Sabicars sources on request, depending on how serious the request and the buyer are; staff review every request. Built: the staff Sourcing Desk board (/admin/requests) with review → sourcing → matched → bought/closed, notes, and the grouped sourcing list.
19. **Automatic alerts to buyers** — email alerts are built (Resend) and switch on once `RESEND_API_KEY` and `RESEND_FROM_EMAIL` are set for the platform. Most buyers prefer WhatsApp: fully automatic WhatsApp needs a WhatsApp Business Platform account (Meta business verification and an approved message template), or SMS through a Nigerian provider such as Termii. Until one exists, alerts that cannot be emailed wait on the staff board with the message pre-written — one tap to send.
13. **The import report** (`web/.data/legacy-import-report.md`) — 26 vehicles need a salesperson's attention: mostly missing descriptions and body types, one price with a stray "Z", one car with a colour in the seats field. Some cover photos are interiors (e.g. the Acura MDX); covers should be an exterior three-quarter view.

## 9. Cost shape

Rough monthly, at launch volume: Vercel Pro ~$20 (the free plan does not
permit commercial use), Supabase Pro ~$25 (the free plan pauses inactive
projects), assistant usage a few dollars to tens of dollars depending on
traffic (rate-limited per visitor), Resend free tier initially, Cloudinary on
its current plan. Paystack charges per transaction. Render can be retired after
cutover.
