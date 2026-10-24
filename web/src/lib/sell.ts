/** The choices on the "Sell your car" form (/sell), shared by the form and the server. */

export const SELL_INTENTS = {
  sell: "Sell it to Sabicars",
  trade_in: "Trade it in towards one of your cars",
  consign: "Have Sabicars sell it for me",
} as const;

export const SELL_PAPERS = {
  all: "Customs papers and registration, all in my name",
  some: "Some papers",
  none: "No papers yet",
} as const;

export type SellIntent = keyof typeof SELL_INTENTS;
