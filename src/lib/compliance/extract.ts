import { declarationFor, extractEntityDeclarations } from "./roles";
import {
  bandFor,
  type ExtractedData,
  type ExtractedField,
  type FieldSource,
  type ImportStatus,
  type PackageContext,
  type ProductCategory,
} from "./types";

export const FIELD_LABELS: Record<string, string> = {
  product_name: "Product / commodity name",
  manufacturer: "Manufacturer",
  packer: "Packer",
  importer: "Importer",
  address: "Address",
  net_quantity: "Net quantity",
  mrp: "Retail sale price (MRP)",
  unit_sale_price: "Unit sale price",
  consumer_care: "Consumer care details",
  country_of_origin: "Country of origin",
  date_of_manufacture: "Month & year of manufacture / packing",
  veg_nonveg_mark: "Vegetarian / non-vegetarian declaration",
  ingredients_list: "List of ingredients",
  fssai_licence: "FSSAI licence number",
  best_before: "Best before / use by",
};

export const FIELD_KEYS = Object.keys(FIELD_LABELS);

export const FOOD_FIELDS = ["veg_nonveg_mark", "ingredients_list", "fssai_licence", "best_before"];

export function emptyField(key: string): ExtractedField {
  return {
    key,
    label: FIELD_LABELS[key] ?? key,
    value: null,
    confidence: 0,
    band: "LOW",
    evidence: null,
    source: "unavailable",
  };
}

function field(
  key: string,
  value: string | null,
  confidence: number,
  evidence: string | null = null,
  source: FieldSource = "ocr",
): ExtractedField {
  const clean = value?.trim() ? value.trim() : null;
  const conf = clean ? Math.max(0, Math.min(1, confidence)) : 0;
  return {
    key,
    label: FIELD_LABELS[key] ?? key,
    value: clean,
    confidence: conf,
    band: bandFor(conf),
    evidence: clean ? (evidence?.trim() || null) : null,
    source: clean ? source : "unavailable",
  };
}

const NET_QTY_RE =
  /(?:net\s*(?:qty|quantity|wt|weight|vol|volume)\s*[:.\-]?\s*)?(\d+(?:[.,]\d+)?)\s*(kg|g|gm|gms|grams?|mg|l|ltr|litres?|liters?|ml|n|no\.?s?|pieces?|pcs)\b/i;
const NET_QTY_LABEL_RE = /net\s*(?:qty|quantity|wt|weight|vol|volume)/i;
const MRP_RE =
  /(?:m\.?r\.?p\.?|maximum\s+retail\s+price|retail\s+sale\s+price|price)\s*[:.\-]?\s*(?:rs\.?|inr|₹)?\s*(\d+(?:[.,]\d{1,2})?)/i;
const MRP_WORDING_RE = /m\.?r\.?p\.?|maximum\s+retail\s+price|retail\s+sale\s+price/i;
const UNIT_PRICE_RE =
  /(?:unit\s*sale\s*price|price\s*per\s*unit|unit\s*price)?\s*(?:₹|rs\.?|inr)?\s*(\d+(?:[.,]\d{1,2})?)\s*(?:\/|per\s*)\s*(kg|g|gm|l|ltr|litre|liter|ml|unit|pc|pcs|piece|n)\b/i;
const UNIT_PRICE_LABEL_RE = /unit\s*sale\s*price|price\s*per\s*unit|unit\s*price/i;
const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.]+/;
const PHONE_RE = /(?:\+91[\s-]?)?(?:1800[\s-]?\d{3}[\s-]?\d{3,4}|\b\d{10}\b)/;
const PIN_RE = /\b\d{6}\b/;
const FSSAI_RE = /(?:fssai|lic(?:ence|ense)\s*(?:no\.?|number)?)[^\dA-Za-z]{0,12}(\d{10,14})/i;
const VEG_RE = /(non[\s-]?veg(?:etarian)?|vegetarian\b|veg\s*mark|green\s*dot|brown\s*dot)/i;
const BEST_BEFORE_RE = /(best\s*before|use\s*by|expiry\s*date|exp\.?\s*date|use\s*before)/i;
const FOOD_HINT_RE =
  /ingredient|fssai|nutrition|vegetarian|best\s*before|use\s*by|flavour|flavor|edible|food|snack|biscuit|atta|flour|oil|spice|masala|beverage|juice|allergen/i;

/** Locate the first line matching a pattern — used as evidence. */
function lineWith(lines: string[], re: RegExp): string | null {
  return lines.find((l) => re.test(l)) ?? null;
}

function lineAfter(lines: string[], re: RegExp): { value: string; evidence: string } | null {
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(re);
    if (m) {
      const rest = lines[i].slice((m.index ?? 0) + m[0].length).replace(/^[:.\-\s]+/, "");
      if (rest.trim().length > 2) return { value: rest.trim(), evidence: lines[i] };
      if (lines[i + 1]?.trim())
        return { value: lines[i + 1].trim(), evidence: `${lines[i]} / ${lines[i + 1]}` };
    }
  }
  return null;
}

const DOMESTIC_ORIGIN_RE = /country\s*of\s*origin\s*[:\-]?\s*india\b/i;
const IMPORT_RE = /imported\s+by|importer\b|country\s*of\s*origin/i;
const NON_FOOD_HINT_RE =
  /shampoo|soap|detergent|cosmetic|cream|lotion|cement|paint|battery|cable|electronic|garment|textile|shoe|footwear|stationery|toy\b/i;

/** Deterministic package-context detection (drives rule applicability only). */
export function detectContext(rawText: string, fields: Record<string, ExtractedField>): PackageContext {
  const text = rawText || "";

  // ---- import classification (three-state; absence of evidence ≠ imported) ----
  const originValue = fields.country_of_origin?.value ?? null;
  const domesticOrigin =
    DOMESTIC_ORIGIN_RE.test(text) || /^india$/i.test((originValue ?? "").trim());
  const importerValue = fields.importer?.value ?? null;
  const importMatch = text.match(/imported\s+by[^\n]*|country\s+of\s+origin[^\n]*|importer[^\n]*/i);

  let import_status: ImportStatus;
  let import_reason: string;
  let import_evidence: string | null = importMatch ? importMatch[0].trim().slice(0, 160) : null;

  if (domesticOrigin && !importerValue) {
    import_status = "DOMESTIC";
    import_reason =
      'The label declares "Country of Origin: India" and no importer declaration was detected, so the product is treated as domestically produced.';
  } else if (importerValue || /imported\s+by/i.test(text)) {
    import_status = "IMPORTED";
    import_reason =
      "An explicit importer declaration was detected, so importer and country-of-origin rules are applicable.";
  } else if (originValue || IMPORT_RE.test(text)) {
    import_status = "UNCERTAIN";
    import_reason =
      "Import-related wording was detected but no explicit importer declaration was found, so import status could not be established.";
  } else {
    import_status = "DOMESTIC";
    import_reason =
      "No import-related declaration was detected in the submitted source, so the product is screened as domestic. Absence of evidence is not treated as an import failure.";
    import_evidence = null;
  }

  // ---- product classification ----
  const strongFood =
    Boolean(fields.ingredients_list?.value) ||
    Boolean(fields.fssai_licence?.value) ||
    Boolean(fields.veg_nonveg_mark?.value) ||
    Boolean(fields.best_before?.value);
  const foodMatch = text.match(FOOD_HINT_RE);
  const nonFoodMatch = text.match(NON_FOOD_HINT_RE);
  const is_food = strongFood || Boolean(foodMatch);

  const product_category: ProductCategory = is_food
    ? "food"
    : nonFoodMatch
      ? "non_food"
      : "unknown";
  const category_reason = strongFood
    ? "Food-specific declarations (ingredients, FSSAI licence, veg/non-veg mark or best-before) were detected."
    : foodMatch
      ? `Food-related wording detected: "${foodMatch[0]}".`
      : nonFoodMatch
        ? `Non-food product wording detected: "${nonFoodMatch[0]}".`
        : "No food or non-food indicators were detected; food-labelling rules are treated as not applicable.";

  return {
    is_imported: import_status === "IMPORTED",
    imported_signal: import_evidence,
    is_food,
    food_signal: strongFood
      ? "Food-specific declarations detected on the label."
      : foodMatch
        ? `Food-related wording detected: "${foodMatch[0]}"`
        : null,
    food_certainty: strongFood ? "certain" : is_food ? "uncertain" : "certain",
    import_status,
    import_evidence,
    import_reason,
    product_category,
    product_subcategory: nonFoodMatch ? nonFoodMatch[0].toLowerCase() : null,
    category_reason,
    attributes: {
      has_ingredients: Boolean(fields.ingredients_list?.value),
      has_fssai_licence: Boolean(fields.fssai_licence?.value),
      has_veg_mark: Boolean(fields.veg_nonveg_mark?.value),
      has_best_before: Boolean(fields.best_before?.value),
      has_importer: Boolean(importerValue),
      has_country_of_origin: Boolean(originValue),
    },
  };
}


/**
 * Deterministic, explainable field extraction from raw OCR text.
 * Used on its own for "re-analyze after editing OCR text", and as a fallback /
 * cross-check for the AI extraction layer.
 */
export function extractFieldsFromText(rawText: string, source: FieldSource = "ocr"): ExtractedData {
  const text = rawText || "";
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const fields: Record<string, ExtractedField> = {};

  // Product name: first substantial non-declaration line.
  const named = lineAfter(lines, /product\s*name|commodity/i);
  const nameLine =
    named?.value ??
    lines.find(
      (l) =>
        l.length >= 3 &&
        l.length <= 60 &&
        !NET_QTY_RE.test(l) &&
        !MRP_RE.test(l) &&
        !/mfg|manufactur|packed|import|customer|consumer|care|address|email|www/i.test(l),
    ) ??
    null;
  fields.product_name = field("product_name", nameLine, nameLine ? 0.72 : 0, named?.evidence ?? nameLine);

  // Role-aware entity extraction: the role marker decides the field, never the
  // mere presence of a company name.
  const declarations = extractEntityDeclarations(lines);
  const manufacturer = declarationFor(declarations, "manufacturer");
  const packer = declarationFor(declarations, "packer");
  const importer = declarationFor(declarations, "importer");
  const ambiguous = declarationFor(declarations, "ambiguous");

  fields.manufacturer = field(
    "manufacturer",
    manufacturer?.name ?? null,
    manufacturer?.confidence ?? 0,
    manufacturer?.evidence ?? null,
  );
  fields.packer = field("packer", packer?.name ?? null, packer?.confidence ?? 0, packer?.evidence ?? null);
  fields.importer = field(
    "importer",
    importer?.name ?? null,
    importer?.confidence ?? 0,
    importer?.evidence ?? null,
  );

  // An ambiguous "Marketed by" / "Distributed by" entity is recorded at low
  // confidence only when no role-specific declaration was found, so the rule
  // engine treats it as needing human review rather than as a mandatory role.
  if (!manufacturer && !packer && ambiguous) {
    fields.manufacturer = field("manufacturer", ambiguous.name, 0.35, ambiguous.evidence);
  }

  const roleAddress = manufacturer?.address ?? packer?.address ?? importer?.address ?? null;
  const addressByPin = lines.find((l) => PIN_RE.test(l) && l.length > 10) ?? null;
  const addressLabelled = roleAddress || addressByPin ? null : lineAfter(lines, /address/i);
  const addressLine = roleAddress ?? addressByPin ?? addressLabelled?.value ?? null;
  fields.address = field(
    "address",
    addressLine,
    roleAddress ? 0.85 : addressByPin ? 0.8 : 0.5,
    roleAddress ?? addressByPin ?? addressLabelled?.evidence,
  );

  const qtyMatch = text.match(NET_QTY_RE);
  fields.net_quantity = field(
    "net_quantity",
    qtyMatch ? `${qtyMatch[1]} ${qtyMatch[2]}` : null,
    NET_QTY_LABEL_RE.test(text) ? 0.9 : 0.6,
    lineWith(lines, NET_QTY_RE) ?? qtyMatch?.[0] ?? null,
  );

  const mrpMatch = text.match(MRP_RE);
  fields.mrp = field(
    "mrp",
    mrpMatch ? `₹ ${mrpMatch[1]}` : null,
    MRP_WORDING_RE.test(text) ? 0.86 : 0.55,
    lineWith(lines, MRP_RE) ?? mrpMatch?.[0] ?? null,
  );

  // Unit sale price is only accepted from a line that actually expresses a
  // "per unit" price — never derived or calculated from the MRP.
  const unitLine = lines.find((l) => UNIT_PRICE_LABEL_RE.test(l) || /\bper\s*(kg|g|l|ltr|litre|ml|unit|pc|piece)\b/i.test(l));
  const unitMatch = unitLine?.match(UNIT_PRICE_RE) ?? null;
  fields.unit_sale_price = field(
    "unit_sale_price",
    unitMatch ? `₹ ${unitMatch[1]} per ${unitMatch[2]}` : unitLine ? unitLine : null,
    unitMatch ? (UNIT_PRICE_LABEL_RE.test(unitLine ?? "") ? 0.88 : 0.65) : 0.35,
    unitLine,
  );

  const email = text.match(EMAIL_RE)?.[0] ?? null;
  const phone = text.match(PHONE_RE)?.[0] ?? null;
  const careLabel = /consumer\s*care|customer\s*care|complaint|helpline/i.test(text);
  const care = [email, phone].filter(Boolean).join(" / ") || null;
  fields.consumer_care = field(
    "consumer_care",
    care,
    careLabel && email && phone ? 0.9 : careLabel ? 0.78 : 0.55,
    lineWith(lines, /consumer\s*care|customer\s*care|helpline|@|\b\d{10}\b/i),
  );

  const origin = lineAfter(lines, /country\s*of\s*origin/i);
  fields.country_of_origin = field("country_of_origin", origin?.value ?? null, 0.82, origin?.evidence);

  const dateMatch =
    text.match(/(?:mfg|manufactur\w*|packed|pkd|date)[^\n]*?((?:0?[1-9]|1[0-2])\s*[/\-.]\s*(?:20)?\d{2})/i) ??
    text.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s*'?\s*(?:20)?\d{2}\b/i);
  const dateValue = dateMatch ? (dateMatch[1] ?? dateMatch[0]) : null;
  fields.date_of_manufacture = field(
    "date_of_manufacture",
    dateValue,
    /mfg|manufactur|packed|pkd/i.test(text) ? 0.8 : 0.55,
    lineWith(lines, /mfg|manufactur|packed|pkd|date/i) ?? dateMatch?.[0] ?? null,
  );

  // ---- food-specific declarations ----
  const vegLine = lineWith(lines, VEG_RE);
  const vegMatch = vegLine?.match(VEG_RE) ?? null;
  fields.veg_nonveg_mark = field(
    "veg_nonveg_mark",
    vegMatch ? vegMatch[0] : null,
    /non[\s-]?veg(?:etarian)?|vegetarian/i.test(vegMatch?.[0] ?? "") ? 0.85 : 0.5,
    vegLine,
  );

  const ingredients = lineAfter(lines, /ingredients?/i);
  fields.ingredients_list = field(
    "ingredients_list",
    ingredients?.value ?? null,
    ingredients && ingredients.value.includes(",") ? 0.85 : 0.6,
    ingredients?.evidence,
  );

  const fssaiMatch = text.match(FSSAI_RE);
  fields.fssai_licence = field(
    "fssai_licence",
    fssaiMatch ? fssaiMatch[1] : null,
    fssaiMatch && fssaiMatch[1].length === 14 ? 0.9 : 0.55,
    lineWith(lines, /fssai|lic(?:ence|ense)/i) ?? fssaiMatch?.[0] ?? null,
  );

  const bestBefore = lineAfter(lines, BEST_BEFORE_RE);
  fields.best_before = field(
    "best_before",
    bestBefore?.value ?? (lineWith(lines, BEST_BEFORE_RE) ?? null),
    bestBefore ? 0.82 : 0.5,
    bestBefore?.evidence ?? lineWith(lines, BEST_BEFORE_RE),
  );

  for (const key of FIELD_KEYS) {
    if (!fields[key]) fields[key] = emptyField(key);
    if (fields[key].value && source === "user_corrected") fields[key].source = "user_corrected";
  }

  const detected = FIELD_KEYS.filter((k) => fields[k].value).length;
  const ocr_confidence = textQuality(text, detected);

  return {
    raw_text: text,
    fields,
    ocr_confidence,
    engine:
      source === "user_corrected" ? "rule-based extractor (user-corrected text)" : "rule-based extractor",
    context: detectContext(text, fields),
  };
}

/**
 * Heuristic detector for garbled / low-quality extracted text. It looks for
 * OCR gap markers (runs of dots, question marks) rather than ordinary
 * punctuation, so decimal values are not treated as unreadable.
 */
export function degradedText(text: string): boolean {
  const stripped = text.replace(/\s/g, "");
  if (!stripped) return true;
  const garble = (stripped.match(/\.{2,}|\?/g) ?? []).join("").length;
  return garble / stripped.length > 0.05;
}

/**
 * Overall extraction-quality signal (0..1). This is an internal heuristic used
 * only to decide whether the absence of a declaration can be trusted — it is
 * not an OCR probability or a measure of AI accuracy.
 */
export function textQuality(text: string, detectedFields: number): number {
  if (text.trim().length < 20) return 0.2;
  if (degradedText(text)) return 0.25;
  return Math.min(0.95, 0.55 + (detectedFields / FIELD_KEYS.length) * 0.4);
}

/**
 * Merge AI/secondary extracted fields over the deterministic baseline.
 * A candidate only wins when it is new or more confident, and the source and
 * evidence of the winning value are preserved.
 */
export function mergeExtraction(
  base: ExtractedData,
  aiFields:
    | Record<string, { value?: string | null; confidence?: number; evidence?: string | null; source?: FieldSource }>
    | undefined,
  defaultSource: FieldSource = "ocr",
  engineLabel = "AI vision OCR + rule-based extractor",
): ExtractedData {
  if (!aiFields) return base;
  const fields = { ...base.fields };
  for (const key of FIELD_KEYS) {
    const ai = aiFields[key];
    const aiValue = ai?.value?.toString().trim();
    const aiConf = typeof ai?.confidence === "number" ? Math.max(0, Math.min(1, ai.confidence)) : 0.6;
    const current = fields[key];
    if (aiValue && aiValue.toLowerCase() !== "not detected" && aiValue !== "null") {
      if (!current.value || aiConf >= current.confidence) {
        fields[key] = {
          ...current,
          value: aiValue,
          confidence: aiConf,
          band: bandFor(aiConf),
          evidence: ai?.evidence?.trim() || current.evidence || findEvidence(base.raw_text, aiValue),
          source: ai?.source ?? defaultSource,
        };
      }
    }
  }
  const detected = FIELD_KEYS.filter((k) => fields[k].value).length;
  return {
    ...base,
    fields,
    ocr_confidence: textQuality(base.raw_text, detected),
    engine: engineLabel,
    context: detectContext(base.raw_text, fields),
  };
}

/** Locate the raw-text line containing a value — never fabricates evidence. */
export function findEvidence(rawText: string, value: string): string | null {
  const needle = value.trim().toLowerCase();
  if (!needle) return null;
  const line = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .find((l) => l.toLowerCase().includes(needle));
  return line ?? null;
}
