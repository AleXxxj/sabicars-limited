import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

/**
 * One button, three voices.
 *
 * - primary: the single action that matters on a screen. Gold on dark, ink on
 *   light. If a screen has two primaries, one of them is wrong.
 * - secondary: a hairline outline, for the alternative path.
 * - quiet: a text link with an arrow, for "read more" weight.
 *
 * 48px tall: the smallest target a thumb hits reliably on a phone held in
 * one hand, which is how most of this site will be used.
 */
type Variant = "primary" | "secondary" | "quiet";
type Size = "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-3 font-sans font-semibold uppercase tracking-[0.18em] [font-stretch:115%] " +
  "transition-[background-color,border-color,color,transform] duration-[var(--duration-fast)] ease-[var(--ease-out)] " +
  "active:translate-y-px disabled:pointer-events-none disabled:opacity-50 whitespace-nowrap";

const variants: Record<Variant, string> = {
  primary: "bg-cta text-cta-fg hover:bg-cta-hover rounded-[2px]",
  secondary:
    "border border-border-strong text-text-primary hover:border-text-primary rounded-[2px] bg-transparent",
  quiet: "text-accent-text hover:text-text-primary px-0 group",
};

const sizes: Record<Size, string> = {
  md: "min-h-12 px-6 text-[0.72rem]",
  lg: "min-h-14 px-8 text-[0.78rem]",
};

interface Common {
  variant?: Variant;
  size?: Size;
  children: ReactNode;
  className?: string;
}

function classes({ variant = "primary", size = "md", className = "" }: Omit<Common, "children">) {
  return [base, variants[variant], variant === "quiet" ? "min-h-12 text-[0.72rem]" : sizes[size], className].join(" ");
}

function Arrow() {
  return (
    <span aria-hidden className="inline-block transition-transform duration-[var(--duration-base)] ease-[var(--ease-out)] group-hover:translate-x-1">
      →
    </span>
  );
}

export function ButtonLink({ href, variant, size, children, className, ...rest }: Common & ComponentProps<typeof Link>) {
  return (
    <Link href={href} className={classes({ variant, size, className })} {...rest}>
      {children}
      {variant === "quiet" && <Arrow />}
    </Link>
  );
}

export function Button({ variant, size, children, className, ...rest }: Common & ComponentProps<"button">) {
  return (
    <button className={classes({ variant, size, className })} {...rest}>
      {children}
      {variant === "quiet" && <Arrow />}
    </button>
  );
}
