import { LEGAL_RULES, type LegalRule } from "@/lib/legal/rules.data";
import type {
  CheckResult,
  CheckStatus,
  ComplianceSummary,
  ExtractedData,
} from "./types";

const CONFIDENT = 0.7;

interface Ctx {
  data: ExtractedData;
  /** true when the package appears to be an imported package */
  isImported: boolean;
}

function ruleFor(field: string): LegalRule {
  const rule = LEGAL_RULES.find((r) => r.field === field);
  if (!rule) throw new Error(`Unknown rule for field: ${field}`);
  return rule;
}

function base(
  rule: LegalRule,
  status: CheckStatus,
  message: string,
  detected: string | null,
  confidence: number,
  action: string,
): CheckResult {
  return {
    status,
    field: rule.field,
    label: rule.title,
    message,
    detected,
    expected: rule.requirement,
    rule_reference: rule.rule_id,
    confidence: Math.round(confidence * 100) / 100,
    recommended_action: action,
  };
}

/** Generic presence check shared by most declarations. */
function presenceCheck(ctx: Ctx, field: string): CheckResult {
  const rule = ruleFor(field);
  const f = ctx.data.fields[field];
  const value = f?.value ?? null;
  const conf = f?.confidence ?? 0;

  if (value && conf >= CONFIDENT) {
    return base(
      rule,
      "PASS",
      `A declaration was identified on the package for "${rule.title}".`,
      value,
      conf,
      "No action required for the prototype check. Confirm legibility on the physical package.",
    );
  }
  if (value) {
    return base(
      rule,
      "REVIEW",
      "A candidate declaration was found, but extraction confidence is low.",
      value,
      conf,
      "Verify this declaration manually against the physical package.",
    );
  }
  if (ctx.data.ocr_confidence < 0.5) {
    return base(
      rule,
      "REVIEW",
      "The declaration could not be confidently identified because overall text extraction quality is low.",
      null,
      ctx.data.ocr_confidence,
      "Re-upload a sharper image, or verify the original package manually.",
    );
  }
  return base(
    rule,
    "FAIL",
    "No corresponding declaration was detected in the extracted text.",
    null,
    ctx.data.ocr_confidence,
    "Check the physical package. If the declaration is genuinely absent, escalate for professional review.",
  );
}

export function check_product_name(ctx: Ctx): CheckResult {
  return presenceCheck(ctx, "product_name");
}

export function check_net_quantity(ctx: Ctx): CheckResult {
  const rule = ruleFor("net_quantity");
  const f = ctx.data.fields.net_quantity;
  if (!f?.value) return presenceCheck(ctx, "net_quantity");
  const formatted = /^\d+(?:[.,]\d+)?\s*(kg|g|gm|gms|gram|grams|mg|l|ltr|litre|litres|liter|liters|ml|n|nos|no|pcs|piece|pieces)$/i.test(
    f.value.trim(),
  );
  if (!formatted) {
    return base(
      rule,
      "REVIEW",
      "A quantity-like value was detected but it does not match the expected number + standard unit pattern.",
      f.value,
      f.confidence,
      "Confirm the net quantity declaration and its unit on the physical package.",
    );
  }
  return presenceCheck(ctx, "net_quantity");
}

export function check_mrp(ctx: Ctx): CheckResult {
  const rule = ruleFor("mrp");
  const f = ctx.data.fields.mrp;
  if (!f?.value) return presenceCheck(ctx, "mrp");
  const hasNumber = /\d/.test(f.value);
  const hasCurrency = /₹|rs\.?|inr/i.test(f.value);
  if (!hasNumber) {
    return base(
      rule,
      "REVIEW",
      "A price declaration was detected but no numeric value could be read.",
      f.value,
      f.confidence,
      "Verify the retail sale price on the physical package.",
    );
  }
  if (!hasCurrency) {
    return base(
      rule,
      "REVIEW",
      "A numeric price was detected, but the currency indication could not be confirmed from the extracted text.",
      f.value,
      f.confidence,
      "Confirm that the retail sale price is declared in the prescribed form on the package.",
    );
  }
  return presenceCheck(ctx, "mrp");
}

export function check_manufacturer_details(ctx: Ctx): CheckResult {
  const rule = ruleFor("manufacturer");
  const mfg = ctx.data.fields.manufacturer;
  const packer = ctx.data.fields.packer;
  const candidate = mfg?.value ?? packer?.value ?? null;
  const conf = mfg?.value ? mfg.confidence : (packer?.confidence ?? 0);
  if (candidate && conf >= CONFIDENT) {
    return base(
      rule,
      "PASS",
      mfg?.value
        ? "A manufacturer declaration was identified."
        : "No manufacturer declaration was found, but a packer declaration was identified.",
      candidate,
      conf,
      "Confirm the entity name and completeness of the declaration on the physical package.",
    );
  }
  if (candidate) {
    return base(
      rule,
      "REVIEW",
      "A responsible-entity declaration was partially detected with low confidence.",
      candidate,
      conf,
      "Verify the manufacturer / packer declaration manually.",
    );
  }
  return presenceCheck(ctx, "manufacturer");
}

export function check_address(ctx: Ctx): CheckResult {
  return presenceCheck(ctx, "address");
}

export function check_consumer_care(ctx: Ctx): CheckResult {
  return presenceCheck(ctx, "consumer_care");
}

export function check_date_of_manufacture(ctx: Ctx): CheckResult {
  return presenceCheck(ctx, "date_of_manufacture");
}

export function check_importer_details(ctx: Ctx): CheckResult {
  const rule = ruleFor("importer");
  if (!ctx.isImported) {
    return base(
      rule,
      "NOT_APPLICABLE",
      "No indication of an imported package was found, so this conditional declaration was not evaluated.",
      null,
      1,
      "If the commodity is in fact imported, re-run the check with a clearer image of the import declaration.",
    );
  }
  return presenceCheck(ctx, "importer");
}

export function check_country_of_origin(ctx: Ctx): CheckResult {
  const rule = ruleFor("country_of_origin");
  if (!ctx.isImported) {
    return base(
      rule,
      "NOT_APPLICABLE",
      "No indication of an imported package was found, so this conditional declaration was not evaluated.",
      null,
      1,
      "If the commodity is imported, verify the country-of-origin declaration manually.",
    );
  }
  return presenceCheck(ctx, "country_of_origin");
}

const CHECKS = [
  check_product_name,
  check_net_quantity,
  check_mrp,
  check_manufacturer_details,
  check_address,
  check_consumer_care,
  check_date_of_manufacture,
  check_importer_details,
  check_country_of_origin,
];

function detectImported(data: ExtractedData): boolean {
  if (data.fields.importer?.value || data.fields.country_of_origin?.value) return true;
  return /imported\s+by|country\s+of\s+origin|importer/i.test(data.raw_text || "");
}

export function summarize(checks: CheckResult[]): ComplianceSummary {
  const applicableChecks = checks.filter((c) => c.status !== "NOT_APPLICABLE");
  const passed = applicableChecks.filter((c) => c.status === "PASS").length;
  const failed = applicableChecks.filter((c) => c.status === "FAIL").length;
  const review = applicableChecks.filter((c) => c.status === "REVIEW").length;
  const applicable = applicableChecks.length;

  // Transparent scoring: PASS = 1 point, REVIEW = 0.5 point, FAIL = 0 points.
  const score = applicable === 0 ? 0 : Math.round(((passed + review * 0.5) / applicable) * 100);

  const overall: ComplianceSummary["overall"] =
    failed > 0 ? "NON_COMPLIANT" : review > 0 ? "NEEDS_REVIEW" : "COMPLIANT";

  return {
    applicable,
    passed,
    failed,
    review,
    not_applicable: checks.length - applicable,
    score,
    overall,
  };
}

export function buildRecommendations(checks: CheckResult[]): string[] {
  const recs: string[] = [];
  for (const c of checks) {
    if (c.status === "FAIL" || c.status === "REVIEW") {
      recs.push(`${c.label}: ${c.recommended_action}`);
    }
  }
  recs.push(
    "Have all flagged items verified by a qualified Legal Metrology professional before acting on these results.",
  );
  return recs;
}

/** Deterministic rule engine entry point. */
export function runRuleEngine(data: ExtractedData) {
  const ctx: Ctx = { data, isImported: detectImported(data) };
  const checks = CHECKS.map((fn) => fn(ctx));
  return {
    checks,
    summary: summarize(checks),
    recommendations: buildRecommendations(checks),
  };
}
