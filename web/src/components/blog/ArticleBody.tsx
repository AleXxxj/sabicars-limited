import { cache } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowRight, CheckCircle2, Info, Lightbulb } from "lucide-react";
import { VehicleCard } from "@/components/VehicleCard";
import { anchorFor, type Block } from "@/lib/blog/blocks";
import { videoSource } from "@/lib/blog/video";
import { money, percentOf } from "@/lib/money";
import { carsForBlock } from "@/lib/repositories/blog";
import { catalogueWithShape, drivePlanCatalogue, hummerBuses } from "@/lib/repositories/vehicles";
import { DRIVE_PLAN_DEPOSIT_BPS, vehicleTitle } from "@/lib/vehicle";
import { Inline } from "./Inline";
import { BudgetQuiz } from "./illustrations/BudgetQuiz";
import { DepositStretch } from "./illustrations/DepositStretch";
import { DrivePlanJourney } from "./illustrations/DrivePlanJourney";
import { DrivePlanSplit } from "./illustrations/DrivePlanSplit";
import { FloodDetective } from "./illustrations/FloodDetective";
import { RepaymentComfort } from "./illustrations/RepaymentComfort";
import { Walkaround } from "./illustrations/Walkaround";
import { HummerAnatomy } from "./illustrations/HummerAnatomy";
import { InspectionChecklist } from "./illustrations/InspectionChecklist";
import { RouteCalculator } from "./illustrations/RouteCalculator";
import { StockChart } from "./illustrations/StockChart";
import { VideoPlayer } from "./VideoPlayer";

/** The Hummer buses in stock, fetched once per article however many blocks use them. */
const hummersInStock = cache(async () => (await hummerBuses()).filter((v) => /hum+er/i.test(v.model) && v.priceMinor));

/** The bus an illustration works its numbers on: the most affordable Hummer in the showroom. */
async function exampleBus() {
  const [bus] = [...(await hummersInStock())].sort((a, b) => a.priceMinor! - b.priceMinor!);
  if (!bus) return null;
  return {
    title: vehicleTitle(bus),
    slug: bus.slug,
    priceMinor: bus.priceMinor!,
    depositMinor: percentOf(money(bus.priceMinor!, "NGN"), DRIVE_PLAN_DEPOSIT_BPS).minor,
  };
}

async function tiktokPoster(url: string): Promise<{ poster: string | null; title: string | null }> {
  try {
    const res = await fetch(`https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`, {
      next: { revalidate: 86_400 },
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return { poster: null, title: null };
    const body = (await res.json()) as { thumbnail_url?: string; title?: string };
    return { poster: body.thumbnail_url ?? null, title: body.title ?? null };
  } catch {
    return { poster: null, title: null };
  }
}

function Caption({ text }: { text?: string }) {
  return text ? <figcaption className="mt-3 text-center text-sm text-text-muted">{text}</figcaption> : null;
}

async function Illustration({ block }: { block: Extract<Block, { type: "illustration" }> }) {
  let body: React.ReactNode = null;
  switch (block.name) {
    case "hummer-anatomy":
      body = <HummerAnatomy />;
      break;
    case "inspection-checklist":
      body = <InspectionChecklist />;
      break;
    case "drive-plan-split":
      body = <DrivePlanSplit car={await exampleBus()} />;
      break;
    case "route-calculator":
      body = <RouteCalculator car={await exampleBus()} />;
      break;
    case "drive-plan-journey":
      body = <DrivePlanJourney />;
      break;
    case "deposit-stretch":
      body = <DepositStretch cars={await drivePlanCatalogue()} />;
      break;
    case "repayment-comfort":
      body = <RepaymentComfort />;
      break;
    case "walkaround":
      body = <Walkaround />;
      break;
    case "flood-detective":
      body = <FloodDetective />;
      break;
    case "budget-quiz":
      body = <BudgetQuiz cars={await catalogueWithShape()} />;
      break;
    case "stock-chart":
      body = (
        <StockChart
          buses={(await hummersInStock()).map((v) => ({
            slug: v.slug,
            title: vehicleTitle(v),
            year: v.year,
            priceMinor: v.priceMinor!,
            seats: v.seats,
          }))}
        />
      );
      break;
  }
  return (
    <figure className="wide spaced">
      {body}
      <Caption text={block.caption} />
    </figure>
  );
}

async function Video({ block }: { block: Extract<Block, { type: "video" }> }) {
  const source = videoSource(block.url);
  if (!source) return null;
  const meta =
    source.kind === "tiktok" ? await tiktokPoster(source.url) : { poster: source.kind === "youtube" ? source.poster : null, title: null };
  return (
    <figure className={`${source.vertical ? "" : "wide"} spaced`}>
      <VideoPlayer source={source} poster={meta.poster} title={block.caption ?? meta.title ?? "Sabicars video"} />
      <Caption text={block.caption} />
    </figure>
  );
}

async function Cars({ block }: { block: Extract<Block, { type: "cars" }> }) {
  const cars = await carsForBlock(block);
  if (!cars.length) return null;
  return (
    <aside className="wide spaced" aria-label={block.title ?? "In the showroom now"}>
      <p className="kicker">{block.title ?? "In the showroom now"}</p>
      <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {cars.map((v) => (
          <VehicleCard key={v.id} vehicle={v} href={`/vehicles/${v.slug}`} />
        ))}
      </div>
    </aside>
  );
}

const CALLOUT = {
  tip: { icon: Lightbulb, label: "Tip", tone: "border-gold-500/40 bg-gold-500/[0.06]" },
  warning: { icon: AlertTriangle, label: "Watch out", tone: "border-danger/40 bg-danger/[0.06]" },
  note: { icon: Info, label: "Good to know", tone: "border-white/15 bg-white/[0.03]" },
} as const;

const CTA = {
  "drive-plan": {
    title: "Pay 40%. Autochek finances the rest.",
    text: "See what your deposit can drive home today.",
    href: "/drive-plan",
    label: "Start with the Drive Plan",
  },
  find: {
    title: "Not in the showroom?",
    text: "Tell the Sourcing Desk what you want and your budget. Hear the moment one arrives.",
    href: "/find",
    label: "Put it on the desk",
  },
  fleet: {
    title: "Buying more than one?",
    text: "Companies, schools and churches buy buses from Sabicars as a single order, with one team accountable.",
    href: "/fleet",
    label: "Request a fleet quotation",
  },
  hummer: {
    title: "Every Hummer bus in stock",
    text: "Photographed, priced and ready to inspect at the showroom.",
    href: "/hummer-bus",
    label: "See the Hummer buses",
  },
  inventory: {
    title: "See what is in the showroom",
    text: "Every vehicle photographed, priced and ready to inspect.",
    href: "/vehicles",
    label: "Browse the inventory",
  },
} as const;

function render(b: Block, i: number, isLede: boolean): React.ReactNode {
  switch (b.type) {
    case "p":
      return (
        <p key={i} className={isLede ? "lede" : undefined}>
          <Inline text={b.text} />
        </p>
      );
    case "h2":
      return (
        <h2 key={i} id={anchorFor(b.text)}>
          {b.text}
        </h2>
      );
    case "h3":
      return <h3 key={i}>{b.text}</h3>;
    case "list": {
      const L = b.ordered ? "ol" : "ul";
      return (
        <L key={i}>
          {b.items.map((it, j) => (
            <li key={j}>
              <Inline text={it} />
            </li>
          ))}
        </L>
      );
    }
    case "quote":
      return (
        <figure key={i} className="wide spaced py-4 text-center">
          <blockquote className="mx-auto max-w-3xl font-display text-[1.9rem] leading-[1.25] text-text-primary italic md:text-[2.5rem]">
            <span aria-hidden className="mb-2 block font-display text-[4rem] leading-none text-gold-400 not-italic">
              “
            </span>
            <Inline text={b.text} />
          </blockquote>
          {b.cite && <figcaption className="mt-5 text-sm tracking-wide text-text-muted">— {b.cite}</figcaption>}
        </figure>
      );
    case "callout": {
      const c = CALLOUT[b.tone];
      const Icon = c.icon;
      return (
        <aside key={i} className={`spaced rounded-2xl border p-5 text-[1.02rem] leading-relaxed ${c.tone}`}>
          <p className="flex items-center gap-2 text-sm font-semibold text-text-primary">
            <Icon aria-hidden size={17} className={b.tone === "warning" ? "text-danger" : "text-gold-300"} />
            {b.title ?? c.label}
          </p>
          <p className="mt-2">
            <Inline text={b.text} />
          </p>
        </aside>
      );
    }
    case "summary":
      return (
        <aside
          key={i}
          className="spaced rounded-2xl border border-gold-500/30 bg-[linear-gradient(160deg,rgb(201_168_76/0.08),transparent_60%)] p-6 md:p-7"
        >
          <p className="kicker">{b.title ?? "The short version"}</p>
          <ul className="mt-4 grid gap-3 text-[1.02rem] leading-relaxed">
            {b.items.map((it, j) => (
              <li key={j} className="flex gap-3">
                <CheckCircle2 aria-hidden size={19} className="mt-1 shrink-0 text-gold-300" />
                <span>
                  <Inline text={it} />
                </span>
              </li>
            ))}
          </ul>
        </aside>
      );
    case "image": {
      const cloudinary = b.url.includes("res.cloudinary.com") && b.url.includes("/image/upload/");
      const src = cloudinary ? b.url.replace("/image/upload/", "/image/upload/f_auto,q_auto,w_1600/") : b.url;
      return (
        <figure key={i} className="wide spaced">
          {/* eslint-disable-next-line @next/next/no-img-element -- sized by Cloudinary above */}
          <img
            src={src}
            alt={b.alt}
            loading="lazy"
            className="max-h-[38rem] w-full rounded-2xl border border-white/[0.08] bg-surface-2 object-cover"
          />
          <Caption text={b.caption} />
        </figure>
      );
    }
    case "video":
      return <Video key={i} block={b} />;
    case "illustration":
      return <Illustration key={i} block={b} />;
    case "cars":
      return <Cars key={i} block={b} />;
    case "table":
      return (
        <figure key={i} className="wide spaced">
          <div className="overflow-x-auto rounded-2xl border border-white/[0.08]">
            <table className="w-full min-w-[32rem] text-left text-[0.98rem]">
              <thead className="bg-surface-2 text-sm text-text-primary">
                <tr>
                  {b.head.map((h, j) => (
                    <th key={j} scope="col" className="px-4 py-3 font-semibold">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {b.rows.map((row, r) => (
                  <tr key={r} className="border-t border-white/[0.06]">
                    {row.map((cell, c) =>
                      c === 0 ? (
                        <th key={c} scope="row" className="px-4 py-3 font-medium text-text-primary">
                          <Inline text={cell} />
                        </th>
                      ) : (
                        <td key={c} className="px-4 py-3">
                          <Inline text={cell} />
                        </td>
                      ),
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Caption text={b.caption} />
        </figure>
      );
    case "faq":
      return (
        <div key={i} className="spaced divide-y divide-white/[0.07] rounded-2xl border border-white/[0.08]">
          {b.items.map((f, j) => (
            <details key={j} className="group px-5 py-1">
              <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 font-semibold text-text-primary [&::-webkit-details-marker]:hidden">
                {f.q}
                <span
                  aria-hidden
                  className="text-2xl leading-none text-gold-300 transition-transform duration-[var(--duration-base)] group-open:rotate-45"
                >
                  +
                </span>
              </summary>
              <p className="pb-5 text-[1.02rem] leading-relaxed">
                <Inline text={f.a} />
              </p>
            </details>
          ))}
        </div>
      );
    case "cta": {
      const c = CTA[b.kind];
      return (
        <Link
          key={i}
          href={c.href}
          className="group wide spaced surface-card flex flex-wrap items-center justify-between gap-6 p-6 !no-underline md:p-8"
        >
          <span>
            <span className="block font-display text-[1.7rem] leading-tight text-text-primary">{c.title}</span>
            <span className="mt-1 block text-[1rem] text-text-secondary">{c.text}</span>
          </span>
          <span className="inline-flex items-center gap-2 rounded-full bg-[linear-gradient(180deg,var(--gold-300),var(--gold-500))] px-6 py-3 text-[0.95rem] font-semibold text-[#0A0908]">
            {c.label} <ArrowRight aria-hidden size={17} className="transition-transform group-hover:translate-x-1" />
          </span>
        </Link>
      );
    }
  }
}

/** The article, block by block. The first paragraph is the lede, set larger with a gold initial. */
export function ArticleBody({ blocks }: { blocks: Block[] }) {
  const lede = blocks.findIndex((b) => b.type === "p");
  return <div className="article">{blocks.map((b, i) => render(b, i, i === lede))}</div>;
}
