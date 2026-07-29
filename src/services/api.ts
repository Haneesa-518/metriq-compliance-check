/**
 * Frontend service layer. UI components never call server functions directly.
 */
import { analyzeImage, analyzeText } from "@/lib/analysis.functions";
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
    ...result,
  };
  saveAnalysis(record);
  return record;
}

export async function reanalyzeText(
  previous: AnalysisRecord,
  rawText: string,
): Promise<AnalysisRecord> {
  const result = await analyzeText({ data: { raw_text: rawText, user_corrected: true } });
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
