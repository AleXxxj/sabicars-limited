/** SC- plus the first six characters of the lead id: short enough to read down a phone. */
export function referenceFor(leadId: string): string {
  return `SC-${leadId.replace(/-/g, "").slice(0, 6).toUpperCase()}`;
}
