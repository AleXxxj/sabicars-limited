/**
 * Where each page of the old static site lives now.
 *
 * One list, used three ways: by next.config's redirects (every old address a
 * search engine or a shared link knows answers with a permanent redirect to
 * its closest new page — one hop, never a blanket redirect to the homepage),
 * by the importer (old notifications linked to car-detail.html?id=…), and by
 * the launch check, which proves every destination is a live page.
 *
 * GitHub Pages served each page both with and without ".html", so both forms
 * are covered.
 */

/** Old page → new page. Keys have no leading slash. */
export const LEGACY_PAGES: Record<string, string> = {
  "": "/",
  "index.html": "/",
  "cars.html": "/vehicles",
  "financing.html": "/drive-plan",
  "about.html": "/about",
  "contact.html": "/contact",
  "blog.html": "/blog",
  // The old site's own admin: staff sign in to the new one.
  "admin.html": "/admin/login",

  // Six articles published as standalone pages. Two repeat a topic a newer
  // article covers better, so their readers (and their ranking) go there;
  // the fleet piece was a sales page for fleet supply; three live on as
  // articles, rewritten.
  "blog/40-percent-plan-explained.html": "/blog/drive-now-pay-monthly-everything-you-need-to-know",
  "blog/toyota-hiace-nigeria.html": "/blog/toyota-hiace-hummer-bus-buyers-guide",
  "blog/why-businesses-choose-sabicars.html": "/fleet",
  "blog/highlander-vs-lexus-gx.html": "/blog/toyota-highlander-vs-lexus-gx-460",
  "blog/top-5-suvs-nigeria-2025.html": "/blog/best-suvs-for-nigerian-roads",
  "blog/buying-tokunbo-truck-nigeria.html": "/blog/buying-a-tokunbo-truck-in-nigeria",

  // Files the old pages, its app manifest and old notifications pointed at.
  "manifest.json": "/manifest.webmanifest",
  "images/icon-192.png": "/brand/icon-192.png",
  "images/icon-512.png": "/brand/icon-512.png",
  "images/apple-touch-icon.png": "/apple-icon.png",
  "images/favicon-96x96.png": "/icon.svg",
  "images/cchristian-founder.JPG": "/founder.jpg",
};

/** The same pages without ".html", as GitHub Pages also served them. New pages that share the name (/about, /contact, /blog) need no redirect. */
const EXTENSIONLESS: Record<string, string> = {
  index: "/",
  cars: "/vehicles",
  financing: "/drive-plan",
  admin: "/admin/login",
};

/** For next.config: every static old address, redirected permanently. */
export function legacyRedirects(): { source: string; destination: string; permanent: true }[] {
  const all = { ...LEGACY_PAGES, ...EXTENSIONLESS };
  return Object.entries(all)
    .filter(([from, to]) => from !== "" && `/${from}` !== to)
    .map(([from, to]) => ({ source: `/${from.replace(/([().])/g, "\\$1")}`, destination: to, permanent: true as const }));
}

/**
 * The new path for an old link, or null if it was not an old-site page.
 * `vehicleSlug` resolves a legacy car id to its new address; a car that no
 * longer exists sends the visitor to the inventory rather than a dead page.
 */
export function newPathFor(oldLink: string, vehicleSlug: (legacyId: string) => string | undefined): string | null {
  let url: URL;
  try {
    url = new URL(oldLink, "https://sabicars.com/");
  } catch {
    return null;
  }
  if (!/^(www\.)?sabicars\.com$/.test(url.hostname) && !/alexxxj\.github\.io$/.test(url.hostname)) return null;
  const page = url.pathname.replace(/^\/(sabicars-limited\/)?/, "");

  if (page === "car-detail.html" || page === "car-detail") {
    const slug = vehicleSlug(url.searchParams.get("id") ?? "");
    return slug ? `/vehicles/${slug}` : "/vehicles";
  }
  if (page === "blog-post.html" || page === "blog-post") {
    const slug = (url.searchParams.get("slug") ?? "").replace(/[^a-z0-9-]/gi, "").toLowerCase();
    return slug ? `/blog/${slug}` : "/blog";
  }
  return LEGACY_PAGES[page] ?? EXTENSIONLESS[page] ?? null;
}
