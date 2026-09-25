import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Refreshes the staff session and sends signed-out visitors from /admin to the
 * sign-in page.
 *
 * This is the Next.js 16 `proxy` convention (formerly `middleware`). It is a
 * first line of defence for the user experience, not the security boundary:
 * every admin page and server action calls requireStaff() itself.
 *
 * Public pages never touch Supabase here — a session lookup is a network round
 * trip that a visitor browsing cars should not pay for.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (!pathname.startsWith("/admin")) return NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  // Not configured yet: the sign-in page explains, instead of the proxy throwing.
  if (!url || !anonKey) {
    if (pathname.startsWith("/admin/login")) return NextResponse.next({ request });
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (toSet) => {
        for (const { name, value } of toSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of toSet) response.cookies.set(name, value, options);
      },
    },
  });

  // getUser() revalidates the token with Supabase; getSession() only reads the
  // cookie and can be forged, so it must never decide access.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && !pathname.startsWith("/admin/login")) {
    const login = request.nextUrl.clone();
    login.pathname = "/admin/login";
    login.search = "";
    login.searchParams.set("next", pathname);
    return NextResponse.redirect(login);
  }
  if (user && pathname === "/admin/login") {
    return NextResponse.redirect(new URL("/admin", request.url));
  }
  return response;
}

export const config = {
  matcher: ["/admin/:path*"],
};
