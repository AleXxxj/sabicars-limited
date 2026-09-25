import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Every vehicle photo already lives on Cloudinary (uploaded by the legacy
    // admin). next/image resizes them per device, which on Nigerian mobile
    // networks is the difference between a page that loads and one that is
    // abandoned.
    remotePatterns: [{ protocol: "https", hostname: "res.cloudinary.com" }],
  },
};

export default nextConfig;
