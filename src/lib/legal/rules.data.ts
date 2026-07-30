/**
 * Legal knowledge layer.
 *
 * This is a structured, citation-light rule dataset for a prototype. Entries
 * reference the Legal Metrology (Packaged Commodities) Rules, 2011 (Government
 * of India, Department of Consumer Affairs) at the rule-number level only.
 *
 * NO rule text is quoted or paraphrased as authoritative wording. Every entry
 * carries a `status` and must be treated as UNVERIFIED unless a human reviewer
 * has confirmed it against the official published document.
 */

export type RuleStatus = "VERIFIED" | "NEEDS_VERIFICATION";
export type RuleCategory = "legal_metrology" | "food_labelling";
export type ValidationType =
  | "presence"
  | "format"
  | "structure"
  | "presence_conditional"
  | "format_conditional";

export interface LegalRule {
  rule_id: string;
  rule_code: string;
  title: string;
  requirement: string;
  applicability: string;
  /** extracted declaration/field this rule maps to */
  field: string;
  /** dashboard grouping: Legal Metrology vs Food Labelling screening */
  category: RuleCategory;
  validation_type: ValidationType;
  /** true when this rule is actually evaluated by the deterministic engine */
  evaluated: boolean;
  source_document: string;
  source_reference: string;
  status: RuleStatus;
  last_verified: string | null;
}

export const LEGAL_RULES: LegalRule[] = [
  {
    rule_id: "LMPCR-2011-R6-PRODUCT-NAME",
    rule_code: "PCR/6/name",
    title: "Name of the commodity",
    requirement:
      "The package is expected to carry a declaration identifying the commodity contained in it.",
    applicability: "Pre-packaged commodities intended for retail sale in India.",
    field: "product_name",
    category: "legal_metrology",
    evaluated: true,
    validation_type: "presence",
    source_document:
      "Legal Metrology (Packaged Commodities) Rules, 2011 — Department of Consumer Affairs, Government of India",
    source_reference: "Rule 6 (declarations on every package)",
    status: "VERIFIED",
    last_verified: "2026-07-30",
  },
  {
    rule_id: "LMPCR-2011-R6-MANUFACTURER",
    rule_code: "PCR/6/manufacturer",
    title: "Name and address of manufacturer / packer",
    requirement:
      "The package is expected to identify the manufacturer, packer or the entity responsible for the package, with an address.",
    applicability: "Pre-packaged commodities intended for retail sale in India.",
    field: "manufacturer",
    category: "legal_metrology",
    evaluated: true,
    validation_type: "presence",
    source_document:
      "Legal Metrology (Packaged Commodities) Rules, 2011 — Department of Consumer Affairs, Government of India",
    source_reference: "Rule 6 (declarations on every package)",
    status: "VERIFIED",
    last_verified: "2026-07-30",
  },
  {
    rule_id: "LMPCR-2011-R6-ADDRESS",
    rule_code: "PCR/6/address",
    title: "Address of the responsible entity",
    requirement:
      "An address for the manufacturer, packer or importer is expected to appear on the package.",
    applicability: "Pre-packaged commodities intended for retail sale in India.",
    field: "address",
    category: "legal_metrology",
    evaluated: true,
    validation_type: "presence",
    source_document:
      "Legal Metrology (Packaged Commodities) Rules, 2011 — Department of Consumer Affairs, Government of India",
    source_reference: "Rule 6 (declarations on every package)",
    status: "VERIFIED",
    last_verified: "2026-07-30",
  },
  {
    rule_id: "LMPCR-2011-R6-NET-QUANTITY",
    rule_code: "PCR/6/net-quantity",
    title: "Net quantity declaration",
    requirement:
      "The package is expected to declare the net quantity in standard units of weight, measure or number.",
    applicability: "Pre-packaged commodities intended for retail sale in India.",
    field: "net_quantity",
    category: "legal_metrology",
    evaluated: true,
    validation_type: "structure",
    source_document:
      "Legal Metrology (Packaged Commodities) Rules, 2011 — Department of Consumer Affairs, Government of India",
    source_reference: "Rule 6 read with Rule 8 (net quantity declaration)",
    status: "VERIFIED",
    last_verified: "2026-07-30",
  },
  {
    rule_id: "LMPCR-2011-R6-MRP",
    rule_code: "PCR/6/retail-sale-price",
    title: "Retail sale price (MRP)",
    requirement:
      "The package is expected to declare the retail sale price, inclusive of all taxes, in the prescribed form.",
    applicability: "Pre-packaged commodities intended for retail sale in India.",
    field: "mrp",
    category: "legal_metrology",
    evaluated: true,
    validation_type: "format",
    source_document:
      "Legal Metrology (Packaged Commodities) Rules, 2011 — Department of Consumer Affairs, Government of India",
    source_reference: "Rule 6 (retail sale price declaration)",
    status: "VERIFIED",
    last_verified: "2026-07-30",
  },
  {
    rule_id: "LMPCR-2011-R6-CONSUMER-CARE",
    rule_code: "PCR/6/consumer-care",
    title: "Consumer care details",
    requirement:
      "Contact details for consumer complaints (such as a name/designation with a phone number or e-mail) are expected on the package.",
    applicability: "Pre-packaged commodities intended for retail sale in India.",
    field: "consumer_care",
    category: "legal_metrology",
    evaluated: true,
    validation_type: "presence",
    source_document:
      "Legal Metrology (Packaged Commodities) Rules, 2011 — Department of Consumer Affairs, Government of India",
    source_reference: "Rule 6 (consumer care details)",
    status: "VERIFIED",
    last_verified: "2026-07-30",
  },
  {
    rule_id: "LMPCR-2011-R6-DATE",
    rule_code: "PCR/6/date-of-manufacture",
    title: "Month and year of manufacture / packing / import",
    requirement:
      "The package is expected to declare the month and year in which the commodity was manufactured, packed or imported.",
    applicability: "Pre-packaged commodities intended for retail sale in India.",
    field: "date_of_manufacture",
    category: "legal_metrology",
    evaluated: true,
    validation_type: "presence",
    source_document:
      "Legal Metrology (Packaged Commodities) Rules, 2011 — Department of Consumer Affairs, Government of India",
    source_reference: "Rule 6 (date declaration)",
    status: "VERIFIED",
    last_verified: "2026-07-30",
  },
  {
    rule_id: "LMPCR-2011-R6-COUNTRY-OF-ORIGIN",
    rule_code: "PCR/6/country-of-origin",
    title: "Country of origin (imported packages)",
    requirement:
      "Where the commodity is imported, the country of origin is expected to be declared on the package.",
    applicability:
      "Applies only when the package indicates import (e.g. an importer declaration is present). Otherwise treated as not applicable.",
    field: "country_of_origin",
    category: "legal_metrology",
    evaluated: true,
    validation_type: "presence_conditional",
    source_document:
      "Legal Metrology (Packaged Commodities) Rules, 2011 — Department of Consumer Affairs, Government of India",
    source_reference: "Rule 6 (imported packages)",
    status: "VERIFIED",
    last_verified: "2026-07-30",
  },
  {
    rule_id: "LMPCR-2011-R6-IMPORTER",
    rule_code: "PCR/6/importer",
    title: "Importer details (imported packages)",
    requirement:
      "Where the commodity is imported, the name and address of the importer is expected on the package.",
    applicability:
      "Applies only when the package indicates import. Otherwise treated as not applicable.",
    field: "importer",
    category: "legal_metrology",
    evaluated: true,
    validation_type: "presence_conditional",
    source_document:
      "Legal Metrology (Packaged Commodities) Rules, 2011 — Department of Consumer Affairs, Government of India",
    source_reference: "Rule 6 (imported packages)",
    status: "VERIFIED",
    last_verified: "2026-07-30",
  },
  {
    rule_id: "FSSLD-2020-VEG-NONVEG",
    rule_code: "FSSLD/5/veg-mark",
    title: "Vegetarian / non-vegetarian mark",
    requirement:
      "The package is expected to carry the prescribed green or brown symbol indicating whether the food is vegetarian or non-vegetarian.",
    applicability: "Pre-packaged food commodities for retail sale in India.",
    field: "veg_nonveg_mark",
    category: "food_labelling",
    evaluated: true,
    validation_type: "presence",
    source_document:
      "Food Safety and Standards (Labelling and Display) Regulations, 2020 — Food Safety and Standards Authority of India",
    source_reference: "Regulation 5 (declarations on pre-packaged food)",
    status: "NEEDS_VERIFICATION",
    last_verified: null,
  },
  {
    rule_id: "FSSLD-2020-INGREDIENTS",
    rule_code: "FSSLD/5/ingredients",
    title: "List of ingredients",
    requirement:
      "A list of ingredients in descending order of composition by weight or volume is expected on the package.",
    applicability: "Pre-packaged multi-ingredient food commodities.",
    field: "ingredients_list",
    category: "food_labelling",
    evaluated: true,
    validation_type: "presence",
    source_document:
      "Food Safety and Standards (Labelling and Display) Regulations, 2020 — Food Safety and Standards Authority of India",
    source_reference: "Regulation 5 (list of ingredients)",
    status: "NEEDS_VERIFICATION",
    last_verified: null,
  },
  {
    rule_id: "FSSLD-2020-ALLERGENS",
    rule_code: "FSSLD/5/allergens",
    title: "Allergen declaration",
    requirement:
      "Where the food contains prescribed allergens, a declaration highlighting them is expected on the package.",
    applicability: "Pre-packaged foods containing declarable allergens.",
    field: "allergen_declaration",
    category: "food_labelling",
    evaluated: false,
    validation_type: "presence_conditional",
    source_document:
      "Food Safety and Standards (Labelling and Display) Regulations, 2020 — Food Safety and Standards Authority of India",
    source_reference: "Regulation 5 (allergen labelling)",
    status: "NEEDS_VERIFICATION",
    last_verified: null,
  },
  {
    rule_id: "FSSLD-2020-NUTRITION",
    rule_code: "FSSLD/5/nutrition",
    title: "Nutritional information panel",
    requirement:
      "Nutritional information per 100 g / 100 ml or per serving is expected on the package.",
    applicability: "Pre-packaged food commodities for retail sale in India.",
    field: "nutrition_information",
    category: "food_labelling",
    evaluated: false,
    validation_type: "presence",
    source_document:
      "Food Safety and Standards (Labelling and Display) Regulations, 2020 — Food Safety and Standards Authority of India",
    source_reference: "Regulation 5 (nutritional information)",
    status: "NEEDS_VERIFICATION",
    last_verified: null,
  },
  {
    rule_id: "FSSLD-2020-BEST-BEFORE",
    rule_code: "FSSLD/5/best-before",
    title: "Best before / use by / expiry date",
    requirement:
      "A date of expiry, best-before or use-by declaration is expected on pre-packaged food.",
    applicability: "Pre-packaged food commodities for retail sale in India.",
    field: "best_before",
    category: "food_labelling",
    evaluated: true,
    validation_type: "presence",
    source_document:
      "Food Safety and Standards (Labelling and Display) Regulations, 2020 — Food Safety and Standards Authority of India",
    source_reference: "Regulation 5 (date marking)",
    status: "NEEDS_VERIFICATION",
    last_verified: null,
  },
  {
    rule_id: "FSS-2006-LICENCE",
    rule_code: "FSS/31/licence-number",
    title: "FSSAI licence number",
    requirement:
      "The FSSAI licence or registration number of the food business operator is expected on the package, along with the FSSAI logo.",
    applicability: "Pre-packaged food commodities for retail sale in India.",
    field: "fssai_licence",
    category: "food_labelling",
    evaluated: true,
    validation_type: "presence",
    source_document:
      "Food Safety and Standards Act, 2006 read with the Licensing and Registration of Food Businesses Regulations, 2011 — FSSAI",
    source_reference: "Section 31 / licensing regulations (licence display)",
    status: "NEEDS_VERIFICATION",
    last_verified: null,
  },
  {
    rule_id: "FSSLD-2020-BATCH",
    rule_code: "FSSLD/5/batch-number",
    title: "Batch / lot / code number",
    requirement:
      "A batch, lot or code number identifying the production lot is expected on the package.",
    applicability: "Pre-packaged food commodities for retail sale in India.",
    field: "batch_number",
    category: "food_labelling",
    evaluated: false,
    validation_type: "presence",
    source_document:
      "Food Safety and Standards (Labelling and Display) Regulations, 2020 — Food Safety and Standards Authority of India",
    source_reference: "Regulation 5 (lot / batch identification)",
    status: "NEEDS_VERIFICATION",
    last_verified: null,
  },
  {
    rule_id: "FSSLD-2020-ADDITIVES",
    rule_code: "FSSLD/5/additives",
    title: "Food additives declaration",
    requirement:
      "Food additives are expected to be declared by class name together with the specific name or INS number.",
    applicability: "Pre-packaged foods containing additives.",
    field: "food_additives",
    category: "food_labelling",
    evaluated: false,
    validation_type: "presence_conditional",
    source_document:
      "Food Safety and Standards (Labelling and Display) Regulations, 2020 — Food Safety and Standards Authority of India",
    source_reference: "Regulation 5 (food additives)",
    status: "NEEDS_VERIFICATION",
    last_verified: null,
  },
  {
    rule_id: "FSSLD-2020-STORAGE",
    rule_code: "FSSLD/5/storage",
    title: "Storage conditions",
    requirement:
      "Any special storage conditions required to maintain the food are expected to be declared.",
    applicability: "Pre-packaged foods requiring specific storage conditions.",
    field: "storage_conditions",
    category: "food_labelling",
    evaluated: false,
    validation_type: "presence_conditional",
    source_document:
      "Food Safety and Standards (Labelling and Display) Regulations, 2020 — Food Safety and Standards Authority of India",
    source_reference: "Regulation 5 (storage instructions)",
    status: "NEEDS_VERIFICATION",
    last_verified: null,
  },
  {
    rule_id: "FSSLD-2020-INSTRUCTIONS",
    rule_code: "FSSLD/5/use-instructions",
    title: "Instructions for use",
    requirement:
      "Where necessary for appropriate use, instructions for preparation or use are expected on the package.",
    applicability: "Pre-packaged foods requiring preparation instructions.",
    field: "instructions_for_use",
    category: "food_labelling",
    evaluated: false,
    validation_type: "presence_conditional",
    source_document:
      "Food Safety and Standards (Labelling and Display) Regulations, 2020 — Food Safety and Standards Authority of India",
    source_reference: "Regulation 5 (instructions for use)",
    status: "NEEDS_VERIFICATION",
    last_verified: null,
  },
  {
    rule_id: "FSSLD-2020-FOOD-CATEGORY",
    rule_code: "FSSLD/5/food-category",
    title: "Nature / category of the food",
    requirement:
      "The package is expected to indicate the true nature or category of the food, distinct from a brand name.",
    applicability: "Pre-packaged food commodities for retail sale in India.",
    field: "food_category",
    category: "food_labelling",
    evaluated: false,
    validation_type: "presence",
    source_document:
      "Food Safety and Standards (Labelling and Display) Regulations, 2020 — Food Safety and Standards Authority of India",
    source_reference: "Regulation 5 (name of food)",
    status: "NEEDS_VERIFICATION",
    last_verified: null,
  },
  {
    rule_id: "FSSLD-2020-IRRADIATED",
    rule_code: "FSSLD/5/irradiated",
    title: "Irradiated food declaration",
    requirement:
      "Irradiated food is expected to bear the prescribed logo and declaration with the date and purpose of irradiation.",
    applicability: "Pre-packaged irradiated foods only.",
    field: "irradiated_food",
    category: "food_labelling",
    evaluated: false,
    validation_type: "presence_conditional",
    source_document:
      "Food Safety and Standards (Labelling and Display) Regulations, 2020 — Food Safety and Standards Authority of India",
    source_reference: "Regulation 5 (irradiated food)",
    status: "NEEDS_VERIFICATION",
    last_verified: null,
  },
  {
    rule_id: "FSSLD-2020-CAFFEINE-WARNING",
    rule_code: "FSSLD/6/caffeine-warning",
    title: "Mandatory statutory warnings",
    requirement:
      "Prescribed statutory warnings (for example for high-caffeine beverages or specified categories) are expected where applicable.",
    applicability: "Pre-packaged foods in categories carrying mandatory warnings.",
    field: "statutory_warning",
    category: "food_labelling",
    evaluated: false,
    validation_type: "presence_conditional",
    source_document:
      "Food Safety and Standards (Labelling and Display) Regulations, 2020 — Food Safety and Standards Authority of India",
    source_reference: "Regulation 6 (mandatory declarations / warnings)",
    status: "NEEDS_VERIFICATION",
    last_verified: null,
  },
  {
    rule_id: "FSSLD-2020-GM-FOOD",
    rule_code: "FSSLD/5/gm-declaration",
    title: "Genetically modified food declaration",
    requirement:
      "Foods containing genetically modified ingredients above the prescribed threshold are expected to carry a GM declaration.",
    applicability: "Pre-packaged foods with GM ingredients.",
    field: "gm_declaration",
    category: "food_labelling",
    evaluated: false,
    validation_type: "presence_conditional",
    source_document:
      "Food Safety and Standards (Labelling and Display) Regulations, 2020 — Food Safety and Standards Authority of India",
    source_reference: "Regulation 5 (GM food labelling)",
    status: "NEEDS_VERIFICATION",
    last_verified: null,
  },
  {
    rule_id: "FSSLD-2020-ORGANIC",
    rule_code: "FSSLD/5/organic-claim",
    title: "Organic claim substantiation",
    requirement:
      "Where a food is labelled organic, the prescribed certification mark / logo and certification details are expected.",
    applicability: "Pre-packaged foods bearing an organic claim.",
    field: "organic_certification",
    category: "food_labelling",
    evaluated: false,
    validation_type: "presence_conditional",
    source_document:
      "Food Safety and Standards (Labelling and Display) Regulations, 2020 — Food Safety and Standards Authority of India",
    source_reference: "Regulation 5 read with the Organic Foods Regulations, 2017",
    status: "NEEDS_VERIFICATION",
    last_verified: null,
  },
  {
    rule_id: "FSSLD-2020-LANGUAGE",
    rule_code: "FSSLD/4/language",
    title: "Language of declarations",
    requirement:
      "Mandatory declarations are expected to appear in English or Hindi in Devanagari script.",
    applicability: "Pre-packaged food commodities for retail sale in India.",
    field: "declaration_language",
    category: "food_labelling",
    evaluated: false,
    validation_type: "presence",
    source_document:
      "Food Safety and Standards (Labelling and Display) Regulations, 2020 — Food Safety and Standards Authority of India",
    source_reference: "Regulation 4 (general labelling requirements)",
    status: "NEEDS_VERIFICATION",
    last_verified: null,
  },
  {
    rule_id: "LMPCR-2011-R6-UNIT-SALE-PRICE",
    rule_code: "PCR/6/unit-sale-price",
    title: "Unit sale price",
    requirement:
      "Where required, the package is expected to declare the sale price per unit of weight, measure or number (for example per kg, per litre or per piece).",
    applicability:
      "Pre-packaged commodities intended for retail sale in India where a unit sale price declaration is expected.",
    field: "unit_sale_price",
    category: "legal_metrology",
    evaluated: true,
    validation_type: "format",
    source_document:
      "Legal Metrology (Packaged Commodities) Rules, 2011 — Department of Consumer Affairs, Government of India",
    source_reference: "Rule 6 read with Rule 2(r) (unit sale price)",
    status: "VERIFIED",
    last_verified: "2026-07-30",
  },
];

export function getRule(ruleId: string): LegalRule | undefined {
  return LEGAL_RULES.find((r) => r.rule_id === ruleId);
}

/**
 * The verified core rule set: packaged-commodity declarations that a human
 * reviewer has checked against the official published rule numbers and that the
 * deterministic engine actually evaluates. Verification is at rule-number and
 * requirement-summary level only — it is not a legal opinion.
 */
export const VERIFIED_CORE_RULES = LEGAL_RULES.filter((r) => r.status === "VERIFIED");

export const EVALUATED_RULES = LEGAL_RULES.filter((r) => r.evaluated);

export function rulesInCategory(category: RuleCategory): LegalRule[] {
  return LEGAL_RULES.filter((r) => r.category === category);
}

export function ruleForField(field: string): LegalRule | undefined {
  return LEGAL_RULES.find((r) => r.field === field);
}
