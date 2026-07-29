/**
 * SYNTHETIC SAMPLE DATA — for demonstration only.
 * These are fictional package texts written for this prototype. They are not
 * real product labels and contain no real company details.
 */
export interface DemoCase {
  id: string;
  label: string;
  description: string;
  raw_text: string;
}

export const DEMO_CASES: DemoCase[] = [
  {
    id: "demo-1",
    label: "Demo 1 — Complete declarations (synthetic)",
    description: "A sample label where all expected declarations are legible.",
    raw_text: `SAMPLE BRAND ATTA
Whole Wheat Flour
Net Quantity: 1 kg
MRP: Rs. 245.00 (incl. of all taxes)
Manufactured & Packed by: Sample Foods Private Limited
Plot 14, Industrial Area Phase II, Sampletown, Maharashtra 411001
Consumer care: care@samplefoods.example / 1800 123 4567
Mfg Date: 03/2026
Batch No: SF-2291
Synthetic sample data for demonstration`,
  },
  {
    id: "demo-2",
    label: "Demo 2 — Missing declarations (synthetic)",
    description: "A sample label with consumer care and date declarations absent.",
    raw_text: `SAMPLE SNACK MIX
Masala Flavour
Net Wt. 200 g
MRP Rs. 60
Packed by: Sample Snacks LLP, Sampletown 560001
Batch: SS-7781
Synthetic sample data for demonstration`,
  },
  {
    id: "demo-3",
    label: "Demo 3 — Poor quality scan (synthetic)",
    description: "A degraded sample where most declarations cannot be read confidently.",
    raw_text: `SAMPL... BR..D
N.t Q.a..ity 5.0 ?
M.R.. R... ..0
....d by Sam... .oods
Synthetic sample data for demonstration`,
  },
];
