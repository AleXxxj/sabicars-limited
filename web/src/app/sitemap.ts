import type { MetadataRoute } from "next";
import { listedVehicleSlugs } from "@/lib/repositories/vehicles";
import { INVENTORY_SHORTCUTS } from "@/lib/navigation";
import { siteUrl } from "@/lib/site";

/**
 * Every page worth finding, including every vehicle — the legacy sitemap
 * listed six pages and no cars at all. Rebuilt hourly so a newly listed
 * vehicle reaches search engines without a redeploy.
 *
 * Pages are added here as they are built; a sitemap entry that 404s costs
 * crawl trust.
 */
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const vehicles = await listedVehicleSlugs();
  const newest = vehicles.reduce((d, v) => (v.updatedAt > d ? v.updatedAt : d), new Date(0));

  return [
    { url: `${base}/`, lastModified: newest, changeFrequency: "daily", priority: 1 },
    { url: `${base}/vehicles`, lastModified: newest, changeFrequency: "daily", priority: 1 },
    ...INVENTORY_SHORTCUTS.map((s) => ({ url: `${base}${s.href}`, lastModified: newest, changeFrequency: "daily" as const, priority: 0.8 })),
    ...vehicles.map((v) => ({
      url: `${base}/vehicles/${v.slug}`,
      lastModified: v.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
  ];
}
