import { createFileRoute, Link } from "@tanstack/react-router";
import { Navbar, Footer } from "@/components/Shell";
import { RuleReferenceCard } from "@/components/Analysis";
import { Button } from "@/components/ui/button";
import { LEGAL_RULES } from "@/lib/legal/rules.data";

export const Route = createFileRoute("/rules")({
  head: () => ({
    meta: [
      { title: "Rule Library — MitraMet Compliance Checker" },
      {
        name: "description",
        content:
          "Structured Legal Metrology rule records used by the MitraMet prototype rule engine, each with applicability, source reference and verification status.",
      },
      { property: "og:title", content: "Rule Library — MitraMet Compliance Checker" },
      {
        property: "og:description",
        content: "Structured rule records with applicability, source reference and verification status.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RulesPage,
});

function RulesPage() {
  return (
    <div className="min-h-screen">
      <Navbar
        right={
          <Button asChild size="sm">
            <Link to="/check">New Analysis</Link>
          </Button>
        }
      />
      <main className="mx-auto max-w-[1600px] px-4 py-10 sm:px-6">
        <h1 className="text-xl font-semibold">Rule library</h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
          The legal knowledge layer is stored as structured data, separate from both the AI extraction
          layer and the UI. Rules reference the Legal Metrology (Packaged Commodities) Rules, 2011
          (Department of Consumer Affairs, Government of India) at rule-number level. No legislative
          wording is quoted, and every record below is marked{" "}
          <span className="font-mono">needs_verification</span> until confirmed against the official
          published document.
        </p>
        <div className="mt-8 grid gap-4 lg:grid-cols-2">
          {LEGAL_RULES.map((r) => (
            <RuleReferenceCard key={r.rule_id} ruleId={r.rule_id} />
          ))}
        </div>
      </main>
      <Footer />
    </div>
  );
}
