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
