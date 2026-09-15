import { createFileRoute, Link } from "@tanstack/react-router";
import { ScanLine, ShieldCheck, FileText, Layers, ArrowRight } from "lucide-react";
import { Navbar, Footer } from "@/components/Shell";
import { Button } from "@/components/ui/button";
import { DisclaimerNote } from "@/components/Analysis";
import { LEGAL_RULES } from "@/lib/legal/rules.data";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "MetriQ — AI Legal Metrology Compliance Checker" },
      {
        name: "description",
        content:
          "Upload a product label and identify potentially missing or problematic mandatory package declarations. Prototype compliance-assistance tool for pre-packaged commodities in India.",
      },
      { property: "og:title", content: "MetriQ — AI Legal Metrology Compliance Checker" },
      {
        property: "og:description",
        content:
          "AI-assisted label reading plus a deterministic rule engine to flag missing package declarations. Prototype, not legal advice.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const PIPELINE = [
  {
    icon: ScanLine,
    title: "AI extraction",
    text: "Vision OCR reads the label and proposes candidate declarations with confidence scores.",
  },
  {
    icon: Layers,
    title: "Legal knowledge layer",
    text: "Structured rule records with applicability, source document and verification status.",
  },
  {
    icon: ShieldCheck,
    title: "Deterministic rule engine",
    text: "Plain validation functions decide PASS / FAIL / REVIEW — never the language model.",
  },
  {
    icon: FileText,
    title: "Report",
    text: "Explained findings, rule references, recommendations and a printable report.",
  },
];

function Landing() {
  return (
    <div className="min-h-screen">
      <Navbar
        right={
          <Button asChild size="sm">
            <Link to="/check">Start Compliance Check</Link>
          </Button>
        }
      />
      <main>
        <section className="border-b border-border">
          <div className="mx-auto max-w-[1600px] px-4 py-20 sm:px-6 lg:py-28">
            <p className="label-caps">Pre-packaged commodities · India · Prototype</p>
            <h1 className="mt-4 max-w-3xl text-4xl font-semibold leading-tight sm:text-5xl">
              Analyze Product Compliance
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-relaxed text-muted-foreground">
              Upload a product label and identify potentially missing or problematic mandatory
              declarations.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link to="/check">
                  Start Compliance Check <ArrowRight className="ml-1 size-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="secondary">
                <Link to="/check" search={{ demo: true }}>
                  View Demo
                </Link>
              </Button>
            </div>
            <DisclaimerNote className="mt-8 max-w-2xl" />
          </div>
        </section>

        <section className="mx-auto max-w-[1600px] px-4 py-16 sm:px-6">
          <h2 className="text-lg font-semibold">How the pipeline is separated</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            AI assists with extraction. Compliance decisions are made by deterministic code against
            a structured rule dataset. A human makes the final call.
          </p>
          <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {PIPELINE.map((p) => (
              <div key={p.title} className="panel p-5">
                <p.icon className="size-5 text-primary" />
                <p className="mt-4 text-sm font-semibold">{p.title}</p>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{p.text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-[1600px] px-4 pb-16 sm:px-6">
          <div className="panel flex flex-wrap items-center justify-between gap-4 p-5">
            <div>
              <p className="text-sm font-semibold">{LEGAL_RULES.length} structured rule records</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Every record carries applicability, source document, source reference and a
                verification status. Nothing is presented as verified until a human confirms it.
              </p>
            </div>
            <Button asChild variant="secondary">
              <Link to="/rules">Open rule library</Link>
            </Button>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
