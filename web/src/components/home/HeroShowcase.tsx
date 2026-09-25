"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { VehicleImage } from "@/components/VehicleImage";

export interface HeroSlide {
  url: string;
  title: string;
  price: string;
  href: string;
}

const INTERVAL_MS = 7000;

/** The connection type is read once; nothing to subscribe to. */
const noSubscription = () => () => {};

function youTubeId(url: string): string | null {
  const m = url.match(/(?:youtube(?:-nocookie)?\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}

/** Most visitors are on metered mobile data: no background video for data-saver or slow connections. */
function videoAllowed(): boolean {
  const c = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
  if (!c) return true;
  return !c.saveData && !["slow-2g", "2g", "3g"].includes(c.effectiveType ?? "");
}

/**
 * The homepage hero: the stock itself, shown slowly.
 *
 * Each vehicle drifts and crossfades into the next; a caption names the car on
 * screen with its price and a link, so the backdrop is also a way in. Images
 * after the first are only fetched once they are about to be shown. Automatic
 * movement can be paused (WCAG 2.2.2) and stops when the tab is hidden.
 *
 * When staff set a hero video, it plays over the slideshow once it is actually
 * running — never a black box — and not at all on slow or data-saver
 * connections, where the slideshow stays.
 */
export function HeroShowcase({ slides, videoUrl }: { slides: HeroSlide[]; videoUrl: string | null }) {
  const [index, setIndex] = useState(0);
  const [previous, setPrevious] = useState<number | null>(null);
  // Each slide's "generation" bumps when it becomes active, remounting it so
  // its drift restarts from the beginning even if it was the last one shown.
  const [generation, setGeneration] = useState<number[]>(() => slides.map(() => 0));
  const [loaded, setLoaded] = useState<Set<number>>(() => new Set([0, 1]));
  const [paused, setPaused] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [videoOn, setVideoOn] = useState(false);
  const [muted, setMuted] = useState(true);
  const frame = useRef<HTMLIFrameElement>(null);
  const video = useRef<HTMLVideoElement>(null);

  const go = useCallback(
    (next: number) => {
      if (slides.length < 2) return;
      const n = (next + slides.length) % slides.length;
      if (n === index) return;
      setPrevious(index);
      setIndex(n);
      setGeneration((g) => g.map((v, k) => (k === n ? v + 1 : v)));
      // Fetch the slide after this one now, so it is ready before it is needed.
      setLoaded((l) => new Set([...l, n, (n + 1) % slides.length]));
    },
    [index, slides.length],
  );

  useEffect(() => {
    const onVisibility = () => setHidden(document.hidden);
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  useEffect(() => {
    if (paused || hidden || videoOn || slides.length < 2) return;
    const t = setTimeout(() => go(index + 1), INTERVAL_MS);
    return () => clearTimeout(t);
  }, [index, paused, hidden, videoOn, slides.length, go]);

  // The connection is only knowable in the browser: the server renders
  // without video, and the browser switches it on after hydrating if allowed.
  const connectionOk = useSyncExternalStore(noSubscription, videoAllowed, () => false);
  const playVideo = Boolean(videoUrl) && connectionOk;

  function toggleSound() {
    const next = !muted;
    setMuted(next);
    if (frame.current) frame.current.contentWindow?.postMessage(JSON.stringify({ event: "command", func: next ? "mute" : "unMute", args: [] }), "*");
    if (video.current) video.current.muted = next;
  }

  const ytId = videoUrl ? youTubeId(videoUrl) : null;
  const current = slides[index];

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Vehicles in stock"
      className="relative isolate flex min-h-[calc(100svh-4rem)] items-end overflow-hidden bg-[#0B0A09] md:min-h-[calc(100svh-5rem)]"
      style={{ ["--hero-interval" as string]: `${INTERVAL_MS}ms` }}
    >
      {/* The stock, drifting. */}
      <div aria-hidden className="absolute inset-0 -z-30">
        {slides.map((s, i) =>
          loaded.has(i) ? (
            <div
              key={`${i}-${generation[i]}`}
              data-slide={i === index ? "active" : i === previous ? "leaving" : "idle"}
              className="absolute inset-0"
            >
              <VehicleImage src={s.url} alt="" fill priority={i === 0} sizes="100vw" className="object-cover" />
            </div>
          ) : null,
        )}
      </div>

      {/* Video, over the slideshow, once it is really playing. */}
      {playVideo && videoUrl && (
        <div aria-hidden className={`absolute inset-0 -z-20 overflow-hidden transition-opacity duration-[1400ms] [container-type:size] ${videoOn ? "opacity-100" : "opacity-0"}`}>
          {ytId ? (
            <iframe
              ref={frame}
              title="Sabicars showcase video"
              src={`https://www.youtube-nocookie.com/embed/${ytId}?autoplay=1&mute=1&loop=1&playlist=${ytId}&controls=0&playsinline=1&modestbranding=1&rel=0&enablejsapi=1`}
              allow="autoplay; encrypted-media"
              onLoad={() => setTimeout(() => setVideoOn(true), 1500)}
              className="pointer-events-none absolute left-1/2 top-1/2 h-[max(100cqh,56.25cqw)] w-[max(100cqw,177.78cqh)] -translate-x-1/2 -translate-y-1/2 border-0"
            />
          ) : (
            <video ref={video} src={videoUrl} autoPlay muted loop playsInline onPlaying={() => setVideoOn(true)} className="h-full w-full object-cover" />
          )}
        </div>
      )}

      {/* Scrims: the words must be legible whatever the photograph does. */}
      <div aria-hidden className="absolute inset-0 -z-10" style={{ background: "var(--hero-scrim)" }} />
      <div aria-hidden className="absolute inset-0 -z-10" style={{ background: "var(--hero-scrim-bottom)" }} />

      <div className="mx-auto w-full max-w-7xl px-5 pb-8 pt-14 md:px-10 md:pb-14 md:pt-28">
        <p className="eyebrow !text-gold-300">Sabicars Limited · Igando, Lagos · RC 1560100</p>
        <h1 className="mt-6 max-w-4xl text-display-1 text-[var(--hero-text)]">
          Every car verified.
          <br />
          <em className="text-gold-300">Every deal</em> on record.
        </h1>
        <p className="mt-5 max-w-xl text-base leading-relaxed text-[var(--hero-text-secondary)] md:mt-6 md:text-lg">
          Luxury cars, Toyota Hiace buses, SUVs and trucks — photographed, priced and documented. Drive today on the 40% Drive Plan,
          or let us supply your fleet.
        </p>
        <div className="mt-8 flex flex-wrap gap-3 md:mt-10 md:gap-4">
          <Link
            href="/vehicles"
            className="inline-flex min-h-14 items-center bg-gold-500 px-8 text-[0.78rem] font-semibold uppercase tracking-[0.18em] text-[#0B0A09] transition-colors [font-stretch:115%] hover:bg-gold-400"
          >
            View the inventory
          </Link>
          <Link
            href="/drive-plan"
            className="inline-flex min-h-14 items-center border border-white/40 px-8 text-[0.78rem] font-semibold uppercase tracking-[0.18em] text-white transition-colors [font-stretch:115%] hover:border-white"
          >
            The 40% Drive Plan
          </Link>
        </div>

        {/* What is on screen, and a way to it. */}
        <div className="mt-10 flex flex-wrap items-end justify-between gap-6 border-t border-white/15 pt-5 md:mt-14">
          {current && !videoOn ? (
            <Link href={current.href} aria-live="polite" className="group min-w-0 text-[var(--hero-text-secondary)]">
              <span className="eyebrow !text-[0.62rem] !text-white/60">Now showing</span>
              <span className="mt-1 block truncate text-sm text-white transition-colors group-hover:text-gold-300">
                {current.title} <span className="figures text-white/70">· {current.price}</span> <span aria-hidden>→</span>
              </span>
            </Link>
          ) : (
            <span />
          )}

          <div className="flex items-center gap-4">
            {videoOn ? (
              <button type="button" onClick={toggleSound} className="eyebrow min-h-11 !text-white/80 hover:!text-white">
                {muted ? "Sound on" : "Sound off"}
              </button>
            ) : (
              slides.length > 1 && (
                <>
                  <div className="flex gap-1.5">
                    {slides.map((s, i) => (
                      <button key={s.href} type="button" onClick={() => go(i)} aria-label={`Show ${s.title}`} aria-current={i === index ? "true" : undefined} className="flex h-11 w-8 items-center md:w-10">
                        <span className="relative block h-0.5 w-full overflow-hidden bg-white/25">
                          {i === index && (
                            <span
                              key={`${index}-${generation[i]}`}
                              data-progress="running"
                              className="absolute inset-0 origin-left bg-gold-300"
                              style={{ animationPlayState: paused || hidden ? "paused" : "running" }}
                            />
                          )}
                        </span>
                      </button>
                    ))}
                  </div>
                  <button type="button" onClick={() => setPaused((p) => !p)} className="eyebrow min-h-11 w-14 text-left !text-[0.62rem] !text-white/70 hover:!text-white">
                    {paused ? "Play" : "Pause"}
                  </button>
                </>
              )
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
