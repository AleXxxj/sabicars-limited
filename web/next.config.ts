import type { NextConfig } from "next";
import { legacyRedirects } from "./src/lib/legacy/urls";

const nextConfig: NextConfig = {
  images: {
    // Every vehicle photo lives on Cloudinary. next/image asks for one size
    // per screen, which on Nigerian mobile networks is the difference between
    // a page that loads and one that is abandoned.
    remotePatterns: [{ protocol: "https", hostname: "res.cloudinary.com" }],
    // A short list of sizes, on purpose. Every distinct size of every photo is
    // one resize billed (by Cloudinary today, by Vercel once
    // NEXT_PUBLIC_IMAGE_DELIVERY=vercel — see lib/media.ts), so the default
    // sixteen widths would multiply the cost of 10,000 photos for no visible
    // gain. These cover a phone (640/828), a laptop (1080) and a full-screen
    // gallery (1600, the largest any photo is kept at); thumbnails use the
    // small sizes.
    deviceSizes: [640, 828, 1080, 1600],
    imageSizes: [96, 256, 384],
    // One modern format: WebP is read by every browser Sabicars' buyers use,
    // and AVIF costs a second resize per size and is slow to encode.
    formats: ["image/webp"],
    qualities: [75],
    // Photo addresses carry Cloudinary's version number, so a stored photo
    // never changes under the same address: keep each resize for 31 days.
    minimumCacheTTL: 2_678_400,
  },
  // Every address of the old site that search engines and shared links know,
  // sent permanently to its new page (car and article ids are resolved by
  // route handlers: app/car-detail.html, app/blog-post.html).
  async redirects() {
    return legacyRedirects();
  },
  // Vercel's own address (sabicars.vercel.app) serves the same pages as
  // sabicars.com. It must keep working — link previews and the rehearsal use
  // it — but it must never compete with sabicars.com on Google.
  async headers() {
    return [{ source: "/:path*", has: [{ type: "host", value: "(?<sub>.+)\\.vercel\\.app" }], headers: [{ key: "X-Robots-Tag", value: "noindex" }] }];
  },
};

export default nextConfig;
