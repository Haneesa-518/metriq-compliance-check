import { Fragment, useState } from "react";
import { AlertTriangle, Check, Minus, X } from "lucide-react";
import type { AnalysisRecord, CheckResult, ExtractedData } from "@/lib/compliance/types";
import { FIELD_SOURCE_LABELS } from "@/lib/compliance/types";
import { ComplianceBadge, ConfidenceIndicator } from "@/components/ComplianceBadge";
import { getRule } from "@/lib/legal/rules.data";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const OVERALL_LABEL: Record<AnalysisRecord["summary"]["overall"], string> = {
  COMPLIANT: "NO ISSUES FOUND (screening)",
  NON_COMPLIANT: "ISSUES FOUND (screening)",
  NEEDS_REVIEW: "REQUIRES REVIEW",
};

export const SCORE_DISCLAIMER =
  "This score represents automated screening coverage and does not constitute a legal determination of compliance.";

export function ComplianceSummaryCard({ summary }: { summary: AnalysisRecord["summary"] }) {
  const tone =
    summary.overall === "COMPLIANT"
      ? "text-pass"
      : summary.overall === "NON_COMPLIANT"
        ? "text-fail"
        : "text-review";
  const stats = [
    { label: "Pass", value: summary.passed, tone: "text-pass" },
    { label: "Review", value: summary.review, tone: "text-review" },
    { label: "Fail", value: summary.failed, tone: "text-fail" },
    { label: "Not applicable", value: summary.not_applicable, tone: "text-muted-foreground" },
  ];
  return (
    <div className="panel p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="label-caps">Overall screening result</p>
          <p className={cn("mt-1 text-2xl font-semibold", tone)}>{OVERALL_LABEL[summary.overall]}</p>
        </div>
        <div className="text-right">
          <p className="label-caps">Compliance screening score</p>
          <p className="mt-1 font-mono text-2xl font-semibold text-primary">{summary.score}%</p>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
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

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <CategoryStat title="Legal Metrology" stat={summary.by_category.legal_metrology} />
        <CategoryStat
          title="Food Labelling — prototype scope"
          stat={summary.by_category.food_labelling}
        />
      </div>

      <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
        Transparent scoring: each applicable check scores 1 for PASS, 0.5 for REVIEW and 0 for FAIL,
        over {summary.applicable} applicable checks. Not-applicable checks are excluded entirely.{" "}
        {SCORE_DISCLAIMER}
      </p>
    </div>
  );
}

function CategoryStat({
  title,
  stat,
}: {
  title: string;
  stat: AnalysisRecord["summary"]["by_category"]["legal_metrology"];
}) {
  return (
    <div className="rounded-md border border-border bg-surface p-3">
      <p className="label-caps">{title}</p>
      <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-mono text-xs">
        <span className="text-pass">{stat.passed} PASS</span>
        <span className="text-review">{stat.review} REVIEW</span>
        <span className="text-fail">{stat.failed} FAIL</span>
        <span className="text-muted-foreground">{stat.not_applicable} N/A</span>
      </p>
    </div>
  );
}

export function CriticalIssuesCard({ summary }: { summary: AnalysisRecord["summary"] }) {
  if (summary.critical_issues.length === 0 && summary.human_review_items === 0) return null;
  return (
    <div className="panel p-5">
      {summary.critical_issues.length > 0 && (
        <>
          <p className="label-caps text-fail">Critical issues ({summary.critical_issues.length})</p>
          <ol className="mt-3 space-y-2">
            {summary.critical_issues.map((issue, i) => (
              <li key={i} className="flex gap-2 text-sm leading-relaxed">
                <span className="font-mono text-xs text-fail">{i + 1}.</span>
                <span>{issue}</span>
              </li>
            ))}
          </ol>
        </>
      )}
      {summary.human_review_items > 0 && (
        <p
          className={cn(
            "text-sm text-review",
            summary.critical_issues.length > 0 && "mt-4 border-t border-border pt-4",
          )}
        >
          <span className="font-semibold">Human review — </span>
          {summary.human_review_items} item{summary.human_review_items === 1 ? "" : "s"} require
          manual verification before any conclusion is drawn.
        </p>
      )}
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
            <ConfidenceIndicator value={f.confidence} band={f.band} />
            <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              {FIELD_SOURCE_LABELS[f.source] ?? f.source}
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
        <p className="label-caps">Extracted text (editable — human in the loop)</p>
        <Button
          size="sm"
          variant="secondary"
          disabled={busy}
          onClick={() => onReanalyze(value)}
          className="no-print"
        >
          {busy ? "Re-analyzing…" : "Edit OCR & re-run analysis"}
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
        Correct any misread text, then re-run the deterministic extraction and rule evaluation on the
        corrected text. AI assists extraction; final compliance decisions require human verification.
      </p>
    </div>
  );
}

const CATEGORY_TITLES = {
  legal_metrology: "Legal Metrology checks",
  food_labelling: "Food labelling screening — prototype scope",
} as const;

export function ComplianceTable({ checks }: { checks: CheckResult[] }) {
  const groups = (["legal_metrology", "food_labelling"] as const)
    .map((cat) => ({ cat, items: checks.filter((c) => c.category === cat) }))
    .filter((g) => g.items.length > 0);
  return (
    <div className="space-y-5">
      {groups.map((g) => (
        <div key={g.cat}>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {CATEGORY_TITLES[g.cat]}
          </h3>
          <CheckGroupTable checks={g.items} />
        </div>
      ))}
    </div>
  );
}

function CheckGroupTable({ checks }: { checks: CheckResult[] }) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <div className="panel overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-surface text-left">
            <th className="px-4 py-2.5 label-caps">Requirement</th>
            <th className="px-4 py-2.5 label-caps">Status</th>
            <th className="hidden px-4 py-2.5 label-caps md:table-cell">Detected</th>
            <th className="hidden px-4 py-2.5 label-caps lg:table-cell">Confidence</th>
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
                  <td className="hidden px-4 py-3 lg:table-cell">
                    {c.status === "NOT_APPLICABLE" ? (
                      <span className="text-xs text-muted-foreground">—</span>
                    ) : (
                      <ConfidenceIndicator value={c.confidence} band={c.confidence_band} />
                    )}
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
        Select any row to see why this result was produced: evidence, validation steps, rule
        reference and the recommended action.
      </p>
    </div>
  );
}

export function ValidationList({ check }: { check: CheckResult }) {
  return (
    <ul className="space-y-1">
      {check.validations.map((v, i) => (
        <li key={i} className="flex items-start gap-2 text-sm">
          {v.passed === true ? (
            <Check className="mt-0.5 size-3.5 shrink-0 text-pass" />
          ) : v.passed === false ? (
            <X className="mt-0.5 size-3.5 shrink-0 text-fail" />
          ) : (
            <Minus className="mt-0.5 size-3.5 shrink-0 text-review" />
          )}
          <span className={v.passed === true ? "text-muted-foreground" : undefined}>{v.label}</span>
        </li>
      ))}
    </ul>
  );
}

/** "Why did I get this result?" — generated entirely from deterministic output. */
export function ExplanationPanel({ check }: { check: CheckResult }) {
  const rule = getRule(check.rule_reference);
  const rows = [
    ["Result", check.status.replace("_", " ")],
    ["Detected value", check.detected ?? "Not confidently detected"],
    ["Evidence", check.evidence ?? "Evidence not confidently located."],
    ["Expected", check.expected],
    ["Reason", check.message],
    ["Applicability", check.applicability],
    ["Rule reference", `${check.rule_reference} — ${rule?.source_reference ?? "unknown rule"}`],
    [
      "Extraction confidence",
      `${check.confidence_band} (internal signal ${Math.round(check.confidence * 100)}/100 — not an OCR probability or AI accuracy figure)`,
    ],
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
      <div>
        <p className="label-caps">Validation steps</p>
        <div className="mt-1">
          <ValidationList check={check} />
        </div>
      </div>
      {check.requires_human_review && (
        <p className="rounded-md border border-review/40 bg-review/10 px-3 py-2 text-xs font-semibold text-review">
          HUMAN VERIFICATION REQUIRED
        </p>
      )}
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
  const verified = rule.status === "VERIFIED";
  return (
    <div className="panel space-y-2 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-xs text-primary">{rule.rule_id}</span>
        <span
          className={cn(
            "rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
            verified
              ? "border-pass/40 bg-pass/10 text-pass"
              : "border-review/40 bg-review/10 text-review",
          )}
        >
          {rule.status.replace("_", " ")}
        </span>
        <span className="rounded border border-border px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
          {rule.category === "legal_metrology" ? "legal metrology" : "food labelling"}
        </span>
        {!rule.evaluated && (
          <span className="rounded border border-border px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
            knowledge only
          </span>
        )}
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
        {verified
          ? `Verified against the official rule reference on ${rule.last_verified}. Verification covers the rule number and requirement summary only — it is not a legal opinion.`
          : "Not yet verified by a human reviewer against the official published document."}
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

export function HumanInLoopNote({ className }: { className?: string }) {
  return (
    <p className={cn("text-xs leading-relaxed text-muted-foreground", className)}>
      AI assists extraction. Final compliance decisions require human verification.
    </p>
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
        Compliance screening prototype. AI assists extraction; deterministic rules flag issues and a
        human makes the final decision. Results are not legal advice.
      </span>
    </div>
  );
}
