/**
 * Persistent analysis repository.
 *
 * Analyses are stored in IndexedDB so that records (including the original
 * evidence image, which can be several megabytes) survive a page reload and are
 * not silently dropped by the ~5 MB sessionStorage quota. An in-memory map is
 * used as a last-resort fallback when IndexedDB is unavailable.
 */
import type { AnalysisRecord } from "./compliance/types";

const DB_NAME = "metriq";
const DB_VERSION = 1;
const STORE = "analyses";

const memory = new Map<string, AnalysisRecord>();

function idb(): Promise<IDBDatabase | null> {
  if (typeof window === "undefined" || !("indexedDB" in window)) return Promise.resolve(null);
  return new Promise((resolve) => {
    let req: IDBOpenDBRequest;
    try {
      req = window.indexedDB.open(DB_NAME, DB_VERSION);
    } catch {
      resolve(null);
      return;
    }
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: "id" });
        store.createIndex("created_at", "created_at");
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
    req.onblocked = () => resolve(null);
  });
}

function tx<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T | null> {
  return idb().then(
    (db) =>
      new Promise<T | null>((resolve) => {
        if (!db) {
          resolve(null);
          return;
        }
        try {
          const request = run(db.transaction(STORE, mode).objectStore(STORE));
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => resolve(null);
        } catch {
          resolve(null);
        }
      }),
  );
}

export async function saveAnalysis(record: AnalysisRecord): Promise<void> {
  memory.set(record.id, record);
  await tx("readwrite", (store) => store.put(record) as IDBRequest<IDBValidKey>);
}

export async function getAnalysis(id: string): Promise<AnalysisRecord | null> {
  const stored = await tx<AnalysisRecord>(
    "readonly",
    (store) => store.get(id) as IDBRequest<AnalysisRecord>,
  );
  return stored ?? memory.get(id) ?? null;
}

export async function listAnalyses(): Promise<AnalysisRecord[]> {
  const all = await tx<AnalysisRecord[]>(
    "readonly",
    (store) => store.getAll() as IDBRequest<AnalysisRecord[]>,
  );
  const records = all && all.length ? all : Array.from(memory.values());
  return [...records].sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export async function deleteAnalysis(id: string): Promise<void> {
  memory.delete(id);
  await tx("readwrite", (store) => store.delete(id) as IDBRequest<undefined>);
}

export interface HistoryFilters {
  query?: string;
  result?: "ALL" | "PASS" | "FAIL" | "REVIEW";
  source?: "ALL" | "image_upload" | "ecommerce_url" | "demo";
  includeDemo?: boolean;
}

function haystack(r: AnalysisRecord): string {
  const f = r.extracted.fields;
  return [
    r.id,
    r.page_title,
    r.source_url,
    r.demo_label,
    f.product_name?.value,
    f.manufacturer?.value,
    f.packer?.value,
    f.importer?.value,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

/** Search and filter the persisted repository (Analysis ID, product, brand, maker, URL). */
export function filterAnalyses(
  records: AnalysisRecord[],
  filters: HistoryFilters,
): AnalysisRecord[] {
  const q = (filters.query ?? "").trim().toLowerCase();
  return records.filter((r) => {
    if (!filters.includeDemo && r.is_demo) return false;
    if (q && !haystack(r).includes(q)) return false;
    if (filters.source && filters.source !== "ALL") {
      const source = r.is_demo ? "demo" : (r.analysis_source ?? "image_upload");
      if (source !== filters.source) return false;
    }
    if (filters.result && filters.result !== "ALL") {
      if (filters.result === "FAIL" && r.summary.failed === 0) return false;
      if (filters.result === "REVIEW" && r.summary.review === 0) return false;
      if (filters.result === "PASS" && (r.summary.failed > 0 || r.summary.review > 0)) return false;
    }
    return true;
  });
}

/** All historical scans of the same product name, newest first (compliance history). */
export function scansOfSameProduct(
  records: AnalysisRecord[],
  record: AnalysisRecord,
): AnalysisRecord[] {
  const name = (record.extracted.fields.product_name?.value ?? "").trim().toLowerCase();
  if (!name) return [];
  return records.filter(
    (r) =>
      r.id !== record.id &&
      (r.extracted.fields.product_name?.value ?? "").trim().toLowerCase() === name,
  );
}
