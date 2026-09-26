import type { Metadata } from "next";

/**
 * The staff side installs as its own app — "Sabicars Staff" — opening on the
 * inbox. On an iPhone, that home-screen app is also what makes phone alerts
 * possible at all: iOS only delivers web push to installed apps.
 */
export const metadata: Metadata = {
  manifest: "/staff.webmanifest",
  appleWebApp: { capable: true, title: "Sabicars Staff", statusBarStyle: "black-translucent" },
  robots: { index: false, follow: false },
};

export default function AdminRoot({ children }: { children: React.ReactNode }) {
  return children;
}
