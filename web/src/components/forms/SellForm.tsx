"use client";

import { useActionState, useState } from "react";
import { submitSellRequest } from "@/lib/actions/leads";
import { SELL_INTENTS, SELL_PAPERS, type SellIntent } from "@/lib/sell";
import { Button, ButtonAnchor } from "@/components/ui/Button";
import {
  FieldError,
  fieldClass,
  Label,
  PrivacyLink,
  SpamGuard,
} from "./shared";

const REPLY_BY = [
  ["whatsapp", "WhatsApp"],
  ["phone", "A phone call"],
  ["email", "Email"],
] as const;

export interface TradeOption {
  id: string;
  title: string;
  price: string;
}

/**
 * Someone offering their own car. It starts with the car, because that is
 * what staff need to judge an offer, and asks for photos afterwards on
 * WhatsApp with the reference, where a phone's camera roll already is.
 */
export function SellForm({
  whatsappBase,
  stock,
  initialIntent = "sell",
}: {
  whatsappBase: string;
  stock: TradeOption[];
  initialIntent?: SellIntent;
}) {
  const [state, action, pending] = useActionState(submitSellRequest, null);
  const v: Record<string, string | undefined> = state?.values ?? {};
  const err = state?.fieldErrors ?? {};
  // Held in state so the trade-in choice shows or hides at once; sent as a hidden field so a failed send never loses it.
  const [intent, setIntent] = useState<SellIntent>(
    (v.intent as SellIntent) ?? initialIntent,
  );

  if (state?.ok) {
    const wa = `${whatsappBase}?text=${encodeURIComponent(`Hello Sabicars, here are photos of the car I want to ${intent === "trade_in" ? "trade in" : "sell"} (reference ${state.reference}).`)}`;
    return (
      <div
        role="status"
        className="surface-card scroll-mt-24 !border-green-500/30 p-7 md:p-9"
      >
        <p className="kicker">Received</p>
        <h3 className="mt-3 text-display-3">
          Thank you{state.name ? `, ${state.name}` : ""}.
        </h3>
        <p className="mt-4 text-text-secondary">
          Your reference is{" "}
          <strong className="figures text-text-primary">
            {state.reference}
          </strong>
          . Send us a few photos of the car on WhatsApp with your reference: the
          front, both sides, the back, the dashboard with the engine running,
          and the papers. We look at them and come back to you. Nothing is final
          until we have seen the car.
        </p>
        <ButtonAnchor
          href={wa}
          target="_blank"
          rel="noopener noreferrer"
          arrow
          className="mt-8 w-full py-3 text-center !whitespace-normal sm:w-auto"
        >
          Send photos on WhatsApp
        </ButtonAnchor>
      </div>
    );
  }

  return (
    <form action={action} className="grid gap-8" noValidate>
      <SpamGuard />
      <input type="hidden" name="intent" value={intent} />
      {state?.error && (
        <p
          role="alert"
          className="border-l-2 border-danger bg-surface-2 px-4 py-3 text-sm text-danger"
        >
          {state.error}
        </p>
      )}

      <fieldset className="grid min-w-0 gap-6">
        <legend className="mb-5 text-[1.1rem] font-semibold text-text-primary">
          Your car
        </legend>
        <div className="grid gap-6 sm:grid-cols-3">
          <label className="grid gap-2">
            <Label>Make</Label>
            <input
              name="make"
              required
              defaultValue={v.make}
              placeholder="Toyota"
              className={fieldClass}
            />
            <FieldError message={err.make} />
          </label>
          <label className="grid gap-2">
            <Label>Model</Label>
            <input
              name="model"
              required
              defaultValue={v.model}
              placeholder="Camry"
              className={fieldClass}
            />
            <FieldError message={err.model} />
          </label>
          <label className="grid gap-2">
            <Label>Year</Label>
            <input
              name="year"
              required
              inputMode="numeric"
              maxLength={4}
              defaultValue={v.year}
              placeholder="2015"
              className={`figures ${fieldClass}`}
            />
            <FieldError message={err.year} />
          </label>
        </div>
        <div className="grid gap-6 sm:grid-cols-2">
          <label className="grid gap-2">
            <Label>Mileage in km (optional)</Label>
            <input
              name="mileageKm"
              inputMode="numeric"
              defaultValue={v.mileageKm}
              placeholder="98,000"
              className={`figures ${fieldClass}`}
            />
            <FieldError message={err.mileageKm} />
          </label>
          <label className="grid gap-2">
            <Label>Where the car is (optional)</Label>
            <input
              name="location"
              defaultValue={v.location}
              placeholder="e.g. Ikeja, Lagos"
              className={fieldClass}
            />
          </label>
        </div>
        <div className="grid gap-6 sm:grid-cols-2">
          <label className="grid gap-2">
            <Label>Condition</Label>
            <select
              name="condition"
              defaultValue={v.condition ?? "nigerian_used"}
              className={fieldClass}
            >
              <option value="nigerian_used">
                Nigerian used (registered here)
              </option>
              <option value="foreign_used">
                Foreign used (not yet registered)
              </option>
            </select>
          </label>
          <label className="grid gap-2">
            <Label>Papers</Label>
            <select
              name="papers"
              defaultValue={v.papers ?? "all"}
              className={fieldClass}
            >
              {Object.entries(SELL_PAPERS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="grid gap-2">
          <Label>Price you have in mind, in naira (optional)</Label>
          <input
            name="price"
            inputMode="numeric"
            defaultValue={v.price}
            placeholder="6,500,000"
            className={`figures ${fieldClass}`}
          />
          <FieldError message={err.price} />
        </label>
      </fieldset>

      <div className="border-t border-border-subtle pt-8">
        <fieldset className="grid min-w-0 gap-4">
          <legend className="mb-5 text-[1.1rem] font-semibold text-text-primary">
            What would you like to do?
          </legend>
          <div
            role="radiogroup"
            aria-label="What would you like to do?"
            className="grid gap-2 sm:grid-cols-3"
          >
            {(Object.keys(SELL_INTENTS) as SellIntent[]).map((key) => (
              <button
                key={key}
                type="button"
                role="radio"
                aria-checked={intent === key}
                onClick={() => setIntent(key)}
                className={`min-h-12 rounded-xl border px-4 py-3 text-left text-sm font-semibold transition-colors ${
                  intent === key
                    ? "border-green-400 bg-green-500/15 text-green-100"
                    : "border-border-default text-text-secondary hover:border-border-strong"
                }`}
              >
                {SELL_INTENTS[key]}
              </button>
            ))}
          </div>
          {intent === "trade_in" && (
            <label className="grid gap-2">
              <Label>The car you would like in exchange (optional)</Label>
              <select
                name="tradeFor"
                defaultValue={v.tradeFor ?? ""}
                className={fieldClass}
              >
                <option value="">Not decided yet</option>
                {stock.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title} · {s.price}
                  </option>
                ))}
              </select>
            </label>
          )}
        </fieldset>
      </div>

      <div className="border-t border-border-subtle pt-8">
        <fieldset className="grid min-w-0 gap-6">
          <legend className="mb-5 text-[1.1rem] font-semibold text-text-primary">
            Where to reach you
          </legend>
          <div className="grid gap-6 sm:grid-cols-2">
            <label className="grid gap-2">
              <Label>Your name</Label>
              <input
                name="name"
                autoComplete="name"
                required
                defaultValue={v.name}
                className={fieldClass}
              />
              <FieldError message={err.name} />
            </label>
            <label className="grid gap-2">
              <Label>Phone number</Label>
              <input
                name="phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                required
                placeholder="0803 123 4567"
                defaultValue={v.phone}
                className={`figures ${fieldClass}`}
              />
              <FieldError message={err.phone} />
            </label>
          </div>
          <label className="grid gap-2">
            <Label>Email (optional)</Label>
            <input
              name="email"
              type="email"
              autoComplete="email"
              defaultValue={v.email}
              className={fieldClass}
            />
            <FieldError message={err.email} />
          </label>
          <div>
            <span className="text-sm font-medium text-text-secondary">
              Reply to me by
            </span>
            <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm text-text-secondary">
              {REPLY_BY.map(([value, label]) => (
                <label
                  key={value}
                  className="inline-flex min-h-11 items-center gap-3"
                >
                  <input
                    type="radio"
                    name="preferredContact"
                    value={value}
                    defaultChecked={
                      (v.preferredContact ?? "whatsapp") === value
                    }
                    className="size-4 accent-[var(--green-500)]"
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>
          <label className="grid gap-2">
            <Label>Anything else? (optional)</Label>
            <textarea
              name="notes"
              rows={3}
              defaultValue={v.notes}
              placeholder="Accidents, repairs, anything a buyer should know"
              className={`${fieldClass} py-3 leading-relaxed`}
            />
          </label>
        </fieldset>
      </div>

      <div>
        <Button
          type="submit"
          size="lg"
          disabled={pending}
          className="w-full sm:w-auto"
        >
          {pending ? "Sending…" : "Send my car’s details"}
        </Button>
        <p className="mt-4 text-xs text-text-muted">
          Your details are used only to reply about your car. <PrivacyLink />
        </p>
      </div>
    </form>
  );
}
