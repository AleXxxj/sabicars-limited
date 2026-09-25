import type { Metadata } from "next";
import { Suspense } from "react";
import { Logo } from "@/components/Logo";
import { authConfigured } from "@/lib/supabase/config";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Staff sign in", robots: { index: false, follow: false } };

export default function LoginPage() {
  const ready = authConfigured();

  return (
    <main className="grid min-h-svh place-items-center px-5 py-16">
      <div className="w-full max-w-sm">
        <Logo />
        <h1 className="mt-10 text-display-3">Staff sign in</h1>
        <p className="mt-2 text-sm text-text-muted">For Sabicars staff only. Every change is recorded.</p>

        {!ready && (
          <p className="mt-8 border-l-2 border-warning bg-surface-1 px-4 py-3 text-sm text-text-secondary">
            Sign-in is not set up yet. It switches on once the Supabase project is connected (architecture §8, item 7).
          </p>
        )}

        <div className="mt-8">
          <Suspense>
            <LoginForm disabled={!ready} />
          </Suspense>
        </div>
      </div>
    </main>
  );
}
