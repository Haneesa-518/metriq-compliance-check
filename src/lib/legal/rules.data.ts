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

export type RuleStatus = "active" | "draft" | "superseded" | "needs_verification";
export type ValidationType = "presence" | "format" | "presence_conditional";

export interface LegalRule {
  rule_id: string;
  rule_code: string;
  title: string;
  requirement: string;
  applicability: string;
  /** extracted declaration/field this rule maps to */
  field: string;
  validation_type: ValidationType;
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
    validation_type: "presence",
    source_document:
      "Legal Metrology (Packaged Commodities) Rules, 2011 — Department of Consumer Affairs, Government of India",
    source_reference: "Rule 6 (declarations on every package)",
    status: "needs_verification",
    last_verified: null,
  },
  {
    rule_id: "LMPCR-2011-R6-MANUFACTURER",
    rule_code: "PCR/6/manufacturer",
    title: "Name and address of manufacturer / packer",
    requirement:
      "The package is expected to identify the manufacturer, packer or the entity responsible for the package, with an address.",
    applicability: "Pre-packaged commodities intended for retail sale in India.",
    field: "manufacturer",
    validation_type: "presence",
    source_document:
      "Legal Metrology (Packaged Commodities) Rules, 2011 — Department of Consumer Affairs, Government of India",
    source_reference: "Rule 6 (declarations on every package)",
    status: "needs_verification",
    last_verified: null,
  },
  {
    rule_id: "LMPCR-2011-R6-ADDRESS",
    rule_code: "PCR/6/address",
    title: "Address of the responsible entity",
    requirement:
      "An address for the manufacturer, packer or importer is expected to appear on the package.",
    applicability: "Pre-packaged commodities intended for retail sale in India.",
    field: "address",
    validation_type: "presence",
    source_document:
      "Legal Metrology (Packaged Commodities) Rules, 2011 — Department of Consumer Affairs, Government of India",
    source_reference: "Rule 6 (declarations on every package)",
    status: "needs_verification",
    last_verified: null,
  },
  {
    rule_id: "LMPCR-2011-R6-NET-QUANTITY",
    rule_code: "PCR/6/net-quantity",
    title: "Net quantity declaration",
    requirement:
      "The package is expected to declare the net quantity in standard units of weight, measure or number.",
    applicability: "Pre-packaged commodities intended for retail sale in India.",
    field: "net_quantity",
    validation_type: "format",
    source_document:
      "Legal Metrology (Packaged Commodities) Rules, 2011 — Department of Consumer Affairs, Government of India",
    source_reference: "Rule 6 read with Rule 8 (net quantity declaration)",
    status: "needs_verification",
    last_verified: null,
  },
  {
    rule_id: "LMPCR-2011-R6-MRP",
    rule_code: "PCR/6/retail-sale-price",
    title: "Retail sale price (MRP)",
    requirement:
      "The package is expected to declare the retail sale price, inclusive of all taxes, in the prescribed form.",
    applicability: "Pre-packaged commodities intended for retail sale in India.",
    field: "mrp",
    validation_type: "format",
    source_document:
      "Legal Metrology (Packaged Commodities) Rules, 2011 — Department of Consumer Affairs, Government of India",
    source_reference: "Rule 6 (retail sale price declaration)",
    status: "needs_verification",
    last_verified: null,
  },
  {
    rule_id: "LMPCR-2011-R6-CONSUMER-CARE",
    rule_code: "PCR/6/consumer-care",
    title: "Consumer care details",
    requirement:
      "Contact details for consumer complaints (such as a name/designation with a phone number or e-mail) are expected on the package.",
    applicability: "Pre-packaged commodities intended for retail sale in India.",
    field: "consumer_care",
    validation_type: "presence",
    source_document:
      "Legal Metrology (Packaged Commodities) Rules, 2011 — Department of Consumer Affairs, Government of India",
    source_reference: "Rule 6 (consumer care details)",
    status: "needs_verification",
    last_verified: null,
  },
  {
    rule_id: "LMPCR-2011-R6-DATE",
    rule_code: "PCR/6/date-of-manufacture",
    title: "Month and year of manufacture / packing / import",
    requirement:
      "The package is expected to declare the month and year in which the commodity was manufactured, packed or imported.",
    applicability: "Pre-packaged commodities intended for retail sale in India.",
    field: "date_of_manufacture",
    validation_type: "presence",
    source_document:
      "Legal Metrology (Packaged Commodities) Rules, 2011 — Department of Consumer Affairs, Government of India",
    source_reference: "Rule 6 (date declaration)",
    status: "needs_verification",
    last_verified: null,
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
    validation_type: "presence_conditional",
    source_document:
      "Legal Metrology (Packaged Commodities) Rules, 2011 — Department of Consumer Affairs, Government of India",
    source_reference: "Rule 6 (imported packages)",
    status: "needs_verification",
    last_verified: null,
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
    validation_type: "presence_conditional",
    source_document:
      "Legal Metrology (Packaged Commodities) Rules, 2011 — Department of Consumer Affairs, Government of India",
    source_reference: "Rule 6 (imported packages)",
    status: "needs_verification",
    last_verified: null,
  },
];

export function getRule(ruleId: string): LegalRule | undefined {
  return LEGAL_RULES.find((r) => r.rule_id === ruleId);
}
