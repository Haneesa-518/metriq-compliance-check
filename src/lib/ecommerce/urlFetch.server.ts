/**
 * Controlled product-page ingestion.
 *
 * This module ONLY fetches publicly accessible pages over plain HTTP(S).
 * It never attempts to bypass logins, CAPTCHAs, anti-bot systems or any other
 * access control. If a page is not publicly readable, it fails cleanly and the
 * user is asked to fall back to the image-upload workflow.
 */

const TIMEOUT_MS = 12_000;
const MAX_BYTES = 2_000_000;

export interface FetchedPage {
  url: string;
  html: string;
}

export class UrlFetchError extends Error {}

/** Validate a user-supplied product URL. Returns a normalised URL string. */
export function validateProductUrl(input: string): string {
  const raw = (input ?? "").trim();
  if (!raw) throw new UrlFetchError("URL_EMPTY");

  let parsed: URL;
  try {
    parsed = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    throw new UrlFetchError("URL_INVALID");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new UrlFetchError("URL_UNSUPPORTED");
  }

  const host = parsed.hostname.toLowerCase();
  const isPrivate =
    host === "localhost" ||
    host === "0.0.0.0" ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^169\.254\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
    /^\[?::1\]?$/.test(host);
  if (isPrivate || !host.includes(".")) throw new UrlFetchError("URL_UNSUPPORTED");

  parsed.hash = "";
  return parsed.toString();
}

/** Fetch a publicly accessible product page with a timeout and a size cap. */
export async function fetchProductPage(url: string): Promise<FetchedPage> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        // Identify honestly; no anti-bot evasion.
        "User-Agent": "MetriQ-ComplianceScreener/1.0 (+prototype; publicly accessible pages only)",
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "en-IN,en;q=0.9",
      },
    });

    if (res.status === 401 || res.status === 403) throw new UrlFetchError("URL_BLOCKED");
    if (res.status === 404) throw new UrlFetchError("URL_NOT_FOUND");
    if (res.status === 429) throw new UrlFetchError("URL_RATE_LIMITED");
    if (!res.ok) throw new UrlFetchError("URL_FETCH_FAILED");

    const contentType = res.headers.get("content-type") ?? "";
    if (contentType && !/text\/html|application\/xhtml|text\/plain/i.test(contentType)) {
      throw new UrlFetchError("URL_NOT_HTML");
    }

    const body = await res.text();
    return { url: res.url || url, html: body.slice(0, MAX_BYTES) };
  } catch (err) {
    if (err instanceof UrlFetchError) throw err;
    if (err instanceof Error && err.name === "AbortError") throw new UrlFetchError("URL_TIMEOUT");
    throw new UrlFetchError("URL_FETCH_FAILED");
  } finally {
    clearTimeout(timer);
  }
}

/** Download a product image and return it as a data URL for the vision layer. */
export async function fetchImageAsDataUrl(imageUrl: string): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(imageUrl, { signal: controller.signal, redirect: "follow" });
    if (!res.ok) return null;
    const type = (res.headers.get("content-type") ?? "").toLowerCase();
    if (!/image\/(png|jpe?g|webp)/.test(type)) return null;
    const buf = await res.arrayBuffer();
    if (buf.byteLength > 6_000_000 || buf.byteLength < 1024) return null;
    const bytes = new Uint8Array(buf);
    let binary = "";
    for (let i = 0; i < bytes.length; i += 8192) {
      binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
    }
    const mime = type.includes("png") ? "image/png" : type.includes("webp") ? "image/webp" : "image/jpeg";
    return `data:${mime};base64,${btoa(binary)}`;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
