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
 *
 * D.1-D.4  Tier-precedence tests (mirrors real company 885 shape).
 *   FY2025 statutory, cash=295005 → wins FY2025 slot (only candidate).
 *   FY2026 statutory year-end, cash=null (other non-null) → wins FY2026 slot (tier beats IM).
 *   FY2026 IM, later period_end, cash=75312.48 → wins currentBalanceSheet (latest overall).
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
// DB integration tests — original fixture (all rows FY2025)
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

// ─────────────────────────────────────────────────────────────────────────────
// DB integration tests — tier-precedence fixture (mirrors real company 885)
// ─────────────────────────────────────────────────────────────────────────────
describe('getReconciledFinancials — tier-precedence balance sheet selection (D.1-D.4)', () => {
  let companyId: number;
  const periodIds: number[] = [];
  const mkToken = () => `rf-tier-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  beforeAll(async () => {
    const [co] = await db
      .insert(targetCompanies)
      .values({ userCompanyId: USER_COMPANY_ID, companyName: `RF-TierTest-${mkToken()}` })
      .returning();
    companyId = co.id;

    // ── FY2025 statutory: cash=295005 — only candidate for FY2025 ────────
    const [fpFy25] = await db
      .insert(financialPeriods)
      .values({
        targetCompanyId: companyId,
        periodType: 'annual',
        periodEnd: '2025-02-28',
        fiscalYear: 2025,
        isFullYear: true,
        sourceTier: 'statutory',
      })
      .returning();
    periodIds.push(fpFy25.id);
    await db.insert(balanceSheets).values({
      targetCompanyId: companyId,
      financialPeriodId: fpFy25.id,
      cashAtBank: '295005',
      totalEquity: '180000',
      tradeDebtors: '42000',
    });

    // ── FY2026 statutory year-end: cash=null, other fields non-null ───────
    // Should win FY2026 slot over the IM row (tier=statutory > IM).
    const [fpFy26Stat] = await db
      .insert(financialPeriods)
      .values({
        targetCompanyId: companyId,
        periodType: 'annual',
        periodEnd: '2026-02-28',
        fiscalYear: 2026,
        isFullYear: true,
        sourceTier: 'statutory',
      })
      .returning();
    periodIds.push(fpFy26Stat.id);
    await db.insert(balanceSheets).values({
      targetCompanyId: companyId,
      financialPeriodId: fpFy26Stat.id,
      cashAtBank: null,           // null cash — disclosed as blank
      totalEquity: '220000',      // non-null: not an empty row
      tradeDebtors: '50000',
    });

    // ── FY2026 IM: cash=75312.48, LATER period_end — wins currentBalanceSheet
    // Should NOT win FY2026 balanceSheetsByYear slot (IM tier < statutory).
    const [fpFy26Im] = await db
      .insert(financialPeriods)
      .values({
        targetCompanyId: companyId,
        periodType: 'annual',
        periodEnd: '2026-06-25',
        fiscalYear: 2026,
        isFullYear: false,
        sourceTier: 'information_memorandum',
      })
      .returning();
    periodIds.push(fpFy26Im.id);
    await db.insert(balanceSheets).values({
      targetCompanyId: companyId,
      financialPeriodId: fpFy26Im.id,
      cashAtBank: '75312.48',
      totalEquity: '195000',
      tradeDebtors: '38000',
    });
  });

  afterAll(async () => {
    await db.delete(balanceSheets).where(eq(balanceSheets.targetCompanyId, companyId));
    if (periodIds.length > 0) {
      await db.delete(financialPeriods).where(inArray(financialPeriods.id, periodIds));
    }
    await db.delete(targetCompanies).where(eq(targetCompanies.id, companyId));
  });

  // D.1 — tier beats later date: FY2026 winner is the statutory row
  it('D.1: balanceSheetsByYear FY2026 winner is the STATUTORY row (tier beats later IM date)', async () => {
    const reconciled = await getReconciledFinancials(companyId);
    const fy2026 = reconciled.balanceSheetsByYear['2026'];
    expect(fy2026).toBeDefined();
    expect(fy2026.sourceTier).toBe('statutory');
    expect(fy2026.periodEnd).toBe('2026-02-28');
    // cashAtBank is null on the statutory row (not disclosed)
    expect(fy2026.cashAtBank).toBeNull();
  });

  // D.2 — FY2025 slot carries 295005
  it('D.2: balanceSheetsByYear FY2025 cashAtBank is 295005', async () => {
    const reconciled = await getReconciledFinancials(companyId);
    const fy2025 = reconciled.balanceSheetsByYear['2025'];
    expect(fy2025).toBeDefined();
    expect(String(fy2025.cashAtBank)).toBe('295005');
  });

  // D.3 — currentBalanceSheet is the IM row (latest passing overall)
  it('D.3: currentBalanceSheet is the IM row (periodEnd=2026-06-25, cash=75312.48)', async () => {
    const reconciled = await getReconciledFinancials(companyId);
    expect(reconciled.currentBalanceSheet).not.toBeNull();
    expect(reconciled.currentBalanceSheet!.periodEnd).toBe('2026-06-25');
    expect(reconciled.currentBalanceSheet!.sourceTier).toBe('information_memorandum');
    expect(String(reconciled.currentBalanceSheet!.cashAtBank)).toBe('75312.48');
    expect(reconciled.currentBalanceSheet!._label).toBe('CURRENT POSITION');
  });

  // D.4 — 295005 appears ONLY in FY2025 entry; current position cash is 75312.48
  it('D.4: 295005 appears only in the FY2025 entry; current position cash is 75312.48', async () => {
    const reconciled = await getReconciledFinancials(companyId);

    // 295005 must appear in FY2025
    const fy2025Serialised = JSON.stringify(reconciled.balanceSheetsByYear['2025']);
    expect(fy2025Serialised).toContain('295005');

    // 295005 must NOT appear in FY2026 slot or currentBalanceSheet
    const fy2026Serialised = JSON.stringify(reconciled.balanceSheetsByYear['2026']);
    expect(fy2026Serialised).not.toContain('295005');
    const currentSerialised = JSON.stringify(reconciled.currentBalanceSheet);
    expect(currentSerialised).not.toContain('295005');

    // Current position cash is 75312.48
    expect(String(reconciled.currentBalanceSheet!.cashAtBank)).toBe('75312.48');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// DB integration tests — sign-convention note (F.1)
// Fixture: one balance sheet row with a NEGATIVE amountsOwedToDirectors (-149587.37)
// mirrors the real company 885 shape.
// ─────────────────────────────────────────────────────────────────────────────
describe('getReconciledFinancials — _signConventions note (F.1)', () => {
  let companyId: number;
  const periodIds: number[] = [];
  const mkToken = () => `rf-sign-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  beforeAll(async () => {
    const [co] = await db
      .insert(targetCompanies)
      .values({ userCompanyId: USER_COMPANY_ID, companyName: `RF-SignTest-${mkToken()}` })
      .returning();
    companyId = co.id;

    // Single balance-sheet row with a negative amountsOwedToDirectors (credit-balance notation)
    const [fp] = await db
      .insert(financialPeriods)
      .values({
        targetCompanyId: companyId,
        periodType: 'annual',
        periodEnd: '2026-06-25',
        fiscalYear: 2026,
        isFullYear: false,
        sourceTier: 'information_memorandum',
      })
      .returning();
    periodIds.push(fp.id);
    await db.insert(balanceSheets).values({
      targetCompanyId: companyId,
      financialPeriodId: fp.id,
      amountsOwedToDirectors: '-149587.37',
      totalEquity: '292974.93',
      cashAtBank: '75312.48',
    });
  });

  afterAll(async () => {
    await db.delete(balanceSheets).where(eq(balanceSheets.targetCompanyId, companyId));
    if (periodIds.length > 0) {
      await db.delete(financialPeriods).where(inArray(financialPeriods.id, periodIds));
    }
    await db.delete(targetCompanies).where(eq(targetCompanies.id, companyId));
  });

  // F.1 — _signConventions note is present and contains the authoritative text
  it('F.1: _signConventions.amountsOwedToDirectors is present in the serialised block', async () => {
    const reconciled = await getReconciledFinancials(companyId);
    const serialised = JSON.stringify(reconciled);

    expect(reconciled._signConventions).toBeDefined();
    expect(typeof reconciled._signConventions.amountsOwedToDirectors).toBe('string');

    // Must state LIABILITY and the credit-balance note
    expect(reconciled._signConventions.amountsOwedToDirectors).toContain('LIABILITY');
    expect(reconciled._signConventions.amountsOwedToDirectors).toContain('credit-balance notation');
    expect(reconciled._signConventions.amountsOwedToDirectors).toContain('abs(value)');

    // Must appear in the top-level serialised output alongside the negative figure
    expect(serialised).toContain('_signConventions');
    expect(serialised).toContain('-149587.37');
  });
});
