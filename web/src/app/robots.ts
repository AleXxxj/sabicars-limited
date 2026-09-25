import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

/**
 * Crawlers may go everywhere public. The admin is excluded as a courtesy, not
 * as protection — every admin route is guarded by requireStaff() — so naming
 * it here reveals nothing that is not already locked.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/style"] },
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
