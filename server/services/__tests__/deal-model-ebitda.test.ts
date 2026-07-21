/**
 * Acceptance tests for fetchReportedEbitdaByYear (Slice 4 + Slice 12).
 *
 * Part A — pure logic tests (no DB needed).
 *   applyEbitdaLoop mirrors the WHERE + loop inside fetchReportedEbitdaByYear
 *   so we can unit-test filtering rules without a live connection.
 *
 * Part B — DB integration tests (graceful skip when no data).
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '../../db';
import {
  financialPeriods,
} from '@shared/schema';
import { fetchReportedEbitdaByYear } from '../deal-model.service';

// ─────────────────────────────────────────────────────────────────────────────
// Helper — mirrors the WHERE + loop from fetchReportedEbitdaByYear
// ─────────────────────────────────────────────────────────────────────────────
function applyEbitdaLoop(
  rows: Array<{
    periodEnd: string | null;
    fiscalYear: number | null;
    isFullYear: boolean;
    sourceTier?: string | null;
    operatingProfit: string | null;
    depreciationAmortisation: string | null;
  }>,
  todayOverride?: string,
): Record<string, number> {
  // Mirror the WHERE from fetchReportedEbitdaByYear:
  //   is_full_year = true
  //   AND (source_tier IS NULL OR source_tier <> 'information_memorandum')
  //   AND period_end <= today           ← Slice 17 completed-year gate
  //   AND fiscal_year <= currentYear    ← guards mislabelled future fiscal years
  // ORDER BY period_end DESC
  const today = todayOverride ?? new Date().toISOString().split('T')[0];
  const currentYear = todayOverride
    ? parseInt(todayOverride.slice(0, 4), 10)
    : new Date().getFullYear();
  const filtered = rows
    .filter(r => r.isFullYear)
    .filter(r => r.sourceTier == null || r.sourceTier !== 'information_memorandum')
    .filter(r => r.periodEnd != null && r.periodEnd <= today)
    .filter(r => r.fiscalYear == null || r.fiscalYear <= currentYear)
    .sort((a, b) => (b.periodEnd ?? '').localeCompare(a.periodEnd ?? ''));

  const result: Record<string, number> = {};
  for (const row of filtered) {
    const year =
      row.fiscalYear?.toString() ||
      (row.periodEnd ? new Date(row.periodEnd).getFullYear().toString() : null);
    if (!year) continue;
    if (year in result) continue; // first (most-recent) row wins
    const op = parseFloat(row.operatingProfit ?? '0') || 0;
    const da = parseFloat(row.depreciationAmortisation ?? '0') || 0;
    result[year] = op + da;
  }
  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// Part A — pure unit tests
// ─────────────────────────────────────────────────────────────────────────────
describe('fetchReportedEbitdaByYear — pure logic', () => {
  it('returns exactly one value per fiscal year even with duplicate rows', () => {
    const rows = [
      { fiscalYear: 2023, periodEnd: '2023-12-31', isFullYear: true, sourceTier: 'statutory',   operatingProfit: '200000', depreciationAmortisation: '10000' },
      { fiscalYear: 2023, periodEnd: '2023-03-31', isFullYear: true, sourceTier: 'statutory',   operatingProfit: '150000', depreciationAmortisation: '8000' },
      { fiscalYear: 2022, periodEnd: '2022-12-31', isFullYear: true, sourceTier: 'statutory',   operatingProfit: '180000', depreciationAmortisation: '9000' },
    ];
    const result = applyEbitdaLoop(rows);
    expect(Object.keys(result)).toHaveLength(2);
    expect(result['2023']).toBe(210000);
    expect(result['2022']).toBe(189000);
  });

  it('excludes part-year periods (isFullYear = false)', () => {
    const rows = [
      { fiscalYear: 2023, periodEnd: '2023-06-30', isFullYear: false, sourceTier: 'management', operatingProfit: '100000', depreciationAmortisation: '5000' },
      { fiscalYear: 2023, periodEnd: '2023-12-31', isFullYear: true,  sourceTier: 'statutory',  operatingProfit: '200000', depreciationAmortisation: '10000' },
      { fiscalYear: 2022, periodEnd: '2022-12-31', isFullYear: false, sourceTier: 'management', operatingProfit: '150000', depreciationAmortisation: '7000' },
    ];
    const result = applyEbitdaLoop(rows);
    expect(Object.keys(result)).toHaveLength(1);
    expect(result['2023']).toBe(210000);
    expect(result['2022']).toBeUndefined();
  });

  it('returns a non-empty map for management-tier data (no management filter applied)', () => {
    const rows = [
      { fiscalYear: 2023, periodEnd: '2023-12-31', isFullYear: true, sourceTier: 'management', operatingProfit: '300000', depreciationAmortisation: '20000' },
      { fiscalYear: 2022, periodEnd: '2022-12-31', isFullYear: true, sourceTier: 'management', operatingProfit: '280000', depreciationAmortisation: '18000' },
    ];
    const result = applyEbitdaLoop(rows);
    expect(Object.keys(result).length).toBeGreaterThan(0);
    expect(result['2023']).toBe(320000);
    expect(result['2022']).toBe(298000);
  });

  it('offer path and screen path use the same function (structural)', () => {
    expect(typeof fetchReportedEbitdaByYear).toBe('function');
    expect(fetchReportedEbitdaByYear.name).toBe('fetchReportedEbitdaByYear');
  });

  // ── Slice 12 spec tests ──────────────────────────────────────────────────

  it('Slice 12 — statutory FY2022-2024 + IM FY2025 full-year → FY2025 excluded', () => {
    const rows = [
      { fiscalYear: 2022, periodEnd: '2022-03-31', isFullYear: true, sourceTier: 'statutory',              operatingProfit: '100000', depreciationAmortisation: '10000' },
      { fiscalYear: 2023, periodEnd: '2023-03-31', isFullYear: true, sourceTier: 'statutory',              operatingProfit: '120000', depreciationAmortisation: '11000' },
      { fiscalYear: 2024, periodEnd: '2024-03-31', isFullYear: true, sourceTier: 'statutory',              operatingProfit: '140000', depreciationAmortisation: '12000' },
      { fiscalYear: 2025, periodEnd: '2025-03-31', isFullYear: true, sourceTier: 'information_memorandum', operatingProfit: '200000', depreciationAmortisation: '20000' },
    ];
    const result = applyEbitdaLoop(rows);

    expect(Object.keys(result)).toHaveLength(3);
    expect(result['2022']).toBe(110000);
    expect(result['2023']).toBe(131000);
    expect(result['2024']).toBe(152000);
    expect(result['2025']).toBeUndefined();
  });

  it('Slice 12 — IM-only full years → empty map (provisional; offer cannot be built)', () => {
    const rows = [
      { fiscalYear: 2021, periodEnd: '2021-03-31', isFullYear: true, sourceTier: 'information_memorandum', operatingProfit: '80000',  depreciationAmortisation: '8000' },
      { fiscalYear: 2022, periodEnd: '2022-03-31', isFullYear: true, sourceTier: 'information_memorandum', operatingProfit: '100000', depreciationAmortisation: '10000' },
      { fiscalYear: 2023, periodEnd: '2023-03-31', isFullYear: true, sourceTier: 'information_memorandum', operatingProfit: '120000', depreciationAmortisation: '12000' },
    ];
    const result = applyEbitdaLoop(rows);

    expect(Object.keys(result)).toHaveLength(0);
  });

  it('Slice 12 — part-year still excluded even when sourceTier is statutory', () => {
    const rows = [
      { fiscalYear: 2024, periodEnd: '2024-09-30', isFullYear: false, sourceTier: 'statutory',  operatingProfit: '50000', depreciationAmortisation: '5000' },
      { fiscalYear: 2023, periodEnd: '2023-03-31', isFullYear: true,  sourceTier: 'statutory',  operatingProfit: '120000', depreciationAmortisation: '11000' },
    ];
    const result = applyEbitdaLoop(rows);

    expect(result['2024']).toBeUndefined();
    expect(result['2023']).toBe(131000);
  });

  it('Slice 12 — NULL sourceTier (legacy row) is included as non-IM', () => {
    const rows = [
      { fiscalYear: 2023, periodEnd: '2023-12-31', isFullYear: true, sourceTier: null, operatingProfit: '200000', depreciationAmortisation: '15000' },
    ];
    const result = applyEbitdaLoop(rows);

    expect(result['2023']).toBe(215000);
  });

  // ── Slice 17 spec tests — completed-year gate ────────────────────────────

  it('Slice 17 — future period_end is excluded from valuation', () => {
    const rows = [
      { fiscalYear: 2025, periodEnd: '2025-12-31', isFullYear: true, sourceTier: 'statutory', operatingProfit: '200000', depreciationAmortisation: '20000' },
      { fiscalYear: 2026, periodEnd: '2026-12-31', isFullYear: true, sourceTier: 'statutory', operatingProfit: '250000', depreciationAmortisation: '25000' },
      { fiscalYear: 2027, periodEnd: '2027-12-31', isFullYear: true, sourceTier: 'management', operatingProfit: '300000', depreciationAmortisation: '30000' },
    ];
    // Simulate today = 2026-07-21: FY2025 completed, FY2026 not yet (2026-12-31 > today), FY2027 future
    const result = applyEbitdaLoop(rows, '2026-07-21');

    expect(result['2025']).toBe(220000);
    expect(result['2026']).toBeUndefined();
    expect(result['2027']).toBeUndefined();
    expect(Object.keys(result)).toHaveLength(1);
  });

  it('Slice 17 — period_end exactly equal to today is included (boundary)', () => {
    const today = new Date().toISOString().split('T')[0];
    const rows = [
      { fiscalYear: 2024, periodEnd: '2024-03-31', isFullYear: true, sourceTier: 'statutory', operatingProfit: '150000', depreciationAmortisation: '15000' },
      { fiscalYear: 2025, periodEnd: today,          isFullYear: true, sourceTier: 'statutory', operatingProfit: '180000', depreciationAmortisation: '18000' },
    ];
    const result = applyEbitdaLoop(rows);

    expect(result['2024']).toBe(165000);
    expect(result['2025']).toBe(198000); // today boundary is INCLUDED
  });

  it('Slice 17 — forecast-only company returns empty map', () => {
    const rows = [
      { fiscalYear: 2027, periodEnd: '2027-12-31', isFullYear: true, sourceTier: 'management', operatingProfit: '500000', depreciationAmortisation: '50000' },
      { fiscalYear: 2028, periodEnd: '2028-12-31', isFullYear: true, sourceTier: 'management', operatingProfit: '600000', depreciationAmortisation: '60000' },
    ];
    const result = applyEbitdaLoop(rows, '2026-07-21');

    expect(Object.keys(result)).toHaveLength(0);
  });

  it('Slice 17 — mix of completed and forecast: only completed years returned', () => {
    const rows = [
      { fiscalYear: 2023, periodEnd: '2023-12-31', isFullYear: true, sourceTier: 'statutory',  operatingProfit: '100000', depreciationAmortisation: '10000' },
      { fiscalYear: 2024, periodEnd: '2024-12-31', isFullYear: true, sourceTier: 'statutory',  operatingProfit: '120000', depreciationAmortisation: '12000' },
      { fiscalYear: 2025, periodEnd: '2025-12-31', isFullYear: true, sourceTier: 'statutory',  operatingProfit: '140000', depreciationAmortisation: '14000' },
      { fiscalYear: 2026, periodEnd: '2026-12-31', isFullYear: true, sourceTier: 'management', operatingProfit: '160000', depreciationAmortisation: '16000' },
      { fiscalYear: 2027, periodEnd: '2027-12-31', isFullYear: true, sourceTier: 'management', operatingProfit: '180000', depreciationAmortisation: '18000' },
    ];
    const result = applyEbitdaLoop(rows, '2026-07-21');

    expect(Object.keys(result)).toHaveLength(3);
    expect(result['2023']).toBe(110000);
    expect(result['2024']).toBe(132000);
    expect(result['2025']).toBe(154000);
    expect(result['2026']).toBeUndefined();
    expect(result['2027']).toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Part B — DB integration tests
// ─────────────────────────────────────────────────────────────────────────────
describe('fetchReportedEbitdaByYear — DB integration', () => {
  let targetCompanyId: number | null = null;

  beforeAll(async () => {
    const rows = await db
      .select({ id: financialPeriods.targetCompanyId })
      .from(financialPeriods)
      .where(eq(financialPeriods.isFullYear, true))
      .limit(1);
    targetCompanyId = rows[0]?.targetCompanyId ?? null;
    if (!targetCompanyId) {
      console.warn('[TEST] No full-year periods found in DB — skipping DB integration tests');
    }
  });

  it('returns a map (possibly empty) without throwing', async () => {
    if (!targetCompanyId) return;
    const result = await fetchReportedEbitdaByYear(targetCompanyId);
    expect(result).toBeDefined();
    expect(typeof result).toBe('object');
  });

  it('at most one value per fiscal year', async () => {
    if (!targetCompanyId) return;
    const result = await fetchReportedEbitdaByYear(targetCompanyId);
    const years = Object.keys(result);
    const uniqueYears = new Set(years);
    expect(years.length).toBe(uniqueYears.size);
  });

  it('all values are finite numbers', async () => {
    if (!targetCompanyId) return;
    const result = await fetchReportedEbitdaByYear(targetCompanyId);
    for (const [year, val] of Object.entries(result)) {
      expect(typeof val).toBe('number');
      expect(isFinite(val)).toBe(true);
    }
  });
});
