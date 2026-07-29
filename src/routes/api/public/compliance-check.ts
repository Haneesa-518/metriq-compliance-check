import { createFileRoute } from "@tanstack/react-router";
import { extractFieldsFromText } from "@/lib/compliance/extract";
import { runRuleEngine } from "@/lib/compliance/engine";
import { LEGAL_RULES } from "@/lib/legal/rules.data";

const CORS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export const Route = createFileRoute("/api/public/compliance-check")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      GET: async () => Response.json({ rules: LEGAL_RULES }, { headers: CORS }),
      POST: async ({ request }) => {
        try {
          const body = (await request.json()) as { raw_text?: string };
          const text = typeof body.raw_text === "string" ? body.raw_text.slice(0, 20000) : "";
          if (!text.trim()) {
            return new Response(JSON.stringify({ error: "raw_text is required" }), {
              status: 400,
              headers: CORS,
            });
          }
          const extracted = extractFieldsFromText(text);
          const result = runRuleEngine(extracted);
          return Response.json({ extracted, ...result }, { headers: CORS });
        } catch {
          return new Response(JSON.stringify({ error: "Malformed request" }), {
            status: 400,
            headers: CORS,
          });
        }
      },
    },
  },
});
