import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { FileDown, RefreshCw } from "lucide-react";
import { Navbar, Sidebar, Footer } from "@/components/Shell";
import {
  ComplianceSummaryCard,
  ComplianceTable,
  OCRTextPanel,
  ProductInfoCards,
  RecommendationCard,
  RuleReferenceCard,
  DisclaimerNote,
} from "@/components/Analysis";
import { ImagePreview } from "@/components/Upload";
import { Button } from "@/components/ui/button";
import { getAnalysis } from "@/lib/analysis-store";
import { friendlyError, reanalyzeText } from "@/services/api";
import type { AnalysisRecord } from "@/lib/compliance/types";

export const Route = createFileRoute("/analysis/$id")({
  head: () => ({
    meta: [
      { title: "Compliance Analysis — MetriQ" },
      {
        name: "description",
        content:
          "Extracted package declarations, deterministic compliance checks with PASS / FAIL / REVIEW status, rule references and recommended actions.",
      },
      { property: "og:title", content: "Compliance Analysis — MetriQ" },
      {
        property: "og:description",
        content: "Package declaration checks with rule references and recommended actions.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AnalysisPage,
});

const SECTIONS = [
  { id: "summary", label: "Summary" },
  { id: "product", label: "Product information" },
  { id: "ocr", label: "Extracted text" },
  { id: "checks", label: "Compliance checks" },
  { id: "rules", label: "Rule references" },
  { id: "recommendations", label: "Recommendations" },
];

function AnalysisPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [record, setRecord] = useState<AnalysisRecord | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void getAnalysis(id).then((r) => {
      if (!active) return;
      setRecord(r);
      setLoaded(true);
    });
    return () => {
      active = false;
    };
  }, [id]);

  async function handleReanalyze(text: string) {
    if (!record) return;
    setBusy(true);
    setError(null);
    try {
      setRecord(await reanalyzeText(record, text));
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  }

  if (!loaded) return null;

  if (!record) {
    return (
      <div className="min-h-screen">
        <Navbar />
        <main className="mx-auto max-w-xl px-4 py-24 text-center">
          <h1 className="text-lg font-semibold">Analysis not found</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Analyses are stored in your browser session only, so this one may have expired.
          </p>
          <Button asChild className="mt-6">
            <Link to="/check">Start a new analysis</Link>
          </Button>
        </main>
        <Footer />
      </div>
    );
  }

  const uniqueRules = Array.from(new Set(record.checks.map((c) => c.rule_reference)));

  return (
    <div className="min-h-screen">
      <Navbar
        right={
          <>
            <Button asChild size="sm" variant="secondary" className="no-print">
              <Link to="/report/$id" params={{ id: record.id }}>
                <FileDown className="mr-1 size-3.5" /> Generate report
              </Link>
            </Button>
            <Button size="sm" className="no-print" onClick={() => navigate({ to: "/check" })}>
              <RefreshCw className="mr-1 size-3.5" /> New analysis
            </Button>
          </>
        }
      />
      <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-border pb-4 text-xs text-muted-foreground">
          <span>
            Analysis ID <span className="font-mono text-foreground">{record.id}</span>
          </span>
          <span>{new Date(record.created_at).toLocaleString()}</span>
          <span>Extraction engine: {record.extracted.engine}</span>
          <span>
            Analysis source:{" "}
            <span className="font-medium text-foreground">
              {record.analysis_source === "ecommerce_url"
                ? "E-commerce product URL"
                : "Uploaded product image"}
            </span>
          </span>
          {record.is_demo && (
            <span className="rounded border border-primary/40 bg-primary/10 px-2 py-0.5 font-semibold text-primary">
              DEMO · SYNTHETIC SAMPLE DATA
            </span>
          )}
        </div>

        <div className="mt-6 flex gap-8">
          <Sidebar items={SECTIONS} />

          <main className="min-w-0 flex-1 space-y-8">
            <section id="summary" className="space-y-4 scroll-mt-20">
              <ComplianceSummaryCard summary={record.summary} />
              <DisclaimerNote />
              {error && (
                <p className="rounded-md border border-fail/40 bg-fail/10 px-3 py-2 text-sm text-fail">
                  {error}
                </p>
              )}
            </section>

            <section id="product" className="scroll-mt-20">
              <h2 className="mb-3 text-sm font-semibold">Extracted product information</h2>
              {record.analysis_source === "ecommerce_url" && (
                <div className="panel mb-3 space-y-1.5 p-4 text-xs">
                  {record.page_title && (
                    <p className="text-sm font-medium text-foreground">{record.page_title}</p>
                  )}
                  {record.source_url && (
                    <p className="break-all text-muted-foreground">
                      Product URL:{" "}
                      <a
                        href={record.source_url}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="text-primary underline underline-offset-2"
                      >
                        {record.source_url}
                      </a>
                    </p>
                  )}
                  <p className="text-muted-foreground">
                    Information sources:{" "}
                    {(record.extracted.information_sources ?? ["Product page text"]).join(" · ")}
                  </p>
                  <p className="text-muted-foreground">
                    An e-commerce listing is not required to display every physical-package
                    declaration. Declarations that appear only on the pack are flagged for human
                    verification instead of being failed.
                  </p>
                </div>
              )}
              <ProductInfoCards extracted={record.extracted} />
            </section>

            <section id="ocr" className="scroll-mt-20">
              <h2 className="mb-3 text-sm font-semibold">
                {record.analysis_source === "ecommerce_url"
                  ? "Extracted listing text"
                  : "OCR extracted text"}
              </h2>
              <OCRTextPanel
                key={record.extracted.raw_text.length}
                text={record.extracted.raw_text}
                onReanalyze={handleReanalyze}
                busy={busy}
              />
            </section>

            <section id="checks" className="scroll-mt-20">
              <h2 className="mb-3 text-sm font-semibold">Compliance checks</h2>
              <ComplianceTable checks={record.checks} />
            </section>

            <section id="rules" className="scroll-mt-20">
              <h2 className="mb-3 text-sm font-semibold">Rule references used</h2>
              <div className="grid gap-3 xl:grid-cols-2">
                {uniqueRules.map((r) => (
                  <RuleReferenceCard key={r} ruleId={r} />
                ))}
              </div>
            </section>

            <section id="recommendations" className="scroll-mt-20">
              <RecommendationCard items={record.recommendations} />
            </section>
          </main>

          <aside className="no-print hidden w-[340px] shrink-0 space-y-4 xl:block">
            <div className="sticky top-20 space-y-4">
              {record.image_data_url ? (
                <ImagePreview src={record.image_data_url} name="Analyzed label" />
              ) : (
                <div className="panel p-5 text-sm text-muted-foreground">
                  {record.analysis_source === "ecommerce_url"
                    ? "No package image could be retrieved from the product page — this analysis used the listing text only."
                    : "No image — this analysis was produced in demo mode from synthetic sample text."}
                </div>
              )}
              <div className="panel p-5">
                <p className="label-caps">Quick summary</p>
                <ul className="mt-3 space-y-1.5 text-sm">
                  <li className="flex justify-between">
                    <span className="text-muted-foreground">Score</span>
                    <span className="font-mono text-primary">{record.summary.score}%</span>
                  </li>
                  <li className="flex justify-between">
                    <span className="text-muted-foreground">Applicable checks</span>
                    <span className="font-mono">{record.summary.applicable}</span>
                  </li>
                  <li className="flex justify-between">
                    <span className="text-muted-foreground">Passed / Review / Failed</span>
                    <span className="font-mono">
                      {record.summary.passed} / {record.summary.review} / {record.summary.failed}
                    </span>
                  </li>
                  <li className="flex justify-between">
                    <span className="text-muted-foreground">Extraction confidence</span>
                    <span className="font-mono">
                      {Math.round(record.extracted.ocr_confidence * 100)}%
                    </span>
                  </li>
                </ul>
              </div>
            </div>
          </aside>
        </div>
      </div>
      <Footer />
    </div>
  );
}
