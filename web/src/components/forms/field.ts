/**
 * One field style for every public form: a soft, raised well that lights gold
 * when focused. 52px tall — a reliable thumb target, and 17px text so iOS
 * never zooms the page on focus.
 */
export const fieldClass =
  "min-h-[3.25rem] w-full rounded-xl border border-border-default bg-surface-1 px-4 text-[1.0625rem] text-text-primary outline-none " +
  "shadow-[inset_0_1px_2px_rgb(0_0_0/0.35)] transition-[border-color,box-shadow] duration-[var(--duration-fast)] placeholder:text-text-muted " +
  "hover:border-border-strong focus:border-gold-500 focus:shadow-[inset_0_1px_2px_rgb(0_0_0/0.35),0_0_0_4px_rgb(201_168_76/0.16)]";
