/**
 * Which service a video link belongs to, and how to embed it. Every embed is
 * "lite": the page shows a poster, and the service's player (and its
 * trackers and megabytes) loads only when the reader taps play — on a Nigerian
 * data plan that is the difference between an article that loads and one that
 * does not.
 */
export type VideoSource =
  | { kind: "youtube"; id: string; vertical: boolean; embed: string; poster: string }
  | { kind: "tiktok"; id: string; vertical: true; embed: string; url: string }
  | { kind: "instagram"; code: string; vertical: true; embed: string; url: string }
  | { kind: "facebook"; vertical: boolean; embed: string; url: string }
  | { kind: "file"; src: string; poster: string | null; vertical: false };

export function videoSource(raw: string): VideoSource | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^(www|m|web|mbasic)\./, "");

  if (host === "youtu.be" || host === "youtube.com" || host === "youtube-nocookie.com") {
    const shorts = url.pathname.match(/^\/shorts\/([\w-]{6,})/);
    const id =
      shorts?.[1] ??
      (host === "youtu.be" ? url.pathname.slice(1) : (url.searchParams.get("v") ?? url.pathname.match(/^\/embed\/([\w-]+)/)?.[1]));
    if (!id || !/^[\w-]{6,20}$/.test(id)) return null;
    return {
      kind: "youtube",
      id,
      vertical: Boolean(shorts),
      embed: `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&playsinline=1&modestbranding=1`,
      poster: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
    };
  }
  if (host === "tiktok.com") {
    const id = url.pathname.match(/\/video\/(\d{8,25})/)?.[1];
    if (!id) return null;
    return { kind: "tiktok", id, vertical: true, embed: `https://www.tiktok.com/player/v1/${id}?autoplay=1&rel=0`, url: raw };
  }
  if (host === "instagram.com") {
    const code = url.pathname.match(/^\/(?:reel|reels|p|tv)\/([\w-]+)/)?.[1];
    if (!code) return null;
    return { kind: "instagram", code, vertical: true, embed: `https://www.instagram.com/reel/${code}/embed/`, url: raw };
  }
  if (host === "facebook.com" || host === "fb.watch" || host === "fb.com") {
    // A video post, a reel, a watch link or a share link. Facebook's own player embeds any of them
    // from the full link; a profile or page link is not a video.
    const reel = /^\/(?:reel|reels)\//.test(url.pathname) || /\/share\/r\//.test(url.pathname);
    const video = reel || host === "fb.watch" || /\/videos?\//.test(url.pathname) || /^\/watch\/?$/.test(url.pathname) || /\/share\/v\//.test(url.pathname);
    if (!video) return null;
    return {
      kind: "facebook",
      vertical: reel,
      embed: `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(raw)}&show_text=false&autoplay=1`,
      url: raw,
    };
  }
  if (host === "res.cloudinary.com" && url.pathname.includes("/video/upload/")) {
    // Cloudinary serves a poster frame from the same asset: swap the extension for .jpg.
    return {
      kind: "file",
      src: raw,
      poster: raw.replace(/\/video\/upload\//, "/video/upload/so_0,q_auto,w_1280/").replace(/\.\w+$/, ".jpg"),
      vertical: false,
    };
  }
  if (/\.(mp4|webm|mov)$/i.test(url.pathname)) return { kind: "file", src: raw, poster: null, vertical: false };
  return null;
}
