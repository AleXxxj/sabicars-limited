import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

/** Lets a phone add Sabicars to its home screen with the proper icon, name and colours. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Sabicars",
    short_name: "Sabicars",
    description: "Toyota Hiace Hummer buses, verified luxury cars, SUVs and trucks from Lagos — with the 40% Drive Plan.",
    id: "/",
    start_url: "/",
    // Lets Chrome tell the site when it is already installed, so it never offers to install it again.
    related_applications: [{ platform: "webapp", url: `${siteUrl()}/manifest.webmanifest` }],
    prefer_related_applications: false,
    display: "standalone",
    background_color: "#0A0908",
    theme_color: "#0A0908",
    icons: [
      { src: "/brand/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/brand/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/brand/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
