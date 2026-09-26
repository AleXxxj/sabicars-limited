import type { Vehicle, VehicleMedia } from "@/db/schema";
import { site, siteUrl } from "@/lib/site";

/**
 * schema.org data that tells search engines a page is a specific car, for sale,
 * at a price, from a registered dealer — not just a page of text. Only facts
 * that are recorded are included; an invented field is worse than a missing one.
 */

const DRIVE: Record<NonNullable<Vehicle["drivetrain"]>, string> = {
  fwd: "https://schema.org/FrontWheelDriveConfiguration",
  rwd: "https://schema.org/RearWheelDriveConfiguration",
  awd: "https://schema.org/AllWheelDriveConfiguration",
  "4wd": "https://schema.org/FourWheelDriveConfiguration",
};

const AVAILABILITY: Record<Vehicle["status"], string> = {
  available: "https://schema.org/InStock",
  reserved: "https://schema.org/LimitedAvailability",
  sold: "https://schema.org/SoldOut",
  draft: "https://schema.org/Discontinued",
  unlisted: "https://schema.org/Discontinued",
};

export function dealerJsonLd() {
  return {
    "@type": "AutoDealer",
    "@id": `${siteUrl()}/#dealer`,
    name: site.legalName,
    url: siteUrl(),
    telephone: site.phones[0].e164,
    email: site.email,
    address: {
      "@type": "PostalAddress",
      streetAddress: `${site.address.line1}, ${site.address.line2}`,
      addressLocality: site.address.city,
      addressRegion: "Lagos",
      postalCode: site.address.postcode,
      addressCountry: site.address.country,
    },
    openingHours: site.hours.map((h) => h.schema),
    hasMap: site.mapsUrl,
    sameAs: [site.social.instagram],
    logo: `${siteUrl()}/brand/icon-512.png`,
    image: `${siteUrl()}/opengraph-image.png`,
    priceRange: "₦₦₦",
  };
}

export function vehicleJsonLd(v: Vehicle, media: VehicleMedia[], url: string) {
  const photos = media.filter((m) => m.kind === "photo").map((m) => m.url);
  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    // A Car is a Product in schema.org; naming both makes the listing eligible
    // for product results (price and availability shown in Google) as well as
    // being read as a vehicle.
    "@type": ["Product", "Car"],
    name: `${v.year} ${v.make} ${v.model}`,
    url,
    sku: v.slug,
    brand: { "@type": "Brand", name: v.make },
    model: v.model,
    vehicleModelDate: String(v.year),
    itemCondition: v.condition === "brand_new" ? "https://schema.org/NewCondition" : "https://schema.org/UsedCondition",
    ...(photos.length && { image: photos }),
    ...(v.description && { description: v.description }),
    ...(v.body && { bodyType: v.body }),
    ...(v.mileageKm && { mileageFromOdometer: { "@type": "QuantitativeValue", value: v.mileageKm, unitCode: "KMT" } }),
    ...(v.fuel && { fuelType: v.fuel }),
    ...(v.transmission && { vehicleTransmission: v.transmission }),
    ...(v.drivetrain && { driveWheelConfiguration: DRIVE[v.drivetrain] }),
    ...(v.seats && { seatingCapacity: v.seats }),
    ...(v.exteriorColour && { color: v.exteriorColour }),
    ...(v.interiorColour && { vehicleInteriorColor: v.interiorColour }),
    ...(v.engine && { vehicleEngine: { "@type": "EngineSpecification", name: v.engine } }),
  };

  // An offer only when there is a price to state; "price on request" is not ₦0.
  if (v.priceMinor) {
    data.offers = {
      "@type": "Offer",
      price: (v.priceMinor / 100).toFixed(0),
      priceCurrency: "NGN",
      availability: AVAILABILITY[v.status],
      itemCondition: data.itemCondition,
      url,
      seller: dealerJsonLd(),
    };
  }
  return data;
}

/** The trail search engines show above a result: Home › Toyota › Highlander › this car. */
export function breadcrumbJsonLd(trail: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: trail.map((t, i) => ({ "@type": "ListItem", position: i + 1, name: t.name, item: `${siteUrl()}${t.path}` })),
  };
}

/** A page of vehicles, as a list search engines can read car by car. */
export function itemListJsonLd(name: string, items: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name,
    numberOfItems: items.length,
    itemListElement: items.map((it, i) => ({ "@type": "ListItem", position: i + 1, name: it.name, url: `${siteUrl()}${it.path}` })),
  };
}

/**
 * JSON.stringify does not escape "<", so a description containing
 * "</script>" could break out of the tag. Escaping it closes that hole.
 */
/** An article, for Google's article and Discover results. */
export function articleJsonLd(a: {
  title: string;
  description: string;
  path: string;
  image: string | null;
  author: string;
  publishedAt: Date;
  updatedAt: Date;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: a.title,
    description: a.description,
    url: `${siteUrl()}${a.path}`,
    mainEntityOfPage: `${siteUrl()}${a.path}`,
    image: a.image ? [a.image] : undefined,
    datePublished: a.publishedAt.toISOString(),
    dateModified: a.updatedAt.toISOString(),
    author: { "@type": "Organization", name: a.author, url: siteUrl() },
    publisher: { "@id": `${siteUrl()}/#dealer` },
  };
}

/** Questions and answers from an article's FAQ block. */
export function faqJsonLd(items: { q: string; a: string }[]) {
  const plain = (s: string) => s.replace(/\*\*|\*/g, "").replace(/\[([^\]]+)\]\([^)]*\)/g, "$1");
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((i) => ({ "@type": "Question", name: i.q, acceptedAnswer: { "@type": "Answer", text: plain(i.a) } })),
  };
}

export function jsonLdScript(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
