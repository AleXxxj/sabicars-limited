import type { Block } from "@/lib/blog/blocks";

/**
 * The flagship guide. Every fact in it is either general knowledge about the
 * Toyota Hiace or drawn live from the showroom (the chart, the cars, the
 * worked example), so nothing printed here goes stale when prices move.
 */
export const hiaceHummerGuide = {
  slug: "toyota-hiace-hummer-bus-buyers-guide",
  title: "The Toyota Hiace Hummer bus: the complete buyer’s guide",
  category: "Buying Guide",
  standfirst:
    "It carries staff to work, children to school and congregations to church — and a good one keeps earning for years. Here is how to tell a good one from a tired one before you pay a kobo.",
  coverImageUrl: "https://res.cloudinary.com/dbmtqpex2/image/upload/v1782005384/sabicars/gk5tkq3gb9xdr7yg7v05.jpg",
  tags: ["toyota-hiace-hummer", "hummer-bus"],
  blocks: [
    {
      type: "p",
      text: "Every weekday before six, Toyota Hiace buses pull out of compounds all over Lagos with a full load and a long day ahead. The tall, square-shouldered ones — the buses Nigerians call **Hummer** — do the hardest of that work, and the best of them do it for years. The worst are bought on looks and sold on a few months later, at a loss.",
    },
    {
      type: "p",
      text: "The difference between the two is rarely the year, the colour or the name the seller gives it. It is the floor, the papers and the engine — in that order. This guide shows you where to look, what a fair price looks like today, and how to make the numbers work before you commit.",
    },
    {
      type: "summary",
      items: [
        "A “Hummer bus” is the **high-roof Toyota Hiace** — the same bus Toyota has built since 2004, through several face-lifts.",
        "“Hummer 1, 2 and 3” are market names, not Toyota’s. The **chassis number** tells you the real year.",
        "Check **six places** before you pay. The checklist below stays on your phone, so you can finish it at the showroom.",
        "You can drive one away on the **40% Drive Plan**: you pay 40%, Autochek finances the 60% once it approves.",
        "Run **your own route numbers** first — the calculator below does the arithmetic.",
      ],
    },

    { type: "h2", text: "Why Lagos calls it a Hummer" },
    {
      type: "p",
      text: "The Hiace is Toyota’s workhorse van, and the fifth generation — launched in 2004 and still built for some markets — is the one on Nigerian roads. It comes with a standard roof and a high roof. The high-roof bus stands a head taller: passengers step in instead of stooping, and there is room for luggage inside.",
    },
    {
      type: "p",
      text: "Next to a standard Hiace, the high-roof version looks the way a Hummer looks beside a saloon car — bigger, squarer, more imposing. That is the usual explanation for the nickname. Whatever its origin, the name stuck, and it is now what buyers ask for and search for.",
    },
    {
      type: "image",
      url: "https://res.cloudinary.com/dbmtqpex2/image/upload/v1782005097/sabicars/bqvwqfxh1bzvfwfzgmyj.jpg",
      alt: "A black 2019 Toyota Hiace high-roof bus at the Sabicars showroom",
      caption: "A 2019 Hummer bus at the Sabicars showroom.",
    },
    {
      type: "p",
      text: "In the market you will also hear **Hummer 1**, **Hummer 2** and **Hummer 3**. They are the same bus at different face-lifts — new lamps, a new grille, updated cabins — and dealers use the names to tell them apart at a glance. Not everyone draws the lines in the same year, so treat the label as a description, not a specification.",
    },
    {
      type: "callout",
      tone: "tip",
      title: "Ask for the year, not the number",
      text: "When a seller says “Hummer 3”, ask for the year of manufacture from the chassis number, and check that the papers say the same. The year sets the price; the nickname does not.",
    },

    { type: "h2", text: "What one costs today" },
    {
      type: "p",
      text: "Bus prices move with the naira, the port and the season, so any price printed in an article is wrong within weeks. Here instead is the showroom as it stands right now — every Hummer bus Sabicars has, placed by year and price:",
    },
    { type: "illustration", name: "stock-chart", caption: "Live from the showroom. Point at a bus for its price; tap to open it." },
    {
      type: "p",
      text: "Two buses of the same year can be millions of naira apart. What moves the price, roughly in order of how much:",
    },
    {
      type: "list",
      items: [
        "**Condition underneath** — floor, sills and suspension. A tired chassis is the most expensive thing to fix.",
        "**Year and face-lift** — newer buses hold their value better and are easier to sell on.",
        "**Seat layout** — an executive layout with fewer, better seats is priced differently from an 18-seat commuter.",
        "**Gearbox and engine** — automatics and diesels are priced differently from manual petrol buses.",
        "**Mileage and history** — how hard it has worked, and whether the papers can show it.",
      ],
    },
    { type: "cars", term: "hummer-bus", limit: 3, title: "Hummer buses in the showroom now" },

    { type: "h2", text: "Petrol or diesel, manual or automatic" },
    {
      type: "p",
      text: "Most Hummer buses in Nigeria run Toyota’s 2.7-litre petrol engine, known by its code **2TR-FE** — every petrol Hummer in the Sabicars showroom has one. It is simple, understood by mechanics in every city, and its parts are easy to find. Diesel Hiaces exist and can be more economical on long runs, but they are less forgiving of poor fuel and cost more to put right when something goes wrong.",
    },
    {
      type: "p",
      text: "Manual gearboxes are still the working standard for buses; automatics are easier on a driver who spends hours in Lagos traffic, and they are increasingly common. Choose by how the bus will be used, not by what sounds better:",
    },
    {
      type: "table",
      head: ["Choice", "Choose it if…", "Think twice if…"],
      rows: [
        [
          "Petrol",
          "Most of your driving is in and around the city, and you want the widest choice of mechanics and parts.",
          "You cover very long distances every day and fuel is your biggest cost.",
        ],
        ["Diesel", "You run long routes, day in, day out.", "You cannot be sure of the quality of the fuel you buy."],
        [
          "Manual",
          "The bus will work hard with hired drivers, and you want the cheapest repairs.",
          "Your drivers will spend most of the day in heavy traffic.",
        ],
        [
          "Automatic",
          "Comfort in traffic matters, or your drivers are new to buses.",
          "Keeping repair costs as low as possible is the priority.",
        ],
      ],
    },

    {
      type: "video",
      url: "https://www.instagram.com/reel/DdjpP3tSO6j/",
      caption: "A Toyota Hummer 2 with a manual gearbox, on video.",
    },

    { type: "h2", text: "Six places to look before you pay" },
    {
      type: "p",
      text: "A bus that has worked hard shows it in the same places every time. Here they are on the bus itself — tap a number to see what to look for, and why it matters:",
    },
    { type: "illustration", name: "hummer-anatomy" },
    {
      type: "p",
      text: "Paint is the last thing that matters. Buy the floor, the papers and the engine — in that order. Take this list with you; it remembers what you have already checked:",
    },
    {
      type: "illustration",
      name: "inspection-checklist",
      caption: "Tick as you go. It stays on this phone, so you can finish it at the showroom.",
    },
    {
      type: "quote",
      text: "Buy the floor, the papers and the engine — in that order. The paint is the last thing that matters.",
    },
    {
      type: "callout",
      tone: "warning",
      title: "Too clean underneath",
      text: "Thick, fresh black underseal on an older bus can hide rust and welded repairs. It is not proof of a problem — but ask when it was done, and why.",
    },

    { type: "h2", text: "The papers" },
    {
      type: "p",
      text: "A bus is only worth what its papers can prove. Before you pay anything, check that the chassis number stamped on the bus matches every document you are shown.",
    },
    {
      type: "list",
      items: [
        "**Foreign-used (tokunbo):** the customs papers showing duty was paid on this bus, matching its chassis number.",
        "**Nigerian-used:** the registration history and proof of ownership, in the name of the person selling it to you.",
        "**Seats:** the number of seats fitted should match the number on the papers.",
        "**Commercial use:** if the bus will carry paying passengers, ask about registering it for commercial use before you buy — it affects the plates and the insurance.",
      ],
    },

    { type: "h2", text: "Buying one on the Drive Plan" },
    {
      type: "p",
      text: "You do not need the full price to drive a bus home. On Sabicars’ 40% Drive Plan you pay 40% of the price, and Autochek — Sabicars’ financing partner — finances the remaining 60%, on the terms set on its listing and subject to its approval. Here is how it splits on a real bus in the showroom today:",
    },
    { type: "illustration", name: "drive-plan-split" },
    {
      type: "p",
      text: "Autochek profiles you and decides the approval. Once it approves and your 40% is paid, the bus is yours to drive away. If you are buying the bus to put it to work, run the numbers below first — the bus should be able to carry its own repayment.",
    },
    { type: "cta", kind: "drive-plan" },

    { type: "h2", text: "Will it pay for itself?" },
    {
      type: "p",
      text: "If the bus is going to work — a staff route, a school run, hire — do the arithmetic before you buy, not after. The calculator starts with cautious figures: three-quarters full, one fare per seat per trip. Replace every one of them with your own.",
    },
    { type: "illustration", name: "route-calculator" },
    {
      type: "p",
      text: "Two numbers deserve most of your attention: how full the bus really is on an average trip, and what fuel costs you a day. It is easy to be optimistic about the first and forgetful about the second — and between them they decide whether the bus pays for itself.",
    },

    { type: "h2", text: "Buying more than one" },
    {
      type: "p",
      text: "Companies, schools, churches and hotels buy buses from Sabicars as a single order: matched buses, each with its own papers, delivered together, with one team accountable from the quotation to the handover.",
    },
    { type: "cta", kind: "fleet" },

    { type: "h2", text: "Questions buyers ask" },
    {
      type: "faq",
      items: [
        {
          q: "Why is it called a Hummer bus?",
          a: "It is the Nigerian name for the high-roof Toyota Hiace. The usual explanation is its size and square shape: next to a standard Hiace it looks like a Hummer beside a saloon car.",
        },
        {
          q: "How many seats does a Hummer bus have?",
          a: "It depends on how it is fitted. The buses in the Sabicars showroom today range from 8-seat executive layouts to 18-seat commuter layouts. Check that the seat count on the papers matches what is fitted.",
        },
        {
          q: "Is a Hummer 3 better than a Hummer 2?",
          a: "A later face-lift has newer styling and features, but condition matters far more than the label. A well-kept older bus is a better buy than a hard-worked newer one. Judge the bus, not the name.",
        },
        {
          q: "Can I pay in instalments?",
          a: "Yes — on the [40% Drive Plan](/drive-plan). You pay 40% and Autochek finances the remaining 60%, subject to its approval. The bus leaves the showroom once Autochek approves and the 40% is paid.",
        },
        {
          q: "Can I inspect the bus before I pay?",
          a: "Yes. Every bus can be inspected at the showroom before any money changes hands, and you are welcome to bring your own mechanic.",
        },
        {
          q: "What if the bus I want is not in stock?",
          a: "Tell the [Sourcing Desk](/find) the year, layout and budget you want. Your request is recorded, and you are told the moment a match arrives.",
        },
      ],
    },

    {
      type: "p",
      text: "A Hummer bus is a working asset, and it should be bought like one: floor first, papers second, engine third, paint last. Do that, and the bus you drive away will still be earning long after the day you bought it.",
    },
    { type: "cta", kind: "hummer" },
  ] satisfies Block[],
};
