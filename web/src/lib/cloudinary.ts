import "server-only";
import { createHash } from "node:crypto";

/**
 * Signed, direct-to-Cloudinary uploads.
 *
 * Photos go from the salesperson's phone straight to Cloudinary. Our server
 * only signs the request (so nobody else can upload into the Sabicars
 * account) and afterwards checks Cloudinary's signature on the result (so a
 * tampered request cannot attach someone else's image to a listing). The
 * photo itself never passes through our server — which matters, because a
 * serverless function accepts a few megabytes at most and a phone photograph
 * is often bigger.
 *
 * The API secret never leaves the server.
 */

function config() {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error("Cloudinary is not configured: set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET.");
  }
  return { cloudName, apiKey, apiSecret, folder: process.env.CLOUDINARY_UPLOAD_FOLDER || "sabicars" };
}

/** Cloudinary's signature: the parameters sorted by name, joined, with the secret appended, SHA-1. */
function sign(params: Record<string, string | number>, secret: string): string {
  const payload = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join("&");
  return createHash("sha1").update(payload + secret).digest("hex");
}

export interface UploadTicket {
  url: string;
  fields: Record<string, string>;
}

/** Everything the browser needs to upload one photo into this vehicle's folder. */
export function uploadTicket(vehicleId: string): UploadTicket {
  const { cloudName, apiKey, apiSecret, folder } = config();
  const params = {
    folder: `${folder}/${vehicleId}`,
    timestamp: Math.floor(Date.now() / 1000),
    allowed_formats: "jpg,jpeg,png,webp,avif,heic",
  };
  return {
    url: `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
    fields: { ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])), api_key: apiKey, signature: sign(params, apiSecret) },
  };
}

export interface UploadedAsset {
  public_id: string;
  version: number | string;
  signature: string;
  secure_url: string;
  width?: number;
  height?: number;
}

/**
 * True only for an asset Cloudinary really stored, in this account, in this
 * vehicle's folder. Cloudinary signs every upload response with
 * sha1("public_id=…&version=…" + secret).
 */
export function isGenuineUpload(asset: UploadedAsset, vehicleId: string): boolean {
  const { cloudName, apiSecret, folder } = config();
  const expected = sign({ public_id: asset.public_id, version: asset.version }, apiSecret);
  return (
    expected === asset.signature &&
    asset.public_id.startsWith(`${folder}/${vehicleId}/`) &&
    asset.secure_url.startsWith(`https://res.cloudinary.com/${cloudName}/image/upload/`)
  );
}
