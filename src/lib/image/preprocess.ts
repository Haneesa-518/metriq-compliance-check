/**
 * Browser-side image preparation for text extraction.
 *
 * The ORIGINAL uploaded image is always preserved as evidence. This module only
 * produces an additional, smaller copy that is submitted to the extraction
 * service, because very large mobile-camera photographs are slow to upload and
 * frequently exceed request limits.
 */

export interface PreparedImage {
  /** untouched original, kept as evidence */
  original: string;
  /** downscaled, EXIF-oriented copy submitted for extraction */
  processed: string;
  width: number;
  height: number;
  original_bytes: number;
  processed_bytes: number;
}

const MAX_EDGE = 2000;
const MIN_EDGE = 200;

export function approximateBytes(dataUrl: string): number {
  const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
  return Math.floor((base64.length * 3) / 4);
}

/**
 * Downscale while preserving aspect ratio and applying EXIF orientation.
 * Returns the original unchanged when the browser cannot decode it here — the
 * server-side extractor then receives the original bytes.
 */
export async function prepareImage(dataUrl: string): Promise<PreparedImage> {
  const original_bytes = approximateBytes(dataUrl);
  const fallback: PreparedImage = {
    original: dataUrl,
    processed: dataUrl,
    width: 0,
    height: 0,
    original_bytes,
    processed_bytes: original_bytes,
  };

  if (typeof window === "undefined" || typeof document === "undefined") return fallback;

  try {
    const blob = await (await fetch(dataUrl)).blob();
    const bitmap = await createImageBitmap(blob, { imageOrientation: "from-image" });
    const { width, height } = bitmap;

    if (width < MIN_EDGE || height < MIN_EDGE) {
      bitmap.close();
      throw new Error("IMAGE_TOO_SMALL");
    }

    const scale = Math.min(1, MAX_EDGE / Math.max(width, height));
    const w = Math.round(width * scale);
    const h = Math.round(height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close();
      return { ...fallback, width, height };
    }
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();

    const processed = canvas.toDataURL("image/jpeg", 0.9);
    return {
      original: dataUrl,
      processed: approximateBytes(processed) < original_bytes ? processed : dataUrl,
      width,
      height,
      original_bytes,
      processed_bytes: approximateBytes(processed),
    };
  } catch (err) {
    if (err instanceof Error && err.message === "IMAGE_TOO_SMALL") throw err;
    return fallback;
  }
}
