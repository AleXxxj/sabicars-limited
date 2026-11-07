/**
 * A car photo with the Sabicars strip under it, made in the partner's own
 * browser for "Cars to share" (/partner/cars). Browser only.
 *
 * A photo posted on a WhatsApp status or Instagram cannot carry a link: it is
 * only a picture. So the strip carries what a buyer needs to come back: the
 * Sabicars name, the site's address, and the partner's code, which the buyer
 * gives at the park or on the phone so the sale is still the partner's. The
 * strip goes under the photo, never over it: the whole car stays in view. It
 * also marks the photo as Sabicars' own, where photos are lifted and reposted.
 *
 * Made here, not by Cloudinary: a text overlay there would be a new paid copy
 * of every photo for every partner. Here it costs nothing but the download.
 */

const NIGHT = "#090E0A";
const ORANGE = "#F7801E";
const TEXT = "#CFD2CC";
const LOGO = "/brand/logo-email.png";

type Loaded = { img: CanvasImageSource; width: number; height: number; release: () => void };

/**
 * Fetches a photo and decodes it from a local copy. Fetched, not set as an
 * <img> address, so an aborted sheet stops the download, and the canvas can
 * always read the pixels (a local copy is never "another site"). Decoded as
 * a bitmap where the browser can: an <img> decodes only while the page is on
 * screen, so a partner who steps into WhatsApp while the photos are made
 * would come back to a sheet still waiting.
 */
async function loadImage(src: string, signal?: AbortSignal): Promise<Loaded> {
  const res = await fetch(src, { signal, mode: "cors", credentials: "omit" });
  if (!res.ok) throw new Error(`Photo answered ${res.status}`);
  const blob = await res.blob();
  if (typeof createImageBitmap === "function") {
    const bitmap = await createImageBitmap(blob);
    return { img: bitmap, width: bitmap.width, height: bitmap.height, release: () => bitmap.close() };
  }
  const url = URL.createObjectURL(blob);
  const img = new Image();
  img.src = url;
  try {
    await img.decode();
  } catch (e) {
    URL.revokeObjectURL(url);
    throw e;
  }
  return { img, width: img.naturalWidth, height: img.naturalHeight, release: () => URL.revokeObjectURL(url) };
}

let logo: Promise<Loaded> | null = null;
function logoImage(): Promise<Loaded> {
  logo ??= loadImage(LOGO).catch((e) => {
    logo = null;
    throw e;
  });
  return logo;
}

/** The page's own font (Archivo), so the strip reads like the site. */
function pageFont(): string {
  return getComputedStyle(document.body).fontFamily || "sans-serif";
}

export interface BrandOptions {
  /** The partner's code, printed in orange: "Code ALEHTS". */
  code: string;
  /** The site's address as a buyer types it: "sabicars.com". */
  host: string;
  signal?: AbortSignal;
}

/** The photo, with the strip, as a JPEG ready to share or save. */
export async function brandPhoto(src: string, { code, host, signal }: BrandOptions): Promise<Blob> {
  const [photo, mark] = await Promise.all([loadImage(src, signal), logoImage()]);
  try {
    if (signal?.aborted) throw new DOMException("The sheet was closed.", "AbortError");
    const w = photo.width;
    const h = photo.height;
    // The strip scales with the photo: 8% of its width, never thinner than a thumb can read or thicker than it needs.
    const bar = Math.round(Math.min(Math.max(w * 0.08, 56), 128));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h + bar;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("This browser cannot draw photos.");

    ctx.drawImage(photo.img, 0, 0, w, h);
    ctx.fillStyle = NIGHT;
    ctx.fillRect(0, h, w, bar);

    const pad = Math.round(bar * 0.34);
    const logoH = Math.round(bar * 0.42);
    const logoW = Math.round((logoH * mark.width) / mark.height);
    ctx.drawImage(mark.img, pad, h + Math.round((bar - logoH) / 2), logoW, logoH);

    // Right side: "Code ALEHTS   sabicars.com", shrunk until it fits beside the logo; the address goes first if room runs out.
    const font = pageFont();
    const codeText = `Code ${code}`;
    const gap = Math.round(bar * 0.3);
    let size = Math.round(bar * 0.3);
    let showHost = true;
    const widths = () => {
      ctx.font = `700 ${size}px ${font}`;
      const a = ctx.measureText(codeText).width;
      ctx.font = `500 ${size}px ${font}`;
      const b = showHost ? ctx.measureText(host).width + gap : 0;
      return { a, b, fits: pad + logoW + gap + a + b + pad <= w };
    };
    let m = widths();
    while (!m.fits && size > 12) {
      size -= 1;
      m = widths();
    }
    if (!m.fits) {
      showHost = false;
      size = Math.round(bar * 0.3);
      m = widths();
      while (!m.fits && size > 10) {
        size -= 1;
        m = widths();
      }
    }
    const y = h + bar / 2;
    ctx.textBaseline = "middle";
    ctx.textAlign = "right";
    if (showHost) {
      ctx.font = `500 ${size}px ${font}`;
      ctx.fillStyle = TEXT;
      ctx.fillText(host, w - pad, y);
    }
    ctx.font = `700 ${size}px ${font}`;
    ctx.fillStyle = ORANGE;
    ctx.fillText(codeText, w - pad - m.b, y);

    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("The photo could not be made."))), "image/jpeg", 0.9),
    );
  } finally {
    photo.release();
  }
}

/* ── The status picture ──────────────────────────────────────────────── */

const TEXT_PRIMARY = "#F2F2EC";
const GREEN = "#A5DB6F";

/** 9:16, the shape a WhatsApp status and an Instagram story fill edge to edge. */
const POSTER = { w: 1080, h: 1920 } as const;
/** Kept clear for the app's own layers: its name and time bar at the top, the caption it lays over the bottom. */
const SAFE_TOP = 140;
const SAFE_BOTTOM = 1700;
const SIDE = 64;

export interface PosterOptions extends BrandOptions {
  title: string;
  /** "₦250,000,000", or null: the picture then says to ask for the price. */
  price: string | null;
  /** The Drive Plan line where the car's year allows it, already worded with its condition; or null. */
  drivePlan: string | null;
}

/** Lines of at most `max` width, at most `lines` of them, the last cut with "…" if the text runs on. */
function wrap(ctx: CanvasRenderingContext2D, text: string, max: number, lines: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const out: string[] = [];
  let i = 0;
  while (i < words.length && out.length < lines) {
    let line = words[i++];
    while (i < words.length && ctx.measureText(`${line} ${words[i]}`).width <= max) line += ` ${words[i++]}`;
    out.push(line);
  }
  if (i < words.length && out.length) {
    let last = out[out.length - 1];
    while (last && ctx.measureText(`${last}…`).width > max) last = last.slice(0, -1).trimEnd();
    out[out.length - 1] = `${last}…`;
  }
  return out;
}

/** The photo cut to fill the box, the way a phone fills a frame: kept centred across, a little below centre down, where a car sits. */
function drawCover(ctx: CanvasRenderingContext2D, { img, width, height }: Loaded, x: number, y: number, w: number, h: number) {
  const scale = Math.max(w / width, h / height);
  const sw = w / scale;
  const sh = h / scale;
  const sx = (width - sw) / 2;
  const sy = Math.min(Math.max((height - sh) * 0.55, 0), height - sh);
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}

/** The site's display voice where the browser can draw it: Archivo set slightly wide (globals.css uses 112%). */
function setStretch(ctx: CanvasRenderingContext2D, stretch: "normal" | "semi-expanded") {
  if ("fontStretch" in ctx) (ctx as CanvasRenderingContext2D & { fontStretch: string }).fontStretch = stretch;
}

/**
 * One picture that fills a WhatsApp status or an Instagram story from edge to
 * edge: the Sabicars logo, the car's photo across the full width, then "For
 * sale in Lagos", its name, the price, the Drive Plan line where the year
 * allows it, and the partner's code with the site's address.
 *
 * Why it exists: a status with a link shows the car's photo only as a small
 * card that WhatsApp sizes, and no website can make it bigger. A picture
 * posted as the status fills the screen; the link goes in its caption.
 *
 * Unlike the photos, it carries the price: a status lasts a day, and the
 * picture is made fresh from today's price each time it is posted.
 */
export async function statusPoster(src: string, { code, host, title, price, drivePlan, signal }: PosterOptions): Promise<Blob> {
  const [photo, mark] = await Promise.all([loadImage(src, signal), logoImage()]);
  try {
    if (signal?.aborted) throw new DOMException("The sheet was closed.", "AbortError");
    await document.fonts?.ready;
    const font = pageFont();
    const canvas = document.createElement("canvas");
    canvas.width = POSTER.w;
    canvas.height = POSTER.h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("This browser cannot draw photos.");
    const textWidth = POSTER.w - SIDE * 2;

    // Night with depth, never a flat black: a faint green light rising behind the words.
    ctx.fillStyle = NIGHT;
    ctx.fillRect(0, 0, POSTER.w, POSTER.h);
    const glow = ctx.createRadialGradient(POSTER.w * 0.3, POSTER.h * 0.8, 40, POSTER.w * 0.3, POSTER.h * 0.8, POSTER.h * 0.55);
    glow.addColorStop(0, "rgba(120, 176, 48, 0.16)");
    glow.addColorStop(1, "rgba(120, 176, 48, 0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, POSTER.w, POSTER.h);

    // Measure the words first: the photo takes whatever height they leave, up to its own shape.
    ctx.textBaseline = "top";
    setStretch(ctx, "semi-expanded");
    ctx.font = `700 60px ${font}`;
    const titleLines = wrap(ctx, title, textWidth, 2);
    const priceText = price ?? "Ask for the price";
    let priceSize = price ? 120 : 76;
    ctx.font = `800 ${priceSize}px ${font}`;
    while (ctx.measureText(priceText).width > textWidth && priceSize > 56) ctx.font = `800 ${(priceSize -= 4)}px ${font}`;
    setStretch(ctx, "normal");
    ctx.font = `500 40px ${font}`;
    const planLines = drivePlan ? wrap(ctx, drivePlan, textWidth, 2) : [];

    const KICKER = 34 + 22;
    const TITLE = titleLines.length * 72 + 18;
    const PRICE = Math.round(priceSize * 1.08) + 26;
    const PLAN = planLines.length ? planLines.length * 54 + 30 : 0;
    const CODE = 50;
    const words = KICKER + TITLE + PRICE + PLAN + CODE;

    const logoH = 64;
    const logoW = Math.round((logoH * mark.width) / mark.height);
    ctx.drawImage(mark.img, SIDE, SAFE_TOP + 16, logoW, logoH);

    // The car as big as the room allows: up to a fifth taller than the photo's own shape (its sides trimmed by at most a
    // sixth, where a car rarely reaches), never taller than the words leave. Room still over is shared above and below it.
    const below = SAFE_TOP + 16 + logoH + 52;
    const natural = Math.round(POSTER.w * (photo.height / photo.width));
    const room = SAFE_BOTTOM - 64 - words - below;
    const photoH = Math.max(600, Math.min(Math.round(natural * 1.2), room, 1080));
    const spare = Math.max(0, room - photoH);
    const photoTop = below + Math.round(spare / 2);
    drawCover(ctx, photo, 0, photoTop, POSTER.w, photoH);

    let y = photoTop + photoH + 64 + Math.round(spare / 2);
    ctx.fillStyle = GREEN;
    ctx.font = `700 30px ${font}`;
    if ("letterSpacing" in ctx) (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = "6px";
    ctx.fillText("FOR SALE IN LAGOS", SIDE, y);
    if ("letterSpacing" in ctx) (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = "0px";
    y += KICKER;

    setStretch(ctx, "semi-expanded");
    ctx.fillStyle = TEXT_PRIMARY;
    ctx.font = `700 60px ${font}`;
    for (const line of titleLines) {
      ctx.fillText(line, SIDE, y);
      y += 72;
    }
    y += 18;
    ctx.font = `800 ${priceSize}px ${font}`;
    ctx.fillText(priceText, SIDE, y);
    y += PRICE;
    setStretch(ctx, "normal");

    if (planLines.length) {
      ctx.fillStyle = GREEN;
      ctx.font = `500 40px ${font}`;
      for (const line of planLines) {
        ctx.fillText(line, SIDE, y);
        y += 54;
      }
      y += 30;
    }

    ctx.font = `700 42px ${font}`;
    ctx.fillStyle = ORANGE;
    const codeText = `Code ${code}`;
    ctx.fillText(codeText, SIDE, y);
    const after = SIDE + ctx.measureText(codeText).width + 28;
    ctx.font = `500 42px ${font}`;
    ctx.fillStyle = TEXT;
    if (after + ctx.measureText(host).width <= POSTER.w - SIDE) ctx.fillText(host, after, y);

    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("The picture could not be made."))), "image/jpeg", 0.9),
    );
  } finally {
    photo.release();
  }
}

/** iPhone or iPad, where "save" means the share sheet's Save Images: a download lands in Files, not in Photos. */
export function isApplePhone(): boolean {
  return /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

/** Whether this browser can hand photos to other apps (WhatsApp, Instagram, Facebook) through the phone's share sheet. */
export function canSharePhotos(files: File[]): boolean {
  try {
    return files.length > 0 && typeof navigator.canShare === "function" && navigator.canShare({ files });
  } catch {
    return false;
  }
}
