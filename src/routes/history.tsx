import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Search, Trash2 } from "lucide-react";
import { Navbar, Footer } from "@/components/Shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ComplianceBadge } from "@/components/ComplianceBadge";
import { deleteAnalysis, filterAnalyses, listAnalyses } from "@/lib/analysis-store";
import type { AnalysisRecord } from "@/lib/compliance/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/history")({
  head: () => ({
    meta: [
      { title: "Screening History — MetriQ" },
      {
        name: "description",
        content:
          "Search and revisit past MetriQ screening runs by product, brand, manufacturer, URL or analysis ID, with result and source filters.",
      },
      { property: "og:title", content: "Screening History — MetriQ" },
      {
        property: "og:description",
        content:
          "Search past compliance screening runs by product, manufacturer, URL or analysis ID.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: HistoryPage,
});

const RESULTS = [
  { value: "ALL", label: "All results" },
  { value: "PASS", label: "No issues" },
  { value: "REVIEW", label: "Verification required" },
  { value: "FAIL", label: "Information not detected" },
] as const;

const SOURCES = [
  { value: "ALL", label: "All sources" },
  { value: "image_upload", label: "Package image" },
  { value: "ecommerce_url", label: "Product URL" },
] as const;

function overallText(record: AnalysisRecord) {
  return record.summary.overall === "COMPLIANT"
    ? "No issues detected in automated screening"
    : "Manual verification required";
}

function HistoryPage() {
  const [records, setRecords] = useState<AnalysisRecord[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<(typeof RESULTS)[number]["value"]>("ALL");
  const [source, setSource] = useState<(typeof SOURCES)[number]["value"]>("ALL");
  const [includeDemo, setIncludeDemo] = useState(false);

  useEffect(() => {
    let active = true;
    void listAnalyses().then((r) => {
      if (!active) return;
      setRecords(r);
      setLoaded(true);
    });
    return () => {
      active = false;
    };
  }, []);

  const visible = useMemo(
    () => filterAnalyses(records, { query, result, source, includeDemo }),
    [records, query, result, source, includeDemo],
  );

  async function handleDelete(id: string) {
    await deleteAnalysis(id);
    setRecords((prev) => prev.filter((r) => r.id !== id));
  }

  return (
    <div className="min-h-screen">
      <Navbar
        right={
          <Button asChild size="sm">
            <Link to="/check">New analysis</Link>
          </Button>
        }
      />
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <h1 className="text-2xl font-semibold">Screening history</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every completed screening run is stored on this device. Search by product, brand,
          manufacturer, importer, product URL or analysis ID.
        </p>

        <div className="panel mt-6 space-y-3 p-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search product, brand, manufacturer, importer, URL or analysis ID"
              className="pl-9"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {RESULTS.map((r) => (
              <FilterChip
                key={r.value}
                active={result === r.value}
                onClick={() => setResult(r.value)}
              >
                {r.label}
              </FilterChip>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {SOURCES.map((s) => (
              <FilterChip
                key={s.value}
                active={source === s.value}
                onClick={() => setSource(s.value)}
              >
                {s.label}
              </FilterChip>
            ))}
            <FilterChip active={includeDemo} onClick={() => setIncludeDemo((v) => !v)}>
              Include demo runs
            </FilterChip>
          </div>
        </div>

        {!loaded ? null : visible.length === 0 ? (
          <p className="mt-8 text-sm text-muted-foreground">
            No screening runs match these filters yet.
          </p>
        ) : (
          <ul className="mt-6 space-y-3">
            {visible.map((r) => (
              <li key={r.id} className="panel p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {r.extracted.fields.product_name?.value ?? r.page_title ?? "Unnamed product"}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {new Date(r.created_at).toLocaleString()} ·{" "}
                      {r.analysis_source === "ecommerce_url" ? "Product URL" : "Package image"} ·{" "}
                      <span className="font-mono">{r.id}</span>
                      {r.is_demo && " · DEMO"}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">{overallText(r)}</p>
                    {r.source_url && (
                      <p className="mt-1 truncate text-xs text-muted-foreground">{r.source_url}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="font-mono text-lg text-primary">{r.summary.score}%</p>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        Coverage
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <ComplianceBadge
                        status={
                          r.summary.failed > 0 ? "FAIL" : r.summary.review > 0 ? "REVIEW" : "PASS"
                        }
                      />
                      <div className="flex gap-1">
                        <Button asChild size="sm" variant="secondary">
                          <Link to="/analysis/$id" params={{ id: r.id }}>
                            Open
                          </Link>
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          aria-label="Delete analysis"
                          onClick={() => void handleDelete(r.id)}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
      <Footer />
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1 text-xs transition-colors",
        active
          ? "border-primary bg-primary/10 text-primary"
          : "border-border text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
