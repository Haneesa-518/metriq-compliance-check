import { cn } from "@/lib/utils";
import { bandFor, STATUS_MEANINGS, type CheckStatus, type ConfidenceBand } from "@/lib/compliance/types";

const MAP: Record<CheckStatus, { text: string; icon: string; cls: string }> = {
  PASS: { text: "PASS", icon: "✓", cls: "bg-pass/15 text-pass border-pass/40" },
  FAIL: { text: "FAIL", icon: "✕", cls: "bg-fail/15 text-fail border-fail/40" },
  REVIEW: { text: "REVIEW", icon: "⚠", cls: "bg-review/15 text-review border-review/40" },
  NOT_APPLICABLE: {
    text: "NOT APPLICABLE",
    icon: "—",
    cls: "bg-muted text-muted-foreground border-border",
  },
};

export function ComplianceBadge({
  status,
  meaning,
  className,
}: {
  status: CheckStatus;
  /** optional override for the plain-language meaning shown under the badge */
  meaning?: string;
  className?: string;
}) {
  const s = MAP[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[11px] font-semibold tracking-wider",
        s.cls,
        className,
      )}
    >
      <span aria-hidden>{s.icon}</span>
      {s.text}
    </span>
  );
}

/** Badge plus its plain-language meaning, used wherever space allows. */
export function ComplianceStatus({
  status,
  meaning,
  className,
}: {
  status: CheckStatus;
  meaning?: string;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex flex-col items-start gap-1", className)}>
      <ComplianceBadge status={status} />
      <span className="text-[11px] leading-tight text-muted-foreground">
        {meaning || STATUS_MEANINGS[status]}
      </span>
    </span>
  );
}


/**
 * Extraction confidence is an internal heuristic signal (how well the value
 * matched a structured pattern) — never an OCR probability or AI accuracy.
 */
export function ConfidenceIndicator({ value, band }: { value: number; band?: ConfidenceBand }) {
  const b: ConfidenceBand = band ?? bandFor(value);
  const pct = Math.round(value * 100);
  const tone = b === "HIGH" ? "bg-pass" : b === "MEDIUM" ? "bg-review" : "bg-fail";
  const text = b === "HIGH" ? "text-pass" : b === "MEDIUM" ? "text-review" : "text-fail";
  return (
    <div className="flex items-center gap-2" title={`Internal extraction-confidence signal: ${pct}/100`}>
      <div className="h-1.5 w-12 overflow-hidden rounded-full bg-muted">
        <div className={cn("h-full rounded-full", tone)} style={{ width: `${pct}%` }} />
      </div>
      <span className={cn("font-mono text-[10px] font-semibold tracking-wider", text)}>{b}</span>
    </div>
  );
}
