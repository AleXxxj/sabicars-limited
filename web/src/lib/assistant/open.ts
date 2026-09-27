/**
 * Opens Ask Sabicars from anywhere on the site — a vehicle page, a comparison,
 * an answer on /ask — optionally with a question already asked, so a buyer
 * never has to retype what the page they were reading was about.
 */
export const ASK_EVENT = "sabicars:ask";

export interface AskRequest {
  prompt?: string;
}

export function openAssistant(prompt?: string) {
  window.dispatchEvent(new CustomEvent<AskRequest>(ASK_EVENT, { detail: { prompt } }));
}
