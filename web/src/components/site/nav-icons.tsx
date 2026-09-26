import { BadgeCheck, CarFront, HandCoins, Heart, House, MessageCircle, Search, Truck, Wallet, type LucideIcon } from "lucide-react";

/** One icon per destination, so the menu and the tab bar never disagree. */
export const NAV_ICON: Record<string, LucideIcon> = {
  "/": House,
  "/vehicles": CarFront,
  "/find": Search,
  "/#drive-plan": Wallet,
  "/drive-plan": Wallet,
  "/fleet": Truck,
  "/partners": HandCoins,
  "/about": BadgeCheck,
  "/contact": MessageCircle,
  "/saved": Heart,
};
