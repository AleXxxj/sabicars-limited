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
export async function shrink(file: File): Promise<Blob> {
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
