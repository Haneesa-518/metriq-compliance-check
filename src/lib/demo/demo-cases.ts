/**
 * SYNTHETIC SAMPLE DATA — for demonstration only.
 * These are fictional package texts written for this prototype. They are not
 * real product labels and contain no real company details. They exist to show
 * how the deterministic engine behaves across edge cases.
 */
export interface DemoCase {
  id: string;
  label: string;
  description: string;
  expectation: string;
  raw_text: string;
}

export const DEMO_CASES: DemoCase[] = [
  {
    id: "demo-1",
    label: "Scenario A — Complete label (synthetic)",
    description: "A sample food label where every expected declaration is legible.",
    expectation: "Expected: mostly PASS.",
    raw_text: `SAMPLE BRAND ATTA
Whole Wheat Flour
Vegetarian
Net Quantity: 1 kg
MRP: Rs. 245.00 (incl. of all taxes)
Unit Sale Price: Rs. 245 per kg
Ingredients: Whole wheat, wheat bran, wheat germ
Manufactured & Packed by: Sample Foods Private Limited
Plot 14, Industrial Area Phase II, Sampletown, Maharashtra 411001
Consumer care: care@samplefoods.example / 1800 123 4567
Mfg Date: 03/2026
Best Before: 09/2026
FSSAI Licence No. 10012031000123
Batch No: SF-2291
Synthetic sample data for demonstration`,
  },
  {
    id: "demo-2",
    label: "Scenario B — Missing declarations (synthetic)",
    description: "Consumer care, date and unit sale price declarations are absent.",
    expectation: "Expected: FAIL results on the missing declarations.",
    raw_text: `SAMPLE SNACK MIX
Masala Flavour
Net Wt. 200 g
MRP Rs. 60
Packed by: Sample Snacks LLP, Sampletown 560001
Ingredients: Rice flakes, peanuts, salt
Batch: SS-7781
Synthetic sample data for demonstration`,
  },
  {
    id: "demo-3",
    label: "Scenario C — Ambiguous / poor OCR (synthetic)",
    description: "A degraded scan where most declarations cannot be read confidently.",
    expectation: "Expected: REVIEW results — never an automatic FAIL.",
    raw_text: `SAMPL... BR..D
N.t Q.a..ity 5.0 ?
M.R.. R... ..0
....d by Sam... .oods
Synthetic sample data for demonstration`,
  },
  {
    id: "demo-4",
    label: "Scenario D — Imported product (synthetic)",
    description: "An imported package carrying importer and country-of-origin declarations.",
    expectation: "Expected: conditional import rules become applicable.",
    raw_text: `SAMPLE OLIVE OIL
Extra Virgin
Vegetarian
Net Quantity: 1 l
MRP: Rs. 900.00 (incl. of all taxes)
Unit Sale Price: Rs. 900 per l
Ingredients: Extra virgin olive oil
Imported by: Sample Importers Private Limited
22 Harbour Road, Sampletown, Maharashtra 400001
Country of Origin: Spain
Consumer care: care@sampleimporters.example / 1800 222 3333
Packed on: 02/2026
Best Before: 02/2028
FSSAI Licence No. 10012031000456
Synthetic sample data for demonstration`,
  },
  {
    id: "demo-5",
    label: "Scenario E — Food label, partial food declarations (synthetic)",
    description: "A food package where the FSSAI licence number is incomplete.",
    expectation: "Expected: food checks active, FSSAI licence flagged for review.",
    raw_text: `SAMPLE FRUIT BISCUITS
Non-Vegetarian
Net Quantity: 250 g
MRP: Rs. 85.00 (incl. of all taxes)
Unit Sale Price: Rs. 340 per kg
Ingredients: Wheat flour, sugar, edible oil, milk solids, egg powder
Manufactured by: Sample Bakers Private Limited
9 Bakery Lane, Sampletown, Karnataka 560002
Consumer care: care@samplebakers.example / 1800 444 5555
Mfg Date: 01/2026
Best Before: 9 months from packing
FSSAI Licence No. 100120310
Synthetic sample data for demonstration`,
  },
  {
    id: "demo-6",
    label: "Scenario F — Domestic non-food product (synthetic)",
    description: "A household product with no food-related declarations.",
    expectation: "Expected: food-labelling rules become NOT APPLICABLE.",
    raw_text: `SAMPLE CLEAN DETERGENT POWDER
Net Quantity: 2 kg
MRP: Rs. 180.00 (incl. of all taxes)
Unit Sale Price: Rs. 90 per kg
Manufactured & Packed by: Sample Household Products Private Limited
5 Works Road, Sampletown, Tamil Nadu 600001
Consumer care: care@samplehousehold.example / 1800 555 6666
Mfg Date: 04/2026
Batch No: SH-3312
Synthetic sample data for demonstration`,
  },
];
