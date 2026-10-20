import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { Inspection } from "@/db/schema";
import { isFresh, type Tally } from "@/lib/inspection/checklist";

/**
 * The car's Sabicars Verified report, summarised beside its price: when it was
 * inspected, how many checks were good, and how many findings the report
 * shows with photos. A car without a report shows nothing here, never a claim.
 */
export function VerifiedPanel({ report, tally: t }: { report: Inspection; tally: Tally }) {
  const at = report.inspectedAt!;
  const fresh = isFresh(at);
  const findings = t.attention + t.fail;
  const date = at.toLocaleDateString("en-NG", { day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Lagos" });
  return (
    <Link
      href={`/v/${report.code}`}
      className="surface-card group mt-6 flex items-center gap-4 !rounded-2xl p-4 hover:border-green-500/30"
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- the vector seal */}
      <img src="/brand/seal.svg" alt="" width={56} height={56} className="size-14 shrink-0" />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-text-primary">
          Sabicars Verified{fresh ? "" : " · report older than four months"}
        </span>
        <span className="figures mt-0.5 block text-sm text-text-secondary">
          Inspected {date} · {t.pass} of {t.total} checks good
          {findings ? ` · ${findings} finding${findings === 1 ? "" : "s"}, with photos` : ""}
        </span>
        <span className="mt-1 inline-flex items-center gap-1.5 text-sm font-semibold text-green-300">
          Read the inspection report <ArrowRight aria-hidden size={15} className="transition-transform group-hover:translate-x-1" />
        </span>
      </span>
    </Link>
  );
}
