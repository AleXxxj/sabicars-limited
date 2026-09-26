import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";

/**
 * One button, three voices.
 *
 * - primary: the single action that matters on a screen — brushed gold, lit
 *   from above. If a screen has two primaries, one of them is wrong.
 * - secondary: frosted glass with a hairline edge, for the alternative path.
 *   Works over photography as well as the page.
 * - quiet: a text link with an arrow, for "read more" weight.
 *
 * Sentence case at a readable size: a call to action is read in a glance on
 * a phone, and spaced-out capitals at 11px were the hardest text on the site
 * to take in. At least 48px tall — a reliable thumb target.
 */
type Variant = "primary" | "secondary" | "quiet";
type Size = "md" | "lg";

const base =
  "group inline-flex items-center justify-center gap-2.5 font-sans font-semibold tracking-[0.005em] whitespace-nowrap " +
  "transition-[background,border-color,color,box-shadow,transform,filter] duration-[var(--duration-fast)] ease-[var(--ease-out)] " +
  "active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50";

const variants: Record<Variant, string> = {
  primary:
    "rounded-full text-[#0A0908] bg-[linear-gradient(180deg,var(--gold-300)_0%,var(--gold-500)_100%)] " +
    "shadow-[inset_0_1px_0_rgb(255_255_255/0.45),0_12px_32px_-12px_rgb(201_168_76/0.6)] hover:brightness-[1.08] hover:shadow-[inset_0_1px_0_rgb(255_255_255/0.45),0_16px_40px_-12px_rgb(201_168_76/0.75)]",
  secondary:
    "rounded-full border border-white/20 bg-white/[0.04] text-text-primary backdrop-blur-md hover:border-white/45 hover:bg-white/[0.08]",
  quiet: "text-accent-text hover:text-text-primary",
};

const sizes: Record<Size, string> = {
  md: "min-h-12 px-6 text-[0.95rem]",
  lg: "min-h-14 px-8 text-base",
};

interface Common {
  variant?: Variant;
  size?: Size;
  /** A trailing arrow: on by default for links that lead somewhere, off for form buttons. */
  arrow?: boolean;
  children: ReactNode;
  className?: string;
}

function classes({ variant = "primary", size = "md", className = "" }: Pick<Common, "variant" | "size" | "className">) {
  return [base, variants[variant], variant === "quiet" ? "min-h-12 text-[0.95rem]" : sizes[size], className].join(" ");
}

function Arrow() {
  return (
    <ArrowRight
      aria-hidden
      size={18}
      strokeWidth={2}
      className="shrink-0 transition-transform duration-[var(--duration-base)] ease-[var(--ease-out)] group-hover:translate-x-1"
    />
  );
}

export function ButtonLink({ href, variant = "primary", size, arrow = variant !== "secondary", children, className, ...rest }: Common & ComponentProps<typeof Link>) {
  return (
    <Link href={href} className={classes({ variant, size, className })} {...rest}>
      {children}
      {arrow && <Arrow />}
    </Link>
  );
}

export function Button({ variant = "primary", size, arrow = variant === "quiet", children, className, ...rest }: Common & ComponentProps<"button">) {
  return (
    <button className={classes({ variant, size, className })} {...rest}>
      {children}
      {arrow && <Arrow />}
    </button>
  );
}

/** For external or same-page links (tel:, wa.me, #anchor) that are not Next.js routes. */
export function ButtonAnchor({ variant = "primary", size, arrow = false, children, className, ...rest }: Common & ComponentProps<"a">) {
  return (
    <a className={classes({ variant, size, className })} {...rest}>
      {children}
      {arrow && <Arrow />}
    </a>
  );
}
