import type { Metadata } from "next";
import Link from "next/link";
import { Address } from "@/components/site/Address";
import { PageIntro } from "@/components/site/PageIntro";
import { pageAddress, site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Privacy notice",
  description: `How ${site.legalName} collects, uses and protects your personal data, and the rights you have under the Nigeria Data Protection Act 2023.`,
  ...pageAddress("/privacy"),
};

const UPDATED = "20 October 2026";

/**
 * The privacy notice the Nigeria Data Protection Act 2023 requires of a data
 * controller. Every statement here describes what the platform actually does;
 * change the code and this page together. It is written for buyers, not
 * lawyers, and should still be read by the company's lawyer before launch.
 */
function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="scroll-mt-28 border-t border-border-subtle pt-10">
      <h2 id={id} className="text-[1.6rem] leading-tight">
        {title}
      </h2>
      <div className="mt-5 space-y-4 text-[1.0625rem] leading-relaxed text-text-secondary [&_strong]:text-text-primary">{children}</div>
    </section>
  );
}

function Rows({ rows }: { rows: [string, React.ReactNode][] }) {
  return (
    <dl className="divide-y divide-border-subtle overflow-hidden rounded-2xl border border-border-default bg-surface-1">
      {rows.map(([term, detail]) => (
        <div key={term} className="grid gap-1 px-5 py-4 sm:grid-cols-[14rem_minmax(0,1fr)] sm:gap-6">
          <dt className="font-semibold text-text-primary">{term}</dt>
          <dd className="text-text-secondary">{detail}</dd>
        </div>
      ))}
    </dl>
  );
}

export default function PrivacyPage() {
  return (
    <>
      <PageIntro eyebrow="Privacy notice" title="Your details, and what we do with them.">
        <p>
          {site.legalName} (CAC RC {site.rcNumber}) uses your details to answer you, sell you a car and keep a record of the deal. We
          do not sell your data. Last updated {UPDATED}.
        </p>
      </PageIntro>

      <div className="mx-auto max-w-3xl space-y-12 px-5 py-16 md:px-10 md:py-20">
        <section aria-labelledby="short" className="surface-card p-6 md:p-8">
          <h2 id="short" className="text-[1.4rem] leading-tight">
            The short version
          </h2>
          <ul className="mt-5 list-disc space-y-3 pl-5 text-text-secondary marker:text-green-400">
            <li>We collect what you type into our forms and chats, and what you choose to give us when you buy.</li>
            <li>We use it to reply to you, arrange viewings and sales, send the alerts you ask for, and pay partners their commission.</li>
            <li>Ask Sabicars is an AI assistant. Your chat is kept so a person can follow up.</li>
            <li>Never send your BVN, card details or ID through a form or chat. We will never ask for them there.</li>
            <li>You can ask to see, correct or delete your details at any time by writing to {site.email}.</li>
          </ul>
        </section>

        <Section id="who" title="Who we are">
          <p>
            <strong>{site.legalName}</strong>, registered with the Corporate Affairs Commission under RC {site.rcNumber}, decides how your
            personal data is used. In the words of the Nigeria Data Protection Act 2023, we are the data controller.
          </p>
          <div className="text-text-secondary">
            <Address />
          </div>
          <p>
            Email <a href={`mailto:${site.email}`} className="text-link underline underline-offset-2">{site.email}</a> or call{" "}
            <span className="figures">{site.phones[0].display}</span> about anything on this page.
          </p>
        </Section>

        <Section id="collect" title="What we collect, and why">
          <Rows
            rows={[
              ["Enquiries and viewings", "Your name, phone number, email if you give it, your message, how you would like us to reply, and the car you asked about. We use them to reply, and we keep the enquiry with a reference such as SC-4E7A2D so whoever helps you knows the history."],
              ["Drive Plan requests", "Your name and phone number, and the car. Autochek, our finance partner, takes the loan application itself on its own site."],
              ["Fleet quotations", "Your name, organisation, role, contact details, the vehicles and quantity you need, where to deliver, your timeframe and budget."],
              ["Sourcing requests", "The car you are looking for, your budget and timeframe, and your contact details, so we can tell you when one is found."],
              ["Price alerts", "Your contact details and the car you are watching, so we can tell you if its price drops."],
              ["Newsletter and phone alerts", "Your email address for the Friday new-arrivals email. If you turn on phone notifications, your browser gives our push provider a delivery address for them; we never see your phone number that way."],
              ["Refer & Earn partners", "Your name, phone number, how you reach buyers, and a record of the sales your link brought in, so we can pay your 1.5% commission."],
              ["Reviews and comments", "The name, location and words you choose to publish. They appear on the site once the team has read them. A review left through a buyer's private link is marked Verified buyer, with the vehicle you bought."],
              ["Ask Sabicars chats", "What you write, the cars shown to you, and the page you started from. A short summary is made automatically. If you give your name and number, the chat becomes an enquiry like any other."],
            ]}
          />
          <p>
            We also record a one-way fingerprint of your internet address alongside chats, reviews and comments. It cannot be turned back
            into the address. We use it only to stop spam and abuse.
          </p>
        </Section>

        <Section id="device" title="On your device">
          <p>Some features keep their information in your own browser, not on our servers:</p>
          <ul className="list-disc space-y-2 pl-5 marker:text-green-400">
            <li>
              <strong>Saved cars and recently viewed</strong> stay on your device until you clear them or your browser&rsquo;s data.
            </li>
            <li>
              <strong>Prompts</strong>: we remember which suggestions you have already seen or dismissed, so we ask once, not every visit.
            </li>
            <li>
              <strong>Partner link cookie</strong>: if you arrive through a partner&rsquo;s link, a cookie named <code className="text-text-primary">sc_partner</code> remembers who sent you for 90 days, so they can be paid if you buy. We do not give partners your contact details.
            </li>
            <li>
              <strong>Google Analytics</strong> sets cookies that count visits and the pages people read. We see totals, not who you are. We have turned off Google&rsquo;s advertising features. You can block these cookies in your browser&rsquo;s settings, or use Google&rsquo;s own{" "}
              <a href="https://tools.google.com/dlpage/gaoptout" target="_blank" rel="noopener noreferrer" className="text-link underline underline-offset-2">
                opt-out add-on
              </a>
              .
            </li>
            <li>
              <strong>Maps and videos</strong>: the map on our contact page is loaded from Google. Article videos from YouTube, TikTok or Instagram load only when you tap them, and those services then apply their own policies.
            </li>
          </ul>
        </Section>

        <Section id="basis" title="Our lawful basis">
          <Rows
            rows={[
              ["To answer and serve you", "Replying to enquiries, arranging viewings, quotations and sales: steps you have asked us to take before or under a contract."],
              ["With your consent", "The newsletter, price alerts, phone notifications and published reviews. You can withdraw consent at any time: every email has a one-click unsubscribe, and notifications can be turned off in your browser."],
              ["The partner programme", "Recording referrals and paying commission, under the programme rules you accept when you register."],
              ["Our legitimate interests", "Keeping the site secure, stopping spam and fraud, counting visits, and reviewing chats and enquiries to serve buyers better. We weigh these against your rights, and you can object."],
              ["The law", "Keeping sales and payment records as tax and company law require, and answering lawful requests from the authorities."],
            ]}
          />
        </Section>

        <Section id="share" title="Who else handles your data">
          <p>We do not sell your personal data, and we do not share it for other companies&rsquo; marketing. These providers run parts of the service for us, under their data processing terms:</p>
          <Rows
            rows={[
              ["Supabase", "Our database, where enquiries, chats and records are kept. Stored in London, United Kingdom."],
              ["Vercel", "Runs the website. Its servers for us are in London, United Kingdom."],
              ["Anthropic", "Writes Ask Sabicars' replies and the chat summaries. In the United States. Under its commercial terms, it does not use these conversations to train its models."],
              ["Resend", "Sends our emails: replies, alerts and the newsletter. In the United States."],
              ["OneSignal", "Delivers phone notifications if you turn them on. In the United States."],
              ["Google", "Analytics and the contact page map. In the United States."],
              ["Cloudinary", "Stores and delivers the photographs on the site."],
            ]}
          />
          <p>
            <strong>Autochek.</strong> If you choose the Drive Plan, you apply to Autochek on its own site, and Autochek&rsquo;s privacy
            policy covers what you give it there. We pass your details to Autochek only if you ask us to help with your application.
          </p>
          <p>
            Because some of these providers are outside Nigeria, your data may be transferred abroad. We use providers that protect it to
            recognised international standards. We will also disclose data where the law requires it, for example to a court, the police
            or a regulator acting with lawful authority.
          </p>
        </Section>

        <Section id="keep" title="How long we keep it">
          <ul className="list-disc space-y-2 pl-5 marker:text-green-400">
            <li>Enquiries, chats and sales records: for as long as we need them to serve you, and then for as long as tax and company law require. After that we delete or anonymise them.</li>
            <li>Newsletter: until you unsubscribe. Price and sourcing alerts: until the request is closed or you ask us to stop.</li>
            <li>Partner records: while you are a partner, and afterwards for as long as payment records must be kept.</li>
            <li>Published reviews and comments: until you ask us to remove them.</li>
          </ul>
        </Section>

        <Section id="rights" title="Your rights">
          <p>Under the Nigeria Data Protection Act 2023 you can ask us to:</p>
          <ul className="list-disc space-y-2 pl-5 marker:text-green-400">
            <li>tell you what personal data we hold about you, and give you a copy;</li>
            <li>correct anything that is wrong or incomplete;</li>
            <li>delete your data, where we no longer need to keep it;</li>
            <li>restrict how we use it, or object to a use based on our legitimate interests;</li>
            <li>give you your data in a common format to take elsewhere;</li>
            <li>withdraw a consent you gave, without affecting what was done before.</li>
          </ul>
          <p>
            No decision with legal or similarly significant effect on you is made by a machine alone. Ask Sabicars suggests cars, but
            people at Sabicars handle every sale, and Autochek decides on finance.
          </p>
          <p>
            Write to <a href={`mailto:${site.email}`} className="text-link underline underline-offset-2">{site.email}</a> with the phone
            number or email you used, and your SC- reference if you have one. We may ask you to confirm who you are before we act. We will
            reply as soon as we can, and within 30 days. If you are not satisfied, you can complain to the{" "}
            <a href="https://ndpc.gov.ng" target="_blank" rel="noopener noreferrer" className="text-link underline underline-offset-2">
              Nigeria Data Protection Commission
            </a>
            .
          </p>
        </Section>

        <Section id="security" title="Keeping it safe">
          <p>
            Everything travels over encrypted connections. Only Sabicars staff with their own accounts can see enquiries, and what each
            person can see depends on their role. Changes to records are logged. No system is perfectly secure, so if we ever learn of a
            breach that puts you at risk, we will tell you and the Commission as the law requires.
          </p>
        </Section>

        <Section id="children" title="Children">
          <p>Our services are for adults. We do not knowingly collect personal data from anyone under 18.</p>
        </Section>

        <Section id="changes" title="Changes to this notice">
          <p>
            When we change how we use personal data, we update this page and the date at the top. For a change that matters to you, we
            will also tell you directly if we have your contact details.
          </p>
          <p>
            <Link href="/contact" className="text-link underline underline-offset-2">
              Contact Sabicars
            </Link>
          </p>
        </Section>
      </div>
    </>
  );
}
