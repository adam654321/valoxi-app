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

/**
 * Secondary gate for income contributions: requires at least one CORE P&L
 * field to be non-null before treating the row as a genuine income statement.
 *
 * Fields like netProfit, staffCosts, and dividendsPaid appear on balance
 * sheets (equity section, notes). An extraction that has only those fields
 * is a balance-sheet artefact, not a real P&L, and must be discarded.
 *
 * Core fields chosen because they form the spine of any P&L:
 *   revenue → costOfSales → grossProfit → operatingProfit → profitBeforeTax
 */
const CORE_INCOME_FIELDS = new Set([
  'revenue',
  'costOfSales',
  'grossProfit',
  'operatingProfit',
  'profitBeforeTax',
]);

export function hasCoreIncomeValue(plFields: Record<string, unknown>): boolean {
  return Array.from(CORE_INCOME_FIELDS).some(
    k => plFields[k] !== null && plFields[k] !== undefined,
  );
}
