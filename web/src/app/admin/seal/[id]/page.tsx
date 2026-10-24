import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import QRCode from "qrcode";
import { db } from "@/db";
import { inspections, vehicles } from "@/db/schema";
import { PrintButton } from "@/components/admin/PrintButton";
import { requireStaff } from "@/lib/auth";
import { site, siteUrl } from "@/lib/site";
import { vehicleTitle } from "@/lib/vehicle";

export const metadata: Metadata = { title: "Windscreen seal · Admin", robots: { index: false, follow: false } };

type Props = { params: Promise<{ id: string }> };

/**
 * The windscreen seal for a car's live report, drawn at its printed size: the
 * seal, the car, the date, and a QR code that opens the report. Outside the
 * admin frame so it prints on its own. On paper the seal takes its deep tones.
 */
export default async function SealPage({ params }: Props) {
  const me = await requireStaff();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [row] = await db
    .select({ report: inspections, vehicle: vehicles })
    .from(inspections)
    .innerJoin(vehicles, eq(vehicles.id, inspections.vehicleId))
    .where(and(eq(inspections.id, id), eq(inspections.dealerId, me.dealerId), eq(inspections.status, "published")))
    .limit(1);
  // No seal for a car held away from the showroom, whatever report is on record.
  if (!row || !row.report.inspectedAt || row.vehicle.heldOffsite) notFound();

  const base = siteUrl();
  const url = `${base}/v/${row.report.code}`;
  const shortUrl = url.replace(/^https?:\/\/(www\.)?/, "");
  const qr = await QRCode.toString(url, { type: "svg", margin: 0, errorCorrectionLevel: "M", color: { dark: "#101511", light: "#FFFFFF" } });
  const preview = !/^https:\/\/(www\.)?sabicars\.com$/.test(base);
  const date = row.report.inspectedAt.toLocaleDateString("en-NG", { day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Lagos" });

  return (
    // The seal keeps its printed size; on a narrow phone the page scrolls sideways inside the white sheet instead of showing the dark ground.
    <div className="min-h-svh w-full overflow-x-auto bg-white px-5 py-10 text-[#101511] print:overflow-visible print:p-0">
      <div className="mx-auto max-w-xl print:hidden">
        <p className="text-sm font-semibold text-[#38580F]">Sabicars Verified · windscreen seal</p>
        <h1 className="mt-2 text-2xl">{vehicleTitle(row.vehicle)}</h1>
        <p className="mt-3 text-[0.95rem] leading-relaxed text-[#383F39]">
          Print at 100% (actual size). The seal is 90 × 130 mm. For the inside of the windscreen, ask the printer for a face-mounted
          sticker, so it reads correctly through the glass.
        </p>
        {preview && (
          <p role="alert" className="mt-4 border-l-4 border-[#B54F05] bg-[#FFF3E8] px-4 py-3 text-sm leading-relaxed">
            The code points to <strong>{shortUrl}</strong>, the preview address. Print seals after the switch to {site.domain}, so every
            sticker carries the permanent address.
          </p>
        )}
        <PrintButton />
      </div>

      <div
        className="mx-auto mt-10 flex flex-col items-center justify-between rounded-[6mm] border border-dashed border-[#9FA59E] bg-white text-center print:mt-0 print:border-[#CED3CB]"
        style={{ width: "90mm", height: "130mm", padding: "7mm 6mm" }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- the vector seal, printed at its size */}
        <img src="/brand/seal-on-light.svg" alt="Sabicars Verified seal" style={{ width: "34mm", height: "34mm" }} />
        <div>
          <p style={{ fontSize: "5.2mm", fontWeight: 800, letterSpacing: "-0.01em" }}>Sabicars Verified</p>
          <p style={{ fontSize: "3.4mm", marginTop: "1mm" }}>{vehicleTitle(row.vehicle)}</p>
          <p style={{ fontSize: "3mm", marginTop: "0.6mm", color: "#383F39" }}>Inspected {date}</p>
        </div>
        <div aria-label={`QR code for ${shortUrl}`} style={{ width: "32mm", height: "32mm" }} dangerouslySetInnerHTML={{ __html: qr }} />
        <div>
          <p style={{ fontSize: "3mm", color: "#383F39" }}>Scan for the full inspection report</p>
          <p className="figures" style={{ fontSize: "3.6mm", fontWeight: 700, marginTop: "0.6mm" }}>
            {shortUrl}
          </p>
          <p className="figures" style={{ fontSize: "2.6mm", marginTop: "0.6mm", color: "#586059" }}>
            Report SV-{row.report.code} · {site.legalName} · RC {site.rcNumber}
          </p>
        </div>
      </div>
    </div>
  );
}
