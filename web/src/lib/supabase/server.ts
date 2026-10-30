import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { timedFetch } from "@/lib/deadline";

/**
 * Supabase client bound to the request's cookies. Uses the anon key, so it
 * acts as the signed-in user and never as an administrator.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      // Every call to Supabase has a deadline: one that hangs must not hold the page for a minute.
      global: { fetch: timedFetch },
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (toSet) => {
          try {
            for (const { name, value, options } of toSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Called from a Server Component, where cookies are read-only.
            // The middleware refreshes the session, so this is safe to ignore.
          }
        },
      },
    },
  );
}
