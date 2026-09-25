"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { authConfigured } from "@/lib/supabase/config";

export async function signIn(_prev: { error?: string } | null, formData: FormData): Promise<{ error?: string }> {
  if (!authConfigured()) return { error: "Staff sign-in is not set up yet." };

  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/admin");
  if (!email || !password) return { error: "Enter your email and password." };

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
