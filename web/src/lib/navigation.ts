/** The public navigation, in one place so the header, mobile menu and footer never disagree. */
export const PRIMARY_NAV = [
  { href: "/vehicles", label: "Inventory", hint: "Every vehicle in stock, with prices" },
  { href: "/find", label: "Find a car", hint: "Tell us what you want — hear when it arrives" },
  { href: "/drive-plan", label: "40% Drive Plan", hint: "Pay 40% — Autochek finances the rest" },
  { href: "/fleet", label: "Fleet", hint: "Volume supply for companies and government" },
  { href: "/partners", label: "Refer & Earn", hint: "Earn 1.5% on every buyer you send" },
  { href: "/about", label: "About", hint: "The story, and the standards we keep" },
  { href: "/contact", label: "Contact", hint: "Visit, call or write — with a map" },
] as const;

/** The phone's bottom bar: the five things a visitor comes to do, one thumb away. */
export const TAB_BAR = [
  { href: "/", label: "Home" },
  { href: "/vehicles", label: "Cars" },
  { href: "/drive-plan", label: "Drive Plan" },
  { href: "/find", label: "Find a car" },
  { href: "/partners", label: "Earn" },
] as const;

/** Ways into the inventory that match how buyers describe what they want. */
export const INVENTORY_SHORTCUTS = [
  { href: "/vehicles?segment=luxury", label: "Luxury" },
  { href: "/vehicles?body=suv", label: "SUVs" },
  { href: "/vehicles?body=bus", label: "Buses & Hiace" },
  { href: "/vehicles?body=truck", label: "Trucks" },
  { href: "/vehicles?body=sedan", label: "Sedans" },
] as const;
