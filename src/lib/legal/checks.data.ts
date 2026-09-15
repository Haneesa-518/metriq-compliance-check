/**
 * Atomic legal check records — the decomposed rule hierarchy.
 *
 * The existing `LEGAL_RULES` dataset holds one record per declaration field and
 * drives the original screening checks. This dataset sits alongside it and
 * decomposes the Legal Metrology (Packaged Commodities) Rules, 2011 into
 * individually addressable atomic checks with a stable identifier scheme:
 *
 *   LMPCR-2011-R<parent rule>-<sequence>
 *
 * Records whose requirement is already screened by the original engine carry
 * `coveredByBaseCheck` — they exist so the legal hierarchy and the inventory
 * are complete, but they never emit a second finding for the same requirement.
 *
 * No legislative wording is quoted. Every record is `needs_verification` until
 * a human reviewer confirms it against the official published Rules.
 */
import type { Severity } from "@/lib/compliance/types";

export type AutomationLevel =
  | "AUTOMATIC"
  | "SEMI_AUTOMATIC"
  | "HUMAN_REVIEW"
  | "EXTERNAL_RECORD_CHECK"
  | "PHYSICAL_INSPECTION";

export type ValidationType =
  | "APPLICABILITY"
  | "PACKAGE_CHECK"
  | "SCHEDULE_LOOKUP"
  | "VISUAL_MEASUREMENT"
  | "CROSS_SOURCE"
  | "EXEMPTION"
  | "DOCUMENT_CHECK"
  | "EXTERNAL_RECORD_CHECK"
  | "PHYSICAL_INSPECTION"
  | "HUMAN_REVIEW";

export interface AtomicCheck {
  checkId: string;
  parentRule: string;
  subRule: string;
  clause: string | null;
  title: string;
  requirement: string;
  applicability: string;
  requiredFields: string[];
  validationType: ValidationType;
  passCondition: string;
  failCondition: string;
  reviewCondition: string;
  notApplicableCondition: string;
  evidenceRequired: string;
  sourceDocument: string;
  sourceReference: string;
  status: "verified" | "needs_verification";
  automationLevel: AutomationLevel;
  /** what the source law itself says about ranking this requirement */
  legalSeverity: string;
  /** METRIQ operational inspection priority — not a legally mandated ranking */
  operationalPriority: Severity;
  category: "legal_metrology" | "food_labelling";
  /** identifier of the evaluator implementing this check */
  evaluator: string;
  /** set when the original engine already screens this requirement */
  coveredByBaseCheck?: string;
}

const DOC = "Legal Metrology (Packaged Commodities) Rules, 2011";
const LEGAL_SEVERITY_NOTE =
  "The source Rules do not rank violations by severity; the priority shown is a METRIQ operational inspection priority only.";

interface Opts extends Partial<AtomicCheck> {
  requirement: string;
  applicability: string;
  evaluator: string;
}

function c(
  checkId: string,
  parentRule: string,
  subRule: string,
  title: string,
  o: Opts,
): AtomicCheck {
  return {
    checkId,
    parentRule,
    subRule,
    clause: o.clause ?? null,
    title,
    requirement: o.requirement,
    applicability: o.applicability,
    requiredFields: o.requiredFields ?? [],
    validationType: o.validationType ?? "PACKAGE_CHECK",
    passCondition: o.passCondition ?? "Requirement satisfied by the submitted source.",
    failCondition:
      o.failCondition ?? "Requirement demonstrably not satisfied in the submitted source.",
    reviewCondition:
      o.reviewCondition ?? "Information partial, ambiguous or not measurable from the source.",
    notApplicableCondition: o.notApplicableCondition ?? "Provision does not apply to this package.",
    evidenceRequired: o.evidenceRequired ?? "Extracted text fragment from the submitted source.",
    sourceDocument: DOC,
    sourceReference: o.sourceReference ?? subRule,
    status: o.status ?? "needs_verification",
    automationLevel: o.automationLevel ?? "AUTOMATIC",
    legalSeverity: o.legalSeverity ?? LEGAL_SEVERITY_NOTE,
    operationalPriority: o.operationalPriority ?? "MEDIUM",
    category: o.category ?? "legal_metrology",
    evaluator: o.evaluator,
    ...(o.coveredByBaseCheck ? { coveredByBaseCheck: o.coveredByBaseCheck } : {}),
  };
}

export const ATOMIC_CHECKS: AtomicCheck[] = [
  /* ---------------- Rule 3 — applicability and scope ---------------- */
  c("LMPCR-2011-R3-001", "Rule 3", "Rule 3", "Pre-packaged commodity scope", {
    requirement: "The Rules apply to commodities pre-packed for retail sale.",
    applicability: "Every submitted package or listing.",
    validationType: "APPLICABILITY",
    evaluator: "r3_scope",
    operationalPriority: "HIGH",
  }),
  c("LMPCR-2011-R3-002", "Rule 3", "Rule 3(a)", "Package exceeding 25 kg", {
    requirement:
      "Packages of commodities exceeding 25 kg are outside the retail declaration scope, subject to the stated exception.",
    applicability: "Packages whose declared net quantity is a weight.",
    validationType: "APPLICABILITY",
    requiredFields: ["net_quantity"],
    evaluator: "r3_over_25kg",
  }),
  c("LMPCR-2011-R3-003", "Rule 3", "Rule 3(a)", "Package exceeding 25 litres", {
    requirement:
      "Packages of commodities exceeding 25 litres are outside the retail declaration scope.",
    applicability: "Packages whose declared net quantity is a volume.",
    validationType: "APPLICABILITY",
    requiredFields: ["net_quantity"],
    evaluator: "r3_over_25l",
  }),
  c("LMPCR-2011-R3-004", "Rule 3", "Rule 3(a) proviso", "Cement / fertilizer exception", {
    requirement:
      "Cement, fertilizer and similar specified commodities sold in bags above 25 kg remain within scope.",
    applicability: "Bagged cement, fertilizer and comparable specified commodities.",
    validationType: "APPLICABILITY",
    evaluator: "r3_cement_fertilizer",
  }),
  c("LMPCR-2011-R3-005", "Rule 3", "Rule 3(b)", "Industrial consumer package", {
    requirement:
      "Packaged commodities meant exclusively for industrial consumers are outside the retail declaration scope.",
    applicability: "Packages marked for industrial use only.",
    validationType: "APPLICABILITY",
    evaluator: "r3_industrial",
  }),
  c("LMPCR-2011-R3-006", "Rule 3", "Rule 3(b)", "Institutional consumer package", {
    requirement:
      "Packaged commodities meant exclusively for institutional consumers are outside the retail declaration scope.",
    applicability: "Packages marked for institutional use only.",
    validationType: "APPLICABILITY",
    evaluator: "r3_institutional",
  }),
  c("LMPCR-2011-R3-007", "Rule 3", "Rule 2(k)", "Retail package classification", {
    requirement:
      "A retail package is intended for sale to the ultimate consumer and attracts the full retail declarations.",
    applicability: "Every submitted package.",
    validationType: "APPLICABILITY",
    evaluator: "r3_retail",
    operationalPriority: "HIGH",
  }),
  c("LMPCR-2011-R3-008", "Rule 3", "Rule 2(x)", "Wholesale package classification", {
    requirement:
      "A wholesale package attracts the wholesale declarations of Rule 24, not the full retail set.",
    applicability: "Every submitted package.",
    validationType: "APPLICABILITY",
    evaluator: "r3_wholesale",
  }),
  c("LMPCR-2011-R3-009", "Rule 3", "Rule 25", "Export package classification", {
    requirement:
      "Packages meant for export are treated under Rule 25 rather than the domestic retail declarations.",
    applicability: "Every submitted package.",
    validationType: "APPLICABILITY",
    evaluator: "r3_export",
  }),
  c("LMPCR-2011-R3-010", "Rule 3", "Rule 26", "Exemption screening", {
    requirement: "Specified packages and commodities are exempt from some or all declarations.",
    applicability: "Every submitted package.",
    validationType: "EXEMPTION",
    evaluator: "r3_exemption_gate",
    operationalPriority: "HIGH",
  }),

  /* ---------------- Rule 5 — standard package sizes ---------------- */
  c("LMPCR-2011-R5-001", "Rule 5", "Rule 5", "Standard package size (Second Schedule)", {
    requirement:
      "Specified commodities may only be packed in the quantities set out in the Second Schedule.",
    applicability: "Commodities listed in the Second Schedule.",
    validationType: "SCHEDULE_LOOKUP",
    requiredFields: ["product_name", "net_quantity"],
    sourceReference: "Rule 5 read with the Second Schedule",
    evaluator: "r5_standard_pack",
    operationalPriority: "HIGH",
    notApplicableCondition: "Commodity is not listed in the Second Schedule.",
  }),
  c("LMPCR-2011-R5-002", "Rule 5", "Rule 5", "Commodity identification for standard size", {
    requirement:
      "The commodity must be identifiable well enough to select the applicable standard-size provision.",
    applicability: "Commodities potentially covered by the Second Schedule.",
    validationType: "SCHEDULE_LOOKUP",
    requiredFields: ["product_name"],
    evaluator: "r5_commodity_identified",
    automationLevel: "SEMI_AUTOMATIC",
  }),

  /* ---------------- Rule 6 — declarations ---------------- */
  c("LMPCR-2011-R6-001", "Rule 6", "Rule 6(1)(a)", "Manufacturer identity declaration", {
    requirement: "Name and complete address of the manufacturer must be declared.",
    applicability: "Retail packages manufactured in India.",
    requiredFields: ["manufacturer"],
    evaluator: "base",
    coveredByBaseCheck: "manufacturer",
    operationalPriority: "HIGH",
  }),
  c("LMPCR-2011-R6-002", "Rule 6", "Rule 6(1)(a)", "Packer identity declaration", {
    requirement:
      "Where the packer differs from the manufacturer, the packer's identity must be declared.",
    applicability: "Packages packed by an entity other than the manufacturer.",
    requiredFields: ["packer", "manufacturer"],
    evaluator: "r6_packer",
  }),
  c("LMPCR-2011-R6-003", "Rule 6", "Rule 6(1)(a)", "Importer identity declaration", {
    requirement: "Imported packages must declare the importer's name and address.",
    applicability: "Packages classified as imported.",
    requiredFields: ["importer"],
    evaluator: "base",
    coveredByBaseCheck: "importer",
  }),
  c("LMPCR-2011-R6-004", "Rule 6", "Rule 6(1)(b)", "Common or generic commodity name", {
    requirement: "The common or generic name of the commodity must be declared.",
    applicability: "All retail packages.",
    requiredFields: ["product_name"],
    evaluator: "base",
    coveredByBaseCheck: "product_name",
  }),
  c("LMPCR-2011-R6-005", "Rule 6", "Rule 6(1)(c)", "Net quantity declaration", {
    requirement: "Net quantity must be declared in the prescribed unit.",
    applicability: "All retail packages.",
    requiredFields: ["net_quantity"],
    evaluator: "base",
    coveredByBaseCheck: "net_quantity",
    operationalPriority: "CRITICAL",
  }),
  c("LMPCR-2011-R6-006", "Rule 6", "Rule 6(1)(d)", "Month and year declaration", {
    requirement: "Month and year of manufacture, packing or import must be declared.",
    applicability: "All retail packages.",
    requiredFields: ["date_of_manufacture"],
    evaluator: "base",
    coveredByBaseCheck: "date_of_manufacture",
  }),
  c("LMPCR-2011-R6-007", "Rule 6", "Rule 6(1)(e)", "Retail sale price declaration", {
    requirement: "The retail sale price must be declared as a maximum, inclusive of all taxes.",
    applicability: "All retail packages.",
    requiredFields: ["mrp"],
    evaluator: "base",
    coveredByBaseCheck: "mrp",
    operationalPriority: "CRITICAL",
  }),
  c("LMPCR-2011-R6-008", "Rule 6", "Rule 6(1)(f)", "Dimension declaration where applicable", {
    requirement:
      "Where the commodity's dimensions are relevant to the consumer, they must be declared.",
    applicability: "Commodities whose sale depends on dimensions.",
    requiredFields: ["product_name"],
    evaluator: "r6_dimensions",
    notApplicableCondition: "Commodity is not one whose dimensions must be declared.",
  }),
  c("LMPCR-2011-R6-009", "Rule 6", "Rule 6(1)(g)", "Consumer complaint information", {
    requirement: "Details for lodging consumer complaints must be declared.",
    applicability: "All retail packages.",
    requiredFields: ["consumer_care"],
    evaluator: "base",
    coveredByBaseCheck: "consumer_care",
  }),
  c("LMPCR-2011-R6-010", "Rule 6", "Rule 6(2)", "Telephone contact for complaints", {
    requirement: "Consumer complaint details must include a telephone number where required.",
    applicability: "All retail packages carrying consumer care details.",
    requiredFields: ["consumer_care"],
    evaluator: "r6_phone",
  }),
  c("LMPCR-2011-R6-011", "Rule 6", "Rule 6(2)", "Email or electronic contact", {
    requirement: "An email address or other electronic contact must be given where required.",
    applicability: "All retail packages carrying consumer care details.",
    requiredFields: ["consumer_care"],
    evaluator: "r6_email",
    operationalPriority: "LOW",
  }),
  c("LMPCR-2011-R6-012", "Rule 6", "Rule 6(1)", "Imported-package declarations", {
    requirement:
      "Imported packages must carry the importer identity and the country of origin together.",
    applicability: "Packages classified as imported.",
    requiredFields: ["importer", "country_of_origin"],
    evaluator: "r6_imported_declarations",
    notApplicableCondition: "Package is not classified as imported.",
  }),
  c("LMPCR-2011-R6-013", "Rule 6", "Rule 6(1)", "Country of origin declaration", {
    requirement: "Country of origin must be declared for imported packages.",
    applicability: "Packages classified as imported.",
    requiredFields: ["country_of_origin"],
    evaluator: "base",
    coveredByBaseCheck: "country_of_origin",
  }),
  c("LMPCR-2011-R6-014", "Rule 6", "Rule 6(5)", "Multi-component package declarations", {
    requirement:
      "A package containing separately packed components must declare the number and quantity of each component.",
    applicability: "Packages presented as combination, multipack or gift packs.",
    requiredFields: ["net_quantity", "product_name"],
    evaluator: "r6_multicomponent",
    notApplicableCondition: "Package is not a multi-component package.",
  }),
  c("LMPCR-2011-R6-015", "Rule 6", "Rule 6(3)", "Sticker / revised retail sale price", {
    requirement:
      "A revised price sticker may only be used in the manner permitted, and must not cover the original declaration.",
    applicability: "Packages showing a revised or stickered price.",
    requiredFields: ["mrp"],
    evaluator: "r6_sticker_mrp",
    automationLevel: "SEMI_AUTOMATIC",
    notApplicableCondition: "No revised or stickered price detected.",
  }),

  /* ---------------- Rule 7 — principal display panel ---------------- */
  c("LMPCR-2011-R7-001", "Rule 7", "Rule 7", "Principal display panel identified", {
    requirement:
      "The principal display panel must be identifiable for the declarations to be assessed.",
    applicability: "Image-based screening of a physical package.",
    validationType: "VISUAL_MEASUREMENT",
    evidenceRequired: "Original and processed package image.",
    evaluator: "r7_pdp_identified",
    automationLevel: "SEMI_AUTOMATIC",
  }),
  c("LMPCR-2011-R7-002", "Rule 7", "Rule 7", "Required declarations on the display panel", {
    requirement: "The mandatory declarations must appear on the principal display panel.",
    applicability: "Image-based screening of a physical package.",
    validationType: "VISUAL_MEASUREMENT",
    evaluator: "r7_declarations_on_pdp",
    automationLevel: "SEMI_AUTOMATIC",
  }),
  c("LMPCR-2011-R7-003", "Rule 7", "Rule 7", "Minimum letter height", {
    requirement: "Declarations must meet the prescribed minimum height of letters.",
    applicability: "Image-based screening where character geometry can be measured.",
    validationType: "VISUAL_MEASUREMENT",
    evaluator: "r7_letter_height",
    automationLevel: "SEMI_AUTOMATIC",
  }),
  c("LMPCR-2011-R7-004", "Rule 7", "Rule 7", "Minimum numeral height for quantity", {
    requirement:
      "The net quantity numerals must meet the prescribed minimum height for the package category.",
    applicability: "Image-based screening where numeral geometry can be measured.",
    validationType: "VISUAL_MEASUREMENT",
    requiredFields: ["net_quantity"],
    evaluator: "r7_numeral_height",
    automationLevel: "SEMI_AUTOMATIC",
    operationalPriority: "HIGH",
  }),
  c("LMPCR-2011-R7-005", "Rule 7", "Rule 7", "Physical measurement confidence", {
    requirement:
      "A height or size conclusion may only be drawn where image resolution and perspective allow reliable measurement.",
    applicability: "Image-based screening.",
    validationType: "VISUAL_MEASUREMENT",
    evaluator: "r7_measurement_confidence",
    automationLevel: "SEMI_AUTOMATIC",
  }),

  /* ---------------- Rule 8 — location and spacing ---------------- */
  c("LMPCR-2011-R8-001", "Rule 8", "Rule 8", "Declaration placement", {
    requirement: "Declarations must be placed as prescribed on the package.",
    applicability: "Image-based screening of a physical package.",
    validationType: "VISUAL_MEASUREMENT",
    evaluator: "r8_placement",
    automationLevel: "SEMI_AUTOMATIC",
  }),
  c("LMPCR-2011-R8-002", "Rule 8", "Rule 8", "Net quantity placement", {
    requirement: "The net quantity declaration must appear in the prescribed position.",
    applicability: "Image-based screening of a physical package.",
    validationType: "VISUAL_MEASUREMENT",
    requiredFields: ["net_quantity"],
    evaluator: "r8_quantity_placement",
    automationLevel: "SEMI_AUTOMATIC",
  }),
  c("LMPCR-2011-R8-003", "Rule 8", "Rule 8", "Spacing around the quantity declaration", {
    requirement: "The prescribed clear space must surround the net quantity declaration.",
    applicability: "Image-based screening of a physical package.",
    validationType: "VISUAL_MEASUREMENT",
    evaluator: "r8_spacing",
    automationLevel: "SEMI_AUTOMATIC",
  }),
  c("LMPCR-2011-R8-004", "Rule 8", "Rule 8", "Principal display area conditions", {
    requirement: "The area of the principal display panel governs the applicable size conditions.",
    applicability: "Image-based screening of a physical package.",
    validationType: "VISUAL_MEASUREMENT",
    evaluator: "r8_display_area",
    automationLevel: "SEMI_AUTOMATIC",
  }),

  /* ---------------- Rule 9 — manner of declarations ---------------- */
  c("LMPCR-2011-R9-001", "Rule 9", "Rule 9(1)", "Legibility of declarations", {
    requirement: "Declarations must be legible.",
    applicability: "Image-based screening of a physical package.",
    validationType: "VISUAL_MEASUREMENT",
    evaluator: "r9_legibility",
    automationLevel: "SEMI_AUTOMATIC",
  }),
  c("LMPCR-2011-R9-002", "Rule 9", "Rule 9(1)", "Prominence of declarations", {
    requirement: "Declarations must be conspicuous and prominent.",
    applicability: "Image-based screening of a physical package.",
    validationType: "VISUAL_MEASUREMENT",
    evaluator: "r9_prominence",
    automationLevel: "SEMI_AUTOMATIC",
  }),
  c("LMPCR-2011-R9-003", "Rule 9", "Rule 9(1)", "Contrast against background", {
    requirement: "Declarations must contrast with the background of the label.",
    applicability: "Image-based screening of a physical package.",
    validationType: "VISUAL_MEASUREMENT",
    evaluator: "r9_contrast",
    automationLevel: "SEMI_AUTOMATIC",
  }),
  c("LMPCR-2011-R9-004", "Rule 9", "Rule 9(2)", "Visibility despite wrappers or coverings", {
    requirement: "Declarations must remain visible through any outer wrapper or covering.",
    applicability: "Packages with an outer wrapper or covering.",
    validationType: "VISUAL_MEASUREMENT",
    evaluator: "r9_wrapper",
    automationLevel: "HUMAN_REVIEW",
  }),
  c("LMPCR-2011-R9-005", "Rule 9", "Rule 9(2)", "Container and liquid declaration visibility", {
    requirement: "Declarations on containers holding liquids must remain visible.",
    applicability: "Liquid commodities in containers.",
    validationType: "VISUAL_MEASUREMENT",
    evaluator: "r9_container_visibility",
    automationLevel: "HUMAN_REVIEW",
    notApplicableCondition: "Commodity is not a liquid in a container.",
  }),
  c("LMPCR-2011-R9-006", "Rule 9", "Rule 9(4)", "Required language of declarations", {
    requirement: "Declarations must be made in the prescribed language.",
    applicability: "All retail packages.",
    evaluator: "r9_language",
    automationLevel: "SEMI_AUTOMATIC",
  }),
  c("LMPCR-2011-R9-007", "Rule 9", "Rule 9(4)", "Additional languages permitted", {
    requirement: "Additional languages are permitted and are not by themselves a contravention.",
    applicability: "Packages carrying more than one language.",
    evaluator: "r9_additional_language",
    operationalPriority: "LOW",
  }),
  c("LMPCR-2011-R9-008", "Rule 9", "Rule 9(3)", "Handwritten declarations", {
    requirement:
      "Declarations must be printed as prescribed rather than handwritten, except where permitted.",
    applicability: "Image-based screening of a physical package.",
    validationType: "VISUAL_MEASUREMENT",
    evaluator: "r9_handwritten",
    automationLevel: "HUMAN_REVIEW",
  }),

  /* ---------------- Rule 10 — name and address ---------------- */
  c("LMPCR-2011-R10-001", "Rule 10", "Rule 10", "Manufacturer name completeness", {
    requirement: "The manufacturer's name must be complete, not abbreviated beyond recognition.",
    applicability: "Packages declaring a manufacturer.",
    requiredFields: ["manufacturer"],
    evaluator: "r10_manufacturer_name",
  }),
  c("LMPCR-2011-R10-002", "Rule 10", "Rule 10", "Manufacturer address completeness", {
    requirement: "The manufacturer's complete address must be declared.",
    applicability: "Packages declaring a manufacturer.",
    requiredFields: ["manufacturer", "address"],
    evaluator: "r10_manufacturer_address",
    operationalPriority: "HIGH",
  }),
  c("LMPCR-2011-R10-003", "Rule 10", "Rule 10", "Packer name completeness", {
    requirement: "The packer's name must be complete where a packer is declared.",
    applicability: "Packages declaring a packer.",
    requiredFields: ["packer"],
    evaluator: "r10_packer_name",
    notApplicableCondition: "No packer declared on the package.",
  }),
  c("LMPCR-2011-R10-004", "Rule 10", "Rule 10", "Packer address completeness", {
    requirement: "The packer's complete address must be declared where a packer is declared.",
    applicability: "Packages declaring a packer.",
    requiredFields: ["packer", "address"],
    evaluator: "r10_packer_address",
    notApplicableCondition: "No packer declared on the package.",
  }),
  c("LMPCR-2011-R10-005", "Rule 10", "Rule 10", "Importer name completeness", {
    requirement: "The importer's name must be complete where the package is imported.",
    applicability: "Imported packages.",
    requiredFields: ["importer"],
    evaluator: "r10_importer_name",
    notApplicableCondition: "Package is not classified as imported.",
  }),
  c("LMPCR-2011-R10-006", "Rule 10", "Rule 10", "Importer address completeness", {
    requirement: "The importer's complete address must be declared where the package is imported.",
    applicability: "Imported packages.",
    requiredFields: ["importer", "address"],
    evaluator: "r10_importer_address",
    notApplicableCondition: "Package is not classified as imported.",
  }),
  c("LMPCR-2011-R10-007", "Rule 10", "Rule 10", "Role-to-address matching", {
    requirement: "Each declared address must be attributable to the declared role it belongs to.",
    applicability: "Packages declaring at least one entity and an address.",
    requiredFields: ["manufacturer", "packer", "importer", "address"],
    evaluator: "r10_role_address_match",
    automationLevel: "SEMI_AUTOMATIC",
  }),
  c("LMPCR-2011-R10-008", "Rule 10", "Rule 10 proviso", "Special address cases", {
    requirement:
      "Marketing-only, brand-owner and multi-unit declarations must be identified as such rather than treated as the manufacturer.",
    applicability: "Packages whose only entity declaration is a marketing or distribution role.",
    requiredFields: ["manufacturer"],
    evaluator: "r10_special_address",
    automationLevel: "SEMI_AUTOMATIC",
  }),

  /* ---------------- Rule 11 — quantity declaration ---------------- */
  c("LMPCR-2011-R11-001", "Rule 11", "Rule 11", "Numeric quantity value", {
    requirement: "The net quantity must be expressed as a numeric value.",
    applicability: "Packages declaring a net quantity.",
    requiredFields: ["net_quantity"],
    evaluator: "r11_numeric",
    operationalPriority: "HIGH",
  }),
  c("LMPCR-2011-R11-002", "Rule 11", "Rule 11", "Quantity and unit pairing", {
    requirement: "The numeric quantity must be accompanied by a permitted unit.",
    applicability: "Packages declaring a net quantity.",
    requiredFields: ["net_quantity"],
    evaluator: "r11_unit_pairing",
    operationalPriority: "HIGH",
  }),
  c("LMPCR-2011-R11-003", "Rule 11", "Rule 11", "Quantity representation format", {
    requirement:
      "The quantity must be represented in the prescribed form, without misleading qualifiers.",
    applicability: "Packages declaring a net quantity.",
    requiredFields: ["net_quantity"],
    evaluator: "r11_representation",
  }),
  c(
    "LMPCR-2011-R11-004",
    "Rule 11",
    "Rule 11 read with the Third Schedule",
    '"When packed" condition',
    {
      requirement:
        "Commodities covered by the Third Schedule must declare quantity on the prescribed basis.",
      applicability: "Commodities listed in the Third Schedule.",
      validationType: "SCHEDULE_LOOKUP",
      requiredFields: ["product_name", "net_quantity"],
      evaluator: "r11_when_packed",
      notApplicableCondition: "Commodity is not listed in the Third Schedule.",
    },
  ),
  c("LMPCR-2011-R11-005", "Rule 11", "Rule 11", "Commodity-specific quantity requirement", {
    requirement:
      "Additional quantity information required for the specific commodity must be declared.",
    applicability: "Commodities with an additional Fourth Schedule requirement.",
    validationType: "SCHEDULE_LOOKUP",
    requiredFields: ["product_name", "net_quantity"],
    evaluator: "r11_commodity_specific",
    notApplicableCondition: "No additional commodity-specific requirement applies.",
  }),
  c("LMPCR-2011-R11-006", "Rule 11", "Rule 11", "Quantity declaration consistency", {
    requirement: "All quantity declarations in the submitted source must agree.",
    applicability: "Sources containing more than one quantity statement.",
    validationType: "CROSS_SOURCE",
    requiredFields: ["net_quantity"],
    evaluator: "r11_consistency",
  }),

  /* ---------------- Rule 12 — quantity type ---------------- */
  c(
    "LMPCR-2011-R12-001",
    "Rule 12",
    "Rule 12 read with the Fourth Schedule",
    "Correct quantity type for the commodity",
    {
      requirement: "The commodity must be declared by the quantity type prescribed for it.",
      applicability: "Commodities listed in the Fourth Schedule.",
      validationType: "SCHEDULE_LOOKUP",
      requiredFields: ["product_name", "net_quantity"],
      evaluator: "r12_quantity_type",
      operationalPriority: "HIGH",
      notApplicableCondition: "Commodity is not listed in the Fourth Schedule.",
    },
  ),
  c("LMPCR-2011-R12-002", "Rule 12", "Rule 12", "Additional quantity representation", {
    requirement:
      "Where an additional representation is required for the commodity, it must also be declared.",
    applicability: "Commodities with an additional Fourth Schedule requirement.",
    validationType: "SCHEDULE_LOOKUP",
    requiredFields: ["net_quantity"],
    evaluator: "r12_additional_representation",
    notApplicableCondition: "No additional representation is required.",
  }),

  /* ---------------- Rule 13 — units and SI representation ---------------- */
  c("LMPCR-2011-R13-001", "Rule 13", "Rule 13", "Permitted unit of measurement", {
    requirement: "Quantities must use units permitted under the legal metrology framework.",
    applicability: "Packages declaring a net quantity.",
    requiredFields: ["net_quantity"],
    evaluator: "r13_valid_unit",
    operationalPriority: "HIGH",
  }),
  c("LMPCR-2011-R13-002", "Rule 13", "Rule 13", "Correct unit symbol", {
    requirement: "Unit symbols must be written in the prescribed form.",
    applicability: "Packages declaring a net quantity.",
    requiredFields: ["net_quantity"],
    evaluator: "r13_unit_symbol",
  }),
  c("LMPCR-2011-R13-003", "Rule 13", "Rule 13", "Quantity type and unit consistency", {
    requirement: "The unit used must match the quantity type prescribed for the commodity.",
    applicability: "Commodities listed in the Fourth Schedule.",
    validationType: "SCHEDULE_LOOKUP",
    requiredFields: ["net_quantity", "product_name"],
    evaluator: "r13_type_unit_consistency",
    notApplicableCondition: "Commodity is not listed in the Fourth Schedule.",
  }),
  c("LMPCR-2011-R13-004", "Rule 13", "Rule 13", "Prohibited quantity terminology", {
    requirement: "Non-standard counting expressions must not be used to declare quantity.",
    applicability: "All retail packages.",
    requiredFields: ["net_quantity"],
    evaluator: "r13_prohibited_terms",
    operationalPriority: "HIGH",
  }),

  /* ---------------- Rule 14 — dimensions ---------------- */
  c("LMPCR-2011-R14-001", "Rule 14", "Rule 14", "Dimension declaration applicability", {
    requirement: "Dimensions must be declared only for commodities for which they are prescribed.",
    applicability: "Commodities sold by or described by dimension.",
    validationType: "APPLICABILITY",
    requiredFields: ["product_name"],
    evaluator: "r14_applicability",
    notApplicableCondition: "Commodity does not require a dimension declaration.",
  }),
  c("LMPCR-2011-R14-002", "Rule 14", "Rule 14", "Dimension declaration present", {
    requirement: "The prescribed dimension declaration must appear on the package.",
    applicability: "Commodities requiring a dimension declaration.",
    requiredFields: ["product_name"],
    evaluator: "r14_present",
    notApplicableCondition: "Commodity does not require a dimension declaration.",
  }),
  c("LMPCR-2011-R14-003", "Rule 14", "Rule 14", "Dimension value and unit", {
    requirement: "Dimension values must be numeric and expressed in a permitted unit.",
    applicability: "Packages declaring dimensions.",
    evaluator: "r14_value_unit",
    notApplicableCondition: "No dimension declaration detected.",
  }),
  c("LMPCR-2011-R14-004", "Rule 14", "Rule 14", "Dimension declaration format", {
    requirement: "Dimensions must be declared in the prescribed order and format.",
    applicability: "Packages declaring dimensions.",
    evaluator: "r14_format",
    notApplicableCondition: "No dimension declaration detected.",
    operationalPriority: "LOW",
  }),

  /* ---------------- Rule 15 — quantity with dimension or weight ---------------- */
  c("LMPCR-2011-R15-001", "Rule 15", "Rule 15", "Quantity accompanied by required measurement", {
    requirement:
      "For specified commodities the quantity must be accompanied by dimensions or weight.",
    applicability: "Commodities for which a combined declaration is prescribed.",
    validationType: "SCHEDULE_LOOKUP",
    requiredFields: ["product_name", "net_quantity"],
    evaluator: "r15_combined_declaration",
    notApplicableCondition: "Commodity does not require a combined declaration.",
  }),

  /* ---------------- Rule 16 — usable sheets ---------------- */
  c("LMPCR-2011-R16-001", "Rule 16", "Rule 16", "Number of usable sheets", {
    requirement: "Sheet commodities must declare the number of sheets.",
    applicability: "Sheet commodities.",
    requiredFields: ["product_name", "net_quantity"],
    evaluator: "r16_sheet_count",
    notApplicableCondition: "Commodity is not a sheet commodity.",
  }),
  c("LMPCR-2011-R16-002", "Rule 16", "Rule 16", "Sheet dimensions and unit", {
    requirement: "Sheet commodities must declare the dimensions of each sheet in a permitted unit.",
    applicability: "Sheet commodities.",
    requiredFields: ["product_name"],
    evaluator: "r16_sheet_dimensions",
    notApplicableCondition: "Commodity is not a sheet commodity.",
  }),

  /* ---------------- Rule 17 — containers ---------------- */
  c("LMPCR-2011-R17-001", "Rule 17", "Rule 17", "Container classification", {
    requirement:
      "Container-type commodities must be classified to select the applicable declarations.",
    applicability: "Bags, boxes and comparable containers sold as commodities.",
    requiredFields: ["product_name"],
    evaluator: "r17_classification",
    notApplicableCondition: "Commodity is not a container-type commodity.",
  }),
  c("LMPCR-2011-R17-002", "Rule 17", "Rule 17", "Container dimension declaration", {
    requirement: "Rectangular and circular containers must declare the prescribed dimensions.",
    applicability: "Container-type commodities.",
    validationType: "VISUAL_MEASUREMENT",
    evaluator: "r17_dimensions",
    automationLevel: "SEMI_AUTOMATIC",
    notApplicableCondition: "Commodity is not a container-type commodity.",
  }),
  c("LMPCR-2011-R17-003", "Rule 17", "Rule 17", "Container capacity declaration", {
    requirement: "Container-type commodities must declare capacity or quantity as prescribed.",
    applicability: "Container-type commodities.",
    requiredFields: ["net_quantity"],
    evaluator: "r17_capacity",
    notApplicableCondition: "Commodity is not a container-type commodity.",
  }),

  /* ---------------- Rule 18 — dealer / e-commerce price ---------------- */
  c("LMPCR-2011-R18-001", "Rule 18", "Rule 18", "Displayed selling price present", {
    requirement: "Where a selling price is displayed it must be identifiable for comparison.",
    applicability: "E-commerce listings and dealer displays.",
    validationType: "CROSS_SOURCE",
    requiredFields: ["mrp"],
    evaluator: "r18_displayed_price",
    notApplicableCondition: "Submitted source is not a listing or dealer display.",
  }),
  c("LMPCR-2011-R18-002", "Rule 18", "Rule 18", "Displayed price not above retail sale price", {
    requirement:
      "The price at which the commodity is offered must not exceed the declared retail sale price.",
    applicability:
      "Listings or displays showing both a selling price and the declared retail sale price.",
    validationType: "CROSS_SOURCE",
    requiredFields: ["mrp"],
    evaluator: "r18_price_above_mrp",
    operationalPriority: "CRITICAL",
    notApplicableCondition: "Only one price is available, so no comparison is possible.",
  }),
  c("LMPCR-2011-R18-003", "Rule 18", "Rule 6(10)", "Required online declarations", {
    requirement:
      "An e-commerce listing must display the prescribed subset of package declarations.",
    applicability: "E-commerce listings.",
    validationType: "CROSS_SOURCE",
    evaluator: "r18_online_declarations",
    notApplicableCondition: "Submitted source is not an e-commerce listing.",
    operationalPriority: "HIGH",
  }),
  c("LMPCR-2011-R18-004", "Rule 18", "Rule 18", "Listing and package declaration consistency", {
    requirement: "Declarations shown online must match those on the physical package.",
    applicability: "E-commerce listings where package information is also available.",
    validationType: "CROSS_SOURCE",
    evaluator: "r18_listing_package_consistency",
    automationLevel: "SEMI_AUTOMATIC",
    notApplicableCondition: "Submitted source is not an e-commerce listing.",
  }),

  /* ---------------- Rule 19 / 22 — physical quantity verification ---------------- */
  c("LMPCR-2011-R19-001", "Rule 19", "Rule 19", "Physical quantity verification", {
    requirement:
      "Actual net quantity must be determined by measurement against the declared quantity.",
    applicability: "Physical inspection mode only.",
    validationType: "PHYSICAL_INSPECTION",
    evidenceRequired:
      "Measured quantity, tare, sample size and lot size recorded by the inspector.",
    evaluator: "r19_physical_inspection",
    automationLevel: "PHYSICAL_INSPECTION",
    notApplicableCondition: "No physical inspection data was supplied with this analysis.",
    operationalPriority: "HIGH",
  }),
  c(
    "LMPCR-2011-R22-001",
    "Rule 22",
    "Rule 22 read with the First Schedule",
    "Maximum permissible error",
    {
      requirement:
        "Any deficiency in net quantity must not exceed the maximum permissible error for the declared quantity.",
      applicability: "Physical inspection mode only; cannot be determined from a label image.",
      validationType: "PHYSICAL_INSPECTION",
      requiredFields: ["net_quantity"],
      evidenceRequired: "Declared quantity and measured quantity.",
      evaluator: "r22_mpe",
      automationLevel: "PHYSICAL_INSPECTION",
      operationalPriority: "HIGH",
    },
  ),

  /* ---------------- Rule 23 — deceptive packaging ---------------- */
  c("LMPCR-2011-R23-001", "Rule 23", "Rule 23", "Potential deceptive packaging", {
    requirement:
      "A package must not be designed to mislead as to the quantity of the commodity it contains.",
    applicability: "Image-based screening of a physical package.",
    validationType: "HUMAN_REVIEW",
    evaluator: "r23_deceptive",
    automationLevel: "HUMAN_REVIEW",
    failCondition:
      "Never determined automatically — this check can only return REVIEW or NOT APPLICABLE.",
  }),

  /* ---------------- Rule 24 — wholesale packages ---------------- */
  c("LMPCR-2011-R24-001", "Rule 24", "Rule 24", "Wholesale commodity identification", {
    requirement: "A wholesale package must identify the commodity it contains.",
    applicability: "Wholesale packages.",
    requiredFields: ["product_name"],
    evaluator: "r24_commodity",
    notApplicableCondition: "Package is not classified as a wholesale package.",
  }),
  c("LMPCR-2011-R24-002", "Rule 24", "Rule 24", "Wholesale quantity declaration", {
    requirement: "A wholesale package must declare the total quantity it contains.",
    applicability: "Wholesale packages.",
    requiredFields: ["net_quantity"],
    evaluator: "r24_quantity",
    notApplicableCondition: "Package is not classified as a wholesale package.",
  }),
  c(
    "LMPCR-2011-R24-003",
    "Rule 24",
    "Rule 24",
    "Wholesale manufacturer / packer / importer identity",
    {
      requirement:
        "A wholesale package must declare the identity of the manufacturer, packer or importer.",
      applicability: "Wholesale packages.",
      requiredFields: ["manufacturer", "packer", "importer"],
      evaluator: "r24_identity",
      notApplicableCondition: "Package is not classified as a wholesale package.",
    },
  ),
  c("LMPCR-2011-R24-004", "Rule 24", "Rule 24", "Number of retail units in the wholesale package", {
    requirement: "A wholesale package must declare the number of retail packages it contains.",
    applicability: "Wholesale packages containing retail packages.",
    evaluator: "r24_retail_units",
    notApplicableCondition: "Package is not classified as a wholesale package.",
  }),
  c(
    "LMPCR-2011-R24-005",
    "Rule 24",
    "Rule 24",
    "Retail declarations not forced on wholesale packages",
    {
      requirement: "Retail-only declarations must not be required of a wholesale package.",
      applicability: "Wholesale packages.",
      validationType: "APPLICABILITY",
      evaluator: "r24_retail_exclusion",
      notApplicableCondition: "Package is not classified as a wholesale package.",
      operationalPriority: "LOW",
    },
  ),

  /* ---------------- Rule 25 — export packages ---------------- */
  c("LMPCR-2011-R25-001", "Rule 25", "Rule 25", "Export package treatment", {
    requirement:
      "Packages meant for export are exempt from the domestic retail declarations to the extent prescribed.",
    applicability: "Packages marked for export.",
    validationType: "APPLICABILITY",
    evaluator: "r25_export",
    notApplicableCondition: "Package is not marked for export.",
  }),

  /* ---------------- Rule 26 — exemptions ---------------- */
  c("LMPCR-2011-R26-001", "Rule 26", "Rule 26(a)", "Package up to 10 g or 10 ml", {
    requirement:
      "Packages containing a commodity of 10 g or 10 ml or less are exempt from specified declarations.",
    applicability: "Very small packages, other than tobacco products.",
    validationType: "EXEMPTION",
    requiredFields: ["net_quantity"],
    evaluator: "r26_small_10",
    notApplicableCondition: "Declared quantity exceeds the exemption threshold.",
  }),
  c(
    "LMPCR-2011-R26-002",
    "Rule 26",
    "Rule 26",
    "Package above 10 g / 10 ml and up to 20 g / 20 ml",
    {
      requirement:
        "Packages in the 10–20 g or 10–20 ml band attract reduced declaration requirements as prescribed.",
      applicability: "Small packages within the stated band.",
      validationType: "EXEMPTION",
      requiredFields: ["net_quantity"],
      evaluator: "r26_small_20",
      notApplicableCondition: "Declared quantity is outside the band.",
    },
  ),
  c("LMPCR-2011-R26-003", "Rule 26", "Rule 26", "Fast-food package exemption", {
    requirement:
      "Fast food items packed by a restaurant or hotel are exempt from the specified declarations.",
    applicability: "Fast food packed by a restaurant or hotel.",
    validationType: "EXEMPTION",
    evaluator: "r26_fast_food",
    notApplicableCondition: "Package is not a restaurant or hotel fast-food package.",
  }),
  c("LMPCR-2011-R26-004", "Rule 26", "Rule 26", "Drug package exemption", {
    requirement: "Packaged drugs covered by the drugs law are exempt to the extent prescribed.",
    applicability: "Packaged drugs and formulations.",
    validationType: "EXEMPTION",
    evaluator: "r26_drugs",
    notApplicableCondition: "Package is not a drug package.",
  }),
  c("LMPCR-2011-R26-005", "Rule 26", "Rule 26", "Agricultural produce exemption", {
    requirement:
      "Specified agricultural farm produce packages are exempt to the extent prescribed.",
    applicability: "Agricultural farm produce packages above the prescribed size.",
    validationType: "EXEMPTION",
    evaluator: "r26_agricultural",
    notApplicableCondition: "Package is not agricultural farm produce.",
  }),
  c("LMPCR-2011-R26-006", "Rule 26", "Rule 26", "Other specifically exempted commodities", {
    requirement:
      "Other commodities and categories specifically exempted are excluded from the stated declarations only.",
    applicability: "Commodities named in the exemption provision.",
    validationType: "EXEMPTION",
    evaluator: "r26_other",
    notApplicableCondition: "Commodity is not within a listed exemption.",
    operationalPriority: "LOW",
  }),

  /* ---------------- Rules 27–30 — administrative requirements ---------------- */
  c(
    "LMPCR-2011-R27-001",
    "Rule 27",
    "Rule 27",
    "Registration of manufacturer, packer or importer",
    {
      requirement:
        "Manufacturers, packers and importers must be registered with the appropriate authority.",
      applicability: "External record check — not determinable from a package image.",
      validationType: "EXTERNAL_RECORD_CHECK",
      evidenceRequired: "Registration certificate or authority record.",
      evaluator: "external_record",
      automationLevel: "EXTERNAL_RECORD_CHECK",
      operationalPriority: "HIGH",
    },
  ),
  c("LMPCR-2011-R28-001", "Rule 28", "Rule 28", "Records and documents maintained", {
    requirement: "Prescribed records and documents must be maintained.",
    applicability: "Document check — not determinable from a package image.",
    validationType: "DOCUMENT_CHECK",
    evidenceRequired: "Inspected records produced by the entity.",
    evaluator: "external_record",
    automationLevel: "EXTERNAL_RECORD_CHECK",
  }),
  c("LMPCR-2011-R29-001", "Rule 29", "Rule 29", "Returns and periodic filings", {
    requirement: "Prescribed returns and filings must be submitted to the authority.",
    applicability: "External record check — not determinable from a package image.",
    validationType: "EXTERNAL_RECORD_CHECK",
    evidenceRequired: "Filed returns or authority acknowledgement.",
    evaluator: "external_record",
    automationLevel: "EXTERNAL_RECORD_CHECK",
    operationalPriority: "LOW",
  }),
  c("LMPCR-2011-R30-001", "Rule 30", "Rule 30", "Licence and approval requirements", {
    requirement: "Prescribed licences and approvals must be held and current.",
    applicability: "External record check — not determinable from a package image.",
    validationType: "EXTERNAL_RECORD_CHECK",
    evidenceRequired: "Licence document or authority record.",
    evaluator: "external_record",
    automationLevel: "EXTERNAL_RECORD_CHECK",
  }),

  /* ---------------- Rule 31 — advertisements ---------------- */
  c("LMPCR-2011-R31-001", "Rule 31", "Rule 31", "Retail selling price in advertisement", {
    requirement:
      "An advertisement mentioning the retail sale price attracts the advertisement declarations.",
    applicability: "Sources that are advertisements or listings mentioning a selling price.",
    validationType: "CROSS_SOURCE",
    evaluator: "r31_price_mentioned",
    notApplicableCondition: "No retail selling price is mentioned in an advertisement context.",
  }),
  c("LMPCR-2011-R31-002", "Rule 31", "Rule 31", "Quantity or number accompanying the price", {
    requirement:
      "Where the price is advertised, the net quantity or number must be declared with it.",
    applicability: "Advertisements mentioning a retail selling price.",
    validationType: "CROSS_SOURCE",
    requiredFields: ["net_quantity"],
    evaluator: "r31_quantity_with_price",
    notApplicableCondition: "No retail selling price is mentioned in an advertisement context.",
    operationalPriority: "HIGH",
  }),
  c(
    "LMPCR-2011-R31-003",
    "Rule 31",
    "Rule 31",
    "Font-size relationship between price and quantity",
    {
      requirement:
        "The quantity declaration must be displayed in the prescribed size relationship to the price.",
      applicability: "Advertisements where the visual sizes can be measured.",
      validationType: "VISUAL_MEASUREMENT",
      evaluator: "r31_font_relationship",
      automationLevel: "SEMI_AUTOMATIC",
      notApplicableCondition: "No retail selling price is mentioned in an advertisement context.",
    },
  ),
];

/* ------------------------------------------------------------------ */
/* Rule 32 — legal consequence metadata (informational only)           */
/* ------------------------------------------------------------------ */

export interface LegalConsequence {
  parentRule: string;
  consequence: string;
  sourceReference: string;
  status: "needs_verification";
}

/**
 * Informational linkage only. METRIQ never presents a consequence as a legal
 * determination — it shows which provision an inspector would consult next.
 */
export const LEGAL_CONSEQUENCES: LegalConsequence[] = [
  {
    parentRule: "Rule 6",
    consequence:
      "Contravention of the declaration requirements is dealt with under the penalty provisions of the parent Act and Rule 32.",
    sourceReference: "Rule 32",
    status: "needs_verification",
  },
  {
    parentRule: "Rule 5",
    consequence:
      "Packing in a non-standard size is dealt with under the penalty provisions referenced by Rule 32.",
    sourceReference: "Rule 32",
    status: "needs_verification",
  },
  {
    parentRule: "Rule 18",
    consequence:
      "Sale above the declared retail sale price is dealt with under the parent Act's price provisions.",
    sourceReference: "Rule 32",
    status: "needs_verification",
  },
  {
    parentRule: "Rule 22",
    consequence:
      "Quantity deficiency beyond the maximum permissible error is dealt with under the parent Act's short-measure provisions.",
    sourceReference: "Rule 32",
    status: "needs_verification",
  },
  {
    parentRule: "Rule 24",
    consequence:
      "Wholesale declaration contraventions are dealt with under the penalty provisions referenced by Rule 32.",
    sourceReference: "Rule 32",
    status: "needs_verification",
  },
  {
    parentRule: "Rule 27",
    consequence:
      "Operating without registration is dealt with under the registration provisions of the parent Act.",
    sourceReference: "Rule 32",
    status: "needs_verification",
  },
  {
    parentRule: "Rule 31",
    consequence:
      "Advertisement contraventions are dealt with under the penalty provisions referenced by Rule 32.",
    sourceReference: "Rule 32",
    status: "needs_verification",
  },
];

export function consequenceFor(parentRule: string): LegalConsequence | null {
  return LEGAL_CONSEQUENCES.find((x) => x.parentRule === parentRule) ?? null;
}

export function atomicCheck(checkId: string): AtomicCheck | null {
  return ATOMIC_CHECKS.find((x) => x.checkId === checkId) ?? null;
}
