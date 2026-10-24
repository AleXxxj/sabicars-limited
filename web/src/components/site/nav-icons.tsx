import { ArrowLeftRight, BadgeCheck, CarFront, ClipboardList, Columns2, HandCoins, Heart, House, MessageCircle, Newspaper, Sparkles, Truck, Wallet, type LucideIcon } from "lucide-react";

/**
 * One icon per destination, so the menu and the tab bar never disagree. A car
 * request is a clipboard, not a magnifier: phones have no other search, so a
 * magnifier read as one. Not a bell either — the header's bell is the news.
 */
export const NAV_ICON: Record<string, LucideIcon> = {
  "/": House,
  "/vehicles": CarFront,
  "/find": ClipboardList,
  "/#drive-plan": Wallet,
  "/drive-plan": Wallet,
  "/fleet": Truck,
  "/partners": HandCoins,
  "/blog": Newspaper,
  "/about": BadgeCheck,
  "/contact": MessageCircle,
  "/saved": Heart,
  "/sell": ArrowLeftRight,
  "/compare": Columns2,
  "/ask": Sparkles,
};
