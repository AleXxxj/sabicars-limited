"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Check, Download, ExternalLink, Share2 } from "lucide-react";
import { VehicleImage } from "@/components/VehicleImage";
import { CopyButton } from "@/components/forms/PartnerForm";
import { Button, ButtonAnchor } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { brandPhoto, canSharePhotos, isApplePhone } from "@/lib/brand-photo";
import { sharePhotoSource, VEHICLE_PLACEHOLDER } from "@/lib/media";

export type ShareGroup = "suvs" | "cars" | "buses" | "trucks" | "other";

/** One car as the share page needs it. The words and the link are made on the server. */
export interface ShareCarView {
  slug: string;
  title: string;
  group: ShareGroup;
  /** "₦24,000,000", or null when the price is given on request. */
  price: string | null;
  /** What the partner earns if their buyer buys it: "₦360,000". */
  earn: string | null;
  /** The stored photo addresses, cover first. */
  photos: string[];
  /** The partner's link to this car: /r/CODE/slug. */
  link: string;
  /** The ready message: the car, the price, the link. */
  caption: string;
}

const GROUPS: { key: ShareGroup | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "buses", label: "Buses" },
  { key: "suvs", label: "SUVs" },
  { key: "cars", label: "Saloon cars" },
  { key: "trucks", label: "Trucks" },
  { key: "other", label: "Others" },
];

/**
 * Every car on sale, for a partner to share: tap a car, and its sheet sends it
 * on WhatsApp (the chat shows the car's photo; the buyer taps it and lands on
 * the car with the partner's code kept), posts its photos to a status or
 * Instagram through the phone's own share list, saves them to the phone, or
 * copies the words. The photos carry the Sabicars strip with the partner's
 * code (lib/brand-photo.ts).
 */
export function ShareCars({ cars, code, host, initialSlug }: { cars: ShareCarView[]; code: string; host: string; initialSlug?: string }) {
  const [group, setGroup] = useState<ShareGroup | "all">("all");
  const [openSlug, setOpenSlug] = useState<string | null>(() => (initialSlug && cars.some((c) => c.slug === initialSlug) ? initialSlug : null));
  const counts = useMemo(() => {
    const m = new Map<string, number>([["all", cars.length]]);
    for (const c of cars) m.set(c.group, (m.get(c.group) ?? 0) + 1);
    return m;
  }, [cars]);
  const shown = group === "all" ? cars : cars.filter((c) => c.group === group);
  const open = cars.find((c) => c.slug === openSlug) ?? null;

  if (!cars.length) {
    return (
      <p className="border border-dashed border-border-default px-6 py-10 text-center text-sm text-text-muted">
        No cars on sale right now. New cars show here the day they arrive.
      </p>
    );
  }

  return (
    <>
      {/* Chips only for kinds in stock, and only when there is more than one kind to choose between. */}
      {counts.size > 2 && (
        <div role="group" aria-label="Show" className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none] md:mx-0 md:flex-wrap md:px-0 [&::-webkit-scrollbar]:hidden">
          {GROUPS.filter((g) => counts.get(g.key)).map((g) => (
            <button
              key={g.key}
              type="button"
              aria-pressed={group === g.key}
              onClick={() => setGroup(g.key)}
              className={`min-h-11 shrink-0 rounded-full border px-4 text-sm font-semibold transition-colors ${
                group === g.key ? "border-green-400/60 bg-green-500/15 text-green-200" : "border-white/15 text-text-secondary hover:border-white/35 hover:text-text-primary"
              }`}
            >
              {g.label} <span className="figures font-normal text-text-muted">{counts.get(g.key)}</span>
            </button>
          ))}
        </div>
      )}

      <ul className="mt-6 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
        {shown.map((c) => (
          <li key={c.slug}>
            <button
              type="button"
              onClick={() => setOpenSlug(c.slug)}
              className="surface-card group flex h-full w-full flex-col overflow-hidden text-left"
              aria-label={`Share the ${c.title}`}
            >
              <div className="relative aspect-[4/3] w-full overflow-hidden bg-surface-2">
                <VehicleImage
                  src={c.photos[0] ?? VEHICLE_PLACEHOLDER}
                  alt=""
                  fill
                  sizes="(min-width: 1024px) 22vw, (min-width: 768px) 30vw, 48vw"
                  className="object-cover transition-transform duration-[var(--duration-slow)] ease-[var(--ease-out)] group-hover:scale-[1.04]"
                />
                {c.photos.length > 0 && (
                  <span className="figures absolute right-2 top-2 rounded-full bg-[#090E0A]/75 px-2 py-0.5 text-[0.7rem] text-text-secondary backdrop-blur">
                    {c.photos.length} {c.photos.length === 1 ? "photo" : "photos"}
                  </span>
                )}
              </div>
              <div className="flex flex-1 flex-col p-3 sm:p-4">
                <p className="line-clamp-2 text-sm text-text-primary group-hover:text-accent-text">{c.title}</p>
                <p className="figures mt-1 text-xs text-text-muted">{c.price ?? "Price on request"}</p>
                {c.earn && (
                  <p className="mt-auto pt-3 text-xs text-text-muted">
                    You earn <span className="figures text-brand block font-display text-[1.25rem] leading-tight sm:text-[1.4rem]">{c.earn}</span>
                  </p>
                )}
                <span className="mt-3 inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-white/15 text-sm font-semibold text-text-primary group-hover:border-white/35">
                  <Share2 aria-hidden size={16} />
                  Share
                </span>
              </div>
            </button>
          </li>
        ))}
      </ul>

      <Dialog open={Boolean(open)} onClose={() => setOpenSlug(null)} title={open?.title ?? "Share"}>
        {open && <ShareSheet key={open.slug} car={open} code={code} host={host} />}
      </Dialog>
    </>
  );
}

type Prepared = { file: File; url: string } | "failed" | null;

const noSubscription = () => () => {};

/**
 * Gets a car's photos ready the moment its sheet opens, two at a time, so the
 * buttons can hand them over at once: a phone opens its share list only in
 * direct answer to a tap, with no download in between. "Try again" redoes
 * only the photos that failed.
 */
function usePreparedPhotos(car: ShareCarView, code: string, host: string) {
  const [items, setItems] = useState<Prepared[]>(() => car.photos.map(() => null));
  const [queue, setQueue] = useState<number[]>(() => car.photos.map((_, i) => i));
  const made = useRef<string[]>([]);

  useEffect(() => {
    const urls = made.current;
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, []);

  useEffect(() => {
    if (!queue.length) return;
    const abort = new AbortController();
    let next = 0;
    const worker = async () => {
      while (next < queue.length && !abort.signal.aborted) {
        const i = queue[next++];
        try {
          const blob = await brandPhoto(sharePhotoSource(car.photos[i]), { code, host, signal: abort.signal });
          if (abort.signal.aborted) return;
          const file = new File([blob], `sabicars-${car.slug}-${i + 1}.jpg`, { type: "image/jpeg" });
          const url = URL.createObjectURL(blob);
          made.current.push(url);
          setItems((prev) => prev.map((p, j) => (j === i ? { file, url } : p)));
        } catch {
          if (abort.signal.aborted) return;
          setItems((prev) => prev.map((p, j) => (j === i ? "failed" : p)));
        }
      }
    };
    void Promise.all([worker(), worker()]);
    return () => abort.abort();
  }, [queue, car, code, host]);

  const retry = () => {
    setQueue(items.flatMap((p, i) => (p === "failed" ? [i] : [])));
    setItems((prev) => prev.map((p) => (p === "failed" ? null : p)));
  };
  return { items, retry };
}

function ShareSheet({ car, code, host }: { car: ShareCarView; code: string; host: string }) {
  const { items, retry } = usePreparedPhotos(car, code, host);
  const [left, setLeft] = useState<Set<number>>(new Set());
  const [note, setNote] = useState<string | null>(null);
  // Which phone this is never changes while the page is open: read once in the browser, "not an iPhone" on the server.
  const apple = useSyncExternalStore(noSubscription, isApplePhone, () => false);
  const saving = useRef(false);

  const ready = items.filter((p) => p && p !== "failed").length;
  const failed = items.filter((p) => p === "failed").length;
  const done = ready + failed === items.length;
  const chosen = items.flatMap((p, i) => (p && p !== "failed" && !left.has(i) ? [p.file] : []));
  const n = chosen.length;
  const shareable = done && canSharePhotos(chosen);
  const photos = `${n} ${n === 1 ? "photo" : "photos"}`;

  const toggle = (i: number) =>
    setLeft((prev) => {
      const s = new Set(prev);
      if (s.has(i)) s.delete(i);
      else s.add(i);
      return s;
    });

  /** The phone's own share list: WhatsApp status, Instagram, Facebook, with the words as the caption where the app takes one. */
  const post = async () => {
    setNote(null);
    try {
      await navigator.share({ files: chosen, text: car.caption });
    } catch (e) {
      if ((e as Error).name !== "AbortError") setNote("Your phone did not open its share list. Save the photos, then post them from your gallery.");
    }
  };

  const save = async () => {
    if (saving.current) return;
    setNote(null);
    // On an iPhone a download lands in Files, not Photos. The share list's "Save Images" puts them in Photos.
    if (apple && shareable) {
      try {
        await navigator.share({ files: chosen });
      } catch (e) {
        if ((e as Error).name !== "AbortError") setNote("Your phone did not open its share list. Press and hold a photo above, then tap Save to Photos.");
      }
      return;
    }
    saving.current = true;
    for (const [k, file] of chosen.entries()) {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(file);
      a.download = file.name;
      document.body.append(a);
      a.click();
      a.remove();
      const href = a.href;
      setTimeout(() => URL.revokeObjectURL(href), 10_000);
      // A short pause between files: browsers drop downloads fired in the same instant.
      if (k < chosen.length - 1) await new Promise((r) => setTimeout(r, 350));
    }
    saving.current = false;
    setNote(n > 1 ? `Saved ${photos} to Downloads. If your phone asks to allow many downloads, tap Allow.` : "Saved to Downloads.");
  };

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <p className="figures text-lg text-text-primary">{car.price ?? "Price on request"}</p>
        {car.earn && (
          <p className="text-sm text-text-muted">
            You earn <span className="figures text-brand font-display text-[1.35rem]">{car.earn}</span>
          </p>
        )}
      </div>

      <ButtonAnchor href={`https://wa.me/?text=${encodeURIComponent(car.caption)}`} target="_blank" rel="noopener noreferrer" size="lg" className="mt-5 w-full">
        Send on WhatsApp
      </ButtonAnchor>
      <p className="mt-2 text-xs leading-relaxed text-text-muted">WhatsApp shows the car&rsquo;s photo. When your buyer taps it, the car opens, and your code goes with them.</p>

      {items.length === 0 ? (
        <p className="mt-7 border-t border-white/[0.06] pt-6 text-sm text-text-muted">No photos of this car yet. Send the link: the car page shows them the day they are added.</p>
      ) : (
        <div className="mt-7 border-t border-white/[0.06] pt-6">
          <div className="flex items-baseline justify-between gap-4">
            <p className="text-sm font-medium text-text-secondary">Photos with your code</p>
            <p className="figures text-xs text-text-muted" aria-live="polite">
              {done ? (failed ? `${ready} of ${items.length} ready` : `${n} of ${items.length} chosen`) : `Getting ready… ${ready} of ${items.length}`}
            </p>
          </div>
          <ul className="-mx-6 mt-3 flex snap-x gap-2 overflow-x-auto scroll-px-6 px-6 pb-1 [scrollbar-width:none] md:-mx-8 md:scroll-px-8 md:px-8 [&::-webkit-scrollbar]:hidden">
            {items.map((p, i) => (
              <li key={i} className="w-[42%] shrink-0 snap-start sm:w-[30%]">
                {p && p !== "failed" ? (
                  <button
                    type="button"
                    onClick={() => toggle(i)}
                    aria-pressed={!left.has(i)}
                    aria-label={`Photo ${i + 1}`}
                    className={`relative block w-full overflow-hidden rounded-xl border transition-opacity ${left.has(i) ? "border-white/10 opacity-40" : "border-green-400/50"}`}
                  >
                    {/* A photo this browser just made: there is nothing for next/image to resize. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.url} alt="" className="block h-auto w-full" />
                    <span
                      aria-hidden
                      className={`absolute right-1.5 top-1.5 inline-flex size-6 items-center justify-center rounded-full ${left.has(i) ? "border border-white/50 bg-[#090E0A]/60" : "bg-green-400 text-[#0B1206]"}`}
                    >
                      {!left.has(i) && <Check size={14} strokeWidth={3} />}
                    </span>
                  </button>
                ) : (
                  <div className={`flex aspect-[4/3] items-center justify-center rounded-xl bg-surface-2 px-2 text-center text-xs text-text-muted ${p ? "" : "animate-pulse"}`}>
                    {p === "failed" ? "Did not load" : ""}
                  </div>
                )}
              </li>
            ))}
          </ul>
          {items.length > 1 && done && ready > 0 && <p className="mt-2 text-xs text-text-muted">Tap a photo to leave it out.</p>}
          {done && failed > 0 && (
            <button type="button" onClick={retry} className="mt-2 min-h-11 text-sm font-semibold text-green-300 hover:text-green-200">
              Try the photos again
            </button>
          )}

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {shareable && (
              <Button type="button" variant="secondary" onClick={post} disabled={!n}>
                <Share2 aria-hidden size={18} />
                Post {photos}
              </Button>
            )}
            <Button type="button" variant="secondary" onClick={save} disabled={!done || !n}>
              <Download aria-hidden size={18} />
              {done ? `Save ${photos}` : "Getting photos ready…"}
            </Button>
          </div>
          {apple && shareable && <p className="mt-2 text-xs leading-relaxed text-text-muted">To keep them on your iPhone, tap Save, then Save Images.</p>}
          {note && (
            <p role="status" className="mt-3 text-sm text-text-secondary">
              {note}
            </p>
          )}
        </div>
      )}

      <div className="mt-7 border-t border-white/[0.06] pt-6">
        <p className="text-sm font-medium text-text-secondary">The words</p>
        <p className="mt-2 whitespace-pre-line rounded-xl bg-surface-2 px-4 py-3 text-sm leading-relaxed text-text-primary">{car.caption}</p>
        <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-3">
          <CopyButton text={car.caption} label="Copy words" />
          <a
            href={`/vehicles/${car.slug}`}
            target="_blank"
            rel="noopener"
            className="inline-flex min-h-12 items-center gap-2 text-sm font-semibold text-green-300 hover:text-green-200"
          >
            See the car page
            <ExternalLink aria-hidden size={15} />
          </a>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-text-muted">Posting on Instagram? Copy the words first, then paste them under your photos.</p>
      </div>
    </div>
  );
}
