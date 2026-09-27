import type { Block } from "@/lib/blog/blocks";

/**
 * Buying a tokunbo truck in Nigeria — the rewrite of the old site's
 * blog/buying-tokunbo-truck-nigeria.html (redirected here). The original
 * claimed stock Sabicars does not have ("Mack Granite tippers and Volvo FH
 * container trucks") and guarantees nobody can give; this one teaches the
 * checks, and the trucks shown are live from the showroom.
 */
export const tokunboTruck = {
  slug: "buying-a-tokunbo-truck-in-nigeria",
  title: "Buying a tokunbo truck in Nigeria: the complete guide",
  category: "Buying Guide",
  standfirst:
    "A truck is a business, not a car. Buy the right one and it earns for years; buy the wrong one and it lives at the mechanic’s. Here is how to choose it, test it and check its papers — before any money moves.",
  coverImageUrl: "https://res.cloudinary.com/dbmtqpex2/image/upload/v1782081810/sabicars/qseerbq9nswzpbenpzy8.jpg",
  tags: ["truck", "tokunbo", "commercial"],
  blocks: [
    {
      type: "p",
      text: "Buying a truck — a tipper, a prime mover, a tanker or a flatbed — is one of the biggest investments a Nigerian business makes. Get it right and it pays for itself, load after load. Get it wrong and you will spend more on repairs than it ever earns.",
    },
    {
      type: "p",
      text: "Most bad truck purchases go wrong in one of three places: the wrong truck for the work, an engine that was tired before it arrived, or papers that do not belong to it. This guide takes you through all three — and lets you practise the last two before you ever meet a seller.",
    },
    {
      type: "summary",
      items: [
        "**Start with the load.** The work decides the truck, not the other way round.",
        "**Start it cold** and read the smoke. It tells you more than the seller will.",
        "**Match the chassis number** to the papers, one character at a time.",
        "**Bring a truck mechanic** — not a car mechanic.",
      ],
    },

    { type: "h2", text: "Start with the load" },
    {
      type: "p",
      text: "Every truck is built around what it carries. Pick your cargo and watch the right one take shape — then put it to work:",
    },
    { type: "illustration", name: "truck-builder" },
    {
      type: "p",
      text: "Two questions settle most choices: how heavy is the load, and how far does it travel? Short, heavy runs — sand to a site — want a tipper built for the weight. Long runs to and from the ports want a prime mover and a trailer. Not sure? Tell us the job and we will tell you the truck.",
    },

    { type: "h2", text: "Start it cold" },
    {
      type: "p",
      text: "The most revealing test takes a minute: start the engine from cold, with your eyes on the exhaust. A warm engine hides things, which is why some sellers run it before you arrive. Put your hand on the bonnet. If it is warm, ask why.",
    },
    {
      type: "p",
      text: "Then read what comes out of the stack. Four trucks, four smokes — try it:",
    },
    { type: "illustration", name: "smoke-doctor" },
    {
      type: "p",
      text: "Listen as well as look. A deep knock from inside the engine, or smoke that thickens as it is revved, is a reason to walk away — or to price a big repair before you price the truck.",
    },

    { type: "h2", text: "The rest of the inspection" },
    {
      type: "list",
      items: [
        "**The gearbox.** Drive it through every gear, loaded if you can. Grinding, jumping out of gear or a slipping clutch all cost money.",
        "**The chassis.** Get underneath with a torch. Cracks, fresh welds and plates bolted over the rails mean the frame has been broken.",
        "**Tyres and axles.** Uneven wear points to alignment, bearing or suspension trouble. Count the tyres, too: they are expensive to replace.",
        "**Springs and suspension.** Look for broken leaves, missing U-bolts, and a truck that sits lower on one side.",
        "**Brakes.** Air brakes should build pressure quickly and hold it. With the engine off, listen for leaks.",
        "**The cab.** Rust in the floor and the door bottoms, and every warning light on the dashboard.",
        "**Its history.** Service records, and where the truck has worked. One from a well-run fleet is worth more than one with no story.",
      ],
    },
    {
      type: "callout",
      tone: "tip",
      title: "Bring a truck mechanic",
      text: "A car mechanic is the wrong person for this job. Bring someone who works on trucks of this make — what it costs is the cheapest insurance you will ever buy.",
    },

    { type: "h2", text: "The papers" },
    {
      type: "p",
      text: "Most truck fraud happens on paper: a good truck with the wrong documents, or the right documents for a different truck. Ask the seller to show you where the chassis number is stamped, and compare it with the papers one character at a time. Practise here:",
    },
    { type: "illustration", name: "chassis-match" },
    {
      type: "list",
      items: [
        "**Customs papers** for an imported truck, showing duty was paid — for *this* chassis number.",
        "**Proof of ownership** in the seller’s name, or the company’s, with the authority to sell.",
        "**The engine number** matching the papers, too.",
        "**No loan against it.** Ask whether a bank or finance company has an interest in the truck. A truck with a debt on it can be taken back.",
        "**Registration and roadworthiness**, if it has already worked on Nigerian roads.",
      ],
    },
    {
      type: "callout",
      tone: "warning",
      title: "Walk away if…",
      text: "…the seller cannot produce the original customs papers, the chassis number looks ground off or re-stamped, or you are pushed to pay before the checks are done.",
    },

    { type: "h2", text: "Brands you will meet" },
    {
      type: "list",
      items: [
        "**Mack** — American and heavy-duty; a long-standing favourite for tippers and prime movers.",
        "**Volvo** — Swedish, comfortable for drivers and strong on long-haul work.",
        "**MAN** — German, widely used for tippers and haulage.",
        "**Mercedes-Benz** — the Actros and its older cousins are common for haulage.",
        "**Scania** — Swedish, powerful and built for heavy loads.",
        "**Sinotruk (HOWO)** — Chinese and lower-priced; check parts and support where the truck will work.",
      ],
    },
    {
      type: "p",
      text: "The best brand is the one with parts and mechanics where your truck will work. Ask other operators on your route what they run — and what they would never buy again.",
    },

    { type: "h2", text: "Buying a truck from Sabicars" },
    {
      type: "p",
      text: "Sabicars sells trucks alongside its cars and buses, and sources them on request. Every vehicle can be inspected before any money changes hands — bring your truck mechanic. Here is what is in the showroom now:",
    },
    { type: "cars", body: "truck", limit: 3, title: "Trucks in the showroom now" },
    {
      type: "p",
      text: "Looking for something specific — a tipper, a prime mover, a particular make and year? Put it on the [Sourcing Desk](/find?want=Truck) and hear the moment one arrives. Buying several for a business? The [fleet team](/fleet) quotes and delivers them as one order.",
    },

    { type: "h2", text: "Questions buyers ask" },
    {
      type: "faq",
      items: [
        {
          q: "What is a tokunbo truck?",
          a: "A used truck imported from abroad — usually from Europe, America or Asia — as opposed to one that has already worked in Nigeria. Tokunbo trucks have not yet met Nigerian roads, but check the customs papers and the chassis number with extra care.",
        },
        {
          q: "Should I buy a tokunbo truck or a Nigerian-used one?",
          a: "Either can be a good buy. A tokunbo truck has not met Nigerian roads yet; a Nigerian-used one has a local history you can ask about. The inspection and the papers decide — not the label.",
        },
        {
          q: "How do I know the truck is not stolen or under a loan?",
          a: "Match the chassis and engine numbers to the customs papers and the proof of ownership, make sure the seller is the owner, and ask directly whether any bank or finance company has an interest in it. Buy from a registered business you can find again.",
        },
        {
          q: "Can I inspect a truck at Sabicars before paying?",
          a: "Yes. Every vehicle can be inspected at the showroom before any money changes hands, and you are welcome to bring your own mechanic.",
        },
      ],
    },
    {
      type: "p",
      text: "Choose for the load, start it cold, match the numbers. Do those three things and you will buy a truck that works as hard as you do.",
    },
    { type: "cta", kind: "find" },
  ] satisfies Block[],
};
