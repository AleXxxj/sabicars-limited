import type { Metadata } from "next";
import Link from "next/link";
import { VehicleForm } from "@/components/admin/VehicleForm";
import { can, requireStaff } from "@/lib/auth";
import { formOptions } from "@/lib/repositories/admin-vehicles";

export const metadata: Metadata = { title: "Add a vehicle · Admin", robots: { index: false, follow: false } };

export default async function NewVehicle() {
  const me = await requireStaff();
  const options = await formOptions(me.dealerId);
  return (
    <>
      <Link href="/admin/vehicles" className="text-sm text-text-muted hover:text-text-primary">
        ← Inventory
      </Link>
      <p className="eyebrow mt-6">New listing</p>
      <h1 className="mt-2 text-display-3">Add a vehicle</h1>
      <p className="mt-3 max-w-xl text-text-secondary">
        It starts as a draft — not on the website — until you set it to Available. Photos are added on the next screen.
      </p>
      <div className="mt-10 max-w-4xl">
        <VehicleForm options={options} canSetPrices={can.setPrices(me)} />
      </div>
    </>
  );
}
