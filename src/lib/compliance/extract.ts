import type { ExtractedData, ExtractedField, FieldSource } from "./types";

export const FIELD_LABELS: Record<string, string> = {
  product_name: "Product / commodity name",
  manufacturer: "Manufacturer",
  packer: "Packer",
  importer: "Importer",
  address: "Address",
  net_quantity: "Net quantity",
  mrp: "Retail sale price (MRP)",
  consumer_care: "Consumer care details",
  country_of_origin: "Country of origin",
  date_of_manufacture: "Month & year of manufacture / packing",
};

export const FIELD_KEYS = Object.keys(FIELD_LABELS);

export function emptyField(key: string): ExtractedField {
  return {
    key,
    label: FIELD_LABELS[key] ?? key,
    value: null,
    confidence: 0,
    source: "unavailable",
  };
}

function field(
  key: string,
  value: string | null,
  confidence: number,
  source: FieldSource = "ocr",
): ExtractedField {
  const clean = value?.trim() ? value.trim() : null;
  return {
    key,
    label: FIELD_LABELS[key] ?? key,
    value: clean,
    confidence: clean ? Math.max(0, Math.min(1, confidence)) : 0,
    source: clean ? source : "unavailable",
  };
}

const NET_QTY_RE =
  /(?:net\s*(?:qty|quantity|wt|weight|vol|volume)\s*[:.\-]?\s*)?(\d+(?:[.,]\d+)?)\s*(kg|g|gm|gms|grams?|mg|l|ltr|litres?|liters?|ml|n|no\.?s?|pieces?|pcs)\b/i;
const MRP_RE =
  /(?:m\.?r\.?p\.?|maximum\s+retail\s+price|retail\s+sale\s+price|price)\s*[:.\-]?\s*(?:rs\.?|inr|₹)?\s*(\d+(?:[.,]\d{1,2})?)/i;
const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.]+/;
const PHONE_RE = /(?:\+91[\s-]?)?(?:1800[\s-]?\d{3}[\s-]?\d{3,4}|\b\d{10}\b)/;
const PIN_RE = /\b\d{6}\b/;

function lineAfter(lines: string[], re: RegExp): string | null {
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(re);
    if (m) {
      const rest = lines[i].slice((m.index ?? 0) + m[0].length).replace(/^[:.\-\s]+/, "");
      if (rest.trim().length > 2) return rest.trim();
      if (lines[i + 1]?.trim()) return lines[i + 1].trim();
    }
  }
  return null;
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
  const nameLine =
    lineAfter(lines, /product\s*name|commodity/i) ??
    lines.find(
      (l) =>
        l.length >= 3 &&
        l.length <= 60 &&
        !NET_QTY_RE.test(l) &&
        !MRP_RE.test(l) &&
        !/mfg|manufactur|packed|import|customer|consumer|care|address|email|www/i.test(l),
    ) ??
    null;
  fields.product_name = field("product_name", nameLine, nameLine ? 0.72 : 0);

  const manufacturer = lineAfter(lines, /manufactured\s*(?:&|and)?\s*(?:packed)?\s*by|mfd?\.?\s*by|manufacturer/i);
  fields.manufacturer = field("manufacturer", manufacturer, 0.78);

  const packer = lineAfter(lines, /packed\s*by|packer/i);
  fields.packer = field("packer", packer, 0.7);

  const importer = lineAfter(lines, /imported\s*by|importer/i);
  fields.importer = field("importer", importer, 0.78);

  const addressLine =
    lines.find((l) => PIN_RE.test(l) && l.length > 10) ??
    lineAfter(lines, /address/i) ??
    null;
  fields.address = field("address", addressLine, addressLine && PIN_RE.test(addressLine) ? 0.8 : 0.5);

  const qtyMatch = text.match(NET_QTY_RE);
  fields.net_quantity = field(
    "net_quantity",
    qtyMatch ? `${qtyMatch[1]} ${qtyMatch[2]}` : null,
    /net\s*(qty|quantity|wt|weight|vol|volume)/i.test(text) ? 0.9 : 0.6,
  );

  const mrpMatch = text.match(MRP_RE);
  fields.mrp = field("mrp", mrpMatch ? `₹ ${mrpMatch[1]}` : null, 0.86);

  const email = text.match(EMAIL_RE)?.[0] ?? null;
  const phone = text.match(PHONE_RE)?.[0] ?? null;
  const careLabel = /consumer\s*care|customer\s*care|complaint|helpline/i.test(text);
  const care = [email, phone].filter(Boolean).join(" / ") || null;
  fields.consumer_care = field("consumer_care", care, careLabel ? 0.85 : 0.6);

  const origin = lineAfter(lines, /country\s*of\s*origin/i);
  fields.country_of_origin = field("country_of_origin", origin, 0.82);

  const date =
    text.match(/(?:mfg|manufactur\w*|packed|pkd|date)[^\n]*?((?:0?[1-9]|1[0-2])\s*[/\-.]\s*(?:20)?\d{2})/i)?.[1] ??
    text.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s*'?\s*(?:20)?\d{2}\b/i)?.[0] ??
    null;
  fields.date_of_manufacture = field("date_of_manufacture", date, 0.75);

  for (const key of FIELD_KEYS) {
    if (!fields[key]) fields[key] = emptyField(key);
    if (fields[key].value && source === "user_corrected") fields[key].source = "user_corrected";
  }

  const detected = FIELD_KEYS.filter((k) => fields[k].value).length;
  const ocr_confidence = text.trim().length < 20 ? 0.2 : Math.min(0.95, 0.35 + detected / FIELD_KEYS.length);

  return {
    raw_text: text,
    fields,
    ocr_confidence,
    engine: source === "user_corrected" ? "rule-based extractor (user-corrected text)" : "rule-based extractor",
  };
}

/** Merge AI-extracted fields over the deterministic baseline. */
export function mergeExtraction(
  base: ExtractedData,
  aiFields: Record<string, { value?: string | null; confidence?: number }> | undefined,
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
        fields[key] = { ...current, value: aiValue, confidence: aiConf, source: "ocr" };
      }
    }
  }
  const detected = FIELD_KEYS.filter((k) => fields[k].value).length;
  return {
    ...base,
    fields,
    ocr_confidence: Math.min(0.95, 0.35 + detected / FIELD_KEYS.length),
    engine: "AI vision OCR + rule-based extractor",
  };
}
