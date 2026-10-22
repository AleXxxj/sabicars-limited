import "server-only";
import { revalidatePath, revalidateTag } from "next/cache";
import { TAGS } from "@/lib/cache-tags";

/**
 * Every public page that shows a vehicle, so a change to one appears everywhere it is shown.
 * `stock: false` for a change that cannot alter which makes and models are on sale (a photo, an
 * inspection), so the footer every page carries is left alone.
 */
export function refreshPublicPages(slug: string, { stock = true }: { stock?: boolean } = {}) {
  // The inventory, its filters, recently sold and the trade-in list are read from the data cache
  // (lib/repositories/vehicles.ts): expire them now, so the pages below rebuild from fresh stock.
  revalidateTag(TAGS.inventory, { expire: 0 });
  if (stock) revalidateTag(TAGS.terms, { expire: 0 });
  revalidatePath("/");
  revalidatePath(`/vehicles/${slug}`);
  revalidatePath("/vehicles");
  revalidatePath("/about"); // live stock count
  revalidatePath("/fleet"); // cover photo comes from the bus stock
  revalidatePath("/partners"); // commission examples use real prices
  revalidatePath("/drive-plan"); // the finder and the worked example use live stock
  revalidatePath("/hummer-bus");
  revalidatePath("/buy/[term]", "page"); // every make and model landing page
  revalidatePath("/sitemap.xml");
  revalidatePath("/admin/vehicles");
}
