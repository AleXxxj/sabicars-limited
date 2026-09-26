/**
 * Where each page of the old static site lives now.
 *
 * Used by the importer (old notifications linked to car-detail.html?id=…) and,
 * at cutover, by the redirects that keep every shared and indexed link working.
 */

const PAGES: Record<string, string> = {
  "": "/",
  "index.html": "/",
  "cars.html": "/vehicles",
  "financing.html": "/drive-plan",
  "about.html": "/about",
  "contact.html": "/contact",
  "blog.html": "/blog",
};

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

  if (page === "car-detail.html") {
    const slug = vehicleSlug(url.searchParams.get("id") ?? "");
    return slug ? `/vehicles/${slug}` : "/vehicles";
  }
  if (page === "blog-post.html") {
    const slug = (url.searchParams.get("slug") ?? "").replace(/[^a-z0-9-]/gi, "");
    return slug ? `/blog/${slug}` : "/blog";
  }
  return PAGES[page] ?? null;
}
