import { describe, expect, it } from "vitest";
import { declarationFor, extractEntityDeclarations } from "./roles";
import { extractFieldsFromText } from "./extract";

const lines = (t: string) =>
  t
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

describe("role-aware entity extraction", () => {
  it("reads the manufacturer from a contextual marker, not a bare company name", () => {
    const d = extractEntityDeclarations(
      lines(`Manufactured by: Sunrise Foods Pvt Ltd
      Plot 22, MIDC Industrial Area, Pune 411018`),
    );
    const mfr = declarationFor(d, "manufacturer");
    expect(mfr?.name).toContain("Sunrise Foods");
    expect(mfr?.address).toContain("411018");
  });

  it("treats 'Marketed by' as ambiguous rather than manufacturer", () => {
    const d = extractEntityDeclarations(lines("Marketed by: Alpha Retail India Ltd"));
    expect(declarationFor(d, "manufacturer")).toBeUndefined();
    expect(declarationFor(d, "ambiguous")?.role).toBe("ambiguous");
  });

  it("treats 'Distributed by' as ambiguous, never importer", () => {
    const d = extractEntityDeclarations(lines("Distributed by: Global Distributors LLP"));
    expect(declarationFor(d, "importer")).toBeUndefined();
    expect(declarationFor(d, "ambiguous")).toBeDefined();
  });

  it("separates importer from manufacturer on an imported pack", () => {
    const d = extractEntityDeclarations(
      lines(`Manufactured by Nordic Oils AS, Oslo, Norway
      Imported by Bharat Imports Pvt Ltd, Mumbai 400001`),
    );
    expect(declarationFor(d, "manufacturer")?.name).toContain("Nordic Oils");
    expect(declarationFor(d, "importer")?.name).toContain("Bharat Imports");
  });

  it("feeds the role results into the field extractor", () => {
    const data = extractFieldsFromText(
      `Packed by: Greenfield Packers, Nashik 422001
       Net Quantity: 500 g
       MRP Rs. 120`,
    );
    expect(data.fields.packer.value).toContain("Greenfield Packers");
    expect(data.fields.address.value).toContain("422001");
  });

  it("marks a marketing-only entity at low extraction confidence", () => {
    const data = extractFieldsFromText("Marketed by: Alpha Retail India Ltd\nNet Quantity: 1 kg");
    expect(data.fields.manufacturer.value).toContain("Alpha Retail");
    expect(data.fields.manufacturer.band).toBe("LOW");
  });
});
