import { site } from "@/lib/site";

/**
 * The showroom address, written one way everywhere. The legacy site printed it
 * differently on different pages (Km 13 here, Km 16 there), which is how a
 * customer ends up at the wrong bus stop.
 */
export function Address({ className }: { className?: string }) {
  return (
    <address className={`not-italic leading-relaxed ${className ?? ""}`}>
      {site.address.line1}
      <br />
      {site.address.line2}
      <br />
      {site.address.city} {site.address.postcode}
    </address>
  );
}
