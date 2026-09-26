"use client";

import { useState, useTransition } from "react";
import { Button, ButtonLink } from "@/components/ui/Button";
import { resubscribe, unsubscribe } from "@/lib/actions/subscribe";

export function UnsubscribeButtons({ token, email, active }: { token: string; email: string; active: boolean }) {
  const [isActive, setActive] = useState(active);
  const [pending, start] = useTransition();
  return isActive ? (
    <>
      <h1 className="mt-4 text-display-3">Unsubscribe {email}?</h1>
      <p className="mt-4 text-text-secondary">You will stop receiving the weekly new arrivals. Nothing else changes.</p>
      <Button
        type="button"
        disabled={pending}
        onClick={() => start(async () => void ((await unsubscribe(token)).ok && setActive(false)))}
        className="mt-8"
      >
        {pending ? "Unsubscribing…" : "Unsubscribe"}
      </Button>
    </>
  ) : (
    <>
      <h1 className="mt-4 text-display-3">You are unsubscribed.</h1>
      <p className="mt-4 text-text-secondary">{email} will not receive the newsletter again. Changed your mind?</p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Button
          type="button"
          variant="secondary"
          disabled={pending}
          onClick={() => start(async () => void ((await resubscribe(token)).ok && setActive(true)))}
        >
          {pending ? "One moment…" : "Subscribe again"}
        </Button>
        <ButtonLink href="/vehicles" variant="quiet">
          See the inventory
        </ButtonLink>
      </div>
    </>
  );
}
