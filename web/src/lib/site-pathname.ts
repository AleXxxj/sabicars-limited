import { usePathname } from "next/navigation";

/**
 * The page's address as the visitor sees it, for everything that compares against it: the tab bar's current tab, the
 * header's current section, the menu, the assistant's suggestions, the prompts. Use it instead of Next's usePathname().
 *
 * Next's own hook says "/index" for the homepage when Vercel draws the copy it keeps and remakes every few minutes:
 * Vercel asks for that copy by its file name, "index", and Next 16.3 draws it for that address. The homepage then went
 * out with no tab marked as the page you are on, and the phone kept those marks as sent when the page woke (live, 15
 * November 2026: Home was never green on the homepage). No page of the site lives at /index, so it is always "/".
 */
export function useSitePathname(): string {
  const pathname = usePathname();
  return pathname === "/index" ? "/" : pathname;
}
