import {
  ATOMIC_CHECKS,
  type AtomicCheck,
} from "@/lib/legal/checks.data";

import {
  mpeBandFor,
  standardPackFor,
  whenPackedConditionsFor,
  quantityTypeRuleFor,
  type QuantityType,
} from "@/lib/legal/schedules";

import {
  bandFor,
  SEVERITY_WEIGHT,
  type ApplicabilityDecision,
  type CheckResult,
  type CheckStatus,
  type ExtractedData,
  type ExtractedField,
  type PackageContext,
  type ValidationStep,
} from "./types";

import {
  degradedText,
  detectContext,
} from "./extract";

const LOW_CONFIDENCE = 0.45;
const LOW_OCR_CONFIDENCE = 0.50;

interface AtomicContext {
  data: ExtractedData;
  package: PackageContext;
  listing: boolean;
}

/* -------------------------------------------------------------------------- */
/* Context                                                                     */
/* -------------------------------------------------------------------------- */

function createContext(data: ExtractedData): AtomicContext {
  return {
    data,
    package:
      data.context ??
      detectContext(data.raw_text || "", data.fields),
    listing: data.analysis_context === "ecommerce_listing",
  };
}

/* -------------------------------------------------------------------------- */
/* Field helpers                                                               */
/* -------------------------------------------------------------------------- */

function getField(
  ctx: AtomicContext,
  key: string,
): ExtractedField | null {
  return ctx.data.fields[key] ?? null;
}

function getValue(
  ctx: AtomicContext,
  key: string,
): string | null {
  return getField(ctx, key)?.value ?? null;
}

function getConfidence(
  ctx: AtomicContext,
  keys: string[],
): number {
  const values = keys
    .map((key) => getField(ctx, key)?.confidence)
    .filter((value): value is number => typeof value === "number");

  if (values.length === 0) {
    return ctx.data.ocr_confidence;
  }

  return Math.min(...values);
}

function getEvidence(
  ctx: AtomicContext,
  keys: string[],
): string | null {
  for (const key of keys) {
    const evidence = getField(ctx, key)?.evidence;

    if (evidence) {
      return evidence;
    }
  }

  return null;
}

function detectedFields(
  ctx: AtomicContext,
  keys: string[],
): string[] {
  return keys.filter((key) => Boolean(getValue(ctx, key)));
}

function missingFields(
  ctx: AtomicContext,
  keys: string[],
): string[] {
  return keys.filter((key) => !getValue(ctx, key));
}

function extractionIsPoor(ctx: AtomicContext): boolean {
  return (
    ctx.data.ocr_confidence < LOW_OCR_CONFIDENCE ||
    degradedText(ctx.data.raw_text || "")
  );
}

/* -------------------------------------------------------------------------- */
/* Quantity parsing                                                            */
/* -------------------------------------------------------------------------- */

interface ParsedQuantity {
  value: number;
  unit: string;
  quantityType: QuantityType;
  baseValue: number;
}

function parseQuantity(
  raw: string | null,
): ParsedQuantity | null {
  if (!raw) {
    return null;
  }

  const match = raw.match(
    /([0-9]+(?:\.[0-9]+)?)\s*(kg|g|mg|µg|ug|l|lt|ltr|litre|liter|ml|mL|cm|mm|m|m2|cm2|sq\.?\s*(?:cm|m)|pcs?|pieces?|nos?|number|count)\b/i,
  );

  if (!match) {
    return null;
  }

  const value = Number(match[1]);
  const unit = match[2].toLowerCase();

  if (!Number.isFinite(value)) {
    return null;
  }

  /* Weight is normalized to grams. */
  if (["kg", "g", "mg", "µg", "ug"].includes(unit)) {
    let baseValue = value;

    if (unit === "kg") {
      baseValue = value * 1000;
    } else if (["mg", "µg", "ug"].includes(unit)) {
      baseValue = value / 1000;
    }

    return {
      value,
      unit,
      quantityType: "weight",
      baseValue,
    };
  }

  /* Volume is normalized to millilitres. */
  if (
    ["l", "lt", "ltr", "litre", "liter", "ml"].includes(unit)
  ) {
    return {
      value,
      unit,
      quantityType: "volume",
      baseValue:
        ["l", "lt", "ltr", "litre", "liter"].includes(unit)
          ? value * 1000
          : value,
    };
  }

  /* Length is normalized to centimetres. */
  if (["cm", "mm", "m"].includes(unit)) {
    return {
      value,
      unit,
      quantityType: "length",
      baseValue:
        unit === "m"
          ? value * 100
          : unit === "mm"
            ? value / 10
            : value,
    };
  }

  /* Area is normalized to cm². */
  if (["m2", "cm2"].includes(unit) || unit.includes("sq")) {
    return {
      value,
      unit,
      quantityType: "area",
      baseValue:
        unit === "m2"
          ? value * 10000
          : value,
    };
  }

  return {
    value,
    unit,
    quantityType: "number",
    baseValue: value,
  };
}

function getQuantity(
  ctx: AtomicContext,
): ParsedQuantity | null {
  return parseQuantity(
    getValue(ctx, "net_quantity"),
  );
}

/* -------------------------------------------------------------------------- */
/* Rule 3 — scope                                                              */
/* -------------------------------------------------------------------------- */

interface ScopeResult {
  decision: ApplicabilityDecision;
  reason: string;
}

function determineScope(
  ctx: AtomicContext,
): ScopeResult {
  const rawText = ctx.data.raw_text || "";

  const productName =
    getValue(ctx, "product_name") || "";

  const text =
    `${rawText} ${productName}`.toLowerCase();

  /*
   * Industrial-only packages.
   */
  if (
    /\b(for\s+industrial\s+use\s+only|industrial\s+consumer|industrial\s+use\s+only)\b/.test(
      text,
    )
  ) {
    return {
      decision: "NOT_APPLICABLE",
      reason:
        "The submitted source indicates that the package is intended exclusively for industrial consumers.",
    };
  }

  /*
   * Institutional-only packages.
   */
  if (
    /\b(for\s+institutional\s+use\s+only|institutional\s+consumer|institutional\s+use\s+only)\b/.test(
      text,
    )
  ) {
    return {
      decision: "NOT_APPLICABLE",
      reason:
        "The submitted source indicates that the package is intended exclusively for institutional consumers.",
    };
  }

  /*
   * Export packages.
   */
  if (
    /\b(for\s+export|export\s+only|made\s+for\s+export)\b/.test(
      text,
    )
  ) {
    return {
      decision: "NOT_APPLICABLE",
      reason:
        "The submitted source indicates that the package is intended for export.",
    };
  }

  const quantity = getQuantity(ctx);

  /*
   * >25 kg.
   */
  if (
    quantity?.quantityType === "weight" &&
    quantity.baseValue > 25000
  ) {
    if (
      /\b(cement|fertilizer|fertiliser)\b/.test(text)
    ) {
      return {
        decision: "APPLICABLE",
        reason:
          "The declared quantity exceeds 25 kg and a cement/fertilizer indicator was detected. The applicable exception still requires confirmation.",
      };
    }

    return {
      decision: "NOT_APPLICABLE",
      reason:
        "The declared quantity exceeds 25 kg and no applicable exception was detected.",
    };
  }

  /*
   * >25 litres.
   */
  if (
    quantity?.quantityType === "volume" &&
    quantity.baseValue > 25000
  ) {
    return {
      decision: "NOT_APPLICABLE",
      reason:
        "The declared quantity exceeds 25 litres and the package is outside the ordinary retail declaration scope.",
    };
  }

  return {
    decision: "APPLICABLE",
    reason:
      "No deterministic Rule 3 exclusion was identified from the submitted source.",
  };
}

function determineApplicability(
  ctx: AtomicContext,
  check: AtomicCheck,
): ScopeResult {
  /*
   * Rule 3 itself is always evaluated because it establishes scope.
   */
  if (check.parentRule === "Rule 3") {
    return {
      decision: "APPLICABLE",
      reason:
        "This is the Rule 3 applicability gate.",
    };
  }

  const scope = determineScope(ctx);

  if (
    scope.decision === "NOT_APPLICABLE"
  ) {
    return scope;
  }

  /*
   * Wholesale checks.
   */
  if (check.parentRule === "Rule 24") {
    const text =
      ctx.data.raw_text.toLowerCase();

    if (
      /\b(wholesale|wholesaler|wholesale\s+package|for\s+wholesale\s+sale)\b/.test(
        text,
      )
    ) {
      return {
        decision: "APPLICABLE",
        reason:
          "Wholesale-package wording was detected.",
      };
    }

    return {
      decision: "UNCERTAIN",
      reason:
        "The submitted source does not provide enough evidence to classify the package as wholesale.",
    };
  }

  /*
   * Export checks.
   */
  if (check.parentRule === "Rule 25") {
    const text =
      ctx.data.raw_text.toLowerCase();

    if (
      /\b(for\s+export|export\s+only|made\s+for\s+export)\b/.test(
        text,
      )
    ) {
      return {
        decision: "APPLICABLE",
        reason:
          "Export wording was detected.",
      };
    }

    return {
      decision: "NOT_APPLICABLE",
      reason:
        "No export indication was detected.",
    };
  }

  return scope;
}

/* -------------------------------------------------------------------------- */
/* Result builder                                                              */
/* -------------------------------------------------------------------------- */

function buildResult(
  ctx: AtomicContext,
  check: AtomicCheck,
  status: CheckStatus,
  message: string,
  detected: string | null,
  confidence: number,
  detectedComponents: string[],
  missingComponents: string[],
  customEvidence?: string | null,
): CheckResult {
  const applicability =
    determineApplicability(ctx, check);

  /*
   * Never allow a downstream PASS/FAIL if applicability itself is uncertain.
   */
  if (
    check.parentRule !== "Rule 3" &&
    applicability.decision === "UNCERTAIN" &&
    status !== "NOT_APPLICABLE"
  ) {
    status = "REVIEW";

    message =
      `Applicability is uncertain. ${message}`;
  }

  /*
   * Scope exclusion overrides downstream checks.
   */
  if (
    check.parentRule !== "Rule 3" &&
    applicability.decision === "NOT_APPLICABLE"
  ) {
    status = "NOT_APPLICABLE";
    message = applicability.reason;
  }

  const boundedConfidence = Math.max(
    0,
    Math.min(
      1,
      Number.isFinite(confidence)
        ? confidence
        : 0,
    ),
  );

  const statusWeight =
    status === "FAIL"
      ? 12
      : status === "REVIEW"
        ? 6
        : status === "PASS"
          ? -100
          : -200;

  const priority =
    SEVERITY_WEIGHT[
      check.operationalPriority
    ] + statusWeight;

  const validationSteps: ValidationStep[] = [
    {
      label: "Applicability",
      passed:
        applicability.decision ===
        "APPLICABLE"
          ? true
          : applicability.decision ===
              "NOT_APPLICABLE"
            ? false
            : null,
    },
    {
      label: "Required information",
      passed:
        status === "PASS"
          ? true
          : status === "FAIL"
            ? false
            : null,
    },
  ];

  return {
  status,

  check_id: check.checkId,
  parent_rule: check.parentRule,
  sub_rule: check.subRule,

  field:
    check.requiredFields[0] ??
    check.checkId,

  label: check.title,

    category: check.category,

    message,

    detected,

    evidence:
      customEvidence ??
      detected ??
      getEvidence(
        ctx,
        check.requiredFields,
      ),

    expected: check.requirement,

    rule_reference:
      check.sourceReference ||
      check.checkId,

    confidence:
      Math.round(
        boundedConfidence * 100,
      ) / 100,

    confidence_band:
      bandFor(boundedConfidence),

    validations: validationSteps,

    applicability:
      check.applicability,

    recommended_action:
      status === "PASS"
        ? "Retain the detected evidence. No further automated action is required for this check."
        : status === "FAIL"
          ? "Verify the physical package and authoritative evidence before taking enforcement action."
          : status === "NOT_APPLICABLE"
            ? "No action is required unless the package classification changes."
            : "Refer this item for human inspection or authoritative source verification.",

    requires_human_review:
      status === "REVIEW" ||
      check.automationLevel !==
        "AUTOMATIC",

    status_summary:
      status === "PASS"
        ? "Complete information detected"
        : status === "FAIL"
          ? "Required information not detected"
          : status ===
              "NOT_APPLICABLE"
            ? "Rule does not apply"
            : "Partial / ambiguous information",

    detected_components:
      detectedComponents,

    missing_components:
      missingComponents,

    source_note:
      ctx.listing
        ? "This result describes the submitted e-commerce source only. Verify the physical package before making a final legal determination."
        : "This result describes the submitted source only. Verify the physical package or authoritative documentation before making a final legal determination.",

    severity:
      check.operationalPriority,

    priority_reason:
      "METRIQ operational inspection priority; not a statutory severity ranking.",

    legal_severity:
      check.legalSeverity,

    priority,

    rule_group:
      check.parentRule,

    applicability_decision:
      applicability.decision,

    applicability_reason:
      applicability.reason,

    rule_verification:
      check.status === "verified"
        ? "VERIFIED"
        : "NEEDS_VERIFICATION",

    binding:
      check.status === "verified",
  };
}

function reviewResult(
  ctx: AtomicContext,
  check: AtomicCheck,
  message: string,
  confidence?: number,
): CheckResult {
  return buildResult(
    ctx,
    check,
    "REVIEW",
    message,
    null,
    confidence ??
      getConfidence(
        ctx,
        check.requiredFields,
      ),
    [],
    check.requiredFields,
  );
}

function notApplicableResult(
  ctx: AtomicContext,
  check: AtomicCheck,
  message: string,
): CheckResult {
  return buildResult(
    ctx,
    check,
    "NOT_APPLICABLE",
    message,
    null,
    1,
    [],
    [],
  );
}

/* -------------------------------------------------------------------------- */
/* Generic presence evaluator                                                  */
/* -------------------------------------------------------------------------- */

function evaluatePresence(
  ctx: AtomicContext,
  check: AtomicCheck,
): CheckResult {
  const required =
    check.requiredFields;

  /*
   * No structured fields means OCR cannot establish this requirement.
   */
  if (required.length === 0) {
    return reviewResult(
      ctx,
      check,
      "This requirement cannot be conclusively determined from the currently extracted structured data.",
    );
  }

  const detected =
    detectedFields(ctx, required);

  const missing =
    missingFields(ctx, required);

  const confidence =
    getConfidence(ctx, required);

  const evidence =
    getEvidence(ctx, required);

  /*
   * Nothing detected.
   */
  if (detected.length === 0) {
    return buildResult(
      ctx,
      check,
      "FAIL",
      "No corresponding declaration was detected in the submitted source. This is a screening result only and does not by itself establish legal non-compliance.",
      null,
      confidence,
      [],
      missing,
      evidence,
    );
  }

  /*
   * Some parts detected, some missing.
   */
  if (missing.length > 0) {
    return buildResult(
      ctx,
      check,
      "REVIEW",
      `Only part of the required information was detected. Missing: ${missing.join(", ")}.`,
      detected.join("; "),
      confidence,
      detected,
      missing,
      evidence,
    );
  }

  /*
   * Everything found, but extraction is weak.
   */
  if (
    confidence < LOW_CONFIDENCE ||
    extractionIsPoor(ctx)
  ) {
    return buildResult(
      ctx,
      check,
      "REVIEW",
      "The required information was detected, but extraction quality is insufficient for a reliable automated conclusion.",
      detected.join("; "),
      confidence,
      detected,
      [],
      evidence,
    );
  }

  return buildResult(
    ctx,
    check,
    "PASS",
    "Required information was detected in the submitted source.",
    detected.join("; "),
    confidence,
    detected,
    [],
    evidence,
  );
}

/* -------------------------------------------------------------------------- */
/* Rule 3 evaluators                                                           */
/* -------------------------------------------------------------------------- */

function evaluateRule3(
  ctx: AtomicContext,
  check: AtomicCheck,
): CheckResult {
  switch (check.evaluator) {
    case "r3_scope": {
      const scope =
        determineScope(ctx);

      return buildResult(
        ctx,
        check,
        scope.decision ===
          "NOT_APPLICABLE"
          ? "REVIEW"
          : "PASS",
        scope.reason,
        null,
        ctx.data.ocr_confidence,
        [],
        [],
      );
    }

    case "r3_over_25kg": {
      const quantity =
        getQuantity(ctx);

      if (!quantity) {
        return reviewResult(
          ctx,
          check,
          "The net quantity could not be reliably parsed for the 25 kg threshold test.",
        );
      }

      if (
        quantity.quantityType !==
        "weight"
      ) {
        return notApplicableResult(
          ctx,
          check,
          "The declared quantity is not weight-based.",
        );
      }

      if (
        quantity.baseValue <= 25000
      ) {
        return buildResult(
          ctx,
          check,
          "PASS",
          "The declared weight does not exceed 25 kg.",
          getValue(
            ctx,
            "net_quantity",
          ),
          getConfidence(ctx, [
            "net_quantity",
          ]),
          ["net_quantity"],
          [],
        );
      }

      const text =
        ctx.data.raw_text.toLowerCase();

      if (
        /\b(cement|fertilizer|fertiliser)\b/.test(
          text,
        )
      ) {
        return reviewResult(
          ctx,
          check,
          "The declared weight exceeds 25 kg and a cement/fertilizer indicator was detected. Confirm the applicable exception.",
        );
      }

      return reviewResult(
        ctx,
        check,
        "The declared weight exceeds 25 kg. Confirm whether an applicable exception applies.",
      );
    }

    case "r3_over_25l": {
      const quantity =
        getQuantity(ctx);

      if (!quantity) {
        return reviewResult(
          ctx,
          check,
          "The net quantity could not be reliably parsed for the 25 litre threshold test.",
        );
      }

      if (
        quantity.quantityType !==
        "volume"
      ) {
        return notApplicableResult(
          ctx,
          check,
          "The declared quantity is not volume-based.",
        );
      }

      if (
        quantity.baseValue <= 25000
      ) {
        return buildResult(
          ctx,
          check,
          "PASS",
          "The declared volume does not exceed 25 litres.",
          getValue(
            ctx,
            "net_quantity",
          ),
          getConfidence(ctx, [
            "net_quantity",
          ]),
          ["net_quantity"],
          [],
        );
      }

      return reviewResult(
        ctx,
        check,
        "The declared volume exceeds 25 litres and scope requires confirmation.",
      );
    }

    case "r3_cement_fertilizer": {
      const text =
        ctx.data.raw_text.toLowerCase();

      if (
        /\b(cement|fertilizer|fertiliser)\b/.test(
          text,
        )
      ) {
        return reviewResult(
          ctx,
          check,
          "A cement/fertilizer indicator was detected. Confirm that the specific Rule 3 exception applies.",
        );
      }

      return notApplicableResult(
        ctx,
        check,
        "No cement or fertilizer indicator was detected.",
      );
    }

    case "r3_industrial":
      return keywordApplicability(
        ctx,
        check,
        /\bindustrial\b/,
        "Industrial-use wording was detected.",
        "No industrial-use wording was detected.",
      );

    case "r3_institutional":
      return keywordApplicability(
        ctx,
        check,
        /\binstitutional\b/,
        "Institutional-use wording was detected.",
        "No institutional-use wording was detected.",
      );

    case "r3_export":
      return keywordApplicability(
        ctx,
        check,
        /\bexport\b/,
        "Export wording was detected.",
        "No export wording was detected.",
      );

    case "r3_wholesale":
      return keywordApplicability(
        ctx,
        check,
        /\bwholesale\b/,
        "Wholesale wording was detected.",
        "No wholesale wording was detected.",
      );

    case "r3_retail":
      return reviewResult(
        ctx,
        check,
        "Retail-package classification should be confirmed from the package/source context.",
      );

    case "r3_exemption_gate":
      return reviewResult(
        ctx,
        check,
        "Exemption screening was performed, but the exact exemption requires commodity-specific legal confirmation.",
      );

    default:
      return evaluatePresence(
        ctx,
        check,
      );
  }
}

function keywordApplicability(
  ctx: AtomicContext,
  check: AtomicCheck,
  pattern: RegExp,
  foundMessage: string,
  absentMessage: string,
): CheckResult {
  const text =
    ctx.data.raw_text.toLowerCase();

  if (pattern.test(text)) {
    return reviewResult(
      ctx,
      check,
      `${foundMessage} Confirm the exact legal classification before treating the package as excluded.`,
    );
  }

  return notApplicableResult(
    ctx,
    check,
    absentMessage,
  );
}

/* -------------------------------------------------------------------------- */
/* Rule 5 — standard pack sizes                                                */
/* -------------------------------------------------------------------------- */

function evaluateStandardPack(
  ctx: AtomicContext,
  check: AtomicCheck,
): CheckResult {
  const product =
    getValue(ctx, "product_name");

  const netQuantity =
    getValue(ctx, "net_quantity");

  if (!product || !netQuantity) {
    return evaluatePresence(
      ctx,
      check,
    );
  }

  const quantity =
    getQuantity(ctx);

  if (!quantity) {
    return reviewResult(
      ctx,
      check,
      "The product and quantity were detected, but the quantity could not be normalized for schedule comparison.",
    );
  }

  const standard =
    standardPackFor(product);

  if (!standard) {
    return reviewResult(
      ctx,
      check,
      "The commodity could not be confidently matched to a Second Schedule standard-pack entry.",
    );
  }

  /*
   * Do not call this PASS while the schedule record is marked
   * needs_verification.
   */
  if (
    standard.status !==
    "verified"
  ) {
    return reviewResult(
      ctx,
      check,
      `The commodity matched the Second Schedule entry "${standard.commodity}", but that schedule record is not yet marked as legally verified in METRIQ.`,
    );
  }

  const unitMatches =
    standard.unit ===
    quantity.unit ||
    (
      standard.unit === "kg" &&
      quantity.unit === "kg"
    );

  if (!unitMatches) {
    return buildResult(
      ctx,
      check,
      "REVIEW",
      `The declared quantity uses "${quantity.unit}" while the matched schedule entry expects "${standard.unit}". Confirm the applicable legal representation.`,
      netQuantity,
      getConfidence(ctx, [
        "product_name",
        "net_quantity",
      ]),
      [
        "product_name",
        "net_quantity",
      ],
      [],
    );
  }

  const permitted =
    standard.permittedQuantity.some(
      (allowed) =>
        Math.abs(
          allowed -
            quantity.value,
        ) < 0.000001,
    );

  return buildResult(
    ctx,
    check,
    permitted
      ? "PASS"
      : "REVIEW",
    permitted
      ? `The declared quantity matches a permitted standard-pack quantity for "${standard.commodity}".`
      : `The declared quantity does not directly match the listed standard-pack quantities for "${standard.commodity}". Confirm the schedule conditions and exceptions.`,
    netQuantity,
    getConfidence(ctx, [
      "product_name",
      "net_quantity",
    ]),
    [
      "product_name",
      "net_quantity",
    ],
    [],
  );
}

/* -------------------------------------------------------------------------- */
/* Rule 6 / 10 — declarations                                                  */
/* -------------------------------------------------------------------------- */

function evaluateDeclaration(
  ctx: AtomicContext,
  check: AtomicCheck,
): CheckResult {
  return evaluatePresence(
    ctx,
    check,
  );
}

/* -------------------------------------------------------------------------- */
/* Rule 7–9 — visual checks                                                     */
/* -------------------------------------------------------------------------- */

function evaluateVisual(
  ctx: AtomicContext,
  check: AtomicCheck,
): CheckResult {
  const reason = ctx.listing
    ? "This requirement depends on package geometry, typography, spacing, prominence or visual presentation and cannot be conclusively measured from an e-commerce listing."
    : "This requirement requires visual or geometric inspection of the physical package and cannot safely be established from OCR alone.";

  return reviewResult(
    ctx,
    check,
    reason,
    ctx.data.ocr_confidence,
  );
}

/* -------------------------------------------------------------------------- */
/* Rule 11 — quantity representation                                            */
/* -------------------------------------------------------------------------- */

function evaluateRule11(
  ctx: AtomicContext,
  check: AtomicCheck,
): CheckResult {
  const raw =
    getValue(ctx, "net_quantity");

  if (!raw) {
    return evaluatePresence(
      ctx,
      check,
    );
  }

  const quantity =
    parseQuantity(raw);

  if (!quantity) {
    return reviewResult(
      ctx,
      check,
      "The quantity declaration was detected, but its numeric/unit representation could not be reliably parsed.",
    );
  }

  switch (check.evaluator) {
    case "r11_numeric":
      return buildResult(
        ctx,
        check,
        /\d/.test(raw)
          ? "PASS"
          : "FAIL",
        /\d/.test(raw)
          ? "A numeric quantity representation was detected."
          : "No numeric quantity representation was detected.",
        raw,
        getConfidence(ctx, [
          "net_quantity",
        ]),
        ["net_quantity"],
        [],
      );

    case "r11_unit_pairing":
      return buildResult(
        ctx,
        check,
        /\d\s*[a-zA-Zµ²]+/.test(
          raw,
        )
          ? "PASS"
          : "REVIEW",
        /\d\s*[a-zA-Zµ²]+/.test(
          raw,
        )
          ? "A numeric value and unit were detected together."
          : "The numeric/unit pairing could not be reliably established.",
        raw,
        getConfidence(ctx, [
          "net_quantity",
        ]),
        ["net_quantity"],
        [],
      );

    case "r11_representation":
      return buildResult(
        ctx,
        check,
        "PASS",
        `The quantity was parsed as a ${quantity.quantityType} quantity.`,
        raw,
        getConfidence(ctx, [
          "net_quantity",
        ]),
        ["net_quantity"],
        [],
      );

    case "r11_consistency": {
      const quantities =
        Array.from(
          new Set(
            Array.from(
              (
                ctx.data.raw_text ||
                ""
              ).matchAll(
                /(?:net\s*(?:qty|quantity|wt|weight|content))[^0-9]{0,15}([0-9]+(?:\.[0-9]+)?\s*(?:kg|g|mg|ml|l)\b)/gi,
              ),
            ).map((match) =>
              match[1]
                .replace(
                  /\s+/g,
                  " ",
                )
                .toLowerCase(),
            ),
          ),
        );

      return buildResult(
        ctx,
        check,
        quantities.length <= 1
          ? "PASS"
          : "REVIEW",
        quantities.length <= 1
          ? "No conflicting quantity declarations were detected."
          : `Conflicting quantity declarations were detected: ${quantities.join(", ")}.`,
        quantities.length
          ? quantities.join(
              " / ",
            )
          : raw,
        getConfidence(ctx, [
          "net_quantity",
        ]),
        ["net_quantity"],
        [],
      );
    }

    case "r11_when_packed": {
      const matches =
        whenPackedConditionsFor(
          getValue(
            ctx,
            "product_name",
          ) ||
            ctx.data.raw_text ||
            "",
        );

      if (
        matches.length === 0
      ) {
        return notApplicableResult(
          ctx,
          check,
          "No commodity-specific Third Schedule 'when packed' condition was matched.",
        );
      }

      const verified =
        matches.every(
          (item) =>
            item.status ===
            "verified",
        );

      return reviewResult(
        ctx,
        check,
        verified
          ? "A Third Schedule condition was matched and requires confirmation against the commodity and package."
          : "A Third Schedule condition was matched, but the schedule record is not yet marked as verified.",
      );
    }

    case "r11_commodity_specific":
      return evaluateScheduleCommodity(
        ctx,
        check,
      );

    default:
      return evaluatePresence(
        ctx,
        check,
      );
  }
}

/* -------------------------------------------------------------------------- */
/* Rule 12 — quantity type                                                      */
/* -------------------------------------------------------------------------- */

function evaluateRule12(
  ctx: AtomicContext,
  check: AtomicCheck,
): CheckResult {
  const product =
    getValue(ctx, "product_name");

  const quantity =
    getQuantity(ctx);

  if (!product || !quantity) {
    return evaluatePresence(
      ctx,
      check,
    );
  }

  const schedule =
    quantityTypeRuleFor(
      product,
    );

  if (!schedule) {
    return reviewResult(
      ctx,
      check,
      "No commodity-specific Fourth Schedule quantity-type rule could be confidently matched.",
    );
  }

  if (
    schedule.status !==
    "verified"
  ) {
    return reviewResult(
      ctx,
      check,
      `The commodity matched "${schedule.commodity}", but the Fourth Schedule record is not yet legally verified in METRIQ.`,
    );
  }

  if (
    schedule.requiredQuantityType !==
    quantity.quantityType
  ) {
    return buildResult(
      ctx,
      check,
      "REVIEW",
      `The matched schedule expects ${schedule.requiredQuantityType}, while the extracted declaration appears to use ${quantity.quantityType}. Confirm the applicable legal provision.`,
      getValue(
        ctx,
        "net_quantity",
      ),
      getConfidence(ctx, [
        "product_name",
        "net_quantity",
      ]),
      [
        "product_name",
        "net_quantity",
      ],
      [],
    );
  }

  return buildResult(
    ctx,
    check,
    "PASS",
    `The extracted quantity type matches the matched Fourth Schedule quantity type (${schedule.requiredQuantityType}).`,
    getValue(
      ctx,
      "net_quantity",
    ),
    getConfidence(ctx, [
      "product_name",
      "net_quantity",
    ]),
    [
      "product_name",
      "net_quantity",
    ],
    [],
  );
}

function evaluateScheduleCommodity(
  ctx: AtomicContext,
  check: AtomicCheck,
): CheckResult {
  const product =
    getValue(ctx, "product_name");

  if (!product) {
    return evaluatePresence(
      ctx,
      check,
    );
  }

  const schedule =
    quantityTypeRuleFor(
      product,
    );

  if (!schedule) {
    return reviewResult(
      ctx,
      check,
      "The product could not be confidently matched to a commodity-specific quantity rule.",
    );
  }

  return reviewResult(
    ctx,
    check,
    `The product matched the commodity-specific schedule entry "${schedule.commodity}". Confirm the exact applicable provision.`,
  );
}

/* -------------------------------------------------------------------------- */
/* Rule 13                                                                   */
/* -------------------------------------------------------------------------- */

function evaluateRule13(
  ctx: AtomicContext,
  check: AtomicCheck,
): CheckResult {
  const raw =
    getValue(ctx, "net_quantity");

  if (!raw) {
    return evaluatePresence(
      ctx,
      check,
    );
  }

  switch (check.evaluator) {
    case "r13_prohibited_terms":
      if (
        /\b(dozen|dz\.?)\b/i.test(
          raw,
        )
      ) {
        return reviewResult(
          ctx,
          check,
          "A prohibited or non-preferred quantity term was detected. Confirm the legally required representation.",
        );
      }

      return buildResult(
        ctx,
        check,
        "PASS",
        "No prohibited quantity term was detected in the extracted declaration.",
        raw,
        getConfidence(ctx, [
          "net_quantity",
        ]),
        ["net_quantity"],
        [],
      );

    case "r13_valid_unit": {
      const quantity =
        parseQuantity(raw);

      return quantity
        ? buildResult(
            ctx,
            check,
            "PASS",
            `A recognizable quantity unit (${quantity.unit}) was detected.`,
            raw,
            getConfidence(ctx, [
              "net_quantity",
            ]),
            ["net_quantity"],
            [],
          )
        : reviewResult(
            ctx,
            check,
            "The quantity unit could not be reliably recognized.",
          );
    }

    case "r13_unit_symbol":
    case "r13_type_unit_consistency":
      return reviewResult(
        ctx,
        check,
        "The extracted quantity can be parsed, but the exact statutory unit/symbol representation requires legal-format validation.",
      );

    default:
      return evaluatePresence(
        ctx,
        check,
      );
  }
}

/* -------------------------------------------------------------------------- */
/* Rule 14–18 generic evaluators                                               */
/* -------------------------------------------------------------------------- */

function evaluateScheduleOrPresence(
  ctx: AtomicContext,
  check: AtomicCheck,
): CheckResult {
  return evaluatePresence(
    ctx,
    check,
  );
}

function evaluatePrice(
  ctx: AtomicContext,
  check: AtomicCheck,
): CheckResult {
  const mrp =
    getValue(ctx, "mrp");

  if (!mrp) {
    return evaluatePresence(
      ctx,
      check,
    );
  }

  if (
    check.evaluator ===
    "r18_price_above_mrp"
  ) {
    const raw =
      ctx.data.raw_text || "";

    const mrpMatch =
      mrp.match(
        /[0-9]+(?:\.[0-9]+)?/,
      );

    const onlinePriceMatch =
      raw.match(
        /(?:sale|selling|online|offer)\s*(?:price)?[^0-9]{0,20}([0-9]+(?:\.[0-9]{1,2})?)/i,
      );

    if (
      !mrpMatch ||
      !onlinePriceMatch
    ) {
      return reviewResult(
        ctx,
        check,
        "MRP was detected, but a directly comparable selling price could not be reliably extracted.",
      );
    }

    const mrpValue =
      Number(mrpMatch[0]);

    const sellingPrice =
      Number(
        onlinePriceMatch[1],
      );

    if (
      !Number.isFinite(
        mrpValue,
      ) ||
      !Number.isFinite(
        sellingPrice,
      )
    ) {
      return reviewResult(
        ctx,
        check,
        "The extracted price values could not be reliably normalized.",
      );
    }

    return buildResult(
      ctx,
      check,
      sellingPrice >
        mrpValue
        ? "FAIL"
        : "PASS",
      sellingPrice >
        mrpValue
        ? `The detected selling price (${sellingPrice}) is above the detected MRP (${mrpValue}).`
        : `The detected selling price (${sellingPrice}) is not above the detected MRP (${mrpValue}).`,
      `${sellingPrice} / ${mrpValue}`,
      getConfidence(ctx, [
        "mrp",
      ]),
      ["mrp"],
      [],
    );
  }

  return evaluatePresence(
    ctx,
    check,
  );
}

/* -------------------------------------------------------------------------- */
/* Rule 19 / 22 — physical inspection                                          */
/* -------------------------------------------------------------------------- */

function evaluatePhysical(
  ctx: AtomicContext,
  check: AtomicCheck,
): CheckResult {
  return reviewResult(
    ctx,
    check,
    "This requirement requires physical inspection or measurement and cannot be conclusively established from OCR or an e-commerce listing.",
    ctx.data.ocr_confidence,
  );
}

function evaluateMpe(
  ctx: AtomicContext,
  check: AtomicCheck,
): CheckResult {
  const quantity =
    getQuantity(ctx);

  if (!quantity) {
    return reviewResult(
      ctx,
      check,
      "The declared quantity could not be normalized for First Schedule MPE lookup.",
    );
  }

  const band =
    mpeBandFor(
      quantity.quantityType,
      quantity.baseValue,
    );

  if (!band) {
    return reviewResult(
      ctx,
      check,
      "No applicable First Schedule MPE band could be identified for the extracted quantity.",
    );
  }

  if (
    band.status !==
    "verified"
  ) {
    return reviewResult(
      ctx,
      check,
      `The applicable MPE band (${band.mpeId}) was identified, but the schedule record is not yet marked as verified in METRIQ.`,
    );
  }

  return reviewResult(
    ctx,
    check,
    `The applicable MPE band (${band.mpeId}) was identified. Actual compliance requires physical measurement of the commodity.`,
  );
}

/* -------------------------------------------------------------------------- */
/* Rule 23 / visual/deceptive packaging                                        */
/* -------------------------------------------------------------------------- */

function evaluateDeceptivePackaging(
  ctx: AtomicContext,
  check: AtomicCheck,
): CheckResult {
  return reviewResult(
    ctx,
    check,
    "Deceptive-packaging assessment requires visual and contextual inspection and is not conclusively established by OCR alone.",
  );
}

/* -------------------------------------------------------------------------- */
/* Rule 27–30 — external records                                               */
/* -------------------------------------------------------------------------- */

function evaluateExternalRecord(
  ctx: AtomicContext,
  check: AtomicCheck,
): CheckResult {
  return reviewResult(
    ctx,
    check,
    "This requirement depends on an external registration, licence, return, record, document or authority-held source and cannot be verified from the submitted package source alone.",
    0,
  );
}

/* -------------------------------------------------------------------------- */
/* Evaluator registry                                                          */
/* -------------------------------------------------------------------------- */

type Evaluator = (
  ctx: AtomicContext,
  check: AtomicCheck,
) => CheckResult;

const EVALUATORS: Record<
  string,
  Evaluator
> = {
  /* Rule 3 */
  r3_scope: evaluateRule3,
  r3_over_25kg: evaluateRule3,
  r3_over_25l: evaluateRule3,
  r3_cement_fertilizer:
    evaluateRule3,
  r3_industrial:
    evaluateRule3,
  r3_institutional:
    evaluateRule3,
  r3_retail:
    evaluateRule3,
  r3_wholesale:
    evaluateRule3,
  r3_export:
    evaluateRule3,
  r3_exemption_gate:
    evaluateRule3,

  /* Rule 5 */
  r5_standard_pack:
    evaluateStandardPack,
  r5_commodity_identified:
    evaluatePresence,

  /* Rule 6 */
  r6_packer:
    evaluateDeclaration,
  r6_dimensions:
    evaluateDeclaration,
  r6_phone:
    evaluateDeclaration,
  r6_email:
    evaluateDeclaration,
  r6_imported_declarations:
    evaluateDeclaration,
  r6_multicomponent:
    evaluateDeclaration,
  r6_sticker_mrp:
    evaluateDeclaration,

  /* Rule 7 */
  r7_pdp_identified:
    evaluateVisual,
  r7_declarations_on_pdp:
    evaluateVisual,
  r7_letter_height:
    evaluateVisual,
  r7_numeral_height:
    evaluateVisual,
  r7_measurement_confidence:
    evaluateVisual,

  /* Rule 8 */
  r8_display_area:
    evaluateVisual,
  r8_placement:
    evaluateVisual,
  r8_quantity_placement:
    evaluateVisual,
  r8_spacing:
    evaluateVisual,

  /* Rule 9 */
  r9_additional_language:
    evaluateVisual,
  r9_container_visibility:
    evaluateVisual,
  r9_contrast:
    evaluateVisual,
  r9_handwritten:
    evaluateVisual,
  r9_language:
    evaluateVisual,
  r9_legibility:
    evaluateVisual,
  r9_prominence:
    evaluateVisual,
  r9_wrapper:
    evaluateVisual,

  /* Rule 10 */
  r10_importer_address:
    evaluateDeclaration,
  r10_importer_name:
    evaluateDeclaration,
  r10_manufacturer_address:
    evaluateDeclaration,
  r10_manufacturer_name:
    evaluateDeclaration,
  r10_packer_address:
    evaluateDeclaration,
  r10_packer_name:
    evaluateDeclaration,
  r10_role_address_match:
    evaluateDeclaration,
  r10_special_address:
    evaluateDeclaration,

  /* Rule 11 */
  r11_commodity_specific:
    evaluateRule11,
  r11_consistency:
    evaluateRule11,
  r11_numeric:
    evaluateRule11,
  r11_representation:
    evaluateRule11,
  r11_unit_pairing:
    evaluateRule11,
  r11_when_packed:
    evaluateRule11,

  /* Rule 12 */
  r12_additional_representation:
    evaluateRule12,
  r12_quantity_type:
    evaluateRule12,

  /* Rule 13 */
  r13_prohibited_terms:
    evaluateRule13,
  r13_type_unit_consistency:
    evaluateRule13,
  r13_unit_symbol:
    evaluateRule13,
  r13_valid_unit:
    evaluateRule13,

  /* Rule 14 */
  r14_applicability:
    evaluateScheduleOrPresence,
  r14_format:
    evaluateScheduleOrPresence,
  r14_present:
    evaluateScheduleOrPresence,
  r14_value_unit:
    evaluateScheduleOrPresence,

  /* Rule 15 */
  r15_combined_declaration:
    evaluateScheduleOrPresence,

  /* Rule 16 */
  r16_sheet_count:
    evaluateScheduleOrPresence,
  r16_sheet_dimensions:
    evaluateScheduleOrPresence,

  /* Rule 17 */
  r17_capacity:
    evaluateScheduleOrPresence,
  r17_classification:
    evaluateScheduleOrPresence,
  r17_dimensions:
    evaluateScheduleOrPresence,

  /* Rule 18 */
  r18_displayed_price:
    evaluatePrice,
  r18_listing_package_consistency:
    evaluateScheduleOrPresence,
  r18_online_declarations:
    evaluateScheduleOrPresence,
  r18_price_above_mrp:
    evaluatePrice,

  /* Rule 19 */
  r19_physical_inspection:
    evaluatePhysical,

  /* Rule 22 */
  r22_mpe:
    evaluateMpe,

  /* Rule 23 */
  r23_deceptive:
    evaluateDeceptivePackaging,

  /* Rule 24 */
  r24_commodity:
    evaluatePresence,
  r24_identity:
    evaluatePresence,
  r24_quantity:
    evaluatePresence,
  r24_retail_exclusion:
    evaluatePresence,
  r24_retail_units:
    evaluatePresence,

  /* Rule 25 */
  r25_export:
    evaluatePresence,

  /* Rule 26 */
  r26_agricultural:
    evaluatePresence,
  r26_drugs:
    evaluatePresence,
  r26_fast_food:
    evaluatePresence,
  r26_other:
    evaluatePresence,
  r26_small_10:
    evaluatePresence,
  r26_small_20:
    evaluatePresence,

  /* Rules 27–30 */
  external_record:
    evaluateExternalRecord,

  /* Rule 31 */
  r31_font_relationship:
    evaluateVisual,
  r31_price_mentioned:
    evaluatePresence,
  r31_quantity_with_price:
    evaluatePresence,

  /*
   * Base records are inventory records for requirements already represented
   * by the existing engine.
   */
  base:
    evaluatePresence,
};

/* -------------------------------------------------------------------------- */
/* Public engine                                                               */
/* -------------------------------------------------------------------------- */

/**
 * Execute the atomic legal-check inventory.
 *
 * Important:
 * - The complete inventory remains in ATOMIC_CHECKS.
 * - Records covered by the existing/base engine are not emitted again.
 * - Missing evaluator implementations never silently disappear; they become
 *   REVIEW so the system cannot accidentally imply compliance.
 */
export function runAtomicEngine(
  data: ExtractedData,
): CheckResult[] {
  const ctx =
    createContext(data);

  return ATOMIC_CHECKS
    .filter(
      (check) =>
        !check.coveredByBaseCheck,
    )
    .map((check) => {
      const evaluator =
        EVALUATORS[
          check.evaluator
        ];

      if (!evaluator) {
        return reviewResult(
          ctx,
          check,
          `Evaluator "${check.evaluator}" is not implemented. Human review is required rather than assuming compliance.`,
        );
      }

      try {
        return evaluator(
          ctx,
          check,
        );
      } catch (error) {
        console.error(
          `[METRIQ] Atomic evaluator failed: ${check.checkId}`,
          error,
        );

        return reviewResult(
          ctx,
          check,
          "The automated evaluator could not safely determine this requirement. Human review is required.",
        );
      }
    });
}

/**
 * Development diagnostic.
 */
export function getAtomicEngineCoverage() {
  const evaluatorIds =
    new Set(
      ATOMIC_CHECKS.map(
        (check) =>
          check.evaluator,
      ),
    );

  const missingEvaluators =
    [...evaluatorIds].filter(
      (id) =>
        !EVALUATORS[id],
    );

  return {
    totalInventory:
      ATOMIC_CHECKS.length,

    duplicateInventoryRecords:
      ATOMIC_CHECKS.filter(
        (check) =>
          Boolean(
            check.coveredByBaseCheck,
          ),
      ).length,

    executableInventory:
      ATOMIC_CHECKS.filter(
        (check) =>
          !check.coveredByBaseCheck &&
          Boolean(
            EVALUATORS[
              check.evaluator
            ],
          ),
      ).length,

    missingEvaluators,
  };
}