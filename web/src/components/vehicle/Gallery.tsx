"use client";

import { useRef, useState } from "react";
import { VehicleImage } from "@/components/VehicleImage";
import { VEHICLE_PLACEHOLDER } from "@/lib/media";

export interface GalleryImage {
  url: string;
  alt: string;
}

const SWIPE_PX = 40;

function Arrow({ dir, onClick, label }: { dir: "prev" | "next"; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={`glass absolute top-1/2 z-10 grid size-12 -translate-y-1/2 place-items-center rounded-full text-white transition-colors hover:bg-[#090E0A]/80 ${
        dir === "prev" ? "left-3" : "right-3"
      }`}
    >
      <span aria-hidden className="text-lg">
        {dir === "prev" ? "←" : "→"}
      </span>
    </button>
  );
}

/**
 * Every photo of the vehicle, the way a buyer actually looks at a car: swipe
 * through on a phone, arrow keys on a laptop, full screen for the detail.
 *
 * The full-screen view is a native <dialog>, so Escape, focus trapping and the
 * back gesture behave as the platform expects without custom code.
 */
export function Gallery({
  images,
  title,
  between,
}: {
  images: GalleryImage[];
  title: string;
  /** Shown between the photo and its thumbnails on a phone: the page's actions, straight under the car. */
  between?: React.ReactNode;
}) {
  const photos = images.length ? images : [{ url: VEHICLE_PLACEHOLDER, alt: `${title} — photos coming soon` }];
  const [i, setI] = useState(0);
  const dialog = useRef<HTMLDialogElement>(null);
  const touchX = useRef<number | null>(null);

  const go = (n: number) => setI((n + photos.length) % photos.length);
  const many = photos.length > 1;

  const swipe = {
    onTouchStart: (e: React.TouchEvent) => (touchX.current = e.touches[0].clientX),
    onTouchEnd: (e: React.TouchEvent) => {
      if (touchX.current === null) return;
      const dx = e.changedTouches[0].clientX - touchX.current;
      touchX.current = null;
      if (Math.abs(dx) > SWIPE_PX) go(i + (dx < 0 ? 1 : -1));
    },
  };
  const keys = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight") go(i + 1);
    if (e.key === "ArrowLeft") go(i - 1);
  };

  return (
    <div onKeyDown={keys} aria-roledescription="carousel" aria-label={`Photos of the ${title}`} className="min-w-0">
      {/* The photo keeps its frame (4:3 on a phone, 16:11 on a laptop) and fills it. On a phone the frame around
          it stands at least --photo-min-h tall — the car's page sets that so the first screen ends at the phone
          bar, with the row under the photo out of sight until the buyer scrolls. Where the frame is taller than
          the photo, the photo sits in the middle of a blurred copy of itself: the extra height is the car's own
          colours, not a band of Night, and the photo is cropped no more than it always was. */}
      <div
        className="relative flex flex-col justify-center overflow-hidden rounded-2xl border border-white/[0.07] bg-surface-2 max-lg:min-h-[var(--photo-min-h,0px)]"
        {...swipe}
      >
        {/* The same file the photo preloads (same src and sizes), so no second download; eager because on a tall
            frame this is the largest image painted, and a lazy LCP image is what Lighthouse flags. */}
        <VehicleImage
          key={`backdrop-${photos[i].url}`}
          src={photos[i].url}
          alt=""
          aria-hidden
          fill
          loading="eager"
          sizes="(min-width: 1024px) 60vw, 100vw"
          className="scale-125 object-cover opacity-50 blur-2xl lg:hidden"
        />
        {/* The arrows, the count and "Full screen" sit on the photo itself, not on the frame: when the frame
            stands taller than the photo its bottom edge may lie under the phone bar (a two-line name or facts
            list pushes it there), and anything anchored to it would be cut off. */}
        <div className="relative aspect-[4/3] w-full lg:aspect-[16/11]">
          <VehicleImage
            key={photos[i].url}
            src={photos[i].url}
            alt={photos[i].alt}
            fill
            priority={i === 0}
            sizes="(min-width: 1024px) 60vw, 100vw"
            className="object-cover"
          />
          {many && (
            <>
              <Arrow dir="prev" onClick={() => go(i - 1)} label="Previous photo" />
              <Arrow dir="next" onClick={() => go(i + 1)} label="Next photo" />
            </>
          )}
          <div className="absolute bottom-3 left-3 right-3 z-10 flex items-center justify-between">
            <span aria-live="polite" className="glass figures rounded-full px-3 py-1.5 text-xs font-medium text-white">
              <span className="figures">
                {i + 1} / {photos.length}
              </span>
            </span>
            {images.length > 0 && (
              <button
                type="button"
                onClick={() => dialog.current?.showModal()}
                className="glass rounded-full px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#090E0A]/80"
              >
                Full screen
              </button>
            )}
          </div>
        </div>
      </div>

      {between && <div className="mt-4 lg:hidden">{between}</div>}

      {many && (
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {photos.map((p, n) => (
            <button
              key={p.url}
              type="button"
              onClick={() => setI(n)}
              aria-label={`Photo ${n + 1}`}
              aria-current={n === i ? "true" : undefined}
              className={`relative aspect-[4/3] w-20 shrink-0 overflow-hidden rounded-lg border-2 transition-opacity md:w-24 ${
                n === i ? "border-green-500" : "border-transparent opacity-60 hover:opacity-100"
              }`}
            >
              <VehicleImage src={p.url} alt="" fill sizes="96px" className="object-cover" />
            </button>
          ))}
        </div>
      )}

      <dialog
        ref={dialog}
        onKeyDown={keys}
        className="m-0 h-dvh max-h-none w-screen max-w-none bg-[#090E0A] p-0 text-white backdrop:bg-black/90"
        aria-label={`${title} — full screen photos`}
      >
        <div className="relative h-full w-full" {...swipe}>
          <VehicleImage key={`full-${photos[i].url}`} src={photos[i].url} alt={photos[i].alt} fill sizes="100vw" className="object-contain" />
          {many && (
            <>
              <Arrow dir="prev" onClick={() => go(i - 1)} label="Previous photo" />
              <Arrow dir="next" onClick={() => go(i + 1)} label="Next photo" />
            </>
          )}
          <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between p-4">
            <span className="figures text-sm font-medium text-white">
              {i + 1} / {photos.length}
            </span>
            <button type="button" onClick={() => dialog.current?.close()} className="glass min-h-11 rounded-full px-4 text-sm font-semibold text-white" autoFocus>
              Close
            </button>
          </div>
        </div>
      </dialog>
    </div>
  );
}
