"use client";

import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { signIn } from "@/lib/actions/auth";
import { Button } from "@/components/ui/Button";

const field =
  "min-h-12 w-full border border-border-strong bg-surface-0 px-4 text-text-primary outline-none transition-colors focus:border-gold-500";

export function LoginForm({ disabled }: { disabled: boolean }) {
  const search = useSearchParams();
  const [state, action, pending] = useActionState(signIn, null);
  const notStaff = search.get("error") === "not_staff";
  const error = state?.error ?? (notStaff ? "That account is not authorised for the Sabicars admin." : null);

  return (
    <form action={action} className="grid gap-6">
      <input type="hidden" name="next" value={search.get("next") ?? "/admin"} />

      {error && (
        <p role="alert" className="border-l-2 border-danger bg-surface-2 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      )}

      <label className="grid gap-2">
        <span className="eyebrow !text-text-secondary">Email</span>
        <input name="email" type="email" autoComplete="username" required disabled={disabled} className={field} />
      </label>
      <label className="grid gap-2">
        <span className="eyebrow !text-text-secondary">Password</span>
        <input name="password" type="password" autoComplete="current-password" required disabled={disabled} className={field} />
      </label>

      <Button type="submit" disabled={pending || disabled} className="w-full">
        {pending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
