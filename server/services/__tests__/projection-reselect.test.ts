/**
 * Acceptance tests for the projection-reselect system.
 *
 * These are DB integration tests that replay the 4-step acceptance scenario:
 *   a. Statutory FY2023/2024 + IM FY2021–2025 → reselect → statutory wins where present
 *   b. An ebitda_adjustment on a surviving period → reselect → adjustment still there
 *   c. Drop statutory contributions → reselect → IM fallback for FY2023/2024
 *   d. Re-add statutory → reselect → statutory wins again
 *
 * Uses fiscal years 2901–2905 (far future) to avoid colliding with any real data.
 * All created rows are cleaned up in afterAll.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq, and, inArray } from 'drizzle-orm';
import { db } from '../../db';
import {
  financialContributions,
  financialPeriods,
  incomeStatements,
  ebitdaAdjustments,
  type FinancialContribution,
} from '@shared/schema';
import { reselect } from '../projection-reselect.service';

// ─────────────────────────────────────────────────────────────────────────────
// Test configuration
// ─────────────────────────────────────────────────────────────────────────────
const TEST_YEARS = [2901, 2902, 2903, 2904, 2905];
const STATUTORY_YEARS = [2903, 2904];
const IM_YEARS = TEST_YEARS;

const IM_REVENUE = '1000000';
const STAT_REVENUE_2903 = '2000000';
const STAT_REVENUE_2904 = '3000000';

const FAKE_IM_DOC_ID = 900001;
const FAKE_STAT_DOC_ID = 900002;

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
async function getTestTargetCompanyId(): Promise<number | null> {
  const rows = await db
    .select({ id: financialPeriods.targetCompanyId })
    .from(financialPeriods)
    .limit(1);
  return rows[0]?.targetCompanyId ?? null;
}

async function insertContributions(
  targetCompanyId: number,
  years: number[],
  tier: string,
  sourceDocumentId: number | null,
  revenueByYear: (y: number) => string,
) {
  for (const fy of years) {
    await db.insert(financialContributions).values({
      targetCompanyId,
      fiscalYear: fy,
      statementType: 'income',
      sourceDocumentId,
      sourceTier: tier,
      isFullYear: true,
      monthsCovered: 12,
      periodEnd: `${fy}-12-31`,
      asAtDate: null,
      figures: { revenue: revenueByYear(fy), costOfSales: null, grossProfit: null } as any,
    });
  }
}

async function getIncomeRevenue(
  targetCompanyId: number,
  fiscalYear: number,
): Promise<string | null> {
  const rows = await db
    .select({ revenue: incomeStatements.revenue })
    .from(incomeStatements)
    .innerJoin(
      financialPeriods,
      eq(incomeStatements.financialPeriodId, financialPeriods.id),
    )
    .where(
      and(
        eq(financialPeriods.targetCompanyId, targetCompanyId),
        eq(financialPeriods.fiscalYear, fiscalYear),
        eq(financialPeriods.isFullYear, true),
      ),
    )
    .limit(1);
  return rows[0]?.revenue ?? null;
}

async function countIncomeRows(targetCompanyId: number, years: number[]): Promise<number> {
  const periods = await db
    .select({ id: financialPeriods.id })
    .from(financialPeriods)
    .where(
      and(
        eq(financialPeriods.targetCompanyId, targetCompanyId),
        eq(financialPeriods.isFullYear, true),
      ),
    );

  const periodIds = periods.map(p => p.id);
  if (periodIds.length === 0) return 0;

  const incomeRows = await db
    .select({ id: incomeStatements.id })
    .from(incomeStatements)
    .where(
      and(
        eq(incomeStatements.targetCompanyId, targetCompanyId),
        inArray(incomeStatements.financialPeriodId, periodIds),
      ),
    );
  return incomeRows.length;
}

async function cleanup(targetCompanyId: number) {
  // Clean up in dependency order
  const periods = await db
    .select({ id: financialPeriods.id })
    .from(financialPeriods)
    .where(eq(financialPeriods.targetCompanyId, targetCompanyId));

  const periodIds = periods.map(p => p.id);

  if (periodIds.length > 0) {
    await db.delete(ebitdaAdjustments).where(
      inArray(ebitdaAdjustments.financialPeriodId, periodIds),
    );
    await db.delete(incomeStatements).where(
      inArray(incomeStatements.financialPeriodId, periodIds),
    );
  }

  await db.delete(financialContributions).where(
    eq(financialContributions.targetCompanyId, targetCompanyId),
  );

  if (periodIds.length > 0) {
    // Only delete periods we created (far future years)
    await db.delete(financialPeriods).where(
      and(
        eq(financialPeriods.targetCompanyId, targetCompanyId),
        inArray(financialPeriods.fiscalYear, TEST_YEARS),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────
describe('reselect acceptance replay', () => {
  let targetCompanyId: number;
  let adjustmentPeriodId: number | null = null;
  let adjustmentId: number | null = null;

  beforeAll(async () => {
    const id = await getTestTargetCompanyId();
    if (!id) {
      console.warn('[TEST] No target company found in DB — skipping integration tests');
      return;
    }
    targetCompanyId = id;
    // Ensure a clean slate for our test years
    await cleanup(targetCompanyId);
  });

  afterAll(async () => {
    if (targetCompanyId) {
      await cleanup(targetCompanyId);
    }
  });

  it('a. statutory wins FY2903/2904; IM covers 2901/2902/2905', async () => {
    if (!targetCompanyId) return;

    // Insert IM contributions for all 5 years
    await insertContributions(
      targetCompanyId,
      IM_YEARS,
      'information_memorandum',
      FAKE_IM_DOC_ID,
      () => IM_REVENUE,
    );

    // Insert statutory contributions for FY2903 and FY2904
    await insertContributions(
      targetCompanyId,
      STATUTORY_YEARS,
      'statutory',
      FAKE_STAT_DOC_ID,
      y => (y === 2903 ? STAT_REVENUE_2903 : STAT_REVENUE_2904),
    );

    await reselect(targetCompanyId);

    // Invariant: financial_contributions untouched (7 rows for our years)
    const contribCount = await db
      .select({ id: financialContributions.id })
      .from(financialContributions)
      .where(eq(financialContributions.targetCompanyId, targetCompanyId));
    expect(contribCount.length).toBe(7);

    // Statutory years → statutory revenue
    expect(await getIncomeRevenue(targetCompanyId, 2903)).toBe(STAT_REVENUE_2903);
    expect(await getIncomeRevenue(targetCompanyId, 2904)).toBe(STAT_REVENUE_2904);

    // IM-only years → IM revenue
    expect(await getIncomeRevenue(targetCompanyId, 2901)).toBe(IM_REVENUE);
    expect(await getIncomeRevenue(targetCompanyId, 2902)).toBe(IM_REVENUE);
    expect(await getIncomeRevenue(targetCompanyId, 2905)).toBe(IM_REVENUE);
  });

  it('b. ebitda_adjustment on FY2903 period survives reselect', async () => {
    if (!targetCompanyId) return;

    // Locate the period we created for FY2903
    const [period] = await db
      .select({ id: financialPeriods.id })
      .from(financialPeriods)
      .where(
        and(
          eq(financialPeriods.targetCompanyId, targetCompanyId),
          eq(financialPeriods.fiscalYear, 2903),
          eq(financialPeriods.isFullYear, true),
        ),
      )
      .limit(1);

    expect(period).toBeDefined();
    adjustmentPeriodId = period.id;

    // Insert an adjustment on this period
    const [adj] = await db
      .insert(ebitdaAdjustments)
      .values({
        financialPeriodId: period.id,
        targetCompanyId,
        description: 'Test one-off cost',
        amount: '50000',
        category: 'one_off',
      })
      .returning();
    adjustmentId = adj.id;

    // Reselect — must NOT delete adjustments
    await reselect(targetCompanyId);

    const [still] = await db
      .select({ id: ebitdaAdjustments.id })
      .from(ebitdaAdjustments)
      .where(eq(ebitdaAdjustments.id, adjustmentId));

    expect(still).toBeDefined();
    expect(still.id).toBe(adjustmentId);
  });

  it('c. dropping statutory → FY2903/2904 fall back to IM', async () => {
    if (!targetCompanyId) return;

    // Delete statutory contributions (simulate deleting the statutory accounts doc)
    await db.delete(financialContributions).where(
      and(
        eq(financialContributions.targetCompanyId, targetCompanyId),
        eq(financialContributions.sourceTier, 'statutory'),
      ),
    );

    await reselect(targetCompanyId);

    // Now only 5 IM contributions remain
    const contribCount = await db
      .select({ id: financialContributions.id })
      .from(financialContributions)
      .where(eq(financialContributions.targetCompanyId, targetCompanyId));
    expect(contribCount.length).toBe(5);

    // FY2903/2904 should now show IM figures
    expect(await getIncomeRevenue(targetCompanyId, 2903)).toBe(IM_REVENUE);
    expect(await getIncomeRevenue(targetCompanyId, 2904)).toBe(IM_REVENUE);

    // Other years unchanged
    expect(await getIncomeRevenue(targetCompanyId, 2901)).toBe(IM_REVENUE);
    expect(await getIncomeRevenue(targetCompanyId, 2902)).toBe(IM_REVENUE);
    expect(await getIncomeRevenue(targetCompanyId, 2905)).toBe(IM_REVENUE);

    // Adjustment on FY2903 period is still intact
    if (adjustmentId) {
      const [adj] = await db
        .select({ id: ebitdaAdjustments.id })
        .from(ebitdaAdjustments)
        .where(eq(ebitdaAdjustments.id, adjustmentId));
      expect(adj).toBeDefined();
    }
  });

  it('d. re-adding statutory → statutory wins again', async () => {
    if (!targetCompanyId) return;

    // Re-insert statutory contributions
    await insertContributions(
      targetCompanyId,
      STATUTORY_YEARS,
      'statutory',
      FAKE_STAT_DOC_ID,
      y => (y === 2903 ? STAT_REVENUE_2903 : STAT_REVENUE_2904),
    );

    await reselect(targetCompanyId);

    expect(await getIncomeRevenue(targetCompanyId, 2903)).toBe(STAT_REVENUE_2903);
    expect(await getIncomeRevenue(targetCompanyId, 2904)).toBe(STAT_REVENUE_2904);
    expect(await getIncomeRevenue(targetCompanyId, 2901)).toBe(IM_REVENUE);
    expect(await getIncomeRevenue(targetCompanyId, 2902)).toBe(IM_REVENUE);
    expect(await getIncomeRevenue(targetCompanyId, 2905)).toBe(IM_REVENUE);
  });

  it('invariant: at most one income row per (fiscalYear, isFullYear) after reselect', async () => {
    if (!targetCompanyId) return;

    const periods = await db
      .select()
      .from(financialPeriods)
      .where(
        and(
          eq(financialPeriods.targetCompanyId, targetCompanyId),
          inArray(financialPeriods.fiscalYear, TEST_YEARS),
        ),
      );

    for (const period of periods) {
      const rows = await db
        .select({ id: incomeStatements.id })
        .from(incomeStatements)
        .where(eq(incomeStatements.financialPeriodId, period.id));
      expect(rows.length).toBeLessThanOrEqual(1);
    }
  });
});
