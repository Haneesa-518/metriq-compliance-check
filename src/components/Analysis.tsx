import { Fragment, useState } from "react";
import { AlertTriangle } from "lucide-react";
import type { AnalysisRecord, CheckResult, ExtractedData } from "@/lib/compliance/types";
import { ComplianceBadge, ConfidenceIndicator } from "@/components/ComplianceBadge";
import { getRule } from "@/lib/legal/rules.data";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const OVERALL_LABEL: Record<AnalysisRecord["summary"]["overall"], string> = {
  COMPLIANT: "COMPLIANT (prototype)",
  NON_COMPLIANT: "NON-COMPLIANT (prototype)",
  NEEDS_REVIEW: "NEEDS REVIEW",
};

export function ComplianceSummaryCard({ summary }: { summary: AnalysisRecord["summary"] }) {
  const tone =
    summary.overall === "COMPLIANT"
      ? "text-pass"
      : summary.overall === "NON_COMPLIANT"
        ? "text-fail"
        : "text-review";
  const stats = [
    { label: "Score", value: `${summary.score}%`, tone: "text-primary" },
    { label: "Passed", value: summary.passed, tone: "text-pass" },
    { label: "Failed", value: summary.failed, tone: "text-fail" },
    { label: "Review", value: summary.review, tone: "text-review" },
    { label: "Not applicable", value: summary.not_applicable, tone: "text-muted-foreground" },
  ];
  return (
    <div className="panel p-5">
      <p className="label-caps">Overall status</p>
      <p className={cn("mt-1 text-2xl font-semibold", tone)}>{OVERALL_LABEL[summary.overall]}</p>
      <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-5">
        {stats.map((s) => (
          <div key={s.label}>
            <p className="label-caps">{s.label}</p>
            <p className={cn("mt-1 font-mono text-xl font-semibold", s.tone)}>{s.value}</p>
          </div>
        ))}
      </div>
      <div className="mt-5 h-2 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary" style={{ width: `${summary.score}%` }} />
      </div>
      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
        Transparent scoring: each applicable check scores 1 for PASS, 0.5 for REVIEW and 0 for FAIL,
        over {summary.applicable} applicable checks. This is a prototype risk indicator — it is not
        an official legal compliance percentage, and 100% does not guarantee legal compliance.
      </p>
    </div>
  );
}

export function ProductInfoCards({ extracted }: { extracted: ExtractedData }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {Object.values(extracted.fields).map((f) => (
        <div key={f.key} className="panel p-4">
          <p className="label-caps">{f.label}</p>
          <p
            className={cn(
              "mt-1.5 text-sm break-words",
              f.value ? "text-foreground" : "text-muted-foreground italic",
            )}
          >
            {f.value ?? "Not detected"}
          </p>
          <div className="mt-3 flex items-center justify-between gap-2">
            <ConfidenceIndicator value={f.confidence} />
            <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              {f.source === "user_corrected" ? "user corrected" : f.source === "ocr" ? "ocr" : "unavailable"}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

export function OCRTextPanel({
  text,
  onReanalyze,
  busy,
}: {
  text: string;
  onReanalyze: (text: string) => void;
  busy?: boolean;
}) {
  const [value, setValue] = useState(text);
  return (
    <div className="panel p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="label-caps">OCR extracted text (editable)</p>
        <Button
          size="sm"
          variant="secondary"
          disabled={busy}
          onClick={() => onReanalyze(value)}
          className="no-print"
        >
          {busy ? "Re-analyzing…" : "Re-analyze"}
        </Button>
      </div>
      <Textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={10}
        className="mt-3 font-mono text-xs leading-relaxed"
        aria-label="Extracted text"
      />
      <p className="mt-2 text-xs text-muted-foreground">
        Correct any misread text and re-run the deterministic rule engine on the corrected text.
      </p>
    </div>
  );
}

export function ComplianceTable({ checks }: { checks: CheckResult[] }) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <div className="panel overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-surface text-left">
            <th className="px-4 py-2.5 label-caps">Requirement</th>
            <th className="px-4 py-2.5 label-caps">Status</th>
            <th className="hidden px-4 py-2.5 label-caps md:table-cell">Evidence</th>
            <th className="hidden px-4 py-2.5 label-caps lg:table-cell">Rule</th>
          </tr>
        </thead>
        <tbody>
          {checks.map((c) => {
            const isOpen = open === c.rule_reference;
            return (
              <Fragment key={c.rule_reference}>
                <tr
                  onClick={() => setOpen(isOpen ? null : c.rule_reference)}
                  className="cursor-pointer border-b border-border transition-colors last:border-0 hover:bg-accent/50"
                >
                  <td className="px-4 py-3 font-medium">{c.label}</td>
                  <td className="px-4 py-3">
                    <ComplianceBadge status={c.status} />
                  </td>
                  <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">
                    {c.detected ?? "Not detected"}
                  </td>
                  <td className="hidden px-4 py-3 font-mono text-xs text-muted-foreground lg:table-cell">
                    {c.rule_reference}
                  </td>
                </tr>
                {isOpen && (
                  <tr className="border-b border-border bg-surface">
                    <td colSpan={4} className="px-4 py-4">
                      <ExplanationPanel check={c} />
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
      <p className="border-t border-border px-4 py-2 text-xs text-muted-foreground">
        Select any row to see the reason, the rule reference and the recommended action.
      </p>
    </div>
  );
}

export function ExplanationPanel({ check }: { check: CheckResult }) {
  const rule = getRule(check.rule_reference);
  const rows = [
    ["Requirement", check.label],
    ["Detected", check.detected ?? "Not confidently detected"],
    ["Expected", check.expected],
    ["Reason", check.message],
    ["Legal reference", `${check.rule_reference} — ${rule?.source_reference ?? "unknown rule"}`],
    ["Confidence", `${Math.round(check.confidence * 100)}%`],
    ["Recommended action", check.recommended_action],
  ] as const;
  return (
    <div className="space-y-3">
      <dl className="grid gap-3 sm:grid-cols-2">
        {rows.map(([k, v]) => (
          <div key={k}>
            <dt className="label-caps">{k}</dt>
            <dd className="mt-1 text-sm leading-relaxed">{v}</dd>
          </div>
        ))}
      </dl>
      {rule && <RuleReferenceCard ruleId={rule.rule_id} />}
    </div>
  );
}

export function RuleReferenceCard({ ruleId }: { ruleId: string }) {
  const rule = getRule(ruleId);
  if (!rule) {
    return (
      <div className="panel p-4 text-sm text-muted-foreground">
        Unknown rule reference: <span className="font-mono">{ruleId}</span>
      </div>
    );
  }
  return (
    <div className="panel space-y-2 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-xs text-primary">{rule.rule_id}</span>
        <span className="rounded border border-review/40 bg-review/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-review">
          {rule.status.replace("_", " ")}
        </span>
      </div>
      <p className="text-sm font-medium">{rule.title}</p>
      <p className="text-sm text-muted-foreground">{rule.requirement}</p>
      <p className="text-xs text-muted-foreground">
        <span className="label-caps">Applicability</span> — {rule.applicability}
      </p>
      <p className="text-xs text-muted-foreground">
        <span className="label-caps">Source</span> — {rule.source_document}, {rule.source_reference}
      </p>
      <p className="text-xs text-muted-foreground">
        Last verified: {rule.last_verified ?? "not yet verified by a human reviewer"}
      </p>
    </div>
  );
}

export function RecommendationCard({ items }: { items: string[] }) {
  return (
    <div className="panel p-5">
      <p className="label-caps">Recommendations</p>
      <ul className="mt-3 space-y-2">
        {items.map((r, i) => (
          <li key={i} className="flex gap-2 text-sm leading-relaxed text-muted-foreground">
            <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
            <span>{r}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function DisclaimerNote({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex gap-2 rounded-md border border-review/30 bg-review/10 px-3 py-2 text-xs leading-relaxed text-review",
        className,
      )}
    >
      <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
      <span>
        Prototype analysis only. Results should be verified by a qualified authority/professional and
        are not legal advice.
      </span>
    </div>
  );
}
