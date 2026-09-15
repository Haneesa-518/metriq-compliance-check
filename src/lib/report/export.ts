/**
 * Report generation. Produces a real PDF file (jsPDF) and an editable
 * document (Word-compatible HTML) from a stored analysis record — both carry
 * exactly the same content as the on-screen report.
 */
import type { AnalysisRecord, CheckResult } from "@/lib/compliance/types";
import { STATUS_LABELS } from "@/lib/compliance/types";
import { getRule } from "@/lib/legal/rules.data";
import { buildReviewList } from "@/lib/compliance/engine";

export const REPORT_DISCLAIMER =
  "MetriQ is an AI-assisted screening prototype offering compliance assistance only. It is not legal advice, is not affiliated with or certified by any government body, and its output is not legally binding. Results describe information detected or not detected in the submitted source. A high screening coverage score does not guarantee legal compliance. All findings must be verified by a qualified authority.";

function overallLabel(record: AnalysisRecord) {
  return record.summary.overall === "COMPLIANT"
    ? "NO ISSUES DETECTED IN AUTOMATED SCREENING"
    : "MANUAL VERIFICATION REQUIRED";
}

function sourceLine(record: AnalysisRecord) {
  if (record.analysis_source === "ecommerce_url")
    return `E-commerce listing — ${record.source_url ?? "URL not recorded"}`;
  if (record.is_demo) return "Demo mode — synthetic sample data";
  return "Uploaded product package image";
}

function escapeHtml(value: string) {
  return value.replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!,
  );
}

function flagged(record: AnalysisRecord): CheckResult[] {
  return record.checks.filter((c) => c.status === "FAIL" || c.status === "REVIEW");
}

export function reportFileName(record: AnalysisRecord, ext: string) {
  return `MetriQ-${record.id}.${ext}`;
}

/** Editable Word-compatible document (opens in Word, Pages and Google Docs). */
export function buildEditableReport(record: AnalysisRecord): Blob {
  const review = record.review_first ?? buildReviewList(record.checks, record.discrepancies ?? []);
  const rows = (cells: string[][]) =>
    cells
      .map(
        (r) =>
          `<tr>${r.map((c) => `<td style="border:1px solid #ccc;padding:4px">${c}</td>`).join("")}</tr>`,
      )
      .join("");

  const html = `<!DOCTYPE html><html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><title>MetriQ Compliance Report ${escapeHtml(record.id)}</title></head>
<body style="font-family:Arial,sans-serif;font-size:11pt;color:#111">
<h1>MetriQ — Compliance Screening Report</h1>
<p><b>Analysis ID:</b> ${escapeHtml(record.id)}<br>
<b>Analyzed:</b> ${new Date(record.created_at).toLocaleString()}<br>
<b>Generated:</b> ${new Date().toLocaleString()}<br>
<b>Source:</b> ${escapeHtml(sourceLine(record))}<br>
<b>Product:</b> ${escapeHtml(record.extracted.fields.product_name?.value ?? record.page_title ?? "Not detected")}</p>

<h2>Overall screening result</h2>
<p><b>${overallLabel(record)}</b> — Screening coverage score ${record.summary.score}% (automated screening coverage, not a legal compliance determination).<br>
PASS ${record.summary.passed} · REVIEW ${record.summary.review} · FAIL ${record.summary.failed} · NOT APPLICABLE ${record.summary.not_applicable} over ${record.summary.applicable} applicable checks.</p>

<h2>Review first (METRIQ inspection priority)</h2>
${
  review.length === 0
    ? "<p>No items flagged.</p>"
    : `<table style="border-collapse:collapse;width:100%">${rows([
        [
          "<b>Priority</b>",
          "<b>Issue</b>",
          "<b>Result</b>",
          "<b>Why it matters</b>",
          "<b>Action</b>",
        ],
        ...review.map((r) => [
          r.severity,
          escapeHtml(r.title),
          r.status,
          escapeHtml(r.reason),
          escapeHtml(r.action),
        ]),
      ])}</table>`
}

<h2>Extracted declarations</h2>
<table style="border-collapse:collapse;width:100%">${rows([
    [
      "<b>Declaration</b>",
      "<b>Detected value</b>",
      "<b>Extraction confidence</b>",
      "<b>Source</b>",
    ],
    ...Object.values(record.extracted.fields).map((f) => [
      escapeHtml(f.label),
      escapeHtml(f.value ?? "Not detected"),
      `${Math.round(f.confidence * 100)}% (${f.band})`,
      escapeHtml(f.source),
    ]),
  ])}</table>

<h2>Rule check results</h2>
<table style="border-collapse:collapse;width:100%">${rows([
    ["<b>Rule</b>", "<b>Check</b>", "<b>Result</b>", "<b>Finding</b>"],
    ...record.checks.map((c) => [
      escapeHtml(c.rule_reference),
      escapeHtml(c.label),
      STATUS_LABELS[c.status],
      escapeHtml(c.message),
    ]),
  ])}</table>

${
  (record.discrepancies ?? []).length > 0
    ? `<h2>Cross-source discrepancies</h2><ul>${(record.discrepancies ?? [])
        .map(
          (d) =>
            `<li><b>${escapeHtml(d.label)}</b> (${d.severity}) — ${escapeHtml(d.message)}</li>`,
        )
        .join("")}</ul>`
    : ""
}

<h2>Evidence — extracted text</h2>
<pre style="white-space:pre-wrap;font-family:Consolas,monospace;font-size:9pt">${escapeHtml(
    record.extracted.raw_text || "No text extracted.",
  )}</pre>

<h2>Recommendations</h2>
<ul>${record.recommendations.map((r) => `<li>${escapeHtml(r)}</li>`).join("")}</ul>

<h2>Disclaimer</h2>
<p>${REPORT_DISCLAIMER}</p>
</body></html>`;

  return new Blob([html], { type: "application/msword" });
}

/** Real PDF file, generated client-side. */
export async function buildPdfReport(record: AnalysisRecord): Promise<Blob> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const M = 42;
  const W = doc.internal.pageSize.getWidth() - M * 2;
  let y = M;

  const page = () => {
    if (y > doc.internal.pageSize.getHeight() - 60) {
      doc.addPage();
      y = M;
    }
  };
  // The built-in PDF fonts are Latin-1 only: the rupee sign and dashes would
  // otherwise render as wrong glyphs.
  const ascii = (value: string) =>
    value
      .replace(/₹/g, "Rs. ")
      .replace(/[–—]/g, "-")
      .replace(/[“”]/g, '"')
      .replace(/[‘’]/g, "'")
      .replace(/·/g, "-")
      .replace(/•/g, "-")
      .split("")
      .filter((char) => char.charCodeAt(0) <= 0xff)
      .join("");
  const text = (value: string, size = 10, style: "normal" | "bold" = "normal", gap = 4) => {
    doc.setFont("helvetica", style);
    doc.setFontSize(size);
    for (const line of doc.splitTextToSize(ascii(value), W) as string[]) {
      page();
      doc.text(line, M, y);
      y += size + 2;
    }
    y += gap;
  };
  const heading = (value: string) => {
    y += 6;
    page();
    text(value.toUpperCase(), 11, "bold", 2);
    doc.setDrawColor(200);
    doc.line(M, y - 4, M + W, y - 4);
    y += 4;
  };

  text("MetriQ — Compliance Screening Report", 17, "bold", 6);
  text(
    `Analysis ID: ${record.id}\nAnalyzed: ${new Date(record.created_at).toLocaleString()}\nGenerated: ${new Date().toLocaleString()}\nSource: ${sourceLine(record)}\nProduct: ${record.extracted.fields.product_name?.value ?? record.page_title ?? "Not detected"}`,
    9,
  );

  heading("Overall screening result");
  text(overallLabel(record), 12, "bold", 2);
  text(
    `Screening coverage score: ${record.summary.score}% — automated screening coverage, not a legal compliance determination.\nPASS ${record.summary.passed} · REVIEW ${record.summary.review} · FAIL ${record.summary.failed} · NOT APPLICABLE ${record.summary.not_applicable} over ${record.summary.applicable} applicable checks.`,
    9,
  );

  const image = record.image_data_url;
  if (image && /^data:image\/(png|jpe?g);base64,/i.test(image)) {
    try {
      const props = doc.getImageProperties(image);
      const w = Math.min(W, 240);
      const h = (props.height / props.width) * w;
      page();
      if (y + h > doc.internal.pageSize.getHeight() - 60) {
        doc.addPage();
        y = M;
      }
      heading("Evidence — submitted image");
      doc.addImage(image, props.fileType, M, y, w, h);
      y += h + 12;
    } catch {
      /* image evidence is optional in the PDF */
    }
  }

  const review = record.review_first ?? buildReviewList(record.checks, record.discrepancies ?? []);
  heading("Review first (METRIQ inspection priority)");
  if (review.length === 0) text("No items flagged in this screening run.", 9);
  review.forEach((r, i) => {
    text(`${i + 1}. [${r.severity}] ${r.title} — ${r.status}`, 10, "bold", 1);
    text(`Why it matters: ${r.reason}`, 9, "normal", 1);
    text(`Action: ${r.action}`, 9);
  });

  heading("Extracted declarations");
  for (const f of Object.values(record.extracted.fields)) {
    text(
      `${f.label}: ${f.value ?? "Not detected"}  —  extraction confidence ${Math.round(f.confidence * 100)}% (${f.band}), source ${f.source}`,
      9,
      "normal",
      1,
    );
  }

  heading("Rule check results");
  for (const c of record.checks) {
    text(`${c.rule_reference} · ${c.label} — ${STATUS_LABELS[c.status]}`, 9, "bold", 1);
    text(c.message, 9, "normal", 3);
  }

  if ((record.discrepancies ?? []).length > 0) {
    heading("Cross-source discrepancies");
    for (const d of record.discrepancies ?? []) {
      text(`[${d.severity}] ${d.label} — ${d.message}`, 9, "normal", 2);
    }
  }

  heading("Evidence — extracted text");
  text(record.extracted.raw_text || "No text extracted.", 8);

  heading("Recommendations");
  for (const r of record.recommendations) text(`• ${r}`, 9, "normal", 1);

  heading("Disclaimer");
  text(REPORT_DISCLAIMER, 8);

  for (const ruleId of Array.from(new Set(record.checks.map((c) => c.rule_reference)))) {
    const rule = getRule(ruleId);
    if (rule)
      text(
        `${ruleId} — ${rule.title} · ${rule.source_document}, ${rule.source_reference}`,
        7,
        "normal",
        0,
      );
  }

  return doc.output("blob");
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
