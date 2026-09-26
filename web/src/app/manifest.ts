import type { MetadataRoute } from "next";

/** Lets a phone add Sabicars to its home screen with the proper icon, name and colours. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Sabicars",
    short_name: "Sabicars",
    description: "Toyota Hiace Hummer buses, verified luxury cars, SUVs and trucks from Lagos — with the 40% Drive Plan.",
    start_url: "/",
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
