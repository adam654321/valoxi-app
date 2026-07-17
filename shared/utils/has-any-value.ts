/**
 * Pure helper — decides whether a plain-object row has at least one genuine
 * scalar (non-null, non-object) value worth storing.
 *
 * Breakdown fields (revenueBreakdown, costOfSalesBreakdown, etc.) are JSON
 * objects/arrays that must NOT count as "real data" — an empty `{}` breakdown
 * returned from a balance-sheet extraction would otherwise fabricate a phantom
 * P&L row.  We skip any value whose typeof is 'object' (covers plain objects,
 * arrays, and null is already excluded by the null check above).
 *
 * Explicit skip list covers housekeeping keys that are never financial data.
 */
const HOUSEKEEPING_KEYS = new Set(['sourceDocumentId', 'updatedAt']);

export function hasAnyValue(obj: Record<string, unknown>): boolean {
  return Object.entries(obj).some(([k, v]) => {
    if (HOUSEKEEPING_KEYS.has(k)) return false;
    if (v === null || v === undefined) return false;
    if (typeof v === 'object') return false; // breakdowns, arrays, etc.
    return true;
  });
}
