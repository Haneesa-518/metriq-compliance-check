/**
 * Server-side product-page content extraction.
 *
 * Reduces a raw HTML document to the product-relevant parts BEFORE anything is
 * sent to the AI layer. Navigation, scripts, styles, adverts, tracking and
 * footer noise are removed. No third-party scraping library is used.
 */

export interface ProductPageData {
  url: string;
  title: string | null;
  description: string | null;
  specifications: Record<string, string>;
  visibleText: string;
  imageUrls: string[];
  source: "ecommerce_url";
}

const STRIP_BLOCKS =
  /<(script|style|noscript|svg|iframe|template|nav|header|footer|form|aside)\b[^>]*>[\s\S]*?<\/\1>/gi;

function decodeEntities(text: string): string {
  return text
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&rupee;|&#8377;|&#x20b9;/gi, "₹")
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCharCode(Number(d)));
}

function tagText(html: string, tag: string): string | null {
  const m = html.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i"));
  return m ? clean(decodeEntities(m[1].replace(/<[^>]+>/g, " "))) || null : null;
}

function clean(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function metaContent(html: string, patterns: RegExp[]): string | null {
  for (const re of patterns) {
    const m = html.match(re);
    if (m?.[1]) {
      const value = clean(decodeEntities(m[1]));
      if (value) return value;
    }
  }
  return null;
}

function absolute(url: string, base: string): string | null {
  try {
    return new URL(url, base).toString();
  } catch {
    return null;
  }
}

/** Structured product metadata (JSON-LD) when the page publishes it. */
function readJsonLd(html: string): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) && out.length < 8) {
    try {
      const parsed: unknown = JSON.parse(m[1].trim());
      const items = Array.isArray(parsed) ? parsed : [parsed];
      for (const item of items) {
        if (item && typeof item === "object") out.push(item as Record<string, unknown>);
      }
    } catch {
      /* malformed structured data is ignored */
    }
  }
  return out;
}

function str(v: unknown): string | null {
  if (typeof v === "string" && v.trim()) return clean(v);
  if (typeof v === "number") return String(v);
  return null;
}

function collectJsonLdProduct(nodes: Record<string, unknown>[]) {
  const specs: Record<string, string> = {};
  const images: string[] = [];
  let title: string | null = null;
  let description: string | null = null;

  for (const node of nodes) {
    const type = String(node["@type"] ?? "").toLowerCase();
    if (!type.includes("product")) continue;
    title ??= str(node.name);
    description ??= str(node.description);
    const brand = node.brand;
    const brandName =
      typeof brand === "object" && brand
        ? str((brand as Record<string, unknown>).name)
        : str(brand);
    if (brandName) specs["Brand"] = brandName;
    const mfr = node.manufacturer;
    const mfrName =
      typeof mfr === "object" && mfr ? str((mfr as Record<string, unknown>).name) : str(mfr);
    if (mfrName) specs["Manufacturer"] = mfrName;
    const weight = node.weight;
    const weightValue =
      typeof weight === "object" && weight
        ? [
            str((weight as Record<string, unknown>).value),
            str((weight as Record<string, unknown>).unitText),
          ]
            .filter(Boolean)
            .join(" ")
        : str(weight);
    if (weightValue) specs["Net quantity"] = weightValue;
    const offers = node.offers;
    const offer = Array.isArray(offers) ? offers[0] : offers;
    if (offer && typeof offer === "object") {
      const price = str((offer as Record<string, unknown>).price);
      const currency = str((offer as Record<string, unknown>).priceCurrency);
      if (price)
        specs["Price"] = `${currency === "INR" ? "₹ " : `${currency ?? ""} `}${price}`.trim();
    }
    const image = node.image;
    for (const i of Array.isArray(image) ? image : [image]) {
      const v = typeof i === "object" && i ? str((i as Record<string, unknown>).url) : str(i);
      if (v) images.push(v);
    }
  }
  return { specs, images, title, description };
}

/** Specification tables and definition lists — the richest product-detail source. */
function readSpecTables(html: string): Record<string, string> {
  const specs: Record<string, string> = {};
  const rowRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let row: RegExpExecArray | null;
  while ((row = rowRe.exec(html)) && Object.keys(specs).length < 60) {
    const cells = Array.from(row[1].matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi)).map((c) =>
      clean(decodeEntities(c[1].replace(/<[^>]+>/g, " "))),
    );
    if (
      cells.length >= 2 &&
      cells[0] &&
      cells[1] &&
      cells[0].length <= 60 &&
      cells[1].length <= 300
    ) {
      specs[cells[0].replace(/:$/, "")] = cells[1];
    }
  }
  const dlRe = /<dt[^>]*>([\s\S]*?)<\/dt>\s*<dd[^>]*>([\s\S]*?)<\/dd>/gi;
  let dl: RegExpExecArray | null;
  while ((dl = dlRe.exec(html)) && Object.keys(specs).length < 80) {
    const k = clean(decodeEntities(dl[1].replace(/<[^>]+>/g, " ")));
    const v = clean(decodeEntities(dl[2].replace(/<[^>]+>/g, " ")));
    if (k && v && k.length <= 60) specs[k.replace(/:$/, "")] = v.slice(0, 300);
  }
  return specs;
}

function readImages(html: string, base: string): string[] {
  const urls: string[] = [];
  const re = /<img\b[^>]*?\ssrc=["']([^"']+)["'][^>]*>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) && urls.length < 40) {
    const abs = absolute(m[1], base);
    if (!abs) continue;
    if (/\.svg(\?|$)|sprite|logo|icon|pixel|tracking|banner|badge|ads?[-_.]/i.test(abs)) continue;
    if (!/^https?:/i.test(abs)) continue;
    urls.push(abs);
  }
  return Array.from(new Set(urls));
}

/** Visible product-relevant text, with page chrome removed. */
function readVisibleText(html: string): string {
  const body = html.replace(STRIP_BLOCKS, " ");
  const withBreaks = body
    .replace(/<\/(p|div|li|tr|h[1-6]|section|br)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ");
  const lines = decodeEntities(withBreaks)
    .split(/\n+/)
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter((l) => l.length >= 2 && l.length <= 400)
    .filter((l) => !/^(home|cart|sign in|log in|menu|search|back to top|©|cookie)/i.test(l));
  return Array.from(new Set(lines)).join("\n").slice(0, 12_000);
}

/** Turn a fetched HTML page into normalised, product-relevant page data. */
export function extractProductPageData(url: string, html: string): ProductPageData {
  const jsonLd = collectJsonLdProduct(readJsonLd(html));
  const cleaned = html.replace(STRIP_BLOCKS, " ");

  const title =
    jsonLd.title ??
    metaContent(html, [
      /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+name=["']title["'][^>]+content=["']([^"']+)["']/i,
    ]) ??
    tagText(cleaned, "h1") ??
    tagText(html, "title");

  const description =
    jsonLd.description ??
    metaContent(html, [
      /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i,
    ]);

  const specifications = { ...readSpecTables(cleaned), ...jsonLd.specs };

  const ogImage = metaContent(html, [
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
  ]);
  const imageUrls = Array.from(
    new Set(
      [...jsonLd.images, ...(ogImage ? [ogImage] : [])]
        .map((i) => absolute(i, url))
        .filter((i): i is string => Boolean(i))
        .concat(readImages(cleaned, url)),
    ),
  ).slice(0, 12);

  return {
    url,
    title,
    description,
    specifications,
    visibleText: readVisibleText(html),
    imageUrls,
    source: "ecommerce_url",
  };
}

/** Is there enough product information on the page to be worth analysing? */
export function hasUsefulProductInfo(page: ProductPageData): boolean {
  const specCount = Object.keys(page.specifications).length;
  return (
    Boolean(page.title) &&
    (page.visibleText.length > 200 || specCount >= 3 || Boolean(page.description))
  );
}

/**
 * Compact, product-relevant text block handed to the extraction layer.
 * Never the raw HTML document.
 */
export function productPageToText(page: ProductPageData): string {
  const specLines = Object.entries(page.specifications)
    .slice(0, 40)
    .map(([k, v]) => `${k}: ${v}`);
  return [
    `Product title: ${page.title ?? "(not found)"}`,
    page.description ? `Description: ${page.description}` : null,
    specLines.length ? `Specifications:\n${specLines.join("\n")}` : null,
    `Listing page text:\n${page.visibleText.slice(0, 8000)}`,
  ]
    .filter(Boolean)
    .join("\n\n");
}
