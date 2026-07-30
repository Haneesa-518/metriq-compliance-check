import { cn } from "@/lib/utils";
import { bandFor, type CheckStatus, type ConfidenceBand } from "@/lib/compliance/types";

const MAP: Record<CheckStatus, { text: string; cls: string }> = {
  PASS: { text: "PASS", cls: "bg-pass/15 text-pass border-pass/40" },
  FAIL: { text: "FAIL", cls: "bg-fail/15 text-fail border-fail/40" },
  REVIEW: { text: "REVIEW", cls: "bg-review/15 text-review border-review/40" },
  NOT_APPLICABLE: { text: "N/A", cls: "bg-muted text-muted-foreground border-border" },
};

export function ComplianceBadge({
  status,
  className,
}: {
  status: CheckStatus;
  className?: string;
}) {
  const s = MAP[status];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded border px-2 py-0.5 text-[11px] font-semibold tracking-wider",
        s.cls,
        className,
      )}
    >
      {s.text}
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
