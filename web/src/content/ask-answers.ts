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
    answer: `You pay a deposit — 40% of the car’s price on a car from 2010, or 50% on a 2008 or 2009 car — and Autochek, Sabicars’ financing partner, finances the rest, which you repay to Autochek monthly. Autochek’s lenders do not finance cars older than 2008, so you pay for those in full.

1. Choose the car at the showroom, and inspect and test-drive it.
2. Apply on the car’s Autochek listing (the Drive Plan button on every car’s page).
3. Autochek’s lender assesses you, decides the approval, and sets the rate and term in your offer.
4. Once the lender approves and your deposit is paid, the car is yours to drive home.

As a deposit, your money reaches a car up to two and a half times its size: ₦10 million reaches a car priced up to ₦25 million from 2010, or ₦20 million from 2008 or 2009. You can put down more than the minimum, up to 70% of the price. Every car’s page shows an estimated monthly repayment at Autochek’s published ceiling over the term you pick. [How the Drive Plan works](/drive-plan).`,
  },
  {
    slug: "who-approves-drive-plan-finance-and-what-are-the-rates",
    question: "Who approves the finance, and what are the interest rate and term?",
    answer: `Autochek’s lending partners, through Autochek — Sabicars’ financing partner. The lender assesses every applicant and decides. It asks for your BVN and a valid ID; bank statements for the last six months from the account you actually use — a commercial bank, or a bank app such as OPay — showing money coming in and going out; proof of income; and a utility bill. Sabicars does not lend. The bank-app alternative is as Autochek’s team told Sabicars on 20 October 2026.

The lender sets the rate and the repayment term when it assesses you, and you see them in your offer before you commit to anything. Autochek publishes a ceiling of 30% a year over 6 to 48 months; on its listings the rate is “available on request”. Autochek’s own example: ₦1,000,000 over 12 months at 30% a year is about ₦97,487 a month. Each car’s page shows an estimated monthly repayment at that ceiling over the term you pick, so you can plan; your offer can be lower. Ask Autochek how a bigger deposit or a longer term changes the monthly amount.`,
  },
  {
    slug: "when-can-i-take-the-car-home-on-the-drive-plan",
    question: "When can I take the car home on the Drive Plan?",
    answer: `Once Autochek’s lender has approved your finance **and** your deposit is paid. Until both have happened, the car stays in the showroom.`,
  },
  {
    slug: "why-is-the-drive-plan-deposit-50-percent-on-some-cars",
    question: "Why is the deposit 50% on some cars?",
    answer: `The deposit depends on the car’s model year. Autochek’s lenders ask for 40% on a car from 2010 and 50% on a 2008 or 2009 car, and they do not finance cars older than 2008 — you pay for those in full. This is the rule Autochek’s team gave Sabicars on 20 October 2026, and every car’s page shows its own deposit.

You can always put down more than the minimum, up to 70% of the price — a bigger deposit means a smaller balance and smaller repayments.`,
  },
  {
    slug: "can-i-apply-for-the-drive-plan-without-a-registered-business",
    question: "I don’t have a registered business — can I still apply?",
    answer: `Yes. Business owners need a CAC business registration as proof of income, and a registered business name is enough — you can register one yourself with the CAC for its published fee (about ₦21,700 in 2026), usually within a few working days. Autochek’s team told Sabicars in October 2026 that it can arrange one for about ₦35,000; ask when you apply.

Salary earners don’t need one: an employment letter or recent payslips are your proof of income.`,
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
    answer: `Yes. [Request a car](/find) and tell us the make, model, year and budget you want. You get a reference number, and we tell you as soon as a matching car arrives.`,
  },
  {
    slug: "how-does-refer-and-earn-work",
    question: "How does Refer & Earn work?",
    answer: `Register free as a partner, share your personal link, and earn **1.5% of the price** when a buyer you sent completes a purchase — paid into a bank account in your own name once the sale is final. It is a commission on sales only; there is nothing to pay and no recruiting. [Get your free link](/partners).`,
  },
  {
    slug: "does-sabicars-supply-fleets-to-companies",
    question: "Can companies and government buy vehicles in bulk from Sabicars?",
    answer: `Yes. Companies and government offices buy several vehicles at once from Sabicars. We find them, check them, prepare the papers and deliver them as one order. One team looks after you from start to finish. [Get a price for several vehicles](/fleet).`,
  },
  {
    slug: "what-is-a-toyota-hiace-hummer-bus",
    question: "What is a Toyota Hiace “Hummer” bus?",
    answer: `It is the market’s name for the high-roof Toyota Hiace — the tall, square-shouldered bus Nigerian businesses use for staff, schools, churches, hire and tourism.

“Hummer 1”, “Hummer 2” and “Hummer 3” are market names, not Toyota’s, and sellers use them differently. At Sabicars, a **Hummer 1** has the 2.0-litre petrol engine and usually 16 seats; a **Hummer 2** has the stronger 2.7 and usually 18; a **Hummer 3** has the same 2.7 in the roomiest body. The **chassis number** tells you the real year. Our [Hummer buyer’s guide](/blog/toyota-hiace-hummer-bus-buyers-guide) covers the rest, and the [buses in stock](/hummer-bus) are always live.`,
  },
  {
    slug: "are-sabicars-cars-foreign-used-or-nigerian-used",
    question: "Are your cars foreign used, Nigerian used or new?",
    answer: `All three are sold. Every listing states which it is, alongside its photographs, details and price — and you can filter the [cars for sale](/vehicles) by condition.`,
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
