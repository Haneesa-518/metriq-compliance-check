import { describe, expect, it } from "vitest";
import { extractFieldsFromText } from "./extract";
import { runRuleEngine, summarize } from "./engine";
import { DEMO_CASES } from "@/lib/demo/demo-cases";
import { LEGAL_RULES, VERIFIED_CORE_RULES } from "@/lib/legal/rules.data";
import type { CheckResult } from "./types";

function engineFor(text: string) {
  return runRuleEngine(extractFieldsFromText(text));
}
function demo(id: string) {
  return engineFor(DEMO_CASES.find((d) => d.id === id)!.raw_text);
}
function find(checks: CheckResult[], field: string) {
  return checks.find((c) => c.field === field)!;
}

describe("field extraction", () => {
  it("reads net quantity and MRP", () => {
    const data = extractFieldsFromText("Net Quantity: 500 g\nMRP: Rs. 120.00");
    expect(data.fields.net_quantity.value).toBe("500 g");
    expect(data.fields.mrp.value).toContain("120");
  });

  it("marks undetected fields as unavailable", () => {
    const data = extractFieldsFromText("Just a brand name");
    expect(data.fields.consumer_care.value).toBeNull();
    expect(data.fields.consumer_care.source).toBe("unavailable");
  });

  it("assigns a confidence band to every field", () => {
    const data = extractFieldsFromText(DEMO_CASES[0].raw_text);
    for (const f of Object.values(data.fields)) {
      expect(["HIGH", "MEDIUM", "LOW"]).toContain(f.band);
    }
  });
});

describe("rule engine — positive cases", () => {
  it("passes a complete synthetic label", () => {
    const { summary } = demo("demo-1");
    expect(summary.failed).toBe(0);
    expect(summary.passed).toBeGreaterThanOrEqual(10);
  });

  it("validates a well-formed net quantity", () => {
    const { checks } = engineFor("SAMPLE\nNet Quantity: 500 g");
    expect(find(checks, "net_quantity").status).toBe("PASS");
  });

  it("validates MRP with currency and wording", () => {
    const { checks } = engineFor("SAMPLE\nMRP: Rs. 120.00");
    expect(find(checks, "mrp").status).toBe("PASS");
  });

  it("validates manufacturer with address", () => {
    const { checks } = engineFor(
      "SAMPLE\nManufactured by: Sample Foods Private Limited\nPlot 14, Sampletown, Maharashtra 411001",
    );
    expect(find(checks, "manufacturer").status).toBe("PASS");
  });

  it("validates consumer care from contact patterns", () => {
    const { checks } = engineFor(
      "SAMPLE\nConsumer care: care@sample.example / 1800 123 4567",
    );
    expect(find(checks, "consumer_care").status).toBe("PASS");
  });

  it("activates and passes food checks on a full food label", () => {
    const { checks } = demo("demo-1");
    for (const f of ["veg_nonveg_mark", "ingredients_list", "fssai_licence", "best_before"]) {
      expect(find(checks, f).status).toBe("PASS");
    }
  });
});

describe("rule engine — negative cases", () => {
  it("flags missing declarations without inventing values", () => {
    const { checks } = demo("demo-2");
    const care = find(checks, "consumer_care");
    expect(care.status).toBe("FAIL");
    expect(care.detected).toBeNull();
  });

  it("fails a missing MRP", () => {
    const { checks } = engineFor(
      "SAMPLE ITEM\nNet Quantity: 500 g\nPacked by: Sample Co, Sampletown 411001",
    );
    expect(find(checks, "mrp").status).toBe("FAIL");
  });

  it("fails a missing net quantity", () => {
    const { checks } = engineFor("SAMPLE ITEM\nMRP: Rs. 50");
    expect(find(checks, "net_quantity").status).toBe("FAIL");
  });

  it("fails a missing manufacturer / packer", () => {
    const { checks } = engineFor("SAMPLE ITEM\nNet Quantity: 500 g\nMRP: Rs. 50");
    expect(find(checks, "manufacturer").status).toBe("FAIL");
  });

  it("fails a missing unit sale price", () => {
    const { checks } = engineFor("SAMPLE ITEM\nNet Quantity: 500 g\nMRP: Rs. 50");
    expect(find(checks, "unit_sale_price").status).toBe("FAIL");
  });

  it("fails a missing date declaration", () => {
    const { checks } = engineFor("SAMPLE ITEM\nNet Quantity: 500 g\nMRP: Rs. 50");
    expect(find(checks, "date_of_manufacture").status).toBe("FAIL");
  });

  it("does not accept a quantity without a unit as valid", () => {
    const { checks } = engineFor("SAMPLE ITEM\nNet Quantity: 500\nMRP: Rs. 50");
    expect(find(checks, "net_quantity").status).not.toBe("PASS");
  });
});

describe("rule engine — ambiguous cases", () => {
  it("returns REVIEW rather than FAIL when text quality is poor", () => {
    const { checks } = demo("demo-3");
    expect(checks.some((c) => c.status === "REVIEW")).toBe(true);
    expect(checks.filter((c) => c.status === "FAIL").length).toBe(0);
  });

  it("reviews an MRP number with no retail-price wording", () => {
    const { checks } = engineFor("SAMPLE ITEM\nPrice 120\nNet Quantity: 500 g");
    expect(find(checks, "mrp").status).toBe("REVIEW");
  });

  it("reviews a partial FSSAI licence number", () => {
    const { checks } = demo("demo-5");
    expect(find(checks, "fssai_licence").status).toBe("REVIEW");
  });

  it("marks REVIEW results as requiring human verification", () => {
    const { checks } = demo("demo-3");
    for (const c of checks.filter((x) => x.status === "REVIEW")) {
      expect(c.requires_human_review).toBe(true);
    }
  });
});

describe("rule applicability", () => {
  it("treats import-only declarations as NOT_APPLICABLE for domestic packages", () => {
    const { checks } = demo("demo-1");
    expect(find(checks, "importer").status).toBe("NOT_APPLICABLE");
    expect(find(checks, "country_of_origin").status).toBe("NOT_APPLICABLE");
  });

  it("evaluates import declarations when the package indicates import", () => {
    const { checks } = demo("demo-4");
    expect(find(checks, "importer").status).not.toBe("NOT_APPLICABLE");
    expect(find(checks, "country_of_origin").status).toBe("PASS");
  });

  it("marks food rules NOT_APPLICABLE for a non-food product", () => {
    const { checks } = demo("demo-6");
    for (const f of ["veg_nonveg_mark", "ingredients_list", "fssai_licence", "best_before"]) {
      expect(find(checks, f).status).toBe("NOT_APPLICABLE");
    }
  });

  it("explains why a rule was not applicable", () => {
    const { checks } = demo("demo-6");
    expect(find(checks, "ingredients_list").applicability).toMatch(/food/i);
  });
});

describe("evidence layer", () => {
  it("returns evidence for detected declarations", () => {
    const { checks } = demo("demo-1");
    expect(find(checks, "net_quantity").evidence).toContain("1 kg");
    expect(find(checks, "mrp").evidence).toMatch(/MRP/i);
  });

  it("never fabricates evidence for undetected declarations", () => {
    const { checks } = demo("demo-2");
    expect(find(checks, "consumer_care").evidence).toBeNull();
  });

  it("returns layered validation steps for every evaluated check", () => {
    const { checks } = demo("demo-1");
    for (const c of checks) {
      expect(c.validations.length).toBeGreaterThan(0);
      expect(typeof c.message).toBe("string");
      expect(typeof c.recommended_action).toBe("string");
    }
  });
});

describe("scoring", () => {
  it("scores PASS=1, REVIEW=0.5, FAIL=0 over applicable checks", () => {
    const summary = summarize([
      { status: "PASS", category: "legal_metrology" },
      { status: "PASS", category: "legal_metrology" },
      { status: "REVIEW", category: "legal_metrology" },
      { status: "FAIL", category: "legal_metrology" },
      { status: "NOT_APPLICABLE", category: "food_labelling" },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ] as any);
    expect(summary.applicable).toBe(4);
    expect(summary.score).toBe(63);
    expect(summary.overall).toBe("NON_COMPLIANT");
  });

  it("excludes NOT_APPLICABLE checks from the score", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const summary = summarize([{ status: "PASS" }, { status: "NOT_APPLICABLE" }] as any);
    expect(summary.score).toBe(100);
    expect(summary.not_applicable).toBe(1);
  });

  it("surfaces critical issues separately from the score", () => {
    const { summary } = demo("demo-2");
    expect(summary.failed).toBeGreaterThan(0);
    expect(summary.critical_issues.length).toBe(summary.failed);
  });

  it("splits counts by category", () => {
    const { summary } = demo("demo-1");
    expect(summary.by_category.legal_metrology.passed).toBeGreaterThan(0);
    expect(summary.by_category.food_labelling.passed).toBe(4);
  });
});

describe("legal knowledge layer", () => {
  it("has a verified core rule set and unverified records", () => {
    expect(VERIFIED_CORE_RULES.length).toBeGreaterThan(0);
    expect(LEGAL_RULES.some((r) => r.status === "NEEDS_VERIFICATION")).toBe(true);
  });

  it("maps every evaluated check to a real rule record", () => {
    const { checks } = demo("demo-1");
    for (const c of checks) {
      expect(LEGAL_RULES.some((r) => r.rule_id === c.rule_reference)).toBe(true);
    }
  });
});

describe("e-commerce listing context", () => {
  const listingText = `Product title: Sample Brand Atta 1 kg
Net quantity: 1 kg
MRP: Rs. 245.00
Manufacturer: Sample Foods Private Limited, Plot 14, Sampletown, Maharashtra 411001
Consumer care: care@samplefoods.example / 1800 123 4567
Ingredients: Whole wheat, wheat bran`;

  function listingResult() {
    const base = extractFieldsFromText(listingText, "page_text");
    return runRuleEngine({ ...base, analysis_context: "ecommerce_listing" });
  }

  it("does not FAIL a physical-package-only declaration missing from a listing", () => {
    const { checks } = listingResult();
    const date = checks.find((c) => c.field === "date_of_manufacture");
    expect(date?.status).toBe("REVIEW");
    expect(date?.requires_human_review).toBe(true);
  });

  it("still evaluates listing-mandated declarations normally", () => {
    const { checks } = listingResult();
    expect(checks.find((c) => c.field === "net_quantity")?.status).toBe("PASS");
    expect(checks.find((c) => c.field === "mrp")?.status).toBe("PASS");
  });

  it("keeps package-only rules failing for physical package analysis", () => {
    const base = extractFieldsFromText(listingText, "ocr");
    const { checks } = runRuleEngine(base);
    expect(checks.find((c) => c.field === "date_of_manufacture")?.status).toBe("FAIL");
  });
});
