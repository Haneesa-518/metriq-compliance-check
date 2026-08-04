import { LEGAL_RULES, ruleForField, type LegalRule } from "@/lib/legal/rules.data";
import { degradedText } from "./extract";
import {
  bandFor,
  type CategorySummary,
  type CheckResult,
  type CheckStatus,
  type ComplianceSummary,
  type ExtractedData,
  type PackageContext,
  type ValidationStep,
} from "./types";

const LOW_QUALITY = 0.5;

/** Internal layer with severity — hard failures fail, soft failures need review. */
interface Layer {
  label: string;
  passed: boolean | null;
  severity: "hard" | "soft";
}

interface Ctx {
  data: ExtractedData;
  pkg: PackageContext;
  /** true when the analysed material is an e-commerce listing, not a package */
  listing: boolean;
}

/**
 * Declarations that live on the physical package. Rule 6(10) of the Legal
 * Metrology (Packaged Commodities) Rules, 2011 requires an e-commerce listing
 * to display commodity name, net quantity, retail sale price, the
 * manufacturer/packer/importer identity, consumer care details and, for
 * imported goods, the country of origin. The remaining declarations are not
 * required to appear in the online listing, so their absence there is reported
 * as "not verifiable from the listing" rather than as a failure.
 */
const PACKAGE_ONLY_FIELDS = new Set([
  "date_of_manufacture",
  "unit_sale_price",
  "best_before",
  "veg_nonveg_mark",
  "ingredients_list",
  "fssai_licence",
]);

function ruleFor(field: string): LegalRule {
  const rule = ruleForField(field);
  if (!rule) throw new Error(`Unknown rule for field: ${field}`);
  return rule;
}

function steps(layers: Layer[]): ValidationStep[] {
  return layers.map(({ label, passed }) => ({ label, passed }));
}

interface Extra {
  detected_components?: string[];
  missing_components?: string[];
  source_note?: string | null;
  /** overrides the default plain-language meaning of the status */
  status_summary?: string;
}

const DEFAULT_SUMMARY: Record<CheckStatus, string> = {
  PASS: "Complete information detected",
  REVIEW: "Partial / ambiguous information detected",
  FAIL: "Required information not detected in submitted source",
  NOT_APPLICABLE: "Rule does not apply to this product",
};

/**
 * Screening results describe the submitted source only. Absence of a
 * declaration in a listing or an image never proves absence on the package.
 */
function sourceNote(ctx: Ctx): string {
  return ctx.listing
    ? "Not detected in the submitted e-commerce source. Verify against the physical package before making a final legal determination."
    : "Not detected in the submitted source. Verify against the physical package or authoritative product documentation before making a final determination.";
}

function build(
  rule: LegalRule,
  status: CheckStatus,
  message: string,
  detected: string | null,
  evidence: string | null,
  confidence: number,
  action: string,
  layers: Layer[],
  applicability = rule.applicability,
  extra: Extra = {},
): CheckResult {
  const conf = Math.round(Math.max(0, Math.min(1, confidence)) * 100) / 100;
  return {
    status,
    field: rule.field,
    label: rule.title,
    category: rule.category,
    message,
    detected,
    evidence,
    expected: rule.requirement,
    rule_reference: rule.rule_id,
    confidence: conf,
    confidence_band: bandFor(conf),
    validations: steps(layers),
    applicability,
    recommended_action: action,
    requires_human_review: status === "REVIEW",
    status_summary: extra.status_summary ?? DEFAULT_SUMMARY[status],
    detected_components:
      extra.detected_components ?? layers.filter((l) => l.passed === true).map((l) => l.label),
    missing_components:
      extra.missing_components ?? layers.filter((l) => l.passed !== true).map((l) => l.label),
    source_note: extra.source_note ?? null,
  };
}

function notApplicable(rule: LegalRule, reason: string, action: string): CheckResult {
  return build(
    rule,
    "NOT_APPLICABLE",
    reason,
    null,
    null,
    1,
    action,
    [{ label: "Rule applicability", passed: false, severity: "soft" }],
    reason,
    { detected_components: [], missing_components: [] },
  );
}

/**
 * Layered validation: presence → readability → format/structure → confidence.
 * FAIL is reserved for "nothing related to this declaration was detected in the
 * submitted source". Whenever meaningful related information was detected but
 * is incomplete or ambiguous, the result is REVIEW.
 */
function evaluate(
  ctx: Ctx,
  fieldKey: string,
  formatLayers: (value: string) => Layer[] = () => [],
): CheckResult {
  const rule = ruleFor(fieldKey);
  const f = ctx.data.fields[fieldKey];
  const value = f?.value ?? null;
  const conf = f?.confidence ?? 0;
  const evidence = f?.evidence ?? null;
  const textPoor = ctx.data.ocr_confidence < LOW_QUALITY || degradedText(ctx.data.raw_text);

  if (!value) {
    const presence: Layer[] = [{ label: "Declaration present in extracted text", passed: false, severity: "hard" }];
    if (ctx.listing && PACKAGE_ONLY_FIELDS.has(fieldKey)) {
      return build(
        rule,
        "REVIEW",
        "This declaration was not found in the e-commerce listing. It is a physical-package declaration that an online listing is not required to display, so its absence here cannot be treated as non-compliance.",
        null,
        null,
        ctx.data.ocr_confidence,
        "Verify this declaration on the physical package or on a package image, for example by uploading a package photograph.",
        [
          { label: "Declaration present in listing information", passed: false, severity: "soft" },
          { label: "Required to be displayed in an e-commerce listing", passed: null, severity: "soft" },
        ],
        "Physical-package declaration — not verifiable from an e-commerce listing alone.",
        {
          status_summary: "Verification required — not displayed in this listing",
          source_note: sourceNote(ctx),
        },
      );
    }
    if (textPoor) {
      return build(
        rule,
        "REVIEW",
        "The declaration could not be located, but the extracted text quality is too low to conclude that it is absent.",
        null,
        null,
        ctx.data.ocr_confidence,
        "Re-upload a sharper image or edit the extracted text, then re-run the analysis.",
        [
          { label: "Declaration present in extracted text", passed: null, severity: "hard" },
          { label: "Extraction quality sufficient to judge absence", passed: false, severity: "soft" },
        ],
        rule.applicability,
        { status_summary: "Verification required — extraction quality too low", source_note: sourceNote(ctx) },
      );
    }
    return build(
      rule,
      "FAIL",
      "No corresponding declaration was detected in the submitted source. This is a screening result about the submitted material only, not a finding of legal non-compliance.",
      null,
      null,
      ctx.data.ocr_confidence,
      "Verify the physical package or authoritative product documentation before making a final determination.",
      presence,
      rule.applicability,
      { source_note: sourceNote(ctx) },
    );
  }

  const layers: Layer[] = [
    { label: "Declaration present in extracted text", passed: true, severity: "hard" },
    { label: "Extracted value is readable", passed: !degradedText(value), severity: "soft" },
    ...formatLayers(value),
  ];

  const hardFail = layers.find((l) => l.passed === false && l.severity === "hard");
  if (hardFail) {
    // Related information WAS detected, so this is incomplete/ambiguous — not "not detected".
    return build(
      rule,
      "REVIEW",
      `Related information was detected, but the declaration appears incomplete or invalid: ${hardFail.label}.`,
      value,
      evidence,
      conf,
      "Verify the complete declaration against the physical package, or correct the extracted text and re-run the analysis.",
      layers,
      rule.applicability,
      { status_summary: "Incomplete information detected" },
    );
  }

  const softIssue = layers.find((l) => l.passed !== true);
  const band = bandFor(conf);
  if (softIssue) {
    return build(
      rule,
      "REVIEW",
      `A declaration was found, but one element could not be confirmed: ${softIssue.label}.`,
      value,
      evidence,
      conf,
      "Verify this declaration manually against the physical package.",
      layers,
      rule.applicability,
      { status_summary: "Partial information detected" },
    );
  }
  if (band === "LOW") {
    return build(
      rule,
      "REVIEW",
      "A declaration was found, but extraction evidence is weak, so it requires human verification.",
      value,
      evidence,
      conf,
      "Verify this declaration manually against the physical package.",
      layers,
      rule.applicability,
      { status_summary: "Verification required — weak extraction evidence" },
    );
  }
  return build(
    rule,
    "PASS",
    "A declaration was identified and satisfied every automated validation for this rule.",
    value,
    evidence,
    conf,
    "No action required from the automated screening. Confirm legibility on the physical package.",
    layers,
  );
}


// ---------------------------------------------------------------- LM checks

const QTY_RE =
  /^(\d+(?:[.,]\d+)?)\s*(kg|g|gm|gms|gram|grams|mg|l|ltr|litre|litres|liter|liters|ml|n|nos|no|pcs|piece|pieces)$/i;

export function check_product_name(ctx: Ctx) {
  return evaluate(ctx, "product_name", (v) => [
    { label: "Value looks like a commodity name (not only a number)", passed: /[a-z]{3}/i.test(v), severity: "soft" },
  ]);
}

export function check_net_quantity(ctx: Ctx) {
  return evaluate(ctx, "net_quantity", (v) => {
    const t = v.trim();
    const m = t.match(QTY_RE);
    const hasNumber = /\d/.test(t);
    const hasUnitWord = /[a-z]/i.test(t);
    return [
      { label: "Numeric quantity detected", passed: hasNumber, severity: "hard" },
      { label: "Unit of weight / measure / number detected", passed: hasUnitWord, severity: "soft" },
      { label: "Unit is a recognised standard unit", passed: Boolean(m), severity: "soft" },
      { label: "Number + unit form a valid quantity declaration", passed: Boolean(m), severity: "soft" },
    ];
  });
}

export function check_mrp(ctx: Ctx) {
  const raw = ctx.data.raw_text || "";
  return evaluate(ctx, "mrp", (v) => {
    const numeric = /\d/.test(v);
    const parseable = Number.isFinite(Number(v.replace(/[^\d.]/g, ""))) && /\d/.test(v);
    const currency = /₹|rs\.?|inr/i.test(v) || /₹|rs\.?|inr/i.test(raw);
    const wording = /m\.?r\.?p\.?|maximum\s+retail\s+price|retail\s+sale\s+price/i.test(raw);
    return [
      { label: "Price value detected", passed: numeric, severity: "hard" },
      { label: "Value is numerically parseable", passed: parseable, severity: "hard" },
      { label: "Currency indication present", passed: currency, severity: "soft" },
      { label: "Retail-sale-price wording identified", passed: wording, severity: "soft" },
    ];
  });
}

export function check_unit_sale_price(ctx: Ctx) {
  const raw = ctx.data.raw_text || "";
  return evaluate(ctx, "unit_sale_price", (v) => {
    const numeric = /\d/.test(v);
    const perUnit = /\bper\b|\//i.test(v);
    const unit = /\b(kg|g|gm|l|ltr|litre|liter|ml|unit|pc|pcs|piece|n)\b/i.test(v);
    const wording = /unit\s*sale\s*price|price\s*per\s*unit|unit\s*price/i.test(raw);
    return [
      { label: "Price value detected", passed: numeric, severity: "hard" },
      { label: "Per-unit structure detected (e.g. per kg / per litre)", passed: perUnit, severity: "soft" },
      { label: "Recognised unit of measure detected", passed: unit, severity: "soft" },
      { label: "Unit-sale-price wording identified", passed: wording, severity: "soft" },
    ];
  });
}

export function check_manufacturer_details(ctx: Ctx): CheckResult {
  const rule = ruleFor("manufacturer");
  const mfg = ctx.data.fields.manufacturer;
  const packer = ctx.data.fields.packer;
  const importer = ctx.data.fields.importer;
  const address = ctx.data.fields.address;
  const chosen = mfg?.value ? mfg : packer?.value ? packer : importer?.value ? importer : null;

  if (!chosen?.value) return evaluate(ctx, "manufacturer");

  const importerNeeded = ctx.pkg.is_imported;
  const layers: Layer[] = [
    { label: "Manufacturer / packer / importer name", passed: true, severity: "hard" },
    { label: "Identity value is readable", passed: !degradedText(chosen.value), severity: "soft" },
    {
      label: "Identity looks like an entity name",
      passed: /[a-z]{3}/i.test(chosen.value),
      severity: "soft",
    },
    { label: "Address", passed: Boolean(address?.value), severity: "soft" },
    ...(importerNeeded
      ? [
          {
            label: "Importer information",
            passed: Boolean(importer?.value),
            severity: "soft" as const,
          },
        ]
      : []),
  ];

  const softIssue = layers.find((l) => l.passed !== true);
  const conf = chosen.confidence;
  if (softIssue) {
    return build(
      rule,
      "REVIEW",
      `A responsible-entity declaration was found, but one element could not be confirmed: ${softIssue.label}.`,
      chosen.value,
      chosen.evidence,
      conf,
      "Verify the manufacturer / packer / importer name together with the complete address on the physical package.",
      layers,
      rule.applicability,
      { status_summary: "Partial information detected" },
    );
  }
  if (bandFor(conf) === "LOW") {
    return build(
      rule,
      "REVIEW",
      "A responsible-entity declaration was found with weak extraction evidence.",
      chosen.value,
      chosen.evidence,
      conf,
      "Verify the manufacturer / packer declaration manually.",
      layers,
      rule.applicability,
      { status_summary: "Verification required — weak extraction evidence" },
    );
  }
  return build(
    rule,
    "PASS",
    mfg?.value
      ? "A manufacturer declaration with accompanying address information was identified."
      : "No manufacturer declaration was found, but a packer/importer declaration with address information was identified.",
    chosen.value,
    chosen.evidence,
    conf,
    "No action required from the automated screening. Confirm the entity details on the physical package.",
    layers,
  );
}

export function check_address(ctx: Ctx) {
  return evaluate(ctx, "address", (v) => [
    { label: "Address contains locality / street detail", passed: v.length > 10, severity: "soft" },
    { label: "PIN code detected", passed: /\b\d{6}\b/.test(v), severity: "soft" },
  ]);
}

export function check_consumer_care(ctx: Ctx) {
  const raw = ctx.data.raw_text || "";
  return evaluate(ctx, "consumer_care", (v) => {
    const email = /[\w.+-]+@[\w-]+\.[\w.]+/.test(v);
    const phone = /\d{6,}/.test(v.replace(/[\s-]/g, ""));
    return [
      { label: "Contact pattern detected (e-mail or telephone)", passed: email || phone, severity: "hard" },
      { label: "E-mail address detected", passed: email, severity: "soft" },
      { label: "Telephone / helpline number detected", passed: phone, severity: "soft" },
      {
        label: "Consumer-care wording identified",
        passed: /consumer\s*care|customer\s*care|complaint|helpline/i.test(raw),
        severity: "soft",
      },
    ];
  });
}

export function check_date_of_manufacture(ctx: Ctx) {
  return evaluate(ctx, "date_of_manufacture", (v) => {
    const numericMonthYear = /^(0?[1-9]|1[0-2])\s*[/\-.]\s*(20)?\d{2}$/.test(v.trim());
    const namedMonth = /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i.test(v);
    const hasYear = /\d{2,4}/.test(v);
    return [
      { label: "Date-like value detected", passed: hasYear, severity: "hard" },
      {
        label: "Value matches an acceptable month/year pattern",
        passed: numericMonthYear || namedMonth,
        severity: "soft",
      },
    ];
  });
}

export function check_importer_details(ctx: Ctx) {
  const rule = ruleFor("importer");
  if (!ctx.pkg.is_imported) {
    return notApplicable(
      rule,
      "Product classified as domestic based on available label information, so the importer declaration was not evaluated.",
      "If the commodity is in fact imported, re-run the check with a clearer image of the import declaration.",
    );
  }
  return evaluate(ctx, "importer", (v) => [
    { label: "Importer identity looks like an entity name", passed: /[a-z]{3}/i.test(v), severity: "soft" },
    {
      label: "Address information present",
      passed: Boolean(ctx.data.fields.address?.value),
      severity: "soft",
    },
  ]);
}

export function check_country_of_origin(ctx: Ctx) {
  const rule = ruleFor("country_of_origin");
  if (!ctx.pkg.is_imported) {
    return notApplicable(
      rule,
      "Product classified as domestic based on available label information, so the country-of-origin declaration was not evaluated.",
      "If the commodity is imported, verify the country-of-origin declaration manually.",
    );
  }
  return evaluate(ctx, "country_of_origin", (v) => [
    { label: "Country name detected", passed: /[a-z]{3}/i.test(v), severity: "soft" },
  ]);
}

// -------------------------------------------------------------- food checks

/** Food rules only run when the label indicates a food product. */
function foodCheck(
  ctx: Ctx,
  fieldKey: string,
  formatLayers: (value: string) => Layer[] = () => [],
): CheckResult {
  const rule = ruleFor(fieldKey);
  if (!ctx.pkg.is_food) {
    return notApplicable(
      rule,
      "No food-product indicators were detected on the label, so this food-labelling rule was not evaluated.",
      "If this is a pre-packaged food, correct the extracted text so food declarations are visible and re-run the analysis.",
    );
  }
  const result = evaluate(ctx, fieldKey, formatLayers);
  // Uncertain food classification must never harden into a FAIL.
  if (result.status === "FAIL" && ctx.pkg.food_certainty === "uncertain") {
    return {
      ...result,
      status: "REVIEW",
      requires_human_review: true,
      message:
        "The product was only tentatively classified as a food item and this declaration was not detected, so the result requires human verification.",
      recommended_action:
        "Confirm whether this is a pre-packaged food and whether the declaration exists on the package.",
    };
  }
  return result;
}

export function check_veg_nonveg(ctx: Ctx) {
  return foodCheck(ctx, "veg_nonveg_mark", (v) => [
    {
      label: "Vegetarian / non-vegetarian wording identified",
      passed: /non[\s-]?veg|vegetarian/i.test(v),
      severity: "soft",
    },
  ]);
}

export function check_ingredients(ctx: Ctx) {
  return foodCheck(ctx, "ingredients_list", (v) => [
    { label: "Ingredient text detected", passed: /[a-z]{3}/i.test(v), severity: "hard" },
    { label: "Multiple ingredients listed (comma separated)", passed: v.includes(","), severity: "soft" },
  ]);
}

export function check_fssai_licence(ctx: Ctx) {
  return foodCheck(ctx, "fssai_licence", (v) => {
    const digits = v.replace(/\D/g, "");
    return [
      { label: "Numeric licence number detected", passed: digits.length > 0, severity: "hard" },
      { label: "Licence number has 14 digits", passed: digits.length === 14, severity: "soft" },
    ];
  });
}

export function check_best_before(ctx: Ctx) {
  const raw = ctx.data.raw_text || "";
  return foodCheck(ctx, "best_before", (v) => [
    {
      label: "Best before / use by wording identified",
      passed: /best\s*before|use\s*by|expiry|exp\b/i.test(`${v} ${raw}`),
      severity: "soft",
    },
    { label: "Date or duration value detected", passed: /\d/.test(v), severity: "soft" },
  ]);
}

const CHECKS = [
  check_product_name,
  check_net_quantity,
  check_mrp,
  check_unit_sale_price,
  check_manufacturer_details,
  check_address,
  check_consumer_care,
  check_date_of_manufacture,
  check_importer_details,
  check_country_of_origin,
  check_veg_nonveg,
  check_ingredients,
  check_fssai_licence,
  check_best_before,
];

function emptyCategory(): CategorySummary {
  return { passed: 0, failed: 0, review: 0, not_applicable: 0 };
}

function tally(checks: CheckResult[]): CategorySummary {
  return {
    passed: checks.filter((c) => c.status === "PASS").length,
    failed: checks.filter((c) => c.status === "FAIL").length,
    review: checks.filter((c) => c.status === "REVIEW").length,
    not_applicable: checks.filter((c) => c.status === "NOT_APPLICABLE").length,
  };
}

export function summarize(checks: CheckResult[]): ComplianceSummary {
  const applicableChecks = checks.filter((c) => c.status !== "NOT_APPLICABLE");
  const passed = applicableChecks.filter((c) => c.status === "PASS").length;
  const failed = applicableChecks.filter((c) => c.status === "FAIL").length;
  const review = applicableChecks.filter((c) => c.status === "REVIEW").length;
  const applicable = applicableChecks.length;

  // Transparent screening coverage: PASS = 1, REVIEW = 0.5, FAIL = 0,
  // NOT_APPLICABLE excluded entirely from the denominator.
  const score = applicable === 0 ? 0 : Math.round(((passed + review * 0.5) / applicable) * 100);

  const overall: ComplianceSummary["overall"] =
    failed > 0 ? "NON_COMPLIANT" : review > 0 ? "NEEDS_REVIEW" : "COMPLIANT";

  const lm = checks.filter((c) => c.category === "legal_metrology");
  const food = checks.filter((c) => c.category === "food_labelling");

  return {
    applicable,
    passed,
    failed,
    review,
    not_applicable: checks.length - applicable,
    score,
    overall,
    by_category: {
      legal_metrology: lm.length ? tally(lm) : emptyCategory(),
      food_labelling: food.length ? tally(food) : emptyCategory(),
    },
    critical_issues: checks
      .filter((c) => c.status === "FAIL")
      .map((c) => `${c.label}: ${c.message}`),
    human_review_items: review,
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
  const pkg: PackageContext = data.context ?? {
    is_imported: /imported\s+by|country\s+of\s+origin|importer/i.test(data.raw_text || ""),
    imported_signal: null,
    is_food: false,
    food_signal: null,
    food_certainty: "certain",
  };
  const ctx: Ctx = { data, pkg, listing: data.analysis_context === "ecommerce_listing" };
  const checks = CHECKS.map((fn) => fn(ctx));
  return {
    checks,
    summary: summarize(checks),
    recommendations: buildRecommendations(checks),
  };
}

export { LEGAL_RULES };
