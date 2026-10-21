import type { Block } from "@/lib/blog/blocks";

/**
 * The Drive Plan, explained — a rewrite of the old "Drive Now, Pay Monthly"
 * post at the same address, so its links and search ranking carry over. It
 * states only the arrangement Autochek's team gave Sabicars on 20 October
 * 2026 (the deposit tiers and the year floor) and what Autochek publishes
 * (the rate ceiling, terms, documents and fee), which lives in
 * lib/drive-plan.ts: the deposit depends on the car's model year (40% from
 * 2010, 50% on a 2008 or 2009 car, nothing older is financed), Autochek's
 * lender assesses the buyer, decides
 * the approval and sets the rate and term in its offer, and the car leaves the
 * showroom once the lender approves and the deposit is paid. No rate or
 * monthly figure is stated as fact: the site shows an estimated monthly
 * repayment at Autochek's published ceiling, labelled as an estimate wherever
 * it appears (the lender's offer is the only quote); every other figure is the
 * reader's own, Autochek's own published example, or live from the showroom.
 */
export const drivePlanExplained = {
  slug: "drive-now-pay-monthly-everything-you-need-to-know",
  title: "Drive now, pay monthly: how the 40% Drive Plan really works",
  category: "Financing",
  standfirst:
    "Put down 40% — 50% on a 2008 or 2009 car — drive the car home, and pay the rest to Autochek month by month. Here is every step, what your money really reaches, and the three mistakes that turn a good plan into a burden.",
  coverImageUrl: "https://res.cloudinary.com/dbmtqpex2/image/upload/v1782603414/IMG_8637_xegewl.png",
  tags: ["drive-plan"],
  blocks: [
    {
      type: "p",
      text: "Most people who want a car in Lagos are not short of ambition. They are short of the full price, today. The Drive Plan closes that gap: 40% from you now on a car from 2010 (50% on a 2008 or 2009 car), the rest from Autochek over time, and the car in your compound once Autochek’s lender says yes.",
    },
    {
      type: "p",
      text: "It is simple on paper and easy to get wrong in practice — usually by choosing a car the repayment cannot comfortably carry. This guide walks the whole journey, shows you what your money really reaches in the showroom today, and helps you find the monthly figure you can live with.",
    },
    {
      type: "summary",
      items: [
        "You pay **40%** of the price on a car from 2010, or **50%** on a 2008 or 2009 car. **Autochek**, Sabicars’ financing partner, finances the rest. Cars older than 2008 are not financed.",
        "Autochek’s lender assesses you, decides the approval, and sets the rate and term in your offer — Autochek publishes a ceiling of 30% a year over 6 to 48 months.",
        "The car leaves the showroom **once the lender approves and your deposit is paid**.",
        "As a deposit, your money reaches a car **up to two and a half times** its size (twice, on a 2008 or 2009 car).",
        "Keep the repayment within what your pay can carry — the calculator below shows where that line is.",
      ],
    },

    { type: "h2", text: "The whole journey, in six steps" },
    {
      type: "p",
      text: "Scroll, and follow the car. The order matters — especially the fourth step, because nothing leaves the showroom before it.",
    },
    { type: "illustration", name: "drive-plan-journey" },
    {
      type: "callout",
      tone: "tip",
      title: "Choose in person first",
      text: "Inspect and test-drive the car before you apply. A loan approved for the wrong car is still the wrong car — and every Sabicars vehicle can be inspected at the showroom, with your own mechanic if you like.",
    },

    { type: "h2", text: "What your money becomes" },
    {
      type: "p",
      text: "This is the part people underestimate. ₦5 million in cash buys a ₦5 million car. As a 40% deposit on a car from 2010, the same ₦5 million reaches a car priced at ₦12.5 million (₦10 million on a 2008 or 2009 car, where the deposit is 50%). Set your own figure and see what it reaches in the showroom right now:",
    },
    { type: "illustration", name: "deposit-stretch", caption: "Live from the showroom: the most car each way reaches, today." },
    {
      type: "p",
      text: "The stretch is real, and so is the repayment that comes with it. Which is why the next question is not *how much car can I get?* but *how much repayment can I carry?*",
    },

    { type: "h2", text: "Can you carry the repayment?" },
    {
      type: "p",
      text: "A common rule of thumb: keep a car repayment within **30%** of your take-home pay. Above that, fuel, parking and the first unexpected bill start to squeeze everything else. Enter your pay and a monthly figure — the estimate on the car’s page, or your Autochek offer once it is in — and see where you stand:",
    },
    { type: "illustration", name: "repayment-comfort" },
    {
      type: "p",
      text: "If the quote lands in the red, you have three levers: a cheaper car, a bigger deposit (you can put down up to 70% of the price), or a longer term. Ask Autochek how each changes the monthly figure before you decide.",
    },

    { type: "h2", text: "Who does what" },
    {
      type: "table",
      head: ["Stage", "You", "Sabicars", "Autochek"],
      rows: [
        ["Choosing", "Pick the car, inspect it, test-drive it", "Shows the car, answers questions", "—"],
        ["Applying", "Apply on the car’s Autochek listing", "Lists the car on its Autochek store", "Receives the application"],
        ["Deciding", "Provide what Autochek asks for", "—", "Its lender assesses you, decides the approval, and sets the rate and term"],
        ["Paying", "Pay your deposit — 40% on a car from 2010, 50% on a 2008 or 2009 car", "Receives the deposit, completes the paperwork", "Pays the balance"],
        ["After", "Repay Autochek monthly", "Hands over the car", "Collects the repayments"],
      ],
    },

    { type: "h2", text: "What Autochek will want to see" },
    {
      type: "p",
      text: "Autochek’s lender assesses every applicant: who you are, and whether your income can carry the repayment. Have these ready before you apply and the offer comes faster — usually within a few days of a complete application:",
    },
    {
      type: "list",
      items: [
        "**Your BVN** and a valid ID — a national ID card, driver’s licence, passport or voter’s card.",
        "**Bank statements** for the last six months, from the account you actually use — a commercial bank, or a bank app such as OPay — showing money coming in and going out.",
        "**Proof of income.** Salary earners: an employment letter or recent payslips. Business owners: a CAC business registration — a registered business name is enough.",
        "**A utility bill** for the address you give.",
      ],
    },
    {
      type: "p",
      text: "No registered business yet? You can register a business name with the CAC yourself for its published fee (about ₦21,700 in 2026), usually within a few working days, and Autochek’s team told Sabicars in October 2026 that it can arrange one for about ₦35,000 — ask when you apply.",
    },
    {
      type: "p",
      text: "The deposit tiers, the year floor and the bank-app statements are as Autochek’s team gave them to Sabicars on 20 October 2026; the rate ceiling, the terms, the documents and the fee are as Autochek publishes. Its lenders decide each application and may ask for more.",
    },

    { type: "h2", text: "Three mistakes to avoid" },
    {
      type: "list",
      ordered: true,
      items: [
        "**Buying at the top of your stretch.** The biggest car your deposit reaches is rarely the right one. Leave room in the monthly budget.",
        "**Forgetting the running costs.** The monthly figure on the car’s Autochek listing includes comprehensive insurance, a vehicle tracker and a maintenance contract (the estimates on Sabicars’ pages are the loan alone) — but fuel, parking and the first unexpected bill sit on top of it. Budget for them from the first month.",
        "**Skipping the fine print.** Read the rate and term in your offer, the processing fee (Autochek’s published example is ₦20,000, credited against your final payment if the loan goes through) and what happens if a payment is late — and ask Autochek about anything unclear before you sign.",
      ],
    },
    {
      type: "quote",
      text: "The right question is not how much car you can get. It is how much repayment you can carry.",
    },

    { type: "h2", text: "Putting the car to work" },
    {
      type: "p",
      text: "Many buyers finance a vehicle to earn with it — ride-hailing, hire, staff runs. It can pay for itself, if the numbers work. Our [Hummer bus buyer’s guide](/blog/toyota-hiace-hummer-bus-buyers-guide) has a calculator that runs them on your own route, fares and costs.",
    },

    { type: "h2", text: "Questions buyers ask" },
    {
      type: "faq",
      items: [
        {
          q: "Who approves the finance?",
          a: "Autochek’s lending partners, through Autochek, Sabicars’ financing partner. The lender assesses you, decides the approval, and sets the rate and term in your offer — Sabicars does not lend.",
        },
        {
          q: "What are the interest rate and the term?",
          a: "The lender sets them when it assesses you, and you see them in your offer before you commit to anything. Autochek publishes a ceiling of 30% a year over 6 to 48 months; on its listings the rate is “available on request”. Autochek’s own example: ₦1,000,000 over 12 months at 30% a year is about ₦97,487 a month. Each car’s page shows an estimated monthly repayment at that ceiling over the term you pick, so you can plan; your offer can be lower.",
        },
        {
          q: "When does the car leave the showroom?",
          a: "Once Autochek’s lender approves the finance and your deposit is paid.",
        },
        {
          q: "Which cars can I buy on the Drive Plan?",
          a: "Any car from 2008 listed on Sabicars’ store on Autochek: 40% down on a car from 2010, 50% on a 2008 or 2009 car. Autochek’s lenders do not finance cars older than 2008, so those are cash purchases. If the one you want is not listed yet, ask Sabicars.",
        },
        {
          q: "Why is the deposit 50% on some cars?",
          a: "The deposit depends on the car’s model year. Autochek’s lenders ask for 40% on a car from 2010 and 50% on a 2008 or 2009 car, and do not finance anything older — the rule Autochek’s team gave Sabicars on 20 October 2026. Every car’s page shows its own deposit, and you can always put down more than the minimum, up to 70% of the price.",
        },
        {
          q: "I don’t have a registered business — can I still apply?",
          a: "Yes. Business owners need a CAC business registration, and a registered business name is enough — you can register one yourself with the CAC for its published fee (about ₦21,700 in 2026), usually within a few working days. Autochek’s team told Sabicars in October 2026 that it can arrange one for about ₦35,000; ask when you apply. Salary earners don’t need one: an employment letter or recent payslips are your proof of income.",
        },
        {
          q: "Can I inspect the car before I apply?",
          a: "Yes — and you should. Every car can be inspected at the showroom, and you are welcome to bring your own mechanic.",
        },
      ],
    },
    {
      type: "p",
      text: "Done well, the Drive Plan is the difference between waiting years and driving this month. Choose the car in person, keep the repayment comfortable, read what you sign — and then enjoy the drive home.",
    },
    { type: "cta", kind: "drive-plan" },
  ] satisfies Block[],
};
