export type CheckStatus = "PASS" | "FAIL" | "REVIEW" | "NOT_APPLICABLE";

export type FieldSource = "ocr" | "user_corrected" | "unavailable" | "demo_sample";

/**
 * Extraction confidence is an INTERNAL heuristic signal derived from how well a
 * declaration matched a structured pattern. It is not an OCR probability and
 * not a measure of AI accuracy. It is used only to decide whether a result
 * needs human review.
 */
export type ConfidenceBand = "HIGH" | "MEDIUM" | "LOW";

export interface ExtractedField {
  /** machine key, e.g. net_quantity */
  key: string;
  /** human label */
  label: string;
  value: string | null;
  /** internal extraction-confidence signal, 0..1 (heuristic, not OCR probability) */
  confidence: number;
  band: ConfidenceBand;
  /** the exact source text fragment the value came from, if locatable */
  evidence: string | null;
  source: FieldSource;
}

export interface ExtractedData {
  raw_text: string;
  fields: Record<string, ExtractedField>;
  /** overall extraction-quality signal 0..1 (heuristic) */
  ocr_confidence: number;
  engine: string;
  /** deterministic context flags derived from the text */
  context?: PackageContext;
}

export interface PackageContext {
  is_imported: boolean;
  imported_signal: string | null;
  is_food: boolean;
  food_signal: string | null;
  food_certainty: "certain" | "uncertain";
}

/** One atomic validation step inside a layered check. */
export interface ValidationStep {
  label: string;
  passed: boolean | null; // null = could not be determined
}

export interface CheckResult {
  status: CheckStatus;
  field: string;
  label: string;
  category: "legal_metrology" | "food_labelling";
  /** human-readable reason for the status */
  message: string;
  detected: string | null;
  /** exact text fragment that triggered the result, or null when not locatable */
  evidence: string | null;
  expected: string;
  rule_reference: string;
  /** heuristic extraction-confidence signal 0..1 */
  confidence: number;
  confidence_band: ConfidenceBand;
  /** layered validation breakdown shown in the UI */
  validations: ValidationStep[];
  /** why the rule was (or was not) applicable */
  applicability: string;
  recommended_action: string;
  requires_human_review: boolean;
}

export interface CategorySummary {
  passed: number;
  failed: number;
  review: number;
  not_applicable: number;
}

export interface ComplianceSummary {
  applicable: number;
  passed: number;
  failed: number;
  review: number;
  not_applicable: number;
  /** screening coverage score 0..100 — NOT a legal compliance percentage */
  score: number;
  overall: "COMPLIANT" | "NON_COMPLIANT" | "NEEDS_REVIEW";
  by_category: {
    legal_metrology: CategorySummary;
    food_labelling: CategorySummary;
  };
  critical_issues: string[];
  human_review_items: number;
}

export interface AnalysisRecord {
  id: string;
  created_at: string;
  image_data_url: string | null;
  is_demo: boolean;
  demo_label?: string;
  extracted: ExtractedData;
  checks: CheckResult[];
  summary: ComplianceSummary;
  recommendations: string[];
}

export function bandFor(confidence: number): ConfidenceBand {
  if (confidence >= 0.75) return "HIGH";
  if (confidence >= 0.45) return "MEDIUM";
  return "LOW";
}
