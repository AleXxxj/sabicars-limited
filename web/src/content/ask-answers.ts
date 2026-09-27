/**
 * The first answers on /ask — the questions buyers ask most, answered only
 * with what the site already states and the owner has confirmed. Staff add to
 * them from real conversations in the admin; `npm run ask:seed` puts these in
 * and never overwrites an answer staff have edited (unless run with --force).
 */
export const ASK_ANSWERS: { slug: string; question: string; answer: string }[] = [
  {
    slug: "how-does-the-40-percent-drive-plan-work",
    question: "How does the 40% Drive Plan work?",
    answer: `You pay 40% of the car’s price, and Autochek — Sabicars’ financing partner — finances the other 60%, which you repay to Autochek monthly.

1. Choose the car at the showroom, and inspect and test-drive it.
2. Apply on the car’s Autochek listing (the Drive Plan button on every car’s page).
3. Autochek profiles you and decides the approval.
4. Once Autochek approves and your 40% is paid, the car is yours to drive home.

As a deposit, your money reaches a car two and a half times its size: ₦10 million reaches a car priced up to ₦25 million. [How the Drive Plan works](/drive-plan).`,
  },
  {
    slug: "who-approves-drive-plan-finance-and-what-are-the-rates",
    question: "Who approves the finance, and what are the interest rate and term?",
    answer: `Autochek approves it. It profiles every applicant — typically proof of identity and income — and decides.

The rate and the repayment term are set by Autochek on each car’s listing, and you see them when you apply, before you commit to anything. Sabicars does not set them, so we won’t guess at a figure: ask Autochek how a bigger deposit or a longer term changes the monthly amount.`,
  },
  {
    slug: "when-can-i-take-the-car-home-on-the-drive-plan",
    question: "When can I take the car home on the Drive Plan?",
    answer: `Once Autochek has approved your finance **and** your 40% deposit is paid. Until both have happened, the car stays in the showroom.`,
  },
  {
    slug: "can-i-inspect-a-car-before-i-pay",
    question: "Can I inspect a car before I pay?",
    answer: `Yes — and you should. Every car can be inspected at the showroom before any money changes hands, and you are welcome to bring your own mechanic.

Our [20-minute inspection guide](/blog/5-things-to-check-before-buying-a-used-car-in-lagos) shows you what to check, including the six signs of a flood car.`,
  },
  {
    slug: "where-is-the-sabicars-showroom-and-when-is-it-open",
    question: "Where is the Sabicars showroom, and when is it open?",
    answer: `Amazing Grace Shopping Complex, Km 16, Alhaji Ede Bus Stop, Lasu Road, Igando, Lagos.

- Monday to Friday: 8am – 7pm
- Saturday and Sunday: 9am – 6pm

[Directions and contact details](/contact).`,
  },
  {
    slug: "can-sabicars-find-a-car-that-is-not-in-stock",
    question: "Can Sabicars find a car that isn’t in the showroom?",
    answer: `Yes. Tell the [Sourcing Desk](/find) the make, model, year and budget you want. Your request is recorded with a reference, and you are told the moment a matching car arrives.`,
  },
  {
    slug: "how-does-refer-and-earn-work",
    question: "How does Refer & Earn work?",
    answer: `Register free as a partner, share your personal link, and earn **1.5% of the price** when a buyer you sent completes a purchase — paid into a bank account in your own name once the sale is final. It is a commission on sales only; there is nothing to pay and no recruiting. [Become a partner](/partners).`,
  },
  {
    slug: "does-sabicars-supply-fleets-to-companies",
    question: "Does Sabicars supply fleets to companies and government?",
    answer: `Yes. Companies and government bodies buy in volume from Sabicars — sourced, documented and delivered as a single order, with one team accountable from quotation to handover. [Request a fleet quotation](/fleet).`,
  },
  {
    slug: "what-is-a-toyota-hiace-hummer-bus",
    question: "What is a Toyota Hiace “Hummer” bus?",
    answer: `It is the market’s name for the high-roof Toyota Hiace — the tall, square-shouldered bus Nigerian businesses use for staff, schools, churches, hire and tourism.

“Hummer 1”, “Hummer 2” and “Hummer 3” are market names for the same bus at different face-lifts, not Toyota’s names. The **chassis number** tells you the real year, and the year sets the price. Our [Hummer buyer’s guide](/blog/toyota-hiace-hummer-bus-buyers-guide) covers the rest, and the [buses in stock](/hummer-bus) are always live.`,
  },
  {
    slug: "are-sabicars-cars-foreign-used-or-nigerian-used",
    question: "Are your cars foreign used, Nigerian used or new?",
    answer: `All three are sold. Every listing states which it is, alongside its photographs, specification and price — and you can filter the [inventory](/vehicles) by condition.`,
  },
  {
    slug: "can-i-get-an-alert-if-a-car-price-drops",
    question: "Can I get an alert if a car’s price drops?",
    answer: `Yes. On any car’s page, choose “Not ready yet? Get an alert if the price drops” and leave your details. If the price comes down, you are told.`,
  },
  {
    slug: "is-sabicars-a-registered-company",
    question: "Is Sabicars a registered company?",
    answer: `Yes. Sabicars Limited is registered with the Corporate Affairs Commission, RC 1560100. Anyone can check it on the [CAC’s public search](https://search.cac.gov.ng).`,
  },
];
