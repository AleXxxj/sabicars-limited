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

type Loaded = { img: HTMLImageElement; release: () => void };

/**
 * Fetches a photo and decodes it from a local copy. Fetched, not set as an
 * <img> address, so an aborted sheet stops the download, and the canvas can
 * always read the pixels (a local copy is never "another site").
 */
async function loadImage(src: string, signal?: AbortSignal): Promise<Loaded> {
  const res = await fetch(src, { signal, mode: "cors", credentials: "omit" });
  if (!res.ok) throw new Error(`Photo answered ${res.status}`);
  const url = URL.createObjectURL(await res.blob());
  const img = new Image();
  img.src = url;
  try {
    await img.decode();
  } catch (e) {
    URL.revokeObjectURL(url);
    throw e;
  }
  return { img, release: () => URL.revokeObjectURL(url) };
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
    const w = photo.img.naturalWidth;
    const h = photo.img.naturalHeight;
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
    const logoW = Math.round((logoH * mark.img.naturalWidth) / mark.img.naturalHeight);
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
