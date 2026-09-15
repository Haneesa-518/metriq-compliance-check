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

const MODEL = "openai/gpt-5.6-sol";

/** Single gateway call with bounded retry for transient (429 / 5xx) failures. */
async function callGateway(body: unknown, attempt = 0): Promise<string> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("AI_KEY_MISSING");

  let res: Response;
  try {
    res = await fetch(GATEWAY, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": key },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error("AI_TIMEOUT");
  }

  if (res.status === 402) throw new Error("AI_CREDITS");
  if (res.status === 403) throw new Error("AI_BLOCKED");
  if (res.status === 429 || res.status >= 500) {
    if (attempt >= 2)
      throw new Error(res.status === 429 ? "AI_RATE_LIMIT" : `AI_ERROR_${res.status}`);
    const retryAfter = Number(res.headers.get("retry-after") ?? 0);
    const waitMs = retryAfter > 0 ? retryAfter * 1000 : 800 * 2 ** attempt + Math.random() * 300;
    await new Promise((r) => setTimeout(r, waitMs));
    return callGateway(body, attempt + 1);
  }
  if (!res.ok) throw new Error(`AI_ERROR_${res.status}`);

  const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return json.choices?.[0]?.message?.content ?? "";
}

function stripFences(content: string): string {
  return content
    .replace(/^\s*```(?:json)?/i, "")
    .replace(/```\s*$/, "")
    .trim();
}

/** Pull the first balanced JSON object out of a partially prose response. */
function extractJsonObject(content: string): string | null {
  const start = content.indexOf("{");
  const end = content.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  return content.slice(start, end + 1);
}

export async function runOcr(imageDataUrl: string): Promise<OcrResult> {
  const visionMessages = (instruction: string, system?: string) => [
    ...(system ? [{ role: "system", content: system }] : []),
    {
      role: "user",
      content: [
        { type: "text", text: instruction },
        { type: "image_url", image_url: { url: imageDataUrl } },
      ],
    },
  ];

  const content = await callGateway({
    model: MODEL,
    reasoning_effort: "none",
    messages: visionMessages(
      "Read this product package label and extract the fields.",
      SYSTEM_PROMPT,
    ),
  });

  const cleaned = stripFences(content);
  let parsed: Partial<OcrResult> | null = null;
  try {
    parsed = JSON.parse(cleaned) as Partial<OcrResult>;
  } catch {
    const candidate = extractJsonObject(cleaned);
    if (candidate) {
      try {
        parsed = JSON.parse(candidate) as Partial<OcrResult>;
      } catch {
        parsed = null;
      }
    }
  }

  const raw_text = typeof parsed?.raw_text === "string" ? parsed.raw_text.trim() : "";
  const fields = (parsed?.fields ?? {}) as OcrResult["fields"];
  const hasFieldValues = Object.values(fields).some((f) => f && f.value);

  if (raw_text || hasFieldValues) {
    return {
      raw_text,
      fields,
      provider: parsed ? "lovable-ai-vision" : "lovable-ai-vision (recovered JSON)",
    };
  }

  // Structured extraction produced nothing usable. Never discard a readable
  // image because of a malformed response — ask for a plain transcription and
  // let the deterministic extractor work from that text.
  if (!parsed && cleaned.length > 20) {
    return {
      raw_text: cleaned.slice(0, 6000),
      fields: {},
      provider: "lovable-ai-vision (unstructured response)",
    };
  }

  const transcript = await callGateway({
    model: MODEL,
    reasoning_effort: "none",
    messages: visionMessages(
      "Transcribe every piece of text visible in this product label photograph, line by line, exactly as printed. Output plain text only. If no text is legible, reply with the single word NONE.",
    ),
  });

  const text = stripFences(transcript).trim();
  if (!text || /^none$/i.test(text)) {
    return { raw_text: "", fields: {}, provider: "lovable-ai-vision (no text found)" };
  }
  return {
    raw_text: text.slice(0, 6000),
    fields: {},
    provider: "lovable-ai-vision (plain transcription)",
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
  fields: Record<
    string,
    { value: string | null; confidence: number; evidence?: string | null; source?: string }
  >;
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
  const cleaned = content
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "")
    .trim();
  try {
    const parsed = JSON.parse(cleaned) as Partial<PageFieldExtraction>;
    return { fields: parsed.fields ?? {}, provider: "lovable-ai-text" };
  } catch {
    return { fields: {}, provider: "lovable-ai-text (unparsed)" };
  }
}
