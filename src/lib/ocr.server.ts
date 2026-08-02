/**
 * AI / OCR layer — deliberately separated from the legal rule engine.
 * This module ONLY reads text and proposes candidate field values with
 * confidence. It never decides compliance.
 */

const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

export interface OcrResult {
  raw_text: string;
  fields: Record<string, { value: string | null; confidence: number }>;
  provider: string;
}

const SYSTEM_PROMPT = `You are an OCR and information-extraction assistant for product packaging photographs from India.
Your ONLY job is to read text and report what you can see. You must NEVER judge legal compliance and never invent values.
Return strict JSON with this shape:
{
  "raw_text": "<all text visible on the package, line by line>",
  "fields": {
    "product_name": {"value": string|null, "confidence": number},
    "manufacturer": {"value": string|null, "confidence": number},
    "packer": {"value": string|null, "confidence": number},
    "importer": {"value": string|null, "confidence": number},
    "address": {"value": string|null, "confidence": number},
    "net_quantity": {"value": string|null, "confidence": number},
    "mrp": {"value": string|null, "confidence": number},
    "unit_sale_price": {"value": string|null, "confidence": number},
    "consumer_care": {"value": string|null, "confidence": number},
    "country_of_origin": {"value": string|null, "confidence": number},
    "date_of_manufacture": {"value": string|null, "confidence": number},
    "veg_nonveg_mark": {"value": string|null, "confidence": number},
    "ingredients_list": {"value": string|null, "confidence": number},
    "fssai_licence": {"value": string|null, "confidence": number},
    "best_before": {"value": string|null, "confidence": number}
  }
}
Use null when a value is not visible. Never calculate or infer a value that is not printed (for example, never derive unit sale price from MRP).
confidence is 0..1 and reflects how clearly you could read the value.
Output JSON only, no markdown fences.`;

export async function runOcr(imageDataUrl: string): Promise<OcrResult> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) {
    throw new Error("AI_KEY_MISSING");
  }

  const res = await fetch(GATEWAY, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": key,
    },
    body: JSON.stringify({
      model: "openai/gpt-5.6-sol",
      reasoning_effort: "none",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            { type: "text", text: "Read this product package label and extract the fields." },
            { type: "image_url", image_url: { url: imageDataUrl } },
          ],
        },
      ],
    }),
  });

  if (res.status === 429) throw new Error("AI_RATE_LIMIT");
  if (res.status === 402) throw new Error("AI_CREDITS");
  if (!res.ok) {
    throw new Error(`AI_ERROR_${res.status}`);
  }

  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = json.choices?.[0]?.message?.content ?? "";
  const cleaned = content.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();

  let parsed: Partial<OcrResult>;
  try {
    parsed = JSON.parse(cleaned) as Partial<OcrResult>;
  } catch {
    // Malformed model response: fall back to using the raw text only.
    return { raw_text: content.slice(0, 4000), fields: {}, provider: "lovable-ai-vision (unstructured)" };
  }

  return {
    raw_text: typeof parsed.raw_text === "string" ? parsed.raw_text : "",
    fields: (parsed.fields ?? {}) as OcrResult["fields"],
    provider: "lovable-ai-vision",
  };
}

/**
 * Text-based product-information extraction for e-commerce listings.
 * Same rule as the vision layer: it only reports what it can see and never
 * decides legal compliance. The deterministic rule engine does that.
 */
const PAGE_SYSTEM_PROMPT = `You are an information-extraction assistant for Indian e-commerce product listings.
Your ONLY job is to identify declarations that are literally present in the supplied listing content.
You must NEVER judge legal compliance and never invent, calculate or infer values that are not printed.
Return strict JSON with this shape:
{
  "fields": {
    "<field_key>": {"value": string|null, "confidence": number, "evidence": string|null, "source": "page_title"|"description"|"specification"|"page_text"}
  }
}
field_key is one of: product_name, manufacturer, packer, importer, address, net_quantity, mrp, unit_sale_price, consumer_care, country_of_origin, date_of_manufacture, veg_nonveg_mark, ingredients_list, fssai_licence, best_before.
"evidence" MUST be the exact fragment of the supplied content that the value came from, copied verbatim. Use null when a value is not present.
confidence is 0..1. Output JSON only, no markdown fences.`;

export interface PageFieldExtraction {
  fields: Record<string, { value: string | null; confidence: number; evidence?: string | null; source?: string }>;
  provider: string;
}

export async function runPageFieldExtraction(pageText: string): Promise<PageFieldExtraction> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("AI_KEY_MISSING");

  const res = await fetch(GATEWAY, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Lovable-API-Key": key },
    body: JSON.stringify({
      model: "openai/gpt-5.6-sol",
      reasoning_effort: "none",
      messages: [
        { role: "system", content: PAGE_SYSTEM_PROMPT },
        {
          role: "user",
          content: `Extract the declarations from this product listing content.\n\n${pageText.slice(0, 12000)}`,
        },
      ],
    }),
  });

  if (res.status === 429) throw new Error("AI_RATE_LIMIT");
  if (res.status === 402) throw new Error("AI_CREDITS");
  if (!res.ok) throw new Error(`AI_ERROR_${res.status}`);

  const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = json.choices?.[0]?.message?.content ?? "";
  const cleaned = content.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  try {
    const parsed = JSON.parse(cleaned) as Partial<PageFieldExtraction>;
    return { fields: parsed.fields ?? {}, provider: "lovable-ai-text" };
  } catch {
    return { fields: {}, provider: "lovable-ai-text (unparsed)" };
  }
}
