# Sabicars platform (`web/`)

The new Sabicars platform: Next.js 16 (App Router) + TypeScript + Tailwind v4,
Postgres via Drizzle, Supabase Auth for staff. The plan, the reasoning and the
open items are in [`../docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md) — read
that first.

The legacy static site at the repository root keeps serving `sabicars.com` from
GitHub Pages until cutover. Nothing here affects it.

## Run it locally

```bash
npm install
cp .env.example .env.local        # then set LEGACY_MONGO_URI
npm run db:local                  # terminal 1: PostgreSQL 17 on :54329 (first run creates it)
npm run db:migrate                # terminal 2: create the tables
npm run legacy:import             # copy everything from the legacy API
npm run dev                       # http://localhost:3000
```

No Docker or system-wide install is needed: `db:local` runs real PostgreSQL 17
— the same engine and version as Supabase — from binaries inside
`node_modules` (embedded-postgres), with data in `.postgres/`.

Earlier this used PGlite served over a socket. That broke under the build's
parallel workers (PGlite is one session; concurrent clients' queries
interleave) and crashed when a client disconnected. PGlite is still used for
the in-memory schema test, which only ever has one client.

## Gates

`npm run build` runs these before compiling, and fails if any does:

| Gate | What it proves |
| --- | --- |
| `tokens` | `tokens.css` is regenerated from `palette.json` — never hand-edited |
| `check:contrast` | every text/background pair in both themes meets WCAG AA |
| `test:schema` | the migrations apply, and the database refuses every invalid state (zero prices, consigned trucks with no owner, sold cars with no date, leads nobody can call back…) |
| `test:money` | kobo arithmetic, the 40% Drive Plan deposit and the 1.5% commission are exact |
| `test:hours` | the showroom clock: when an enquiry's response time starts counting |
| `test:viewings` | viewing slots follow the showroom's hours, notice and capacity rules |
| `test:drive-plan` | the Drive Plan deposit tiers by model year and the repayment estimate match what Autochek gave Sabicars |
| `test:ledger` | the commission ledger's rules: 1.5% to the kobo, the 48-hour cooling-off, whose name a bank account must be in, the payout reference and Paystack's transfer fee |

## Walkthroughs and the backup

These are not part of `npm run build`. GitHub Actions runs the first two
(`../.github/workflows/smoke.yml` on every production deploy,
`../.github/workflows/e2e.yml` on every push to `platform`, which also runs
`test:backup` and `test:outbox`); all of them can be run by hand.
Playwright's browser is installed once with `npx playwright install chromium`.

| Script | What it does |
| --- | --- |
| `test:smoke` | walks the site at `SMOKE_BASE_URL` (default `http://localhost:3000`) as a buyer and as staff, read-only, on a desktop and a phone viewport; it submits the public forms the way a bot would, which the site answers without saving a row, so the round trip is proved on the live site too |
| `test:e2e` | drives the money paths — an enquiry, a partner registering and adding a bank account, a car sold with the commission attributed and paid — against `E2E_BASE_URL` (default `http://localhost:3000`) and the database in `.env.local`; run `e2e:seed` first, and never point either at the live database |
| `e2e:seed` | puts the fixture rows the flows suite expects into the database in `.env.local` |
| `backup:restore` | loads a backup file (from `/api/cron/backup` or the status page's download) into an empty database that has had `db:migrate`: `-- <file> --check` reads it, `-- <file> --yes` loads it |
| `test:backup` | proves a backup restores exactly: exports the database in `DATABASE_URL` through `lib/backup.ts`, restores it into an empty database beside it, and compares every table row for row, then drops the copy; refuses a Supabase address; runs in CI on every push |
| `test:outbox` | proves the email outbox (`lib/email.ts`) loses nothing and sends nothing twice: 250 emails at once against a stand-in for Resend that is busy at first, then refuses a batch for one bad address; checks every email is sent exactly once, the bad one fails alone, a day-old one expires, a dead sender's claim is released, and the "Email outbox" check on `/admin/status` reads it right; writes and removes `@outbox.test` rows in `DATABASE_URL`, refuses a Supabase address, and refuses to run while other email is waiting; runs in CI on every push |

Staff screens in the tests sign in with `E2E_STAFF_EMAIL` and
`E2E_STAFF_PASSWORD` (see `.env.example`); without them the staff tests are
skipped.

## The legacy import

`npm run legacy:import` reads the legacy Mongo database (read-only — only
`find()` is ever called) and writes everything to Postgres in one transaction.
It is safe to re-run up to cutover: rows are keyed on the Mongo `_id` and a
vehicle keeps its URL across runs. Add `-- --dry-run` to only produce the
report.

Every run writes `.data/legacy-import-report.md`: which vehicles need a person
to check or fill something in, and every correction made automatically.

## Staff accounts

Once Supabase is configured, create each account yourself (the password is
read from the environment, never typed into a file or a chat):

```bash
STAFF_EMAIL="owner@sabicars.com" STAFF_NAME="…" STAFF_ROLE=owner STAFF_PASSWORD='…' npm run staff:create
```

Roles: `owner` (everything, including staff), `manager` (prices and money),
`sales` (customers and cars).
