import { cn } from "@/lib/utils";
import type { CheckStatus } from "@/lib/compliance/types";

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

export function ConfidenceIndicator({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const tone = pct >= 70 ? "bg-pass" : pct >= 40 ? "bg-review" : "bg-fail";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
        <div className={cn("h-full rounded-full", tone)} style={{ width: `${pct}%` }} />
      </div>
      <span className="font-mono text-xs text-muted-foreground">{pct}%</span>
    </div>
  );
}
