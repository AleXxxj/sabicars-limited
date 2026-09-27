"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRight, Plus, X } from "lucide-react";
import { fieldClass } from "@/components/forms/field";
import { comparePath } from "@/lib/assistant/parts";

export interface PickerCar {
  slug: string;
  title: string;
  price: string;
  body: string;
}

/** Any two or three cars in the showroom, side by side. */
export function ComparePicker({ cars }: { cars: PickerCar[] }) {
  const router = useRouter();
  const [picked, setPicked] = useState<string[]>(["", ""]);
  const groups = [...new Set(cars.map((c) => c.body))];
  const chosen = picked.filter(Boolean);
  const ready = chosen.length >= 2 && new Set(chosen).size === chosen.length;

  return (
    <form
      className="surface-card grid gap-4 p-5 md:p-8"
      onSubmit={(e) => {
        e.preventDefault();
        if (ready) router.push(comparePath(chosen));
      }}
    >
      {picked.map((value, i) => (
        <div key={i} className="flex items-center gap-2">
          <label className="grid flex-1 gap-1.5">
            <span className="text-sm font-medium text-text-secondary">{["First car", "Second car", "Third car"][i]}</span>
            <select
              className={`${fieldClass} appearance-none`}
              value={value}
              onChange={(e) => setPicked((p) => p.map((v, j) => (j === i ? e.target.value : v)))}
            >
              <option value="">Choose a car…</option>
              {groups.map((g) => (
                <optgroup key={g} label={g}>
                  {cars
                    .filter((c) => c.body === g)
                    .map((c) => (
                      <option key={c.slug} value={c.slug} disabled={picked.includes(c.slug) && value !== c.slug}>
                        {c.title} — {c.price}
                      </option>
                    ))}
                </optgroup>
              ))}
            </select>
          </label>
          {i === 2 && (
            <button
              type="button"
              onClick={() => setPicked((p) => p.slice(0, 2))}
              aria-label="Remove the third car"
              className="mt-7 inline-flex size-11 items-center justify-center rounded-full text-text-muted hover:bg-white/[0.06] hover:text-text-primary"
            >
              <X aria-hidden size={18} />
            </button>
          )}
        </div>
      ))}
      <div className="flex flex-wrap items-center gap-4">
        <button
          type="submit"
          disabled={!ready}
          className="inline-flex min-h-12 items-center gap-2 rounded-full bg-[linear-gradient(180deg,var(--gold-300),var(--gold-500))] px-6 font-semibold text-[#0A0908] disabled:opacity-40"
        >
          Compare side by side <ArrowRight aria-hidden size={17} />
        </button>
        {picked.length < 3 && (
          <button
            type="button"
            onClick={() => setPicked((p) => [...p, ""])}
            className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-gold-300 hover:text-gold-200"
          >
            <Plus aria-hidden size={16} /> Add a third car
          </button>
        )}
      </div>
    </form>
  );
}
