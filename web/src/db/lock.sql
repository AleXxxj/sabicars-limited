-- Closes every table in the public schema to Supabase's Data API.
--
-- Supabase publishes the public schema over HTTP (PostgREST) to two roles:
-- `anon`, which anyone holding the project's publishable key acts as, and
-- `authenticated`, which any signed-in Supabase user acts as. By default it
-- grants both roles every privilege on every table the `postgres` role
-- creates, and Row Level Security is off, so the key alone would read and
-- change every row: enquiries, staff, partners' bank details, payouts.
--
-- The site never uses the Data API. It reaches the database only through its
-- own server connection, as `postgres`, which owns every table and bypasses
-- Row Level Security. So Row Level Security is switched on for every table,
-- with no policies (nobody else may read or write a row), both roles lose
-- their privileges, and tables created later are not granted to them.
--
-- Safe to run any number of times. scripts/migrate.mjs runs it after every
-- migration, so a table added later is closed the moment it exists. Locally
-- and in CI there are no `anon` or `authenticated` roles; only the first
-- part applies there. /admin/status shows whether it holds.
DO $$
DECLARE
  t record;
BEGIN
  FOR t IN
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p') AND NOT c.relrowsecurity
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.relname);
  END LOOP;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
     AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
    REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
    REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM anon, authenticated;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM anon, authenticated;
  END IF;
END $$;
