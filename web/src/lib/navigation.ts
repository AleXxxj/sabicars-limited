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
  { href: "/partners", label: "Refer & Earn", hint: "Send a buyer. Earn 1.5% when they buy" },
] as const;

/**
 * Everything else, behind "More" on every width, in two groups. Nothing here
 * repeats a section the header or the tab bar already shows.
 */
export const MORE_NAV = [
  {
    group: "Buying and selling",
    items: [
      { href: "/sell", label: "Sell your car", hint: "Sell it to us, trade it in, or we sell it for you" },
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
] as const;

/** Every More item in one list, in order, for the footer and the tests. */
export const MORE_ITEMS = MORE_NAV.flatMap<{ readonly href: string; readonly label: string; readonly hint: string }>((g) => g.items);

/** The phone's bottom bar: the five things a visitor comes to do, one thumb away, named as above. */
export const TAB_BAR = [
  { href: "/", label: "Home" },
  { href: CARS_NAV.href, label: CARS_NAV.short },
  { href: MAIN_NAV[0].href, label: MAIN_NAV[0].short },
  { href: MAIN_NAV[1].href, label: MAIN_NAV[1].label },
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
