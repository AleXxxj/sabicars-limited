"use client";

import { useEffect, useState, useTransition } from "react";
import { Heart } from "lucide-react";
import { loadSavedVehicles } from "@/lib/actions/saved";
import type { CardVehicle } from "@/lib/repositories/vehicles";
import { useSaved } from "@/lib/saved";
import { VehicleCard } from "@/components/VehicleCard";
import { ButtonLink } from "@/components/ui/Button";
import { WatchForm } from "./WatchForm";

/**
 * The shortlist. The slugs live on the device; the cars are fetched fresh, so
 * a price or status shown here is always today's — a car sold since it was
 * saved says so.
 */
export function SavedList() {
  const slugs = useSaved();
  const [cars, setCars] = useState<CardVehicle[] | null>(null);
  const [loading, start] = useTransition();
  const key = slugs.join(",");

  useEffect(() => {
    if (!key) return;
    start(async () => setCars(await loadSavedVehicles(key.split(","))));
  }, [key]);

  // Unsaving a car removes it at once, without waiting for a reload.
  const shown = (cars ?? []).filter((c) => slugs.includes(c.slug));
  const forSale = shown.filter((c) => c.status === "available" || c.status === "reserved");

  if (!slugs.length) {
    return (
      <div className="surface-card mx-auto max-w-xl p-8 text-center">
        <span className="mx-auto inline-flex size-14 items-center justify-center rounded-full border border-gold-500/25 bg-gold-500/10 text-gold-300">
          <Heart aria-hidden size={24} />
        </span>
        <p className="mt-5 text-lg font-semibold text-text-primary">No saved cars yet.</p>
        <p className="mt-2 text-text-secondary">Tap the heart on any car to keep it here, then ask to be told if its price drops.</p>
        <ButtonLink href="/vehicles" className="mt-6">
          Browse cars
        </ButtonLink>
      </div>
    );
  }

  if (!cars && loading) return <p className="text-text-muted">Loading your saved cars…</p>;

  return (
    <div className="grid gap-14">
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {shown.map((v) => (
          <VehicleCard key={v.id} vehicle={v} href={`/vehicles/${v.slug}`} />
        ))}
      </div>

      {forSale.length > 0 && (
        <section className="surface-card grid gap-8 p-6 md:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] md:p-10">
          <div>
            <p className="kicker">Price alerts</p>
            <h2 className="mt-4 text-display-3">Hear first if any of these gets cheaper.</h2>
            <p className="mt-4 text-text-secondary">
              Your saved cars live on this phone. Leave your number and Sabicars will tell you the moment the price of{" "}
              {forSale.length === 1 ? "this car" : `any of these ${forSale.length} cars`} drops.
            </p>
          </div>
          <WatchForm slugs={forSale.map((c) => c.slug)} landingPath="/saved" />
        </section>
      )}
    </div>
  );
}
