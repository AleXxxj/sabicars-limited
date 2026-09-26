"use client";

import { useEffect, useRef, useState } from "react";
import { Play, Volume2, VolumeX } from "lucide-react";
import type { VideoSource } from "@/lib/blog/video";

const LABEL = { youtube: "YouTube", tiktok: "TikTok", instagram: "Instagram" } as const;

/**
 * A video inside an article.
 *
 * Sabicars' own clips play as silent loops the moment they scroll into view —
 * like a moving photograph — with a tap for sound. YouTube, TikTok and
 * Instagram show a poster until tapped, so their players load only for a
 * reader who wants them.
 */
export function VideoPlayer({ source, poster, title }: { source: VideoSource; poster: string | null; title: string }) {
  if (source.kind === "file") return <LoopingClip src={source.src} poster={source.poster} title={title} />;

  return <LiteEmbed source={source} poster={poster} title={title} />;
}

function LoopingClip({ src, poster, title }: { src: string; poster: string | null; title: string }) {
  const video = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);

  useEffect(() => {
    const v = video.current;
    if (!v) return;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting && !still) v.play().catch(() => {});
        else v.pause();
      },
      { threshold: 0.35 },
    );
    io.observe(v);
    return () => io.disconnect();
  }, []);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-surface-2">
      <video
        ref={video}
        src={src}
        poster={poster ?? undefined}
        muted={muted}
        loop
        playsInline
        preload="metadata"
        aria-label={title}
        className="block aspect-video w-full object-cover"
      />
      <button
        type="button"
        onClick={() => {
          const v = video.current;
          if (!v) return;
          v.muted = !muted;
          setMuted(!muted);
          if (v.paused) v.play().catch(() => {});
        }}
        aria-label={muted ? "Turn the sound on" : "Turn the sound off"}
        className="glass absolute right-3 bottom-3 inline-flex size-11 items-center justify-center rounded-full text-white"
      >
        {muted ? <VolumeX aria-hidden size={18} /> : <Volume2 aria-hidden size={18} />}
      </button>
    </div>
  );
}

function LiteEmbed({ source, poster, title }: { source: Exclude<VideoSource, { kind: "file" }>; poster: string | null; title: string }) {
  const [playing, setPlaying] = useState(false);
  const shape = source.vertical ? "mx-auto aspect-[9/16] w-full max-w-[22rem]" : "aspect-video w-full";

  if (playing) {
    return (
      <div className={`${shape} overflow-hidden rounded-2xl border border-white/[0.08] bg-black`}>
        <iframe
          src={source.embed}
          title={title}
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
          className="size-full border-0"
        />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setPlaying(true)}
      aria-label={`Play: ${title} (${LABEL[source.kind]})`}
      className={`${shape} group relative block overflow-hidden rounded-2xl border border-white/[0.08] bg-[radial-gradient(120%_90%_at_30%_20%,rgb(201_168_76/0.22),transparent_60%),var(--surface-2)] text-left`}
    >
      {poster && (
        // eslint-disable-next-line @next/next/no-img-element -- the service's own poster frame
        <img
          src={poster}
          alt=""
          loading="lazy"
          className="absolute inset-0 size-full object-cover transition-transform duration-[var(--duration-slow)] ease-[var(--ease-out)] group-hover:scale-[1.03]"
        />
      )}
      <span aria-hidden className="absolute inset-0 bg-gradient-to-t from-[#0A0908]/85 via-[#0A0908]/15 to-transparent" />
      <span
        aria-hidden
        className="absolute top-1/2 left-1/2 inline-flex size-16 -translate-1/2 items-center justify-center rounded-full bg-gold-400 text-[#0A0908] shadow-[0_12px_40px_-8px_rgb(201_168_76/0.7)] transition-transform duration-[var(--duration-base)] group-hover:scale-110"
      >
        <Play size={26} className="translate-x-0.5 fill-current" />
      </span>
      <span className="absolute inset-x-4 bottom-4 flex items-end justify-between gap-3 text-white">
        <span className="line-clamp-2 text-sm font-semibold">{title}</span>
        <span className="glass shrink-0 rounded-full px-2.5 py-1 text-[0.7rem] font-semibold tracking-wide">{LABEL[source.kind]}</span>
      </span>
    </button>
  );
}
