/**
 * Frontend service layer. UI components never call server functions directly.
 */
import { analyzeImage, analyzeText, analyzeUrl } from "@/lib/analysis.functions";
import { runRuleEngine } from "@/lib/compliance/engine";
import { extractFieldsFromText } from "@/lib/compliance/extract";
import { DEMO_CASES, type DemoCase } from "@/lib/demo/demo-cases";
import { saveAnalysis } from "@/lib/analysis-store";
import type { AnalysisRecord } from "@/lib/compliance/types";

function newId() {
  return `MM-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

export function friendlyError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes("AI_KEY_MISSING"))
    return "The AI extraction service is not configured. Use Demo Mode to see the full workflow.";
  if (msg.includes("AI_RATE_LIMIT")) return "Too many requests right now. Please retry in a moment.";
  if (msg.includes("AI_CREDITS")) return "AI usage limit reached. Use Demo Mode to continue the demonstration.";
  if (msg.includes("OCR_EMPTY"))
    return "No readable text could be extracted from that image. Try a sharper, well-lit photo.";
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
  if (msg.includes("AI_ERROR")) return "The extraction service returned an error. Please try again.";
  if (/Only JPG|too large|too big/i.test(msg)) return msg;
  if (/fetch|network|Failed to fetch/i.test(msg))
    return "Could not reach the analysis service. Check your connection and try again.";
  return "Analysis failed unexpectedly. Please try again or use Demo Mode.";
}

export async function analyzeProduct(imageDataUrl: string): Promise<AnalysisRecord> {
  const result = await analyzeImage({ data: { image_data_url: imageDataUrl } });
  const record: AnalysisRecord = {
    id: newId(),
    created_at: new Date().toISOString(),
    image_data_url: imageDataUrl,
    is_demo: false,
    analysis_source: "image_upload",
    ...result,
  };
  saveAnalysis(record);
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
  saveAnalysis(record);
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
  const record: AnalysisRecord = { ...previous, ...result, created_at: new Date().toISOString() };
  saveAnalysis(record);
  return record;
}

/** Demo mode runs entirely locally — no external service or API key required. */
export function runDemo(demo: DemoCase): AnalysisRecord {
  const extracted = extractFieldsFromText(demo.raw_text);
  const engineResult = runRuleEngine({ ...extracted, engine: "demo mode (synthetic sample text)" });
  const record: AnalysisRecord = {
    id: newId(),
    created_at: new Date().toISOString(),
    image_data_url: null,
    is_demo: true,
    demo_label: demo.label,
    extracted: { ...extracted, engine: "demo mode (synthetic sample text)" },
    ...engineResult,
  };
  saveAnalysis(record);
  return record;
}

export function getDemoCases() {
  return DEMO_CASES;
}
