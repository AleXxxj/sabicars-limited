/**
 * The page-wide word that an enquiry was saved. The enquiry card sends it with
 * the reference; the phone bar listens, and swaps its "Enquire" for the
 * reference, so the page stops asking for what it already has.
 */
export const ENQUIRED_EVENT = "sabicars:enquired";

export function announceEnquiry(reference: string): void {
  window.dispatchEvent(new CustomEvent(ENQUIRED_EVENT, { detail: { reference } }));
}
