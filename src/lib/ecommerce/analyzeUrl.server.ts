/**
 * E-commerce URL analysis pipeline.
 *
 * URL → fetch page → extract product-relevant content → AI-assisted field
 * extraction (text + available package images) → the SAME deterministic
 * extraction structures and rule engine used by the image workflow.
 */
import { extractFieldsFromText, mergeExtraction } from "@/lib/compliance/extract";
import { runRuleEngine } from "@/lib/compliance/engine";
import type { ExtractedData, FieldSource } from "@/lib/compliance/types";
import { runOcr, runPageFieldExtraction } from "@/lib/ocr.server";
import {
  extractProductPageData,
  hasUsefulProductInfo,
  productPageToText,
  type ProductPageData,
} from "./pageExtract.server";
import { fetchImageAsDataUrl, fetchProductPage, validateProductUrl } from "./urlFetch.server";

const PAGE_SOURCES: FieldSource[] = ["page_title", "description", "specification", "page_text"];

function normaliseSource(raw: string | undefined): FieldSource {
  const value = (raw ?? "") as FieldSource;
  return PAGE_SOURCES.includes(value) ? value : "ai";
}

/** Pick the images most likely to show the package itself. */
function candidateImages(page: ProductPageData): string[] {
  return page.imageUrls.slice(0, 3);
}

export interface UrlAnalysisResult {
  extracted: ExtractedData;
  checks: ReturnType<typeof runRuleEngine>["checks"];
  summary: ReturnType<typeof runRuleEngine>["summary"];
  recommendations: string[];
  page: { url: string; title: string | null; image_data_url: string | null };
}

export async function analyzeProductUrlPipeline(inputUrl: string): Promise<UrlAnalysisResult> {
  const url = validateProductUrl(inputUrl);
  const { html, url: finalUrl } = await fetchProductPage(url);
  const page = extractProductPageData(finalUrl, html);

  if (!hasUsefulProductInfo(page)) throw new Error("PAGE_INSUFFICIENT");

  const pageText = productPageToText(page);
  const sources: string[] = ["Product page text"];
  if (page.title) sources.push("Product title");
  if (page.description) sources.push("Product description");
  if (Object.keys(page.specifications).length) sources.push("Product specifications");

  // --- optional package-image OCR (never fatal) ---
  let imageText = "";
  let imageFields: Record<string, { value: string | null; confidence: number }> = {};
  let usedImage: string | null = null;
  for (const candidate of candidateImages(page)) {
    const dataUrl = await fetchImageAsDataUrl(candidate);
    if (!dataUrl) continue;
    try {
      const ocr = await runOcr(dataUrl);
      if (ocr.raw_text.trim() || Object.keys(ocr.fields).length) {
        imageText = ocr.raw_text;
        imageFields = ocr.fields;
        usedImage = dataUrl;
        sources.push("Product image (vision OCR)");
        break;
      }
    } catch {
      /* image OCR is best-effort — text analysis continues without it */
    }
  }

  const combinedText = imageText.trim()
    ? `${pageText}\n\n--- Text read from product image ---\n${imageText.trim()}`
    : pageText;

  // --- deterministic baseline over all collected text ---
  let extracted = extractFieldsFromText(combinedText, "page_text");

  // --- AI-assisted normalisation of the listing content (extraction only) ---
  try {
    const ai = await runPageFieldExtraction(pageText);
    const mapped = Object.fromEntries(
      Object.entries(ai.fields).map(([key, v]) => [
        key,
        {
          value: v?.value ?? null,
          confidence: typeof v?.confidence === "number" ? v.confidence : 0.6,
          evidence: v?.evidence ?? null,
          source: normaliseSource(v?.source),
        },
      ]),
    );
    extracted = mergeExtraction(extracted, mapped, "ai", "AI-assisted listing extraction + rule-based extractor");
    if (Object.keys(mapped).length) sources.push("AI-assisted extraction");
  } catch {
    /* fall back to the deterministic extractor only */
  }

  // --- package-image declarations win when they are more confident ---
  if (Object.keys(imageFields).length) {
    extracted = mergeExtraction(
      extracted,
      imageFields,
      "product_image",
      "AI-assisted listing extraction + vision OCR + rule-based extractor",
    );
  }

  extracted = {
    ...extracted,
    analysis_source: "ecommerce_url",
    analysis_context: "ecommerce_listing",
    information_sources: Array.from(new Set(sources)),
  };

  const result = runRuleEngine(extracted);
  return {
    extracted,
    ...result,
    page: { url: finalUrl, title: page.title, image_data_url: usedImage },
  };
}
