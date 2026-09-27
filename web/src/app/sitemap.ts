import type { MetadataRoute } from "next";
import { INVENTORY_SHORTCUTS } from "@/lib/navigation";
import { comparisonPairs } from "@/lib/compare";
import { publishedAnswers } from "@/lib/repositories/ask";
import { publishedPosts } from "@/lib/repositories/blog";
import { searchTerms, sitemapVehicles } from "@/lib/repositories/vehicles";
import { termHref } from "@/lib/seo/search-terms";
import { siteUrl } from "@/lib/site";

/**
 * Every page worth finding, and every photograph on them.
 *
 * - Each vehicle, with all its photos listed, so Google Images indexes the
 *   whole stock — each image tied to a page titled "… for sale in Lagos".
 * - A page per make and model family with stock ("Toyota Highlander for sale
 *   in Lagos"), generated from the inventory itself.
 *
 * Rebuilt hourly (and whenever staff change a vehicle), so a car listed this
 * morning reaches search engines without a redeploy. A sitemap entry that
 * 404s costs crawl trust, so sold-out families are left out.
 */
export const revalidate = 3600;

/** Large, colour-corrected JPEGs: what a search engine's image index should hold. */
const indexImage = (url: string) => (url.includes("/upload/") ? url.replace("/upload/", "/upload/e_improve,f_jpg,q_auto,c_limit,w_1600/") : url);

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const [vehicles, terms, posts, answers, pairs] = await Promise.all([sitemapVehicles(), searchTerms(), publishedPosts(), publishedAnswers(), comparisonPairs()]);
  const newest = vehicles.reduce((d, v) => (v.updatedAt > d ? v.updatedAt : d), new Date(0));

  return [
    { url: `${base}/`, lastModified: newest, changeFrequency: "daily", priority: 1 },
    { url: `${base}/vehicles`, lastModified: newest, changeFrequency: "daily", priority: 1 },
    { url: `${base}/hummer-bus`, lastModified: newest, changeFrequency: "daily", priority: 0.9 },
    ...["/drive-plan", "/find", "/partners", "/fleet", "/about", "/contact"].map((path) => ({ url: `${base}${path}`, changeFrequency: "monthly" as const, priority: 0.6 })),
    ...INVENTORY_SHORTCUTS.filter((s) => s.href !== "/hummer-bus").map((s) => ({ url: `${base}${s.href}`, lastModified: newest, changeFrequency: "daily" as const, priority: 0.8 })),
    ...terms
      .filter((t) => t.inStock > 0 && termHref(t.slug).startsWith("/buy/"))
      .map((t) => ({ url: `${base}${termHref(t.slug)}`, lastModified: newest, changeFrequency: "daily" as const, priority: t.family ? 0.8 : 0.7 })),
    { url: `${base}/blog`, lastModified: posts[0]?.publishedAt, changeFrequency: "weekly" as const, priority: 0.7 },
    ...posts.map((p) => ({
      url: `${base}/blog/${p.slug}`,
      lastModified: p.publishedAt,
      changeFrequency: "monthly" as const,
      priority: p.isFeatured ? 0.8 : 0.6,
      images: p.coverImageUrl ? [indexImage(p.coverImageUrl)] : undefined,
    })),
    { url: `${base}/ask`, lastModified: answers.reduce((d, a) => (a.updatedAt > d ? a.updatedAt : d), new Date(0)), changeFrequency: "weekly" as const, priority: 0.7 },
    ...answers.map((a) => ({ url: `${base}/ask/${a.slug}`, lastModified: a.updatedAt, changeFrequency: "monthly" as const, priority: 0.6 })),
    { url: `${base}/compare`, lastModified: newest, changeFrequency: "daily" as const, priority: 0.6 },
    ...pairs.map((p) => ({ url: `${base}${p.path}`, lastModified: newest, changeFrequency: "weekly" as const, priority: 0.5 })),
    ...vehicles.map((v) => ({
      url: `${base}/vehicles/${v.slug}`,
      lastModified: v.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.7,
      images: v.photos.map(indexImage),
    })),
  ];
}
