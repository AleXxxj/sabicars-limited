import type { Lead } from "@/db/schema";

/** What each kind of lead is called in the inbox and in alerts — the buyer's intent, in plain words. */
export const LEAD_TYPE_LABEL: Record<Lead["type"], string> = {
  question: "Question",
  viewing: "Viewing request",
  reservation: "Reservation",
  drive_plan: "Drive Plan",
  fleet: "Fleet quotation",
  contact: "Message",
  sourcing: "Find-me-a-car request",
  watch: "Price watch",
};

export const LEAD_STATUS_LABEL: Record<Lead["status"], string> = {
  new: "New",
  contacted: "Contacted",
  qualified: "Serious buyer",
  won: "Bought",
  lost: "Lost",
};

/** How staff reached a buyer, as the activity log records it. */
export const CONTACT_METHODS = { call: "Called", whatsapp: "Opened WhatsApp", email: "Emailed", other: "Replied another way" } as const;

/** Why a lead was lost — a short list, so the reasons can be counted. */
export const LOST_REASONS = [
  "Bought elsewhere",
  "Budget too low",
  "Could not reach them",
  "Just browsing",
  "Car no longer available",
  "Spam or a test",
] as const;

/** Leads that need a person now. A price watch waits quietly for a price cut. */
export const ALERTING_TYPES: Lead["type"][] = ["question", "viewing", "reservation", "drive_plan", "fleet", "contact", "sourcing"];

/** How long a new lead may wait, during opening hours, before managers are told. */
export const RESPONSE_TARGET_MINUTES = 15;
