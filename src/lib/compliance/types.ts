export type CheckStatus = "PASS" | "FAIL" | "REVIEW" | "NOT_APPLICABLE";

export type FieldSource = "ocr" | "user_corrected" | "unavailable" | "demo_sample";

export interface ExtractedField {
  /** machine key, e.g. net_quantity */
  key: string;
  /** human label */
  label: string;
  value: string | null;
  confidence: number; // 0..1
  source: FieldSource;
}

export interface ExtractedData {
  raw_text: string;
  fields: Record<string, ExtractedField>;
  /** overall OCR confidence 0..1 */
  ocr_confidence: number;
  engine: string;
}

export interface CheckResult {
  status: CheckStatus;
  field: string;
  label: string;
  message: string;
  detected: string | null;
  expected: string;
  rule_reference: string;
  confidence: number;
  recommended_action: string;
}

export interface ComplianceSummary {
  applicable: number;
  passed: number;
  failed: number;
  review: number;
  not_applicable: number;
  score: number; // 0..100
  overall: "COMPLIANT" | "NON_COMPLIANT" | "NEEDS_REVIEW";
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
