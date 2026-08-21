export type CheckStatus = "PASS" | "FAIL" | "REVIEW" | "NOT_APPLICABLE";

export type FieldSource =
  | "ocr"
  | "user_corrected"
  | "unavailable"
  | "demo_sample"
  /* e-commerce listing sources */
  | "page_title"
  | "description"
  | "specification"
  | "page_text"
  | "product_image"
  | "ai";

/** Where the analysed material came from. */
export type AnalysisSource = "image_upload" | "ecommerce_url" | "demo";

/**
 * Analysis context. A physical package must carry every declaration; an
 * e-commerce listing displays only a subset, so applicability differs.
 */
export type AnalysisContext = "physical_package" | "ecommerce_listing";

export const FIELD_SOURCE_LABELS: Record<FieldSource, string> = {
  ocr: "Product image (OCR)",
  user_corrected: "User corrected",
  unavailable: "Not detected",
  demo_sample: "Synthetic sample",
  page_title: "Product title",
  description: "Product description",
  specification: "Product specifications",
  page_text: "Product page text",
  product_image: "Product image (OCR)",
  ai: "AI-assisted extraction",
};

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
  /** which input pipeline produced this data */
  analysis_source?: AnalysisSource;
  /** listing vs physical package — drives rule applicability */
  analysis_context?: AnalysisContext;
  /** human-readable list of the information sources actually used */
  information_sources?: string[];
  /** deterministic context flags derived from the text */
  context?: PackageContext;
}

/** Three-state import classification — absence of evidence is not evidence of import. */
export type ImportStatus = "IMPORTED" | "DOMESTIC" | "UNCERTAIN";

/** Coarse product classification used to activate conditional rule groups. */
export type ProductCategory = "food" | "non_food" | "unknown";

export type Certainty = "certain" | "uncertain";

/**
 * Deterministic product context. Everything here is derived from the extracted
 * text by explainable heuristics and drives rule APPLICABILITY only — never the
 * pass/fail decision itself.
 */
export interface PackageContext {
  /** legacy convenience flag — true only when import_status === "IMPORTED" */
  is_imported: boolean;
  imported_signal: string | null;
  is_food: boolean;
  food_signal: string | null;
  food_certainty: Certainty;
  /** three-state import classification with evidence */
  import_status: ImportStatus;
  import_evidence: string | null;
  import_reason: string;
  /** product classification */
  product_category: ProductCategory;
  product_subcategory: string | null;
  category_reason: string;
  /** deterministic attribute flags that activate conditional sub-rule groups */
  attributes: Record<string, boolean>;
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
  /** short plain-language meaning of the status, e.g. "Partial information detected" */
  status_summary: string;
  /** components of the declaration that were detected */
  detected_components: string[];
  /** components of the declaration that were not detected */
  missing_components: string[];
  /** clarifies that the result describes the submitted source, not the physical package */
  source_note: string | null;
  /** issue severity used to prioritise human review */
  severity: Severity;
  /** numeric ordering weight — higher means "review this first" */
  priority: number;
  /** hierarchical rule group this check belongs to */
  rule_group: string;
  /** whether the rule was applicable, not applicable, or could not be decided */
  applicability_decision: ApplicabilityDecision;
  /** why the applicability engine reached that decision */
  applicability_reason: string;
  /** VERIFIED rules are binding screening results; unverified ones are advisory */
  rule_verification: "VERIFIED" | "NEEDS_VERIFICATION";
  binding: boolean;
}

export type Severity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

export type ApplicabilityDecision = "APPLICABLE" | "NOT_APPLICABLE" | "UNCERTAIN";

export const SEVERITY_WEIGHT: Record<Severity, number> = {
  CRITICAL: 100,
  HIGH: 70,
  MEDIUM: 40,
  LOW: 15,
};

/** A cross-field or cross-source inconsistency found between declarations. */
export interface Discrepancy {
  id: string;
  label: string;
  severity: Severity;
  priority: number;
  message: string;
  evidence: string | null;
  fields: string[];
  recommended_action: string;
}

/** One prioritised entry in the "Review first" dashboard section. */
export interface ReviewItem {
  kind: "check" | "discrepancy";
  key: string;
  title: string;
  severity: Severity;
  priority: number;
  status: CheckStatus | "DISCREPANCY";
  reason: string;
  action: string;
}


/** Screening status labels and their plain-language meaning, shared by all UI surfaces. */
export const STATUS_LABELS: Record<CheckStatus, string> = {
  PASS: "PASS",
  FAIL: "FAIL",
  REVIEW: "REVIEW",
  NOT_APPLICABLE: "NOT APPLICABLE",
};

export const STATUS_MEANINGS: Record<CheckStatus, string> = {
  PASS: "Complete information detected",
  FAIL: "Required information not detected",
  REVIEW: "Partial / ambiguous information",
  NOT_APPLICABLE: "Rule does not apply",
};


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
  /** defaults to "image_upload" for legacy records */
  analysis_source?: AnalysisSource;
  source_url?: string | null;
  page_title?: string | null;
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
