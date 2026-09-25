import type { StaffMember } from "@/lib/auth";

/**
 * The admin's sections and who can reach them.
 *
 * This decides what the navigation shows; it is not the security boundary.
 * Every page and every server action checks the staff member itself, so a
 * hidden link never has to be load-bearing. Sections appear here only once
 * they exist — a menu of "coming soon" entries is noise.
 */
const SECTIONS: { href: string; label: string; roles: StaffMember["role"][] }[] = [
  { href: "/admin/vehicles", label: "Inventory", roles: ["owner", "manager", "sales"] },
  { href: "/admin/consignors", label: "Consignors", roles: ["owner", "manager"] },
];

export function adminNavFor(role: StaffMember["role"]) {
  return SECTIONS.filter((s) => s.roles.includes(role));
}

export const ROLE_LABEL: Record<StaffMember["role"], string> = { owner: "Owner", manager: "Manager", sales: "Sales" };
