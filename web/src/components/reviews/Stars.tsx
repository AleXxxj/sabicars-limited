import { Star } from "lucide-react";

/** A rating as five stars, read out as "4 out of 5 stars". */
export function Stars({ rating, size = 15, className = "" }: { rating: number; size?: number; className?: string }) {
  return (
    <span role="img" aria-label={`${rating} out of 5 stars`} className={`inline-flex gap-0.5 ${className}`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          aria-hidden
          size={size}
          strokeWidth={1.5}
          className={n <= Math.round(rating) ? "fill-gold-400 text-gold-400" : "fill-transparent text-white/25"}
        />
      ))}
    </span>
  );
}
