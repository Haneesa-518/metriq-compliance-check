/**
 * Role-aware extraction of the manufacturer / packer / importer declarations.
 *
 * A company name on a label means nothing on its own — the role marker in front
 * of it does. "Marketed by" is NOT a manufacturer declaration and "Distributed
 * by" is NOT an importer declaration, so those are captured separately and
 * reported as ambiguous instead of being mapped onto a mandatory role.
 */

export type EntityRole = "manufacturer" | "packer" | "importer" | "ambiguous";

export interface EntityDeclaration {
  role: EntityRole;
  /** the literal marker text that established the role */
  marker: string;
  name: string | null;
  address: string | null;
  raw_text: string;
  confidence: number;
  evidence: string;
}

interface Marker {
  re: RegExp;
  role: EntityRole;
  confidence: number;
}

/**
 * Markers are matched against normalised text, so OCR noise such as
 * "M f d . b y" or "Manufactured  &  Packed  By" still resolves.
 */
const MARKERS: Marker[] = [
  { re: /manufactured\s*(?:and|&)?\s*packed\s*(?:and|&)?\s*marketed\s*by/, role: "manufacturer", confidence: 0.9 },
  { re: /manufactured\s*(?:and|&)\s*marketed\s*by/, role: "manufacturer", confidence: 0.88 },
  { re: /manufactured\s*(?:and|&)\s*packed\s*by/, role: "manufacturer", confidence: 0.9 },
  { re: /manufactured\s*(?:by|at|in)/, role: "manufacturer", confidence: 0.9 },
  { re: /mfd?\s*\.?\s*by/, role: "manufacturer", confidence: 0.82 },
  { re: /manufacturer/, role: "manufacturer", confidence: 0.8 },
  { re: /packed\s*(?:and|&)\s*marketed\s*by/, role: "packer", confidence: 0.86 },
  { re: /(?:re)?packed\s*(?:by|at|for)/, role: "packer", confidence: 0.86 },
  { re: /pkd\s*\.?\s*by/, role: "packer", confidence: 0.78 },
  { re: /packer/, role: "packer", confidence: 0.78 },
  { re: /imported\s*(?:and|&)\s*marketed\s*by/, role: "importer", confidence: 0.88 },
  { re: /imported\s*(?:by|for)/, role: "importer", confidence: 0.9 },
  { re: /importer/, role: "importer", confidence: 0.82 },
  { re: /marketed\s*by/, role: "ambiguous", confidence: 0.5 },
  { re: /distributed\s*by|distributor/, role: "ambiguous", confidence: 0.5 },
  { re: /sold\s*by/, role: "ambiguous", confidence: 0.45 },
  { re: /brand\s*owner/, role: "ambiguous", confidence: 0.5 },
];

/** Collapse OCR spacing/punctuation noise and common misreadings. */
export function normalizeLabelText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[|]/g, "l")
    .replace(/0(?=[a-z])/g, "o")
    .replace(/\s*\.\s*/g, ".")
    .replace(/(?<=\b[a-z])\s(?=[a-z]\b)/g, "")
    .replace(/[^a-z0-9&.\s]/g, " ")
    .replace(/manufactur[a-z]{0,4}/g, "manufactured")
    .replace(/\s+/g, " ")
    .trim();
}

const ADDRESS_HINT = /\d{6}\b|road|street|st\.|nagar|estate|industrial|plot|phase|dist|district|tal\.|village|city|state|india|pin\b|p\.o|sector|block|floor/i;
const STOP_LINE = /^(net\s|mrp|m\.r\.p|price|best\s*before|use\s*by|mfg|pkd|batch|lot|ingredients|fssai|customer|consumer|for\s+queries|email|www)/i;

function splitNameAddress(raw: string): { name: string | null; address: string | null } {
  const parts = raw
    .split(/\n|,(?=\s*[A-Z0-9])/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 0) return { name: null, address: null };
  const name = parts[0];
  const address = parts.slice(1).join(", ") || null;
  return { name, address: address && ADDRESS_HINT.test(address) ? address : address };
}

/**
 * Extract every role declaration from OCR lines. Each declaration keeps the
 * continuation lines that look like part of its address.
 */
export function extractEntityDeclarations(lines: string[]): EntityDeclaration[] {
  const out: EntityDeclaration[] = [];

  for (let i = 0; i < lines.length; i++) {
    const normalized = normalizeLabelText(lines[i]);
    let best: { marker: Marker; match: RegExpMatchArray } | null = null;
    for (const marker of MARKERS) {
      const match = normalized.match(marker.re);
      if (match && (!best || (match.index ?? 0) < (best.match.index ?? 0) || match[0].length > best.match[0].length)) {
        if (!best || match[0].length > best.match[0].length) best = { marker, match };
      }
    }
    if (!best) continue;

    // Text following the marker on the same line. The marker is re-located in
    // the ORIGINAL line (normalisation changes offsets), with a tolerant
    // pattern so OCR spacing and punctuation noise still matches.
    const loose = new RegExp(best.marker.re.source.replace(/\\s\*/g, "[\\s.]*"), "i");
    const inOriginal = lines[i].match(loose);
    let value = "";
    if (inOriginal && inOriginal.index !== undefined) {
      value = lines[i].slice(inOriginal.index + inOriginal[0].length).replace(/^[\s:.\-–—]+/, "").trim();
    } else {
      const tailNorm = normalized
        .slice((best.match.index ?? 0) + best.match[0].length)
        .replace(/^[\s:.\-]+/, "");
      value = tailNorm ? lines[i].slice(-tailNorm.length).replace(/^[\s:.\-]+/, "").trim() : "";
    }
    if (value.length < 3) value = "";

    const collected: string[] = value ? [value] : [];
    for (let j = i + 1; j < lines.length && collected.length < 4; j++) {
      const next = lines[j];
      if (!next || STOP_LINE.test(next)) break;
      if (MARKERS.some((m) => m.re.test(normalizeLabelText(next)))) break;
      collected.push(next.trim());
      if (/\b\d{6}\b/.test(next)) break;
      if (collected.length >= 1 && !ADDRESS_HINT.test(next) && collected.length > 1) break;
    }

    const raw_text = collected.join("\n").trim();
    if (!raw_text) continue;

    const { name, address } = splitNameAddress(raw_text);
    const hasAddress = Boolean(address && ADDRESS_HINT.test(address));
    out.push({
      role: best.marker.role,
      marker: best.match[0],
      name,
      address: hasAddress ? address : null,
      raw_text,
      confidence: Math.min(0.95, best.marker.confidence + (hasAddress ? 0.05 : -0.1)),
      evidence: lines[i],
    });
  }

  return out;
}

/** Highest-confidence declaration for a given role, if any. */
export function declarationFor(
  declarations: EntityDeclaration[],
  role: EntityRole,
): EntityDeclaration | null {
  return (
    declarations
      .filter((d) => d.role === role)
      .sort((a, b) => b.confidence - a.confidence)[0] ?? null
  );
}
