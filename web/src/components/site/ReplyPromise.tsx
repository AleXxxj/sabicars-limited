import { Clock } from "lucide-react";
import { sabicarsDealerId } from "@/lib/leads";
import { replyPromise } from "@/lib/repositories/leads";

/**
 * "Most messages get a reply within N minutes in opening hours." Shown only
 * while the last 30 days earn it (lib/showroom-hours.ts, replyPromiseFrom);
 * otherwise nothing, so the page never promises what the record cannot show.
 * The thing a tester missed most on a marketplace was a reply at all.
 */
export async function ReplyPromise({ className = "" }: { className?: string }) {
  const promise = await replyPromise(await sabicarsDealerId()).catch(() => null);
  if (!promise) return null;
  return (
    <p className={`inline-flex items-center gap-2 text-sm text-text-secondary ${className}`}>
      <Clock aria-hidden size={16} className="shrink-0 text-green-300" />
      <span>
        Most messages get a reply within <span className="figures font-semibold text-text-primary">{promise.minutes} minutes</span> in opening
        hours — measured on the last {promise.answered} enquiries.
      </span>
    </p>
  );
}
