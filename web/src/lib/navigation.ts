/**
 * The public navigation, in one place so the header, the More menu, the tab
 * bar and the footer never disagree. Each section has one name, used on every
 * surface; the tab bar takes a short form only where the full name will not
 * fit a phone's tab, and the short form keeps the head word.
 */

/** The cars in stock: the header's orange button, the first tab after Home, the footer's column heading. */
export const CARS_NAV = { href: "/vehicles", label: "Cars for sale", short: "Cars", hint: "Everything in stock, with prices" } as const;

/** What a buyer comes for after the cars: the desktop header's links, and the rest of the phone's tab bar. */
export const MAIN_NAV = [
  { href: "/drive-plan", label: "40% Drive Plan", short: "Drive Plan", hint: "40% down on a car from 2010 or newer, the rest monthly if approved" },
  { href: "/find", label: "Request a car", hint: "Not in stock? We can look for it" },
  // "Earn", not "Refer & Earn": sending a buyer is the first way to earn, and more will join it here (the owner, 2026-11-06).
  { href: "/partners", label: "Earn", hint: "Send a buyer. Earn 1.5% when they buy" },
] as const;

/** The free VIN check: the phone's fourth tab, and under More on a wide screen (the owner, 14 November 2026: "let the down menu Request a car turn check vin"). */
export const CHECK_NAV = { href: "/check", label: "Check VIN", hint: "Free check: see what a car really is before you pay" } as const;

export type MoreItem = { readonly href: string; readonly label: string; readonly hint: string; /** Shown on one width only, because the other width already has it in its bar. */ readonly on?: "phone" | "wide" };

/**
 * Everything else, behind "More" on every width, in two groups. Nothing here
 * repeats a section the header or the tab bar already shows on that width:
 * a phone's tab bar has Check VIN and not Request a car, a wide screen's
 * header has Request a car and not Check VIN, so More carries the other one.
 */
export const MORE_NAV = [
  {
    group: "Buying and selling",
    items: [
      { ...MAIN_NAV[1], on: "phone" },
      { ...CHECK_NAV, on: "wide" },
      { href: "/sell", label: "Sell your car", hint: "Sell it to us, swap it, or we sell it for you" },
      { href: "/fleet", label: "Buy in bulk", hint: "2 or more vehicles for a company or government" },
      { href: "/compare", label: "Compare cars", hint: "Two or three cars side by side" },
      { href: "/saved", label: "My saved cars", hint: "Tap the heart on a car to keep it here" },
    ],
  },
  {
    group: "Help",
    items: [
      // "Help" is the word both testers looked for on another site; the page itself is the answers, and the assistant.
      { href: "/ask", label: "Help", hint: "Questions buyers ask, answered — or ask your own" },
      { href: "/blog", label: "Buying guides", hint: "Plain guides to buying and paying for a car" },
      { href: "/about", label: "About", hint: "Who we are, and the promises we keep" },
      { href: "/contact", label: "Contact", hint: "Visit, call or write, with a map" },
    ],
  },
] as const satisfies readonly { readonly group: string; readonly items: readonly MoreItem[] }[];

/** What More shows on one width, in order, for the tests. */
type AnyMoreItem = (typeof MORE_NAV)[number]["items"][number];
export const moreItemsOn = (width: "phone" | "wide"): AnyMoreItem[] => MORE_NAV.flatMap<AnyMoreItem>((g) => g.items).filter((i) => !("on" in i) || i.on === width);

/** Every section that is not in MAIN_NAV, in order, for the footer (which lists MAIN_NAV first). */
export const MORE_ITEMS = moreItemsOn("wide");

/** The phone's bottom bar: the five things a visitor comes to do, one thumb away, named as above. */
export const TAB_BAR = [
  { href: "/", label: "Home" },
  { href: CARS_NAV.href, label: CARS_NAV.short },
  { href: MAIN_NAV[0].href, label: MAIN_NAV[0].short },
  { href: CHECK_NAV.href, label: CHECK_NAV.label },
  { href: MAIN_NAV[2].href, label: MAIN_NAV[2].label },
] as const;

/** Ways into the cars for sale that match how buyers describe what they want. */
export const INVENTORY_SHORTCUTS = [
  { href: "/vehicles?body=car", label: "Saloon cars" },
  { href: "/vehicles?body=suv", label: "SUVs" },
  { href: "/hummer-bus", label: "Hummer buses" },
  { href: "/vehicles?body=bus", label: "All buses" },
  { href: "/vehicles?body=truck", label: "Trucks" },
  { href: "/vehicles?segment=luxury", label: "Luxury" },
] as const;
