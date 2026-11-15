"use client";

import Link from "@/components/IntentLink";
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
/** Read once; nothing to subscribe to. */
const noSubscription = () => () => {};

/** After "Watch video", or after the phone refused to start it, how long before a video that never plays is given up. */
const ASKED_GIVE_UP_MS = 45_000;
/** A YouTube player that tried to play (buffering) and fell back to waiting for this long was refused by the phone. */
const REFUSED_AFTER_MS = 1_500;
/** The player's own ways to say it was refused: posted on a page that subscribes to them (YouTube's IFrame API). */
const SUBSCRIBE_REFUSED = JSON.stringify({ event: "command", func: "addEventListener", args: ["onAutoplayBlocked"], id: 1, channel: "widget" });
const LISTENING = JSON.stringify({ event: "listening", id: 1, channel: "widget" });

/**
 * The homepage opened with ?video starts the hero video at once, as if "Watch video" had been tapped: the preview staff
 * open from Admin, Audience ("See it play").
 */
const previewVideo = () => new URLSearchParams(window.location.search).has("video");

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
 * When staff set a hero video (Admin → Audience), a "Watch video" button
 * among the slide controls offers it on every load, and it never starts by
 * itself, so it uses nobody's data unasked (the owner, 14 November 2026, as
 * he saw it on his computer). Tapped, the button says "Loading video…" until
 * the video runs over the photos, muted, with a sound and a stop button; then
 * the slides carry on, and the button is gone until the page is loaded again.
 * It plays for the seconds set beside it, 20 unless changed, counted in the
 * video's own time, and it stops for good when the visitor scrolls past it.
 * A phone that will not start it (an iPhone in Low Power Mode) says so
 * through the player, and only then is the player shown, with its own play
 * button and "Tap the video to play" in the strip; until the video plays or
 * is refused, the photos stay, however slow the line.
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
  // The video has really started (the player said so), so it is shown until it ends or is stopped, through any pause to load.
  const [started, setStarted] = useState(false);
  const [videoDone, setVideoDone] = useState(false);
  // The phone refused to start it by itself (an iPhone in Low Power Mode, a browser set never to autoplay): the player
  // is then shown with its own play button, and takes taps. Only then: a player still loading must not cover the photos
  // with a black box that a tap would stop (review of 7c1faac, 15 November 2026).
  const [refused, setRefused] = useState(false);
  // What the YouTube player last said of itself, whether it has tried to play yet, and the refusal fallback's timer.
  const lastState = useRef<number | null>(null);
  const triedToPlay = useRef(false);
  const refuseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Where the page was when the visitor asked for the video: if they scroll away meanwhile, nothing moves it back.
  const askedAt = useRef<number | null>(null);
  // The player has answered at least once, so it is listening and need not be asked again.
  const heard = useRef(false);
  const [muted, setMuted] = useState(true);
  const reduced = useSyncExternalStore(subscribeReduced, () => window.matchMedia(REDUCED).matches, () => false);
  const section = useRef<HTMLElement>(null);
  const photos = useRef<HTMLDivElement>(null);
  const touch = useRef<{ x: number; y: number } | null>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const video = useRef<HTMLVideoElement>(null);

  // The video plays only when asked for: "Watch video" on every load (or ?video, staff's preview). Offered once the page
  // is awake, never in the server's HTML: until then a tap on it would do nothing.
  const [asked, setAsked] = useState(false);
  const preview = useSyncExternalStore(noSubscription, previewVideo, () => false);
  const hydrated = useSyncExternalStore(noSubscription, () => true, () => false);
  const requested = asked || preview;
  const playVideo = Boolean(videoUrl) && requested && !videoDone;
  const offerVideo = Boolean(videoUrl) && hydrated && !requested && !videoDone;
  // "Loading video…" with the photos, until the player plays or the phone refuses it.
  const loadingVideo = playVideo && !started && !refused;
  // Shown over the photos: once it plays, or once the phone has refused to start it.
  const videoShown = playVideo && (started || refused);
  // Refused and not started: the player waits for a tap on its own play button, so it takes taps (home.css).
  const waiting = playVideo && refused && !started;
  const ytId = videoUrl ? youTubeId(videoUrl) : null;
  const auto = count > 1 && !reduced;
  const running = auto && !userPaused && !hidden && !offscreen && !focusInside && !videoShown;

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
    setVideoDone(true);
  }, []);

  // Asked for and not playing: given up after ASKED_GIVE_UP_MS if nothing happens, and the photos stay. A refusal starts
  // the count again, so a visitor shown the play button has the same time to find it.
  useEffect(() => {
    if (!playVideo || started) return;
    const giveUp = setTimeout(finish, ASKED_GIVE_UP_MS);
    return () => clearTimeout(giveUp);
  }, [playVideo, started, refused, finish]);

  // Refused, its play button is in the middle of the player. On a short screen (a phone turned sideways, scrolled to
  // reach "Watch video") the middle can lie under the header or the tab bar: the page moves just far enough to bring it
  // into sight between them. Not if the visitor has scrolled since asking: the page is theirs to move.
  useEffect(() => {
    const el = photos.current;
    if (!waiting || !el || askedAt.current === null || Math.abs(window.scrollY - askedAt.current) > 24) return;
    const r = el.getBoundingClientRect();
    const middle = r.top + r.height / 2;
    const top = (document.querySelector("header")?.getBoundingClientRect().bottom ?? 0) + 24;
    const bar = document.querySelector('nav[aria-label="Quick"]')?.getBoundingClientRect();
    const bottom = (bar && bar.height > 0 ? bar.top : window.innerHeight) - 24;
    const by = middle < top ? middle - top : middle > bottom ? middle - bottom : 0;
    if (by) window.scrollBy({ top: by, behavior: reduced ? "auto" : "smooth" });
  }, [waiting, reduced]);

  // Started: its share of the hero is its seconds, and a few more for loading. YouTube is told the same with end= and
  // says when it ends; this is the backstop for a player that goes quiet, so the slides always come back.
  useEffect(() => {
    if (!started || videoDone) return;
    const t = setTimeout(finish, (videoSeconds + 8) * 1000);
    return () => clearTimeout(t);
  }, [started, videoDone, videoSeconds, finish]);

  // Keyboard users keep their place: when the controls change under them (the loading pill gives way to Stop, or Stop to
  // the slides), focus moves to the control that took its place instead of falling to the page, which also left the
  // slideshow paused for good (review of 7c1faac, 15 November 2026). Only for focus the keyboard put there.
  useEffect(() => {
    const el = section.current;
    if (!el || !focusInside) return;
    const active = document.activeElement;
    if (active && active !== document.body) return;
    const next = el.querySelector<HTMLElement>(
      videoShown ? '[aria-label="Stop the video"]' : '.hh-watch, [aria-label="Pause the slideshow"], [aria-label="Play the slideshow"], .hh-now',
    );
    if (next) next.focus();
    else setFocusInside(false);
  }, [videoShown, focusInside]);

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

  // YouTube reports its state only to a page that asks: 1 is playing, 0 is ended. The video shows once it has
  // really started: a player still loading, or blocked, would otherwise cover the photos with a black box.
  useEffect(() => {
    if (!playVideo) return;
    const onMessage = (e: MessageEvent) => {
      // This hero's own player only: not another frame, nor one already taken off the page.
      if (!frame.current || e.source !== frame.current.contentWindow || typeof e.data !== "string") return;
      try {
        if (!/youtube(-nocookie)?\.com$/.test(new URL(e.origin).hostname)) return;
        const data = JSON.parse(e.data) as { event?: string; info?: { playerState?: number } };
        if (!heard.current) {
          heard.current = true;
          // Awake now, so the subscription to its refusal is sure to be taken.
          frame.current.contentWindow?.postMessage(SUBSCRIBE_REFUSED, "*");
        }
        if (data.event === "onAutoplayBlocked") {
          setRefused(true);
          return;
        }
        const state = data.event === "infoDelivery" || data.event === "initialDelivery" ? data.info?.playerState : undefined;
        if (state === undefined) return;
        lastState.current = state;
        // Its first answer counts too: a player that started before it was first asked says so only then.
        if (state === 0 && data.event === "infoDelivery") finish();
        else if (state === 1) setStarted(true);
        if (state === 3 || state === 1) {
          triedToPlay.current = true;
          if (refuseTimer.current) clearTimeout(refuseTimer.current);
          refuseTimer.current = null;
        } else if ((state === -1 || state === 5) && triedToPlay.current && !refuseTimer.current) {
          // For a browser that does not send onAutoplayBlocked: it tried to play, then went back to waiting, and stayed.
          refuseTimer.current = setTimeout(() => {
            refuseTimer.current = null;
            if (lastState.current === -1 || lastState.current === 5) setRefused(true);
          }, REFUSED_AFTER_MS);
        }
      } catch {
        /* not the player's message */
      }
    };
    window.addEventListener("message", onMessage);
    return () => {
      window.removeEventListener("message", onMessage);
      if (refuseTimer.current) clearTimeout(refuseTimer.current);
      refuseTimer.current = null;
    };
  }, [playVideo, finish]);

  // Asking once, when the frame loads, is not enough: on a phone the player is often not awake yet and the question
  // is lost, and then the page never hears that it plays (on a slow line the player first answered after 22 s). YouTube's
  // own script asks again until it is answered; so does this, every 400 ms until it answers or the video is given up.
  // Each time it also asks to be told if the phone refuses to start it.
  useEffect(() => {
    if (!playVideo || !ytId) return;
    heard.current = false;
    triedToPlay.current = false;
    lastState.current = null;
    const ask = setInterval(() => {
      if (heard.current) {
        clearInterval(ask);
        return;
      }
      frame.current?.contentWindow?.postMessage(LISTENING, "*");
      frame.current?.contentWindow?.postMessage(SUBSCRIBE_REFUSED, "*");
    }, 400);
    return () => clearInterval(ask);
  }, [playVideo, ytId]);

  // A video file: asked to play straight away, so a refusal is known (a refused autoplay attribute says nothing).
  useEffect(() => {
    const v = video.current;
    if (!playVideo || ytId || !v) return;
    v.play().catch((e: unknown) => {
      if ((e as { name?: string } | null)?.name === "NotAllowedError") setRefused(true);
    });
  }, [playVideo, ytId]);

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
  const shown = videoShown ? 0 : Math.min(current?.head ?? 0, heads.length - 1);

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
      // The player is waiting for a tap on its own play button: the words over it let taps through (home.css).
      data-video={waiting ? "waiting" : undefined}
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
          // Shown and not started, it takes taps, so the player's own play button works on a phone that blocks autoplay;
          // playing, it does not, so a tap or a swipe on the hero never pauses it by accident. data-started: it really
          // plays (the smoke tests wait for it).
          <div className={`hh-video${videoShown ? " is-on" : ""}${waiting ? " is-waiting" : ""}`} data-started={started || undefined}>
            {ytId ? (
              <iframe
                ref={frame}
                title="Sabicars showcase video"
                // Decoration: the Tab key must go from "Skip to content" to the first real button, not into YouTube's player.
                tabIndex={-1}
                src={`https://www.youtube-nocookie.com/embed/${ytId}?autoplay=1&mute=1&controls=0&playsinline=1&modestbranding=1&rel=0&enablejsapi=1&start=0&end=${videoSeconds}`}
                allow="autoplay; encrypted-media"
                onLoad={() => {
                  frame.current?.contentWindow?.postMessage(LISTENING, "*");
                  frame.current?.contentWindow?.postMessage(SUBSCRIBE_REFUSED, "*");
                }}
              />
            ) : (
              <video
                ref={video}
                src={videoUrl}
                autoPlay
                muted
                playsInline
                // Refused: its own play button, and a tap on it starts it.
                controls={waiting}
                onClick={(e) => {
                  if (!started) e.currentTarget.play().catch(() => {});
                }}
                onPlaying={() => setStarted(true)}
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
            {videoShown ? (
              <div className="hh-track">
                {waiting ? (
                  // Refused by the phone: the player's own play button starts it, and the strip says so in words.
                  <p className="hh-watch hh-tap" role="status">
                    <Play aria-hidden size={12} />
                    Tap the video to play
                  </p>
                ) : (
                  <button type="button" className="hh-pause" aria-label={muted ? "Sound on" : "Sound off"} onClick={toggleSound}>
                    {muted ? <VolumeX aria-hidden size={16} /> : <Volume2 aria-hidden size={16} />}
                  </button>
                )}
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
                      <button
                        type="button"
                        className="hh-watch"
                        // aria-disabled, not disabled: a button that disables itself drops keyboard focus to the page.
                        aria-disabled={loadingVideo || undefined}
                        onClick={() => {
                          if (loadingVideo) return;
                          askedAt.current = window.scrollY;
                          setAsked(true);
                        }}
                      >
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
