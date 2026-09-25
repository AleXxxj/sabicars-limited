/**
 * Whether staff sign-in can work at all.
 *
 * Until the Supabase project exists (architecture §8, item 7), the admin says
 * so plainly instead of throwing on an undefined URL. The public site does not
 * depend on Supabase and works either way.
 */
export function authConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}
