"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { withinLimit } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";
import { authConfigured } from "@/lib/supabase/config";

const TOO_MANY_SIGN_INS = "Too many sign-in attempts from this connection. Wait fifteen minutes, or ask the owner to reset your password.";

export async function signIn(_prev: { error?: string } | null, formData: FormData): Promise<{ error?: string }> {
  if (!authConfigured()) return { error: "Staff sign-in is not set up yet." };

  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/admin");
  if (!email || !password) return { error: "Enter your email and password." };
  // Counted before the password is tried, so guessing one is slow: enough attempts for a mistyped password,
  // or a few staff signing in from the showroom's one connection, but not for working through a list.
  if (!(await withinLimit("signin"))) return { error: TOO_MANY_SIGN_INS };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    // Deliberately vague: saying "no such user" versus "wrong password" lets
    // anyone find out which emails have staff accounts.
    return { error: "Incorrect email or password." };
  }

  revalidatePath("/admin", "layout");
  // Only ever back into the admin — never an arbitrary URL from the query string.
  redirect(next.startsWith("/admin") ? next : "/admin");
}

export async function signOut() {
  if (authConfigured()) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }
  revalidatePath("/admin", "layout");
  redirect("/admin/login");
}
