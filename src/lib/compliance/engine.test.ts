import { describe, expect, it } from "vitest";
import { extractFieldsFromText } from "./extract";
import { runRuleEngine, summarize } from "./engine";
import { DEMO_CASES } from "@/lib/demo/demo-cases";

function engineFor(text: string) {
  return runRuleEngine(extractFieldsFromText(text));
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
});

describe("rule engine", () => {
  it("passes a complete synthetic label", () => {
    const { summary, checks } = engineFor(DEMO_CASES[0].raw_text);
    expect(summary.failed).toBe(0);
    expect(checks.every((c) => c.rule_reference.startsWith("LMPCR"))).toBe(true);
  });

  it("flags missing declarations without inventing values", () => {
    const { checks } = engineFor(DEMO_CASES[1].raw_text);
    const care = checks.find((c) => c.field === "consumer_care");
    expect(care?.status).toBe("FAIL");
    expect(care?.detected).toBeNull();
  });

  it("returns REVIEW rather than FAIL when text quality is poor", () => {
    const { checks } = engineFor(DEMO_CASES[2].raw_text);
    expect(checks.some((c) => c.status === "REVIEW")).toBe(true);
  });

  it("treats import-only declarations as NOT_APPLICABLE for domestic packages", () => {
    const { checks } = engineFor(DEMO_CASES[0].raw_text);
    expect(checks.find((c) => c.field === "importer")?.status).toBe("NOT_APPLICABLE");
    expect(checks.find((c) => c.field === "country_of_origin")?.status).toBe("NOT_APPLICABLE");
  });

  it("evaluates import declarations when the package indicates import", () => {
    const { checks } = engineFor(
      "SAMPLE OLIVE OIL\nNet Quantity 1 l\nMRP Rs. 900\nImported by: Sample Importers Pvt Ltd, Sampletown 400001\nCountry of Origin: Spain",
    );
    expect(checks.find((c) => c.field === "importer")?.status).not.toBe("NOT_APPLICABLE");
  });
});

describe("scoring", () => {
  it("scores PASS=1, REVIEW=0.5, FAIL=0 over applicable checks", () => {
    const summary = summarize([
      { status: "PASS" },
      { status: "PASS" },
      { status: "REVIEW" },
      { status: "FAIL" },
      { status: "NOT_APPLICABLE" },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ] as any);
    expect(summary.applicable).toBe(4);
    expect(summary.score).toBe(63);
    expect(summary.overall).toBe("NON_COMPLIANT");
  });
});
