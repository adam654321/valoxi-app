/**
 * Slice 1c.1a - evidence version diff comparator.
 *
 * PURE. No database access, no imports from server/, no clock, no I/O.
 * NEVER THROWS. Malformed or non-array inputs are tolerated by skipping
 * offending rows. All counters satisfy:
 *   baseCount  === equal + differ + baseOnly
 *   compareCount === equal + differ + compareOnly
 * by construction (R9).
 */

export interface EvidenceFigureRow {
  documentId: number;
  documentType: string;
  extractionVersion: number;
  fiscalYearStated: number | null;
  payloadPath: string;
  value: string | null;
  pageNumber: number | null;
  labelTextAsPrinted: string | null;
  statementType: string;
}

export interface FigureDiff {
  key: string;
  documentId: number;
  fiscalYearStated: number | null;
  payloadPath: string;
  baseValue: string | null;
  compareValue: string | null;
  bucket: 'EQUAL' | 'DIFFER' | 'BASE_ONLY' | 'COMPARE_ONLY';
  absoluteDifference: number | null;
}

export interface DiffResult {
  baseCount: number;
  compareCount: number;
  equal: number;
  differ: number;
  baseOnly: number;
  compareOnly: number;
  diffs: FigureDiff[];
  anchorCoverage: {
    compareTotal: number;
    withPage: number;
    withLabel: number;
    withBoth: number;
  };
  duplicateBaseKeys: string[];
  duplicateCompareKeys: string[];
}

/**
 * R1. Key = documentId | fiscalYearStated (literal "null" when null) | payloadPath.
 * document_type and statement_type are intentionally excluded.
 */
export function buildFigureKey(row: EvidenceFigureRow): string {
  const fy = row.fiscalYearStated === null ? 'null' : String(row.fiscalYearStated);
  return `${row.documentId}|${fy}|${row.payloadPath}`;
}

/**
 * R2/R3. Parse to a finite number or return null.
 * A string that does not yield a finite number is treated as null.
 */
function parseValue(v: string | null | undefined): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * R8. Validates that a row has the minimum fields required to be useful.
 * Rows that fail this check are silently skipped and not counted.
 */
function isValidRow(row: unknown): row is EvidenceFigureRow {
  if (row === null || typeof row !== 'object') return false;
  const r = row as Record<string, unknown>;
  return (
    typeof r['documentId'] === 'number' &&
    typeof r['documentType'] === 'string' &&
    typeof r['extractionVersion'] === 'number' &&
    (r['fiscalYearStated'] === null || typeof r['fiscalYearStated'] === 'number') &&
    typeof r['payloadPath'] === 'string' &&
    typeof r['statementType'] === 'string'
  );
}

function toArray(input: unknown): unknown[] {
  if (!Array.isArray(input)) return [];
  return input;
}

/**
 * R6. Build a keyed map from an array, recording duplicates.
 * First occurrence wins; subsequent occurrences with the same key are pushed
 * into duplicateKeys and skipped.
 */
function buildMap(
  rows: unknown[],
  duplicateKeys: string[],
): Map<string, EvidenceFigureRow> {
  const map = new Map<string, EvidenceFigureRow>();
  for (const row of rows) {
    if (!isValidRow(row)) continue;
    const key = buildFigureKey(row);
    if (map.has(key)) {
      duplicateKeys.push(key);
    } else {
      map.set(key, row);
    }
  }
  return map;
}

/**
 * Compare two sets of evidence figure rows, one per extraction version.
 *
 * R8. Never throws on any input.
 * R9. baseCount and compareCount are derived from bucket totals, never computed
 *     independently, so the reconciliation identities hold by construction.
 */
export function diffEvidenceVersions(base: unknown, compare: unknown): DiffResult {
  const duplicateBaseKeys: string[] = [];
  const duplicateCompareKeys: string[] = [];

  const baseMap = buildMap(toArray(base), duplicateBaseKeys);
  const compareMap = buildMap(toArray(compare), duplicateCompareKeys);

  const diffs: FigureDiff[] = [];
  let equal = 0;
  let differ = 0;
  let baseOnly = 0;
  let compareOnly = 0;

  // Pass 1: all base keys
  for (const [key, baseRow] of baseMap) {
    if (compareMap.has(key)) {
      const compareRow = compareMap.get(key)!;
      const bNum = parseValue(baseRow.value);
      const cNum = parseValue(compareRow.value);

      let bucket: 'EQUAL' | 'DIFFER';
      let absoluteDifference: number | null = null;

      if (bNum === null && cNum === null) {
        // R3: null vs null → EQUAL
        bucket = 'EQUAL';
      } else if (bNum !== null && cNum !== null) {
        // R2: numeric comparison, zero tolerance
        if (bNum === cNum) {
          bucket = 'EQUAL';
        } else {
          bucket = 'DIFFER';
          // R4: absoluteDifference only when both finite and they differ
          absoluteDifference = Math.abs(bNum - cNum);
        }
      } else {
        // R3: one null, one value → DIFFER, absoluteDifference null
        bucket = 'DIFFER';
      }

      if (bucket === 'EQUAL') {
        equal++;
      } else {
        differ++;
      }

      diffs.push({
        key,
        documentId: baseRow.documentId,
        fiscalYearStated: baseRow.fiscalYearStated,
        payloadPath: baseRow.payloadPath,
        baseValue: baseRow.value ?? null,
        compareValue: compareRow.value ?? null,
        bucket,
        absoluteDifference,
      });
    } else {
      // R5: base key absent from compare
      baseOnly++;
      diffs.push({
        key,
        documentId: baseRow.documentId,
        fiscalYearStated: baseRow.fiscalYearStated,
        payloadPath: baseRow.payloadPath,
        baseValue: baseRow.value ?? null,
        compareValue: null,
        bucket: 'BASE_ONLY',
        absoluteDifference: null,
      });
    }
  }

  // Pass 2: compare keys not present in base
  for (const [key, compareRow] of compareMap) {
    if (!baseMap.has(key)) {
      // R5: compare key absent from base
      compareOnly++;
      diffs.push({
        key,
        documentId: compareRow.documentId,
        fiscalYearStated: compareRow.fiscalYearStated,
        payloadPath: compareRow.payloadPath,
        baseValue: null,
        compareValue: compareRow.value ?? null,
        bucket: 'COMPARE_ONLY',
        absoluteDifference: null,
      });
    }
  }

  // R7: anchor coverage counts over COMPARE set only
  let withPage = 0;
  let withLabel = 0;
  let withBoth = 0;
  for (const row of compareMap.values()) {
    const hasPage = row.pageNumber !== null && row.pageNumber !== undefined;
    const hasLabel = row.labelTextAsPrinted !== null && row.labelTextAsPrinted !== undefined;
    if (hasPage) withPage++;
    if (hasLabel) withLabel++;
    if (hasPage && hasLabel) withBoth++;
  }

  // R9: derive totals from bucket counters, never independently
  const baseCount = equal + differ + baseOnly;
  const compareCount = equal + differ + compareOnly;

  return {
    baseCount,
    compareCount,
    equal,
    differ,
    baseOnly,
    compareOnly,
    diffs,
    anchorCoverage: {
      compareTotal: compareMap.size,
      withPage,
      withLabel,
      withBoth,
    },
    duplicateBaseKeys,
    duplicateCompareKeys,
  };
}
