import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ComplianceBadge } from "@/components/ComplianceBadge";
import { getAnalysis } from "@/lib/analysis-store";
import { getRule } from "@/lib/legal/rules.data";
import type { AnalysisRecord } from "@/lib/compliance/types";

export const Route = createFileRoute("/report/$id")({
  head: () => ({
    meta: [
      { title: "Compliance Report — MetriQ" },
      {
        name: "description",
        content:
          "Printable MetriQ compliance report: extracted declarations, check results, rule references, recommendations and prototype disclaimer.",
      },
      { property: "og:title", content: "Compliance Report — MetriQ" },
      {
        property: "og:description",
        content: "Printable prototype compliance report with rule references and recommendations.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ReportPage,
});

function ReportPage() {
  const { id } = Route.useParams();
  const [record, setRecord] = useState<AnalysisRecord | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setRecord(getAnalysis(id));
    setLoaded(true);
  }, [id]);

  if (!loaded) return null;
  if (!record) {
    return (
      <main className="mx-auto max-w-xl px-4 py-24 text-center">
        <h1 className="text-lg font-semibold">Report not available</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This analysis is no longer in your browser session.
        </p>
        <Button asChild className="mt-6">
          <Link to="/check">Start a new analysis</Link>
        </Button>
      </main>
    );
  }

  const flagged = record.checks.filter((c) => c.status === "FAIL" || c.status === "REVIEW");

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <div className="no-print mb-6 flex items-center justify-between gap-3">
        <Button asChild variant="secondary" size="sm">
          <Link to="/analysis/$id" params={{ id: record.id }}>
            Back to analysis
          </Link>
        </Button>
        <Button size="sm" onClick={() => window.print()}>
          <Printer className="mr-1 size-3.5" /> Print / Save as PDF
        </Button>
      </div>

      <header className="border-b border-border pb-4">
        <h1 className="text-2xl font-semibold">MetriQ — Compliance Report</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Prototype assessment of package declarations for pre-packaged commodities (India)
        </p>
        <dl className="mt-4 grid grid-cols-2 gap-2 text-xs">
          <div>
            <dt className="label-caps">Analysis ID</dt>
            <dd className="font-mono">{record.id}</dd>
          </div>
          <div>
            <dt className="label-caps">Generated</dt>
            <dd>{new Date().toLocaleString()}</dd>
          </div>
          <div>
            <dt className="label-caps">Analyzed</dt>
            <dd>{new Date(record.created_at).toLocaleString()}</dd>
          </div>
          <div>
            <dt className="label-caps">Source</dt>
            <dd>{record.is_demo ? "Demo mode — synthetic sample data" : record.extracted.engine}</dd>
          </div>
        </dl>
      </header>

      <Section title="Result summary">
        <p className="text-sm">
          Overall status: <strong>{record.summary.overall.replace("_", " ")}</strong> · Prototype
          score: <strong>{record.summary.score}%</strong>
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {record.summary.passed} passed, {record.summary.review} for review, {record.summary.failed}{" "}
          failed across {record.summary.applicable} applicable checks (
          {record.summary.not_applicable} not applicable).
        </p>
      </Section>

      <Section title="Extracted declarations">
        <table className="w-full text-sm">
          <tbody>
            {Object.values(record.extracted.fields).map((f) => (
              <tr key={f.key} className="border-b border-border last:border-0">
                <td className="py-1.5 pr-4 text-muted-foreground">{f.label}</td>
                <td className="py-1.5 pr-4">{f.value ?? "Not detected"}</td>
                <td className="py-1.5 text-right font-mono text-xs text-muted-foreground">
                  {Math.round(f.confidence * 100)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section title="Compliance results">
        <table className="w-full text-sm">
          <tbody>
            {record.checks.map((c) => (
              <tr key={c.rule_reference} className="border-b border-border last:border-0 align-top">
                <td className="py-2 pr-4">{c.label}</td>
                <td className="py-2 pr-4">
                  <ComplianceBadge status={c.status} />
                </td>
                <td className="py-2 font-mono text-xs text-muted-foreground">{c.rule_reference}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section title="Failed and review items">
        {flagged.length === 0 ? (
          <p className="text-sm text-muted-foreground">No items were flagged in this prototype run.</p>
        ) : (
          <ul className="space-y-3">
            {flagged.map((c) => (
              <li key={c.rule_reference} className="text-sm">
                <p className="font-medium">
                  {c.label} — {c.status}
                </p>
                <p className="text-muted-foreground">{c.message}</p>
                <p className="text-muted-foreground">
                  Detected: {c.detected ?? "Not confidently detected"} · Confidence{" "}
                  {Math.round(c.confidence * 100)}% · Reference{" "}
                  <span className="font-mono">{c.rule_reference}</span>
                </p>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Rule references">
        <ul className="space-y-2 text-sm">
          {Array.from(new Set(record.checks.map((c) => c.rule_reference))).map((id) => {
            const rule = getRule(id);
            return (
              <li key={id}>
                <span className="font-mono text-xs">{id}</span> — {rule?.title} ·{" "}
                {rule?.source_document}, {rule?.source_reference} · status: {rule?.status}
              </li>
            );
          })}
        </ul>
      </Section>

      <Section title="Recommendations">
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          {record.recommendations.map((r, i) => (
            <li key={i}>{r}</li>
          ))}
        </ul>
      </Section>

      <Section title="Disclaimer">
        <p className="text-sm leading-relaxed text-muted-foreground">
          MetriQ is a hackathon prototype offering compliance assistance only. It is not legal
          advice, is not affiliated with or certified by any government body, and its output is not
          legally binding. Rule records are marked as requiring verification against the official
          published documents. A score of 100% does not guarantee legal compliance. All findings must
          be verified by a qualified authority or professional.
        </p>
      </Section>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="mb-3 border-b border-border pb-1 text-sm font-semibold uppercase tracking-wider">
        {title}
      </h2>
      {children}
    </section>
  );
}
