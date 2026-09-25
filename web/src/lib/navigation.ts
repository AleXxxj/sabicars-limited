/** The public navigation, in one place so the header, mobile menu and footer never disagree. */
export const PRIMARY_NAV = [
  { href: "/vehicles", label: "Inventory" },
  { href: "/drive-plan", label: "40% Drive Plan" },
  { href: "/fleet", label: "Fleet & Government" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
] as const;

/** Ways into the inventory that match how buyers describe what they want. */
export const INVENTORY_SHORTCUTS = [
  { href: "/vehicles?segment=luxury", label: "Luxury" },
  { href: "/vehicles?body=suv", label: "SUVs" },
  { href: "/vehicles?body=bus", label: "Buses & Hiace" },
  { href: "/vehicles?body=truck", label: "Trucks" },
  { href: "/vehicles?body=sedan", label: "Sedans" },
] as const;
