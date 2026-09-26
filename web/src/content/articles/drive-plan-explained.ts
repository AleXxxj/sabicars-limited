import type { Block } from "@/lib/blog/blocks";

/**
 * The Drive Plan, explained — a rewrite of the old "Drive Now, Pay Monthly"
 * post at the same address, so its links and search ranking carry over. It
 * states only the arrangement the owner confirmed: the buyer pays 40%,
 * Autochek finances 60% on the terms set on its listing and decides the
 * approval, and the car leaves the showroom once it approves and the 40% is
 * paid. Every figure in it is the reader's own or live from the showroom.
 */
export const drivePlanExplained = {
  slug: "drive-now-pay-monthly-everything-you-need-to-know",
  title: "Drive now, pay monthly: how the 40% Drive Plan really works",
  category: "Financing",
  standfirst:
    "Put down 40%, drive the car home, and pay the rest to Autochek month by month. Here is every step, what your money really reaches, and the three mistakes that turn a good plan into a burden.",
  coverImageUrl: "https://res.cloudinary.com/dbmtqpex2/image/upload/v1782603414/IMG_8637_xegewl.png",
  tags: ["drive-plan"],
  blocks: [
    {
      type: "p",
      text: "Most people who want a car in Lagos are not short of ambition. They are short of the full price, today. The Drive Plan closes that gap: 40% from you now, 60% from Autochek over time, and the car in your compound once Autochek says yes.",
    },
    {
      type: "p",
      text: "It is simple on paper and easy to get wrong in practice — usually by choosing a car the repayment cannot comfortably carry. This guide walks the whole journey, shows you what your money really reaches in the showroom today, and helps you find the monthly figure you can live with.",
    },
    {
      type: "summary",
      items: [
        "You pay **40%** of the price. **Autochek**, Sabicars’ financing partner, finances the other **60%**.",
        "Autochek decides the approval and sets the repayment terms on the car’s listing.",
        "The car leaves the showroom **once Autochek approves and your 40% is paid**.",
        "As a deposit, your money reaches a car **two and a half times** its size.",
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
      text: "This is the part people underestimate. ₦5 million in cash buys a ₦5 million car. As a 40% deposit, the same ₦5 million reaches a car priced at ₦12.5 million. Set your own figure and see what it reaches in the showroom right now:",
    },
    { type: "illustration", name: "deposit-stretch", caption: "Live from the showroom: the most car each way reaches, today." },
    {
      type: "p",
      text: "The stretch is real, and so is the repayment that comes with it. Which is why the next question is not *how much car can I get?* but *how much repayment can I carry?*",
    },

    { type: "h2", text: "Can you carry the repayment?" },
    {
      type: "p",
      text: "A common rule of thumb: keep a car repayment within **30%** of your take-home pay. Above that, fuel, insurance and the first unexpected bill start to squeeze everything else. Enter your pay — and, once Autochek has quoted you, the monthly figure — and see where you stand:",
    },
    { type: "illustration", name: "repayment-comfort" },
    {
      type: "p",
      text: "If the quote lands in the red, you have three levers: a cheaper car, a bigger deposit, or a longer term. Ask Autochek how each changes the monthly figure before you decide.",
    },

    { type: "h2", text: "Who does what" },
    {
      type: "table",
      head: ["Stage", "You", "Sabicars", "Autochek"],
      rows: [
        ["Choosing", "Pick the car, inspect it, test-drive it", "Shows the car, answers questions", "—"],
        ["Applying", "Apply on the car’s Autochek listing", "Lists the car on its Autochek store", "Receives the application"],
        ["Deciding", "Provide what Autochek asks for", "—", "Profiles you and decides the approval"],
        ["Paying", "Pay the 40% deposit", "Receives the 40%, completes the paperwork", "Pays the 60%"],
        ["After", "Repay Autochek monthly", "Hands over the car", "Collects the repayments"],
      ],
    },

    { type: "h2", text: "What Autochek will want to see" },
    {
      type: "p",
      text: "Autochek profiles every applicant: who you are, and whether your income can carry the repayment. Its application tells you exactly what it needs — typically proof of identity and of income. Have yours ready before you apply and the decision comes faster.",
    },

    { type: "h2", text: "Three mistakes to avoid" },
    {
      type: "list",
      ordered: true,
      items: [
        "**Buying at the top of your stretch.** The biggest car your deposit reaches is rarely the right one. Leave room in the monthly budget.",
        "**Forgetting the running costs.** Insurance, fuel and servicing sit on top of the repayment. A financed car usually has to be comprehensively insured — budget for it from the first month.",
        "**Skipping the fine print.** Read the rate, the fees and what happens if a payment is late — and ask Autochek about anything unclear before you sign.",
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
          a: "Autochek, Sabicars’ financing partner. It profiles you and decides the approval on the terms set on the car’s listing.",
        },
        {
          q: "What are the interest rate and the term?",
          a: "Autochek sets them on each car’s listing. You see them when you apply, before you commit to anything.",
        },
        {
          q: "When does the car leave the showroom?",
          a: "Once Autochek approves the finance and your 40% deposit is paid.",
        },
        {
          q: "Which cars can I buy on the Drive Plan?",
          a: "Any car listed on Sabicars’ store on Autochek. If the one you want is not listed yet, ask Sabicars.",
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
