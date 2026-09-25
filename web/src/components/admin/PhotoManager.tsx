"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { VehicleImage } from "@/components/VehicleImage";
import { photoUploadTicket, recordPhoto, removePhoto, reorderPhotos } from "@/lib/actions/vehicles";

export interface ManagedPhoto {
  id: string;
  url: string;
  alt: string | null;
}

interface Outcome {
  name: string;
  state: "waiting" | "uploading" | "done" | "failed";
  error?: string;
}

/** Long edge after shrinking. Sharp on a 4K screen, a fraction of a phone photo's size. */
const MAX_EDGE = 2400;

/**
 * Shrinks a photo in the browser before it is sent.
 *
 * A phone photograph is 3–8MB; on a Nigerian mobile connection that is the
 * difference between a listing made in a minute and one abandoned half-way.
 * Re-encoded at 2,400px it is a few hundred kilobytes and still sharp. If the
 * browser cannot decode the file (HEIC on some Android browsers), the original
 * is sent unchanged and Cloudinary converts it.
 */
async function shrink(file: File): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size < 1_500_000) return file;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.86));
    return blob ?? file;
  } catch {
    return file;
  }
}

/**
 * Every photo of one vehicle: upload, order, choose the cover, remove.
 *
 * Photos go straight from the phone to Cloudinary, one request per file, so a
 * single bad file fails on its own and names itself while the rest land. The
 * controls always come back, even if something unexpected stops the run —
 * a button stuck on "Uploading 3 of 8…" with nothing behind it is worse than
 * an honest error.
 */
export function PhotoManager({ vehicleId, photos: initial }: { vehicleId: string; photos: ManagedPhoto[] }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [photos, setPhotos] = useState(initial);
  const [outcomes, setOutcomes] = useState<Outcome[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // New props (after a refresh) replace local order, unless a change is mid-flight.
  const [lastInitial, setLastInitial] = useState(initial);
  if (initial !== lastInitial) {
    setLastInitial(initial);
    setPhotos(initial);
  }

  async function upload(files: File[]) {
    if (!files.length) return;
    setError(null);
    setUploading(true);
    const results: Outcome[] = files.map((f) => ({ name: f.name, state: "waiting" }));
    setOutcomes([...results]);
    try {
      for (const [i, file] of files.entries()) {
        results[i] = { name: file.name, state: "uploading" };
        setOutcomes([...results]);
        try {
          const ticket = await photoUploadTicket(vehicleId);
          if ("error" in ticket) throw new Error(ticket.error);
          const body = new FormData();
          for (const [k, v] of Object.entries(ticket.fields)) body.set(k, v);
          body.set("file", await shrink(file), file.name.replace(/\.\w+$/, ".jpg"));
          const res = await fetch(ticket.url, { method: "POST", body });
          const asset = await res.json();
          if (!res.ok) throw new Error(asset?.error?.message ?? "Upload refused");
          const saved = await recordPhoto(vehicleId, asset);
          if (!saved.ok) throw new Error(saved.error);
          results[i] = { name: file.name, state: "done" };
        } catch (e) {
          results[i] = { name: file.name, state: "failed", error: e instanceof Error ? e.message : "Upload failed" };
        }
        setOutcomes([...results]);
      }
    } finally {
      setUploading(false);
      if (input.current) input.current.value = "";
      router.refresh();
    }
  }

  function applyOrder(next: ManagedPhoto[]) {
    const previous = photos;
    setPhotos(next);
    setError(null);
    startTransition(async () => {
      const res = await reorderPhotos(vehicleId, next.map((p) => p.id));
      if (!res.ok) {
        setPhotos(previous);
        setError(res.error ?? "The new order could not be saved.");
      } else {
        router.refresh();
      }
    });
  }

  function move(index: number, to: number) {
    if (to < 0 || to >= photos.length) return;
    const next = [...photos];
    const [p] = next.splice(index, 1);
    next.splice(to, 0, p);
    applyOrder(next);
  }

  function remove(photo: ManagedPhoto) {
    if (!window.confirm("Remove this photo from the listing?")) return;
    const previous = photos;
    setPhotos(photos.filter((p) => p.id !== photo.id));
    startTransition(async () => {
      const res = await removePhoto(vehicleId, photo.id);
      if (!res.ok) {
        setPhotos(previous);
        setError(res.error ?? "The photo could not be removed.");
      } else {
        router.refresh();
      }
    });
  }

  const done = outcomes.filter((o) => o.state === "done").length;
  const failed = outcomes.filter((o) => o.state === "failed");

  return (
    <section aria-labelledby="photos-heading">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 id="photos-heading" className="eyebrow">
            Photos <span className="figures !text-text-muted">({photos.length})</span>
          </h2>
          <p className="mt-2 text-sm text-text-muted">The first photo is the cover. Lead with an exterior three-quarter view in daylight.</p>
        </div>
        <label className={`eyebrow inline-flex min-h-12 cursor-pointer items-center border border-gold-500 px-5 !text-accent-text hover:bg-surface-1 ${uploading ? "pointer-events-none opacity-60" : ""}`}>
          {uploading ? `Uploading ${Math.min(done + failed.length + 1, outcomes.length)} of ${outcomes.length}…` : "Add photos"}
          <input
            ref={input}
            type="file"
            accept="image/*"
            multiple
            disabled={uploading}
            onChange={(e) => upload([...(e.target.files ?? [])])}
            className="sr-only"
          />
        </label>
      </div>

      {error && (
        <p role="alert" className="mt-4 border-l-2 border-danger bg-surface-1 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      )}

      {outcomes.length > 0 && !uploading && (
        <p role="status" className={`mt-4 text-sm ${failed.length ? "text-warning" : "text-success"}`}>
          {done} of {outcomes.length} uploaded.
          {failed.map((f) => (
            <span key={f.name} className="mt-1 block text-danger">
              {f.name}: {f.error}
            </span>
          ))}
        </p>
      )}

      {photos.length === 0 ? (
        <p className="mt-6 border border-dashed border-border-default px-6 py-12 text-center text-sm text-text-muted">
          No photos yet. Buyers skip listings without them — add at least five.
        </p>
      ) : (
        <ol className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {photos.map((p, i) => (
            <li key={p.id} className="group relative border border-border-subtle bg-surface-1">
              <div className="relative aspect-[4/3] overflow-hidden">
                <VehicleImage src={p.url} alt={p.alt ?? ""} fill sizes="(min-width: 640px) 220px, 45vw" className="object-cover" />
                {i === 0 && <span className="eyebrow absolute left-2 top-2 bg-[#0B0A09]/80 px-2 py-1 !text-[0.6rem] !text-gold-300">Cover</span>}
              </div>
              <div className="flex items-center justify-between gap-1 p-1.5">
                <div className="flex">
                  <button type="button" onClick={() => move(i, i - 1)} disabled={i === 0} aria-label="Move earlier" className="grid size-10 place-items-center text-text-secondary hover:text-text-primary disabled:opacity-30">
                    ←
                  </button>
                  <button type="button" onClick={() => move(i, i + 1)} disabled={i === photos.length - 1} aria-label="Move later" className="grid size-10 place-items-center text-text-secondary hover:text-text-primary disabled:opacity-30">
                    →
                  </button>
                </div>
                {i !== 0 && (
                  <button type="button" onClick={() => move(i, 0)} className="text-xs text-text-secondary underline-offset-2 hover:text-text-primary hover:underline">
                    Make cover
                  </button>
                )}
                <button type="button" onClick={() => remove(p)} aria-label="Remove photo" className="grid size-10 place-items-center text-text-muted hover:text-danger">
                  ✕
                </button>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
