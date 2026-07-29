import type { AnalysisRecord } from "./compliance/types";

const KEY = "mitramet.analyses.v1";

function read(): AnalysisRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as AnalysisRecord[]) : [];
  } catch {
    return [];
  }
}

function write(items: AnalysisRecord[]) {
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(items.slice(0, 10)));
  } catch {
    /* storage full — analyses are ephemeral by design */
  }
}

export function saveAnalysis(record: AnalysisRecord) {
  const items = read().filter((a) => a.id !== record.id);
  write([record, ...items]);
}

export function getAnalysis(id: string): AnalysisRecord | null {
  return read().find((a) => a.id === id) ?? null;
}

export function listAnalyses(): AnalysisRecord[] {
  return read();
}
