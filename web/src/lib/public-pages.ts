import "server-only";
import { revalidatePath } from "next/cache";

/** Every public page that shows a vehicle, so a change to one appears everywhere it is shown. */
export function refreshPublicPages(slug: string) {
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
