import type { NextConfig } from "next";
import { legacyRedirects } from "./src/lib/legacy/urls";

const nextConfig: NextConfig = {
  images: {
    // Every vehicle photo already lives on Cloudinary (uploaded by the legacy
    // admin). next/image resizes them per device, which on Nigerian mobile
    // networks is the difference between a page that loads and one that is
    // abandoned.
    remotePatterns: [{ protocol: "https", hostname: "res.cloudinary.com" }],
  },
  // Every address of the old site that search engines and shared links know,
  // sent permanently to its new page (car and article ids are resolved by
  // route handlers: app/car-detail.html, app/blog-post.html).
  async redirects() {
    return legacyRedirects();
  },
};

export default nextConfig;
