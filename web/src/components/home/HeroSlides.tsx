"use client";

import Link from "next/link";
import { ArrowRight, Pause, Play, Square, Volume2, VolumeX } from "lucide-react";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type FocusEvent, type ReactNode, type TouchEvent } from "react";
import { VehicleImage } from "@/components/VehicleImage";
import { heroPhotoSources } from "@/lib/media";
import type { HeroSlide } from "./heroDeck";

export type { HeroSlide };

/** How long a car is shown. Its segment fills for as long. */
const CAR_MS = 6000;
/** A service slide has a headline and a line to read, so it stays longer. */
const SERVICE_MS = 8000;
/** A photo's width over its height as CSS takes it; 4:3, a phone's landscape photo, until it is known or when it is absurd. */
const shape = (ratio: number | null | undefined) => (ratio && ratio > 0.4 && ratio < 3 ? ratio.toFixed(4) : "1.3333");
const timeFor = (s: HeroSlide) => (s.head > 0 ? SERVICE_MS : CAR_MS);

const REDUCED = "(prefers-reduced-motion: reduce)";
function subscribeReduced(onChange: () => void) {
  const mq = window.matchMedia(REDUCED);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}
/** The connection type is read once; nothing to subscribe to. */
const noSubscription = () => () => {};

/**
 * The homepage opened with ?video plays the hero video whatever the connection: a preview for staff (linked from
 * Admin, Audience). Chrome rates many Lagos connections "3g" (the owner's office on 14 November 2026: 1.35 Mbps, 500 ms),
 * so without it the people who set the video could not see it play.
 */
const previewVideo = () => new URLSearchParams(window.location.search).has("video");

/** Most visitors are on metered mobile data: no video for data-saver or slow connections, nor for anyone who asked for less motion. */
function videoAllowed(): boolean {
  if (previewVideo()) return true;
  if (window.matchMedia(REDUCED).matches) return false;
  const c = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
  if (!c) return true;
  return !c.saveData && !["slow-2g", "2g", "3g"].includes(c.effectiveType ?? "");
}

function youTubeId(url: string): string | null {
  const m = url.match(/(?:youtube(?:-nocookie)?\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}

/**
 * The home page's hero, built the way the Adedayo Aremu Autos hero is (the
 * owner, 14 November 2026): the cars for sale one after another, the page's
 * first words on the photo's lower part, and the three doors right under it.
 * Every slide has its own words over its own car: the opening one, then one
 * for each thing Sabicars does (heroDeck.ts; styles/home.css). Nothing is
 * said or shown twice in one turn.
 *
 * Each slide shows for a few seconds with a slow zoom, then crossfades to
 * the next, words and photo together. Every set of words lies in one grid cell at the
 * foot of the photo, so the photo's height and the doors never move.
 *
 * Along the photo's bottom edge the controls are one quiet strip: the name
 * of the car in the photo as a link to its page, a row of thin segments
 * (each a button to its slide, the current one filling as its time runs),
 * and a pause button. Swiping across the hero changes slide on a phone.
 *
 * It stops by itself whenever it would be moving for nobody, or in someone's
 * way: while the tab is hidden, while the hero is scrolled out of sight, and
 * while keyboard focus is inside it. The pause button stops it for good
 * (WCAG 2.2.2). Someone who asked their phone for less motion gets no
 * auto-advance and no zoom; the segments still work. The words that are not
 * showing are inert, so their link can't be reached unseen.
 *
 * The advance is driven by the segment's own fill animation ending, so the
 * bar and the change of slide can never drift apart.
 *
 * When staff set a hero video (Admin → Audience), it plays once over the
 * photos, muted, once it is really running, with a sound and a stop button;
 * then the slides carry on (the owner, 8 November 2026). It plays for the
 * seconds set beside it, 20 unless changed, counted in the video's own time,
 * and it stops for good when the visitor scrolls past it (the owner, 14
 * November 2026), so it never plays, or uses their data, for nobody. On a
 * slow or data-saving connection, or for someone who asked for less motion,
 * it does not start by itself: a "Watch video" button among the slide
 * controls offers it, the same day's choice of the owner.
 */
export function HeroSlides({
  slides,
  heads,
  videoUrl,
  videoSeconds,
  children,
}: {
  slides: HeroSlide[];
  /** The sets of words, one per worded slide: heads[0] opens the page (and shows while the video plays); a slide names its own by `head`. */
  heads: ReactNode[];
  videoUrl: string | null;
  /** How long the video plays before the slides come back (lib/hero-video.ts). */
  videoSeconds: number;
  /** The doors and links under the photo: the same on every slide. */
  children: ReactNode;
}) {
  const count = slides.length;
  const [index, setIndex] = useState(0);
  // Photos that have been current or next; they stay mounted for crossfades.
  const [loaded, setLoaded] = useState<number[]>(count > 1 ? [0, 1] : [0]);
  const [userPaused, setUserPaused] = useState(false);
  // Each photo's measured shape, by slide.
  const [ratios, setRatios] = useState<Record<number, number>>({});
  const measured = useCallback((i: number, img: HTMLImageElement) => {
    const { naturalWidth: w, naturalHeight: h } = img;
    if (w && h) setRatios((r) => (r[i] === w / h ? r : { ...r, [i]: w / h }));
  }, []);
  const [hidden, setHidden] = useState(false);
  const [offscreen, setOffscreen] = useState(false);
  const [focusInside, setFocusInside] = useState(false);
  const [videoOn, setVideoOn] = useState(false);
  const [videoDone, setVideoDone] = useState(false);
  const [muted, setMuted] = useState(true);
  const reduced = useSyncExternalStore(subscribeReduced, () => window.matchMedia(REDUCED).matches, () => false);
  const connectionOk = useSyncExternalStore(noSubscription, videoAllowed, () => false);
  const section = useRef<HTMLElement>(null);
  const photos = useRef<HTMLDivElement>(null);
  const touch = useRef<{ x: number; y: number } | null>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const video = useRef<HTMLVideoElement>(null);

  // A slow or data-saving connection, or a visitor who asked for less motion: the video does not start by itself.
  // A "Watch video" button offers it instead, so it only uses their data if they ask (the owner, 14 November 2026).
  // Offered once the page knows the connection, never in the server's HTML, so a fast connection never sees it flash.
  const [asked, setAsked] = useState(false);
  const hydrated = useSyncExternalStore(noSubscription, () => true, () => false);
  const playVideo = Boolean(videoUrl) && (connectionOk || asked) && !videoDone;
  const offerVideo = Boolean(videoUrl) && hydrated && !connectionOk && !asked && !videoDone;
  const loadingVideo = asked && !videoOn && !videoDone;
  const ytId = videoUrl ? youTubeId(videoUrl) : null;
  const auto = count > 1 && !reduced;
  const running = auto && !userPaused && !hidden && !offscreen && !focusInside && !videoOn;

  const goTo = useCallback(
    (to: number) => {
      if (count < 2) return;
      const i = ((to % count) + count) % count;
      setIndex(i);
      setLoaded((l) => {
        const next = (i + 1) % count;
        const add = [i, next].filter((n) => !l.includes(n));
        return add.length ? [...l, ...add] : l;
      });
    },
    [count],
  );

  /** The video has played through, or was stopped: it leaves, and the slides carry on. */
  const finish = useCallback(() => {
    setVideoOn(false);
    setVideoDone(true);
  }, []);

  // Asked for on a slow connection but still not playing after 30 seconds: given up, and the photos stay.
  useEffect(() => {
    if (!loadingVideo) return;
    const t = setTimeout(finish, 30_000);
    return () => clearTimeout(t);
  }, [loadingVideo, finish]);

  // Hidden tab.
  useEffect(() => {
    const onVisibility = () => setHidden(document.visibilityState === "hidden");
    onVisibility();
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  // Scrolled out of sight.
  useEffect(() => {
    const el = section.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([entry]) => setOffscreen(!entry.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // The video's own area scrolled out of sight, up past the header (72px at most) or down below the screen: the
  // video stops for good, as if Stop were pressed, and the slides are there when the visitor comes back. Its area, not
  // the whole hero: on a phone the doors under it are still in sight when the video has gone up under the header.
  useEffect(() => {
    const el = photos.current;
    if (!playVideo || !el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) finish();
    }, { rootMargin: "-72px 0px 0px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [playVideo, finish]);

  // YouTube reports its state only to a page that asks: 1 is playing, 0 is ended. The video shows only while
  // it is really playing: a player still buffering, or blocked, would otherwise cover the photos with a black box.
  useEffect(() => {
    if (!playVideo) return;
    const onMessage = (e: MessageEvent) => {
      if (typeof e.data !== "string" || !/youtube(-nocookie)?\.com$/.test(new URL(e.origin).hostname)) return;
      try {
        const data = JSON.parse(e.data) as { event?: string; info?: { playerState?: number } };
        if (data.event !== "infoDelivery" || data.info?.playerState === undefined) return;
        if (data.info.playerState === 0) finish();
        else setVideoOn(data.info.playerState === 1);
      } catch {
        /* not the player's message */
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [playVideo, finish]);

  function toggleSound() {
    const next = !muted;
    setMuted(next);
    if (frame.current) frame.current.contentWindow?.postMessage(JSON.stringify({ event: "command", func: next ? "mute" : "unMute", args: [] }), "*");
    if (video.current) video.current.muted = next;
  }

  // Keyboard focus inside. A tap or click gives a button focus too, but not :focus-visible, so pressing a
  // segment does not freeze the show.
  const onFocus = (e: FocusEvent<HTMLElement>) => {
    let keyboard = true;
    try {
      keyboard = e.target.matches(":focus-visible");
    } catch {
      /* An older browser: treat any focus as the keyboard's. */
    }
    if (keyboard) setFocusInside(true);
  };
  const onBlur = (e: FocusEvent<HTMLElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocusInside(false);
  };

  // A swipe across the hero, not a scroll down it.
  const onTouchStart = (e: TouchEvent) => {
    const t = e.touches[0];
    touch.current = t ? { x: t.clientX, y: t.clientY } : null;
  };
  const onTouchEnd = (e: TouchEvent) => {
    const start = touch.current;
    const t = e.changedTouches[0];
    touch.current = null;
    if (!start || !t || count < 2) return;
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.5) goTo(index + (dx < 0 ? 1 : -1));
  };

  const current = slides[index];
  const previous = count > 1 ? (index - 1 + count) % count : -1;
  // While the video plays, the opening words stay: the video is not any one service's slide.
  const shown = videoOn ? 0 : Math.min(current?.head ?? 0, heads.length - 1);

  return (
    <section
      ref={section}
      className="hh"
      aria-label="Sabicars: cars for sale, and what we do"
      onFocus={onFocus}
      onBlur={onBlur}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      data-running={running ? "true" : "false"}
      data-words={shown === 0 ? "opening" : "service"}
    >
      <div ref={photos} className="hh-photos" aria-hidden="true">
        {slides.map((s, i) =>
          loaded.includes(i) ? (
            <div
              // By position: a car's photo can come round twice, once on its own and once behind a service.
              key={i}
              className={`hh-photo${i === index ? " is-current" : ""}${i === previous ? " is-previous" : ""}`}
              // The photo's own shape; 4:3, a phone's landscape photo, until it is known.
              style={{ ["--hh-ratio" as string]: shape(ratios[i] ?? s.ratio) }}
            >
              {/* On a phone the car is whole, never enlarged (the owner, 14 November 2026: "fit perfectly in the hero slide
                  view like not zoomed in"), and the same photo, tiny and blurred, fills the stage behind it, so a photo of
                  any shape sits on its own colours and not on black bars. On a tablet and a wide screen the photo alone
                  covers the stage, as Adedayo's does, and the blurred copy is not shown: two copies of one car, at two
                  sizes, read as a glitch (home.css). */}
              <span className="hh-photo-back">
                <VehicleImage src={s.src} alt="" fill sizes="96px" />
              </span>
              <span
                className="hh-photo-car"
                // Most photos carry no size on record: the photo itself says its shape once it is here. Asked when it
                // mounts too: the first photo is often here before the page wakes, and its load event is then missed.
                ref={(el) => {
                  const img = el?.querySelector("img");
                  if (img?.complete) measured(i, img);
                }}
              >
                <HeroPhoto src={s.src} first={i === 0} onShape={(img) => measured(i, img)} />
              </span>
            </div>
          ) : null,
        )}
        {playVideo && videoUrl && (
          <div className={`hh-video${videoOn ? " is-on" : ""}`}>
            {ytId ? (
              <iframe
                ref={frame}
                title="Sabicars showcase video"
                // Decoration: the Tab key must go from "Skip to content" to the first real button, not into YouTube's player.
                tabIndex={-1}
                src={`https://www.youtube-nocookie.com/embed/${ytId}?autoplay=1&mute=1&controls=0&playsinline=1&modestbranding=1&rel=0&enablejsapi=1&start=0&end=${videoSeconds}`}
                allow="autoplay; encrypted-media"
                onLoad={() => frame.current?.contentWindow?.postMessage(JSON.stringify({ event: "listening", id: 1, channel: "widget" }), "*")}
              />
            ) : (
              <video
                ref={video}
                src={videoUrl}
                autoPlay
                muted
                playsInline
                onPlaying={() => setVideoOn(true)}
                // Its share of the hero, in its own time: YouTube is told the same with end= above.
                onTimeUpdate={(e) => {
                  if (e.currentTarget.currentTime >= videoSeconds) finish();
                }}
                onEnded={finish}
                onError={finish}
              />
            )}
          </div>
        )}
      </div>

      {/* The words, on the photo. Every set lies in one grid cell (home.css), at the photo's foot, so none moves
          anything when it gives way to another. */}
      <div className="hh-words">
        <div className="hh-inner">
          <div className="hh-heads">
            {heads.map((head, i) => (
              <div key={i} className={`hh-head${i === shown ? " is-on" : ""}`} inert={i !== shown} aria-hidden={i !== shown || undefined}>
                {head}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* The doors and links: right under the photo on a phone, under the words on a wide screen. */}
      <div className="hh-body">
        <div className="hh-inner">
          <div className="hh-copy">{children}</div>
        </div>
      </div>

      {/* After the doors in the page's order, so a keyboard reaches them first. Shown along the bottom edge of
          the photo on a phone, and at the bottom right on a wide screen (home.css). */}
      {count > 0 && current && (
        <div className="hh-dock">
          <div className="hh-controls" role="group" aria-label="Photos of our cars">
            {videoOn ? (
              <div className="hh-track">
                <button type="button" className="hh-pause" aria-label={muted ? "Sound on" : "Sound off"} onClick={toggleSound}>
                  {muted ? <VolumeX aria-hidden size={16} /> : <Volume2 aria-hidden size={16} />}
                </button>
                {/* Moving content that starts by itself must be stoppable (WCAG 2.2.2): the photographs come back. */}
                <button type="button" className="hh-pause" aria-label="Stop the video" onClick={finish}>
                  <Square aria-hidden size={13} />
                </button>
              </div>
            ) : (
              <>
                <Link href={current.href} className="hh-now" aria-label={`${current.name}${current.note ? `, ${current.note}` : ""}`}>
                  {/* A long name is cut short; its price never is. */}
                  <span className="hh-now-car">{current.name}</span>
                  {current.note && <span className="hh-now-note figures">· {current.note}</span>}
                  <ArrowRight aria-hidden size={15} />
                </Link>

                {(count > 1 || offerVideo || loadingVideo) && (
                  <div className="hh-track">
                    {(offerVideo || loadingVideo) && (
                      <button type="button" className="hh-watch" onClick={() => setAsked(true)} disabled={loadingVideo}>
                        <Play aria-hidden size={12} />
                        {loadingVideo ? "Loading video…" : "Watch video"}
                      </button>
                    )}
                    {count > 1 && (
                    <div className="hh-segments">
                      {slides.map((s, i) => (
                        <button
                          key={i}
                          type="button"
                          className={`hh-seg${i < index ? " is-done" : ""}${i === index ? " is-current" : ""}`}
                          aria-label={`Show photo ${i + 1} of ${count}: ${s.label ?? s.name}`}
                          aria-current={i === index ? "true" : undefined}
                          onClick={() => goTo(i)}
                        >
                          <span className="hh-seg-bar">
                            {i === index && (
                              <span
                                // A new element per slide, so its fill starts empty.
                                key={`fill-${index}`}
                                className={`hh-seg-fill${auto ? " is-timed" : ""}`}
                                style={{ animationDuration: `${timeFor(s)}ms`, animationPlayState: running ? "running" : "paused" }}
                                onAnimationEnd={() => goTo(index + 1)}
                              />
                            )}
                          </span>
                        </button>
                      ))}
                    </div>
                    )}
                    {auto && (
                      <button type="button" className="hh-pause" aria-label={userPaused ? "Play the slideshow" : "Pause the slideshow"} onClick={() => setUserPaused((p) => !p)}>
                        {userPaused ? <Play aria-hidden size={13} /> : <Pause aria-hidden size={13} />}
                      </button>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

/**
 * A slide's photo, framed on the car by Cloudinary (lib/media.ts, heroPhotoSources): on a phone or a tablet the car
 * whole, and on a wide screen a wider strip centred on the car, to cover the whole hero. One <picture>, so a browser
 * fetches only the one it shows. A plain <img>: the framing is a transformation next/image's loaders do not make.
 */
function HeroPhoto({ src, first, onShape }: { src: string; first: boolean; onShape: (img: HTMLImageElement) => void }) {
  const sources = heroPhotoSources(src);
  if (!sources) return <VehicleImage src={src} alt="" fill priority={first} sizes="100vw" onLoad={(e) => onShape(e.currentTarget)} />;
  return (
    <picture>
      <source media="(min-width: 1024px)" srcSet={sources.wide} sizes="100vw" />
      <img
        src={sources.fallback}
        srcSet={sources.srcSet}
        // As wide as the screen on a phone, and across a tablet's whole stage.
        sizes="100vw"
        alt=""
        // The first photo is the page's largest paint: fetched at once and first. The others wait until they are next.
        loading={first ? "eager" : "lazy"}
        fetchPriority={first ? "high" : "auto"}
        decoding="async"
        onLoad={(e) => onShape(e.currentTarget)}
      />
    </picture>
  );
}
