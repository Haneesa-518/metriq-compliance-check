# MitraMet — AI Legal Metrology Compliance Checker

A hackathon MVP that reads a photo of a pre-packaged commodity label, extracts the declarations
printed on it, and checks them against a **structured Legal Metrology rule dataset** using a
**deterministic rule engine**.

> **Disclaimer.** MitraMet is a compliance-assistance prototype. It is **not legal advice**, is not
> affiliated with or certified by any government body, and its output is **not legally binding**.
> Rule records are marked `needs_verification` until confirmed by a human against the official
> published documents. A 100% prototype score does **not** guarantee legal compliance.

## Problem

Pre-packaged commodities sold in India must carry mandatory declarations (commodity name, net
quantity, retail sale price, manufacturer/packer details, consumer care details, and more, per the
Legal Metrology (Packaged Commodities) Rules, 2011). Manually auditing labels at scale is slow and
inconsistent.

## Solution

Four strictly separated layers:

| Layer | Responsibility | Where |
| --- | --- | --- |
| AI extraction | Read text from the image, propose candidate field values + confidence | `src/lib/ocr.server.ts` |
| Legal knowledge | Structured rule records (requirement, applicability, source, status) | `src/lib/legal/rules.data.ts` |
| Deterministic validation | `check_*` functions returning PASS / FAIL / REVIEW / NOT_APPLICABLE | `src/lib/compliance/engine.ts` |
| UI presentation | Upload flow, dashboard, report | `src/routes`, `src/components` |

**The language model never decides compliance.** It only assists with extraction. Every status is
produced by plain, testable code.

## Architecture

```text
Image
  ↓  AI vision OCR (src/lib/ocr.server.ts)
Raw text + candidate fields
  ↓  Deterministic extractor (src/lib/compliance/extract.ts)
Structured JSON fields (value, confidence, source)
  ↓  Applicability determination + rule evaluation (src/lib/compliance/engine.ts)
Compliance result (checks, summary, recommendations)
  ↓
Dashboard + printable report
```

## Tech stack

Lovable's supported stack is used instead of the originally requested Flask/Python backend
(Python services cannot run on this platform):

- React 19 + TanStack Start (full-stack React, SSR + typed server functions) + Vite
- TypeScript, Tailwind CSS v4 design tokens, shadcn/ui primitives
- Server functions (`createServerFn`) replace the Flask REST layer for app-internal calls
- One public REST endpoint (`/api/public/compliance-check`) for external callers
- Vitest for rule-engine tests
- Lovable AI Gateway for vision OCR

## Folder structure

```text
src/
├── components/            UI components (UploadZone, Analysis dashboard parts, badges, shell)
├── lib/
│   ├── analysis.functions.ts   Server functions: analyzeImage, analyzeText, getRules
│   ├── ocr.server.ts           AI/OCR layer (replaceable provider)
│   ├── analysis-store.ts       Session persistence for analyses
│   ├── compliance/
│   │   ├── types.ts            Shared types
│   │   ├── extract.ts          Deterministic field extraction
│   │   ├── engine.ts           Rule engine (check_* functions, scoring)
│   │   └── engine.test.ts      Rule engine tests
│   ├── legal/rules.data.ts     Structured rule dataset
│   └── demo/demo-cases.ts      Synthetic demo samples
├── routes/
│   ├── index.tsx               Landing page
│   ├── check.tsx               Upload + demo mode
│   ├── analysis.$id.tsx        Compliance dashboard
│   ├── report.$id.tsx          Printable report
│   ├── rules.tsx               Rule library
│   └── api/public/compliance-check.ts   Public REST endpoint
└── services/api.ts        Frontend service layer (UI never calls the backend directly)
```

## Running

```bash
bun install
bun run dev        # http://localhost:8080
bunx vitest run    # rule engine tests
```

## Environment variables

See `.env.example`. `LOVABLE_API_KEY` is provisioned automatically by Lovable and is read **only**
inside server handlers — it is never exposed to the browser. No secrets are committed.

## API

App-internal (typed server functions, called through `src/services/api.ts`):

- `analyzeImage({ image_data_url })` → extracted fields + checks + summary
- `analyzeText({ raw_text, user_corrected })` → re-run the rule engine on corrected text
- `getRules()` → the rule dataset

Public HTTP endpoint:

- `GET /api/public/compliance-check` → `{ rules: [...] }`
- `POST /api/public/compliance-check` with `{ "raw_text": "..." }` → `{ extracted, checks, summary, recommendations }`

## Demo instructions

Open **Compliance Check → Demo mode** and run any of the three synthetic cases:

1. Complete declarations
2. Missing declarations (consumer care / date absent)
3. Poor-quality scan → returns *Needs Manual Review*

Demo mode runs fully offline — no API key or external service required. All demo text is fictional
and labelled as synthetic sample data.

## Rule data structure

```jsonc
{
  "rule_id": "LMPCR-2011-R6-NET-QUANTITY",
  "rule_code": "PCR/6/net-quantity",
  "title": "Net quantity declaration",
  "requirement": "…",
  "applicability": "…",
  "field": "net_quantity",
  "validation_type": "format",
  "source_document": "Legal Metrology (Packaged Commodities) Rules, 2011 — Department of Consumer Affairs, GoI",
  "source_reference": "Rule 6 read with Rule 8",
  "status": "needs_verification",
  "last_verified": null
}
```

No legislative wording is quoted, and no rule is treated as authoritative while its status is
`needs_verification`.

## Scoring

Per applicable check: PASS = 1, REVIEW = 0.5, FAIL = 0; NOT_APPLICABLE checks are excluded.
Score = points / applicable checks. This is a prototype risk indicator only.

## Limitations

- Rule coverage is intentionally narrow (core Rule 6 declarations); exemptions, commodity-specific
  rules and state enforcement procedures are out of scope.
- OCR quality dominates results; low-confidence extraction yields REVIEW rather than FAIL.
- Analyses are stored in the browser session, not in a server database. Uploaded images are sent for
  extraction only and are not persisted server-side.

## Future improvements

Persistent database (products, analyses, rules, reports), human rule-verification workflow,
commodity-specific rule sets, batch auditing, PDF export service, and multilingual label support.
