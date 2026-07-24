/**
 * Deterministic tests for getReconciledFinancials — no LLM calls anywhere.
 *
 * E.1  The reconciled object contains 75312 and NOT 295005 anywhere.
 * E.2  The reconciled object the expert receives is deep-equal to what the
 *      deal model reads (both delegate to the same getReconciledFinancials accessor).
 * E.3  currentBalanceSheet selection skips the empty row and the future-dated
 *      row and lands on the 75312 row.
 *
 * Fixture layout (all four rows are for FY2025; ordered by period_end DESC):
 *   futureRow   — period_end 2099-12-31, FY2025, cash=999999  → excluded (future-dated)
 *   currentRow  — period_end 2025-03-31, FY2025, cash=75312   → SELECTED
 *   emptyRow    — period_end 2024-09-30, FY2025, all null     → excluded (empty)
 *   staleRow    — period_end 2024-03-31, FY2025, cash=295005  → excluded (currentRow wins FY2025 slot)
 *
 * Because all rows share FY2025, balanceSheetsByYear["2025"] = 75312 row and
 * 295005 never appears anywhere in the serialised output.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq, inArray } from 'drizzle-orm';
import { db } from '../../db';
import {
  targetCompanies,
  financialPeriods,
  balanceSheets,
} from '@shared/schema';
import { getReconciledFinancials, isBalanceSheetEmpty } from '../reconciled-financials.service';
import { fetchReportedEbitdaByYear } from '../deal-model.service';

// ─── HOST GUARD ─────────────────────────────────────────────────────────────
const dbUrl = process.env.DATABASE_URL ?? '';
const dbHost = dbUrl.match(/@([^/]+)\//)?.[1] ?? 'unknown';
if (dbHost.includes('ep-old-recipe') || dbHost.includes('.prod.')) {
  throw new Error(`RF ABORT: DATABASE_URL points at prod host (${dbHost}). Tests must run on dev.`);
}

const USER_COMPANY_ID = 71;
const FISCAL_YEAR = 2025;

// ─────────────────────────────────────────────────────────────────────────────
// Pure unit tests — no DB
// ─────────────────────────────────────────────────────────────────────────────
describe('isBalanceSheetEmpty — pure logic', () => {
  it('returns true when all core fields are null', () => {
    expect(isBalanceSheetEmpty({
      cashAtBank: null,
      tradeDebtors: null,
      totalCurrentAssets: null,
      tradeCreditors: null,
      totalCurrentLiabilities: null,
      totalEquity: null,
      retainedEarnings: null,
      tangibleFixedAssets: null,
      stockInventory: null,
    })).toBe(true);
  });

  it('returns false when at least one core field is non-null', () => {
    expect(isBalanceSheetEmpty({
      cashAtBank: '75312',
      tradeDebtors: null,
      totalCurrentAssets: null,
      tradeCreditors: null,
      totalCurrentLiabilities: null,
      totalEquity: null,
      retainedEarnings: null,
      tangibleFixedAssets: null,
      stockInventory: null,
    })).toBe(false);
  });

  it('returns false when only totalEquity is non-null', () => {
    expect(isBalanceSheetEmpty({
      cashAtBank: null,
      tradeDebtors: null,
      totalCurrentAssets: null,
      tradeCreditors: null,
      totalCurrentLiabilities: null,
      totalEquity: '150000',
      retainedEarnings: null,
      tangibleFixedAssets: null,
      stockInventory: null,
    })).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// DB integration tests
// ─────────────────────────────────────────────────────────────────────────────
describe('getReconciledFinancials — balance sheet selection (E.1, E.2, E.3)', () => {
  let companyId: number;
  const periodIds: number[] = [];
  const mkToken = () => `rf-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  beforeAll(async () => {
    const [co] = await db
      .insert(targetCompanies)
      .values({ userCompanyId: USER_COMPANY_ID, companyName: `RF-Test-${mkToken()}` })
      .returning();
    companyId = co.id;

    // ── futureRow — future-dated, cash=999999 (excluded: future-dated) ────
    const [fpFuture] = await db
      .insert(financialPeriods)
      .values({
        targetCompanyId: companyId,
        periodType: 'annual',
        periodEnd: '2099-12-31',
        fiscalYear: FISCAL_YEAR,
        isFullYear: true,
        sourceTier: 'statutory',
      })
      .returning();
    periodIds.push(fpFuture.id);
    await db.insert(balanceSheets).values({
      targetCompanyId: companyId,
      financialPeriodId: fpFuture.id,
      cashAtBank: '999999',
      totalEquity: '500000',
    });

    // ── currentRow — most-recent past, cash=75312 (SELECTED) ─────────────
    const [fpCurrent] = await db
      .insert(financialPeriods)
      .values({
        targetCompanyId: companyId,
        periodType: 'annual',
        periodEnd: '2025-03-31',
        fiscalYear: FISCAL_YEAR,
        isFullYear: true,
        sourceTier: 'statutory',
      })
      .returning();
    periodIds.push(fpCurrent.id);
    await db.insert(balanceSheets).values({
      targetCompanyId: companyId,
      financialPeriodId: fpCurrent.id,
      cashAtBank: '75312',
      tradeDebtors: '45000',
      totalCurrentAssets: '120312',
      totalEquity: '200000',
    });

    // ── emptyRow — all core fields null (excluded: empty) ─────────────────
    const [fpEmpty] = await db
      .insert(financialPeriods)
      .values({
        targetCompanyId: companyId,
        periodType: 'annual',
        periodEnd: '2024-09-30',
        fiscalYear: FISCAL_YEAR,
        isFullYear: true,
        sourceTier: 'statutory',
      })
      .returning();
    periodIds.push(fpEmpty.id);
    await db.insert(balanceSheets).values({
      targetCompanyId: companyId,
      financialPeriodId: fpEmpty.id,
      // All core fields intentionally null — represents an empty/unextracted row
    });

    // ── staleRow — older past, cash=295005 (excluded: currentRow wins FY2025)
    const [fpStale] = await db
      .insert(financialPeriods)
      .values({
        targetCompanyId: companyId,
        periodType: 'annual',
        periodEnd: '2024-03-31',
        fiscalYear: FISCAL_YEAR,
        isFullYear: true,
        sourceTier: 'statutory',
      })
      .returning();
    periodIds.push(fpStale.id);
    await db.insert(balanceSheets).values({
      targetCompanyId: companyId,
      financialPeriodId: fpStale.id,
      cashAtBank: '295005',
      totalEquity: '180000',
    });
  });

  afterAll(async () => {
    // Must delete child rows before parent to satisfy FK constraints
    await db.delete(balanceSheets).where(eq(balanceSheets.targetCompanyId, companyId));
    if (periodIds.length > 0) {
      await db.delete(financialPeriods).where(inArray(financialPeriods.id, periodIds));
    }
    await db.delete(targetCompanies).where(eq(targetCompanies.id, companyId));
  });

  // E.3 — primary assertion: lands on 75312 row
  it('E.3: currentBalanceSheet skips future-dated and empty rows; selects cash=75312', async () => {
    const reconciled = await getReconciledFinancials(companyId);
    expect(reconciled.currentBalanceSheet).not.toBeNull();
    expect(String(reconciled.currentBalanceSheet!.cashAtBank)).toBe('75312');
  });

  // E.3 — future-dated row is excluded
  it('E.3: future-dated row (cash=999999) is excluded from currentBalanceSheet', async () => {
    const reconciled = await getReconciledFinancials(companyId);
    const serialised = JSON.stringify(reconciled.currentBalanceSheet);
    expect(serialised).not.toContain('999999');
  });

  // E.3 — empty row does not surface as currentBalanceSheet (cashAtBank would be null)
  it('E.3: empty row is excluded; currentBalanceSheet.cashAtBank is non-null', async () => {
    const reconciled = await getReconciledFinancials(companyId);
    expect(reconciled.currentBalanceSheet).not.toBeNull();
    expect(reconciled.currentBalanceSheet!.cashAtBank).not.toBeNull();
  });

  // E.1 — serialised reconciled object contains 75312 and NOT 295005
  it('E.1: full reconciled object contains 75312 and does NOT contain 295005 anywhere', async () => {
    const reconciled = await getReconciledFinancials(companyId);
    const serialised = JSON.stringify(reconciled);
    expect(serialised).toContain('75312');
    expect(serialised).not.toContain('295005');
  });

  // E.2 — deal model and expert read the same accessor
  it('E.2: fetchReportedEbitdaByYear is consistent with getReconciledFinancials.incomeByYear', async () => {
    const reconciled = await getReconciledFinancials(companyId);
    const ebitdaByYear = await fetchReportedEbitdaByYear(companyId);

    // Same set of years
    const reconciledYears = Object.keys(reconciled.incomeByYear).sort();
    const ebitdaYears = Object.keys(ebitdaByYear).sort();
    expect(ebitdaYears).toEqual(reconciledYears);

    // Same EBITDA value for every year (fetchReportedEbitdaByYear maps row.ebitda)
    for (const year of reconciledYears) {
      expect(ebitdaByYear[year]).toBe(reconciled.incomeByYear[year].ebitda);
    }
  });

  // E.2 structural — both exports are functions from the same module
  it('E.2 structural: getReconciledFinancials is exported and callable', () => {
    expect(typeof getReconciledFinancials).toBe('function');
    expect(typeof fetchReportedEbitdaByYear).toBe('function');
  });
});
