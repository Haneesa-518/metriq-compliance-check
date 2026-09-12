/**
 * Frontend service layer. UI components never call server functions directly.
 */
import { analyzeImage, analyzeText, analyzeUrl } from "@/lib/analysis.functions";
import { runRuleEngine } from "@/lib/compliance/engine";
import { extractFieldsFromText } from "@/lib/compliance/extract";
import { DEMO_CASES, type DemoCase } from "@/lib/demo/demo-cases";
import { saveAnalysis } from "@/lib/analysis-store";
import { prepareImage } from "@/lib/image/preprocess";
import type { AnalysisRecord } from "@/lib/compliance/types";

function newId() {
  return `MM-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

export function friendlyError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes("AI_KEY_MISSING"))
    return "Image analysis could not be completed: the text-extraction service is not configured on the server. Use Demo Mode to see the full workflow.";
  if (msg.includes("AI_RATE_LIMIT"))
    return "Image analysis could not be completed: the extraction service is rate-limiting requests. Please retry in a moment.";
  if (msg.includes("AI_CREDITS"))
    return "Image analysis could not be completed: the extraction service usage limit was reached. Use Demo Mode to continue the demonstration.";
  if (msg.includes("AI_TIMEOUT"))
    return "Image analysis could not be completed: the extraction service did not respond in time. Try again, or upload a smaller/sharper photo.";
  if (msg.includes("IMAGE_TOO_SMALL"))
    return "That image is too small to read reliably. Upload a photo of at least 200 × 200 pixels.";
  if (msg.includes("OCR_EMPTY"))
    return "No readable text could be extracted from that image. Try a sharper, well-lit, straight-on photo of the label.";
  if (msg.includes("URL_EMPTY")) return "Please enter a product URL.";
  if (msg.includes("URL_INVALID")) return "Please enter a valid product URL.";
  if (msg.includes("URL_UNSUPPORTED"))
    return "That URL is not supported. Enter a public https:// product listing URL.";
  if (msg.includes("URL_BLOCKED"))
    return "This product page blocks automated access. Try uploading a screenshot of the listing or the package instead.";
  if (msg.includes("URL_NOT_FOUND")) return "That product page could not be found. Check the URL and try again.";
  if (msg.includes("URL_RATE_LIMITED"))
    return "The product site is rate-limiting requests right now. Please try again shortly.";
  if (msg.includes("URL_TIMEOUT"))
    return "The product page took too long to respond. Try again, or upload a screenshot instead.";
  if (msg.includes("URL_NOT_HTML")) return "That link is not a product page. Paste the product listing URL.";
  if (msg.includes("URL_FETCH_FAILED"))
    return "We couldn't access this product page. Try uploading a screenshot instead.";
  if (msg.includes("PAGE_INSUFFICIENT"))
    return "Insufficient product information was found on this page. Try a different listing URL or upload a package image.";
  const aiError = msg.match(/AI_ERROR_(\d{3})/);
  if (aiError)
    return `Image analysis could not be completed: the extraction service returned status ${aiError[1]}. Please try again.`;
  if (/Only JPG|too large|too big/i.test(msg)) return msg;
  if (/fetch|network|Failed to fetch/i.test(msg))
    return "Could not reach the analysis service. Check your connection and try again.";
  return "Analysis failed unexpectedly. Please try again or use Demo Mode.";
}

export async function analyzeProduct(imageDataUrl: string): Promise<AnalysisRecord> {
  // The original image is preserved as evidence; only a downscaled copy is sent.
  const prepared = await prepareImage(imageDataUrl);
  const result = await analyzeImage({ data: { image_data_url: prepared.processed } });
  const record: AnalysisRecord = {
    id: newId(),
    created_at: new Date().toISOString(),
    image_data_url: prepared.original,
    processed_image_data_url: prepared.processed === prepared.original ? null : prepared.processed,
    is_demo: false,
    analysis_source: "image_upload",
    ...result,
  };
  await saveAnalysis(record);
  return record;
}

export async function analyzeProductUrl(url: string): Promise<AnalysisRecord> {
  const result = await analyzeUrl({ data: { url } });
  const { page, ...analysis } = result;
  const record: AnalysisRecord = {
    id: newId(),
    created_at: new Date().toISOString(),
    image_data_url: page.image_data_url,
    is_demo: false,
    analysis_source: "ecommerce_url",
    source_url: page.url,
    page_title: page.title,
    ...analysis,
  };
  await saveAnalysis(record);
  return record;
}

export async function reanalyzeText(
  previous: AnalysisRecord,
  rawText: string,
): Promise<AnalysisRecord> {
  const result = await analyzeText({
    data: {
      raw_text: rawText,
      user_corrected: true,
      listing: previous.analysis_source === "ecommerce_url",
    },
  });
  const record: AnalysisRecord = {
    ...previous,
    ...result,
    // The originally extracted text is retained as evidence of what the
    // automated extraction actually read.
    corrections: [
      ...(previous.corrections ?? []),
      { at: new Date().toISOString(), original_raw_text: previous.extracted.raw_text },
    ],
    created_at: new Date().toISOString(),
  };
  await saveAnalysis(record);
  return record;
}

/** Demo mode runs entirely locally — no external service or API key required. */
export async function runDemo(demo: DemoCase): Promise<AnalysisRecord> {
  const isUrl = demo.kind === "url";
  const base = extractFieldsFromText(demo.raw_text, isUrl ? "page_text" : "ocr");
  const extracted = {
    ...base,
    engine: isUrl
      ? "demo mode (synthetic e-commerce listing)"
      : "demo mode (synthetic sample text)",
    analysis_source: (isUrl ? "ecommerce_url" : "demo") as "ecommerce_url" | "demo",
    analysis_context: (isUrl ? "ecommerce_listing" : "physical_package") as
      | "ecommerce_listing"
      | "physical_package",
    information_sources: isUrl
      ? ["Product title", "Product description", "Product specifications", "Product page text"]
      : ["Synthetic sample package text"],
  };
  const engineResult = runRuleEngine(extracted);
  const record: AnalysisRecord = {
    id: newId(),
    created_at: new Date().toISOString(),
    image_data_url: null,
    is_demo: true,
    demo_label: demo.label,
    analysis_source: isUrl ? "ecommerce_url" : "demo",
    source_url: demo.url ?? null,
    page_title: demo.title ?? null,
    extracted,
    ...engineResult,
  };
  await saveAnalysis(record);
  return record;
}

export function getDemoCases() {
  return DEMO_CASES;
}
