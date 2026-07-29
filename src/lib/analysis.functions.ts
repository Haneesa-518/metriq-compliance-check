import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { extractFieldsFromText, mergeExtraction } from "@/lib/compliance/extract";
import { runRuleEngine } from "@/lib/compliance/engine";
import { LEGAL_RULES } from "@/lib/legal/rules.data";
import { runOcr } from "@/lib/ocr.server";

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

const AnalyzeImageInput = z.object({
  image_data_url: z
    .string()
    .regex(/^data:image\/(png|jpe?g);base64,/i, "Only JPG/JPEG or PNG images are supported.")
    .max(Math.ceil(MAX_IMAGE_BYTES * 1.4), "Image is too large (max 8 MB)."),
});

const AnalyzeTextInput = z.object({
  raw_text: z.string().min(1).max(20000),
  user_corrected: z.boolean().optional(),
});

export const analyzeImage = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => AnalyzeImageInput.parse(d))
  .handler(async ({ data }) => {
    const ocr = await runOcr(data.image_data_url);
    if (!ocr.raw_text.trim() && Object.keys(ocr.fields).length === 0) {
      throw new Error("OCR_EMPTY");
    }
    const baseline = extractFieldsFromText(ocr.raw_text);
    const extracted = mergeExtraction(baseline, ocr.fields);
    const result = runRuleEngine(extracted);
    return { extracted: { ...extracted, engine: `${ocr.provider} + rule-based extractor` }, ...result };
  });

export const analyzeText = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => AnalyzeTextInput.parse(d))
  .handler(async ({ data }) => {
    const extracted = extractFieldsFromText(
      data.raw_text,
      data.user_corrected ? "user_corrected" : "ocr",
    );
    const result = runRuleEngine(extracted);
    return { extracted, ...result };
  });

export const getRules = createServerFn({ method: "GET" }).handler(async () => LEGAL_RULES);
