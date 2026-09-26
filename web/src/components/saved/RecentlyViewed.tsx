"use client";

import { useEffect, useState } from "react";
import { VehicleCard } from "@/components/VehicleCard";
import { loadSavedVehicles } from "@/lib/actions/saved";
import { deviceList } from "@/lib/device-list";
import type { CardVehicle } from "@/lib/repositories/vehicles";

const viewed = deviceList("sabicars-viewed", 12);

/** Put on a vehicle's page: remembers the visit, on this device only. */
export function RecordView({ slug }: { slug: string }) {
  useEffect(() => {
    viewed.write([slug, ...viewed.read().filter((s) => s !== slug)]);
  }, [slug]);
  return null;
}

/**
 * The cars this visitor looked at recently, still for sale — the way back to
 * the one they were thinking about. Fetched fresh, so prices are today's.
 * Shows nothing until there is something to show.
 */
export function RecentlyViewed({ exclude, className = "" }: { exclude?: string; className?: string }) {
  const slugs = viewed.useList().filter((s) => s !== exclude);
  const key = slugs.slice(0, 8).join(",");
  const [cars, setCars] = useState<CardVehicle[]>([]);

  useEffect(() => {
    if (!key) return;
    let live = true;
    loadSavedVehicles(key.split(",")).then((found) => {
      if (!live) return;
      const order = key.split(",");
      setCars(
        found
          .filter((c) => c.status === "available" || c.status === "reserved")
          .sort((a, b) => order.indexOf(a.slug) - order.indexOf(b.slug)),
      );
    });
    return () => {
      live = false;
    };
  }, [key]);

  const shown = key ? cars.filter((c) => c.slug !== exclude) : [];
  if (!shown.length) return null;
  return (
    <section aria-labelledby="recently-viewed" className={className}>
      <p id="recently-viewed" className="kicker">
        Recently viewed
      </p>
      <div className="-mx-5 mt-6 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-px-5 px-5 pb-4 [scrollbar-width:none] md:mx-0 md:px-0 [&::-webkit-scrollbar]:hidden">
        {shown.map((v) => (
          <div key={v.id} className="w-[78%] shrink-0 snap-start sm:w-[45%] lg:w-[31%]">
            <VehicleCard vehicle={v} href={`/vehicles/${v.slug}`} />
          </div>
        ))}
      </div>
    </section>
  );
}
