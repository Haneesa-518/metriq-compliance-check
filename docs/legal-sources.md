# Legal sources

## Primary reference

- **Legal Metrology (Packaged Commodities) Rules, 2011**, Department of Consumer Affairs, Ministry of
  Consumer Affairs, Food & Public Distribution, Government of India — including subsequent
  amendments.

## How this prototype uses it

- Rules are referenced at **rule-number level only** (e.g. "Rule 6"). No legislative text is quoted
  or paraphrased as authoritative wording anywhere in the application.
- Every record in `src/lib/legal/rules.data.ts` carries `status: "needs_verification"` and
  `last_verified: null`. A human reviewer must compare each record against the official published
  document and update these fields before the record is treated as verified.
- The application never presents an unverified rule as authoritative, and never claims government
  certification or legal validity.

## Verification checklist (for maintainers)

For each rule record:

1. Locate the corresponding provision in the official published document.
2. Confirm the `requirement` summary is accurate and non-misleading.
3. Confirm `applicability`, including exemptions the prototype does not model.
4. Set `status` to `active` (or `superseded`) and record the `last_verified` date.

## Out of scope

Commodity-specific rules, exemptions and thresholds, state enforcement procedures, and rules outside
the packaged-commodities declaration requirements.
