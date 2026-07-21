/**
 * Layer A — Forward-Path Regression Gate (14 scenarios).
 *
 * Each scenario feeds a frozen fixture through processExtractedData, triggers
 * reselect, then asserts the resulting DB state and EBITDA output.
 *
 * No Gemini calls are made; IM detection is exercised via llmIsIM flag or
 * documentCategory only.
 *
 * Run: npx vitest run server/services/__tests__/forward-path-gate.test.ts
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq, and } from 'drizzle-orm';
import { db } from '../../db';
import {
  users,
  targetCompanies,
  financialContributions,
  financialPeriods,
  incomeStatements,
  balanceSheets,
  staffData,
  ebitdaAdjustments,
} from '@shared/schema';
import { financialDataService } from '../financial-data.service';
import { reselect } from '../projection-reselect.service';
import { fetchReportedEbitdaByYear } from '../deal-model.service';

// ─── HOST GUARD ────────────────────────────────────────────────────────────────
const dbUrl = process.env.DATABASE_URL ?? '';
const dbHost = dbUrl.match(/@([^/]+)\//)?.[1] ?? 'unknown';
if (dbHost.includes('ep-old-recipe') || dbHost.includes('.prod.')) {
  throw new Error(`FPG ABORT: DATABASE_URL points at prod host (${dbHost}). Tests must run on dev.`);
}

// ─── FIXTURES ─────────────────────────────────────────────────────────────────
/* eslint-disable @typescript-eslint/no-require-imports */
const sc01     = require('./fixtures/sc01-ytd-named-pl.json');
const sc02     = require('./fixtures/sc02-ytd-daterange-pl.json');
const sc03     = require('./fixtures/sc03-forecast-multiyear-pl.json');
const sc04     = require('./fixtures/sc04-fiscal-year-mislabel.json');
const sc05     = require('./fixtures/sc05-flyer-im-pl.json');
const sc06     = require('./fixtures/sc06-staff-matrix.json');
const sc07     = require('./fixtures/sc07-homecare-im-pack.json');
const sc08Full = require('./fixtures/sc08-timber-full-year.json');
const sc08Part = require('./fixtures/sc08-timber-partial.json');
const sc09Mgmt = require('./fixtures/sc09-management-pl.json');
const sc09Stat = require('./fixtures/sc09-statutory-pl.json');
const sc10BS   = require('./fixtures/sc10-company-accounts-bs-only.json');
const sc10YTD  = require('./fixtures/sc10-ytd-pl.json');
const sc11Emp  = require('./fixtures/sc11-empty-balance.json');
const sc11Data = require('./fixtures/sc11-data-balance.json');
const sc12     = require('./fixtures/sc12-bs-phantom-net-profit.json');
const sc13Stat = require('./fixtures/sc13-statutory-pl.json');
const sc13Mgmt = require('./fixtures/sc13-management-pl.json');
const sc14MgV1 = require('./fixtures/sc14-management-v1.json');
const sc14Stat = require('./fixtures/sc14-statutory-pl.json');

const USER_COMPANY_ID = 71;

describe('Forward-Path Regression Gate — Layer A (14 scenarios)', () => {
  let userId: number;
  const createdCompanyIds: number[] = [];

  // ── Helpers ──────────────────────────────────────────────────────────────

  const mkToken = () => `fpg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  async function mkCompany(name: string): Promise<number> {
    const [co] = await db
      .insert(targetCompanies)
      .values({ userCompanyId: USER_COMPANY_ID, companyName: name })
      .returning();
    createdCompanyIds.push(co.id);
    return co.id;
  }

  async function getPeriodId(coId: number, fy: number): Promise<number | undefined> {
    const [row] = await db
      .select({ id: financialPeriods.id })
      .from(financialPeriods)
      .where(
        and(
          eq(financialPeriods.targetCompanyId, coId),
          eq(financialPeriods.fiscalYear, fy),
          eq(financialPeriods.isFullYear, true),
        ),
      )
      .limit(1);
    return row?.id;
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  beforeAll(async () => {
    const [u] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.userCompanyId, USER_COMPANY_ID))
      .limit(1);
    if (!u) throw new Error(`No user found for userCompanyId=${USER_COMPANY_ID}`);
    userId = u.id;
    // satisfy linter — userId used by mkToken closure for future doc inserts
    void userId;
    void mkToken;
  });

  afterAll(async () => {
    for (const coId of createdCompanyIds) {
      try {
        await db.delete(staffData).where(eq(staffData.targetCompanyId, coId));
        await db.delete(ebitdaAdjustments).where(eq(ebitdaAdjustments.targetCompanyId, coId));
        await db.delete(incomeStatements).where(eq(incomeStatements.targetCompanyId, coId));
        await db.delete(balanceSheets).where(eq(balanceSheets.targetCompanyId, coId));
        await db.delete(financialContributions).where(eq(financialContributions.targetCompanyId, coId));
        await db.delete(financialPeriods).where(eq(financialPeriods.targetCompanyId, coId));
        await db.delete(targetCompanies).where(eq(targetCompanies.id, coId));
      } catch { /* best-effort */ }
    }
  });

  // ══════════════════════════════════════════════════════════════════════════
  // Sc-1  YTD named P&L → is_full_year=false, excluded from EBITDA
  // ══════════════════════════════════════════════════════════════════════════

  it('Sc-1: YTD named P&L → is_full_year=false, excluded from EBITDA', async () => {
    const coId = await mkCompany('FPG SC1 YTD Named P&L');

    await financialDataService.processExtractedData(
      'profit_and_loss',
      sc01,
      coId,
      undefined,
      undefined,
      undefined,
      'Canoports_YTD_Profit_and_Loss.pdf',
    );

    const contribs = await db
      .select()
      .from(financialContributions)
      .where(
        and(
          eq(financialContributions.targetCompanyId, coId),
          eq(financialContributions.statementType, 'income'),
        ),
      );
    expect(contribs).toHaveLength(1);
    expect(contribs[0].isFullYear).toBe(false);

    const incomes = await db
      .select()
      .from(incomeStatements)
      .where(eq(incomeStatements.targetCompanyId, coId));
    expect(incomes).toHaveLength(1);
    expect(incomes[0].isFullYear).toBe(false);

    expect(await fetchReportedEbitdaByYear(coId)).toEqual({});
  });

  // ══════════════════════════════════════════════════════════════════════════
  // Sc-2  YTD date-range P&L (3-month period) → is_full_year=false
  // ══════════════════════════════════════════════════════════════════════════

  it('Sc-2: YTD date-range P&L (3 months) → is_full_year=false, excluded from EBITDA', async () => {
    const coId = await mkCompany('FPG SC2 YTD Date-Range P&L');

    await financialDataService.processExtractedData(
      'profit_and_loss',
      sc02,
      coId,
      undefined,
      undefined,
      undefined,
      'OPEM - YTD Profit & Loss 28.02.2026 to 31.05.2026.xlsx',
    );

    const contribs = await db
      .select()
      .from(financialContributions)
      .where(
        and(
          eq(financialContributions.targetCompanyId, coId),
          eq(financialContributions.statementType, 'income'),
        ),
      );
    expect(contribs).toHaveLength(1);
    expect(contribs[0].isFullYear).toBe(false);
    expect(contribs[0].monthsCovered).toBe(3);

    const incomes = await db
      .select()
      .from(incomeStatements)
      .where(eq(incomeStatements.targetCompanyId, coId));
    expect(incomes).toHaveLength(1);
    expect(incomes[0].isFullYear).toBe(false);

    expect(await fetchReportedEbitdaByYear(coId)).toEqual({});
  });

  // ══════════════════════════════════════════════════════════════════════════
  // Sc-3  Forecast multi-year — future fiscal years never enter EBITDA window
  // ══════════════════════════════════════════════════════════════════════════

  it('Sc-3: Forecast multi-year — future fiscal years never enter EBITDA window', async () => {
    const coId = await mkCompany('FPG SC3 Forecast Multi-Year');

    await financialDataService.processExtractedData('profit_and_loss', sc03, coId);

    const ebitda = await fetchReportedEbitdaByYear(coId);
    const ebitdaYears = Object.keys(ebitda).sort();
    expect(ebitdaYears).toEqual(['2023', '2024', '2025']);
    expect(ebitda['2023']).toBe(115000); // 100k + 15k
    expect(ebitda['2024']).toBe(138000); // 120k + 18k
    expect(ebitda['2025']).toBe(160000); // 140k + 20k
    expect('2027' in ebitda).toBe(false);
    expect('2028' in ebitda).toBe(false);

    // Future-year contributions still exist in the truth table (never deleted)
    const allContribs = await db
      .select()
      .from(financialContributions)
      .where(eq(financialContributions.targetCompanyId, coId));
    expect(allContribs.some(c => c.fiscalYear === 2027)).toBe(true);
    expect(allContribs.some(c => c.fiscalYear === 2028)).toBe(true);

    // But no income_statements for future years (cleared by reselect)
    const allPeriods = await db
      .select({ id: financialPeriods.id, fy: financialPeriods.fiscalYear })
      .from(financialPeriods)
      .where(eq(financialPeriods.targetCompanyId, coId));
    const futureIds = allPeriods.filter(p => (p.fy ?? 0) > 2026).map(p => p.id);
    expect(futureIds).toHaveLength(0); // pruned as ghosts
  });

  // ══════════════════════════════════════════════════════════════════════════
  // Sc-4  Fiscal-year mislabel — period_end in past but fiscalYear=2027
  // ══════════════════════════════════════════════════════════════════════════

  it('Sc-4: Fiscal-year mislabel (FY2027 with 2026 period_end) → excluded by fiscal_year gate', async () => {
    const coId = await mkCompany('FPG SC4 Fiscal Year Mislabel');

    await financialDataService.processExtractedData('profit_and_loss', sc04, coId);

    // Contribution is written (truth table is append-only) — fiscal_year=2027 recorded
    const contribs = await db
      .select()
      .from(financialContributions)
      .where(eq(financialContributions.targetCompanyId, coId));
    expect(contribs.some(c => c.fiscalYear === 2027)).toBe(true);

    // But it never surfaces in EBITDA
    expect(await fetchReportedEbitdaByYear(coId)).toEqual({});
  });

  // ══════════════════════════════════════════════════════════════════════════
  // Sc-5  Flyer / IM (llmIsIM=true) → tier=information_memorandum
  // ══════════════════════════════════════════════════════════════════════════

  it('Sc-5: Flyer/IM (llmIsIM=true) → tier=information_memorandum, excluded from EBITDA', async () => {
    const coId = await mkCompany('FPG SC5 Flyer IM');

    await financialDataService.processExtractedData(
      'profit_and_loss',
      sc05,
      coId,
      undefined,
      undefined,
      { llmIsIM: true },
    );

    const contribs = await db
      .select()
      .from(financialContributions)
      .where(
        and(
          eq(financialContributions.targetCompanyId, coId),
          eq(financialContributions.statementType, 'income'),
        ),
      );
    expect(contribs).toHaveLength(1);
    expect(contribs[0].sourceTier).toBe('information_memorandum');

    expect(await fetchReportedEbitdaByYear(coId)).toEqual({});
  });

  // ══════════════════════════════════════════════════════════════════════════
  // Sc-6  Staff matrix → staff_data written, zero financial contributions
  // ══════════════════════════════════════════════════════════════════════════

  it('Sc-6: Staff matrix → staff_data written, zero financial contributions', async () => {
    const coId = await mkCompany('FPG SC6 Staff Matrix');

    await financialDataService.processExtractedData('staff_matrix', sc06, coId);

    const contribs = await db
      .select()
      .from(financialContributions)
      .where(eq(financialContributions.targetCompanyId, coId));
    expect(contribs).toHaveLength(0);

    const incomes = await db
      .select()
      .from(incomeStatements)
      .where(eq(incomeStatements.targetCompanyId, coId));
    expect(incomes).toHaveLength(0);

    const sdRows = await db
      .select()
      .from(staffData)
      .where(eq(staffData.targetCompanyId, coId));
    expect(sdRows).toHaveLength(1);
    expect(sdRows[0].totalHeadcount).toBe(25);
  });

  // ══════════════════════════════════════════════════════════════════════════
  // Sc-7  Homecare IM results pack (documentCategory=Deal Documents)
  // ══════════════════════════════════════════════════════════════════════════

  it('Sc-7: Homecare IM pack → all contributions are IM tier; statutory override wins its year', async () => {
    const coId = await mkCompany('FPG SC7 Homecare IM Pack');

    // Phase 1: process IM pack (Deal Documents → IM tier)
    await financialDataService.processExtractedData(
      'profit_and_loss',
      sc07,
      coId,
      undefined,
      'Deal Documents',
    );

    const imContribs = await db
      .select()
      .from(financialContributions)
      .where(eq(financialContributions.targetCompanyId, coId));
    expect(imContribs).toHaveLength(3);
    expect(imContribs.every(c => c.sourceTier === 'information_memorandum')).toBe(true);
    expect(await fetchReportedEbitdaByYear(coId)).toEqual({});

    // Phase 2: add a statutory doc for FY2023 → statutory wins that year
    const statFY2023 = {
      source: 'statutory',
      years: {
        '2023': { revenue: 2000000, operating_profit: 220000, depreciation_amortisation: 32000 },
      },
      period_ends: { '2023': '2023-12-31' },
    };
    await financialDataService.processExtractedData('profit_and_loss', statFY2023, coId);

    const ebitda = await fetchReportedEbitdaByYear(coId);
    expect(ebitda['2023']).toBe(252000); // 220k + 32k statutory
    expect('2022' in ebitda).toBe(false); // IM — excluded
    expect('2024' in ebitda).toBe(false); // IM — excluded
  });

  // ══════════════════════════════════════════════════════════════════════════
  // Sc-8  Duplicate statutory (Timber) — complete copy wins full-year slot
  // ══════════════════════════════════════════════════════════════════════════

  it('Sc-8: Duplicate statutory — complete (full-year) copy wins; partial retained in contributions', async () => {
    const coId = await mkCompany('FPG SC8 Timber Duplicate Statutory');

    // Process partial first so full-year contribution is inserted last → full-year winner
    // is processed last in reselect → its reconcile evicts the partial income statement.
    // This is the correct upload order when the user uploads a half-year extract before
    // the complete accounts arrive.
    await financialDataService.processExtractedData('profit_and_loss', sc08Part, coId);
    await financialDataService.processExtractedData('profit_and_loss', sc08Full, coId);

    // Full-year income_statement shows complete statutory figures
    const allIncomes = await db
      .select()
      .from(incomeStatements)
      .where(eq(incomeStatements.targetCompanyId, coId));
    const full = allIncomes.filter(r => r.isFullYear === true);
    expect(full).toHaveLength(1);
    expect(full[0].revenue).toBe('337000');
    // Partial income was evicted by the full-year reconcile (loser demoted in IS,
    // but the contribution itself is retained in financial_contributions below).

    // EBITDA uses the full-year figure only: 45000 + 8000
    const ebitda = await fetchReportedEbitdaByYear(coId);
    expect(ebitda['2024']).toBe(53000);

    // Both contributions retained in the append-only truth table
    const contribs = await db
      .select()
      .from(financialContributions)
      .where(eq(financialContributions.targetCompanyId, coId));
    expect(contribs).toHaveLength(2);
  });

  // ══════════════════════════════════════════════════════════════════════════
  // Sc-9  Management + statutory overlap → statutory wins
  // ══════════════════════════════════════════════════════════════════════════

  it('Sc-9: Management + statutory overlap — statutory wins, management contribution retained', async () => {
    const coId = await mkCompany('FPG SC9 Mgmt+Stat Overlap');

    await financialDataService.processExtractedData('profit_and_loss', sc09Mgmt, coId);
    await financialDataService.processExtractedData('profit_and_loss', sc09Stat, coId);

    // Full-year income_statement shows statutory revenue
    const fullYearIncomes = await db
      .select()
      .from(incomeStatements)
      .where(and(eq(incomeStatements.targetCompanyId, coId), eq(incomeStatements.isFullYear, true)));
    expect(fullYearIncomes).toHaveLength(1);
    expect(fullYearIncomes[0].revenue).toBe('500000'); // statutory wins

    // EBITDA: 55k + 9k from statutory
    const ebitda = await fetchReportedEbitdaByYear(coId);
    expect(ebitda['2024']).toBe(64000);

    // Both contributions retained (truth table append-only)
    const contribs = await db
      .select()
      .from(financialContributions)
      .where(eq(financialContributions.targetCompanyId, coId));
    expect(contribs).toHaveLength(2);
    expect(contribs.some(c => c.sourceTier === 'management')).toBe(true);
    expect(contribs.some(c => c.sourceTier === 'statutory')).toBe(true);
  });

  // ══════════════════════════════════════════════════════════════════════════
  // Sc-10  Split-source container — YTD income is_full_year=false despite
  //        full-year balance container
  // ══════════════════════════════════════════════════════════════════════════

  it('Sc-10: Split-source container — YTD income is_full_year=false → excluded from EBITDA', async () => {
    const coId = await mkCompany('FPG SC10 Split-Source Container');

    // BS-only company accounts: creates a balance contribution with is_full_year=true
    await financialDataService.processExtractedData('company_accounts', sc10BS, coId);

    // YTD 9-month P&L: creates an income contribution with is_full_year=false
    await financialDataService.processExtractedData('profit_and_loss', sc10YTD, coId);

    // No full-year income_statement — YTD income is in part-year slot
    const fullYearIncomes = await db
      .select()
      .from(incomeStatements)
      .where(and(eq(incomeStatements.targetCompanyId, coId), eq(incomeStatements.isFullYear, true)));
    expect(fullYearIncomes).toHaveLength(0);

    // YTD income_statement IS written (is_full_year=false)
    const allIncomes = await db
      .select()
      .from(incomeStatements)
      .where(eq(incomeStatements.targetCompanyId, coId));
    expect(allIncomes).toHaveLength(1);
    expect(allIncomes[0].isFullYear).toBe(false);

    // EBITDA empty: fetchReportedEbitdaByYear requires IS.is_full_year=true
    expect(await fetchReportedEbitdaByYear(coId)).toEqual({});

    // Balance sheet exists on the full-year period container
    const fullYearPeriods = await db
      .select({ id: financialPeriods.id })
      .from(financialPeriods)
      .where(and(eq(financialPeriods.targetCompanyId, coId), eq(financialPeriods.isFullYear, true)));
    expect(fullYearPeriods.length).toBeGreaterThan(0);

    const bsRows = await db
      .select()
      .from(balanceSheets)
      .where(eq(balanceSheets.financialPeriodId, fullYearPeriods[0].id));
    expect(bsRows.length).toBeGreaterThan(0);
  });

  // ══════════════════════════════════════════════════════════════════════════
  // Sc-11  Empty-balance survivor — data-bearing balance wins; empty skipped
  // ══════════════════════════════════════════════════════════════════════════

  it('Sc-11: Empty-balance survivor — data-bearing balance wins; empty (no-core) skipped', async () => {
    const coId = await mkCompany('FPG SC11 Empty Balance Survivor');

    await financialDataService.processExtractedData('balance_sheet', sc11Emp, coId);
    await financialDataService.processExtractedData('balance_sheet', sc11Data, coId);

    // Only one balance contribution (empty fixture was skipped)
    const balContribs = await db
      .select()
      .from(financialContributions)
      .where(
        and(
          eq(financialContributions.targetCompanyId, coId),
          eq(financialContributions.statementType, 'balance'),
        ),
      );
    expect(balContribs).toHaveLength(1);

    // Balance sheet shows data-bearing figures
    const bsRows = await db
      .select()
      .from(balanceSheets)
      .where(eq(balanceSheets.targetCompanyId, coId));
    expect(bsRows).toHaveLength(1);
    expect(bsRows[0].totalCurrentAssets).toBe('686000');
  });

  // ══════════════════════════════════════════════════════════════════════════
  // Sc-12  Phantom P&L from balance-only doc — no income contributions
  // ══════════════════════════════════════════════════════════════════════════

  it('Sc-12: Phantom P&L from balance-only doc — no income contributions created', async () => {
    const coId = await mkCompany('FPG SC12 Phantom PL from BS');

    // balance_sheet doc with a stray net_profit at yearData level
    await financialDataService.processExtractedData('balance_sheet', sc12, coId);

    const incomeContribs = await db
      .select()
      .from(financialContributions)
      .where(
        and(
          eq(financialContributions.targetCompanyId, coId),
          eq(financialContributions.statementType, 'income'),
        ),
      );
    expect(incomeContribs).toHaveLength(0);

    const incomes = await db
      .select()
      .from(incomeStatements)
      .where(eq(incomeStatements.targetCompanyId, coId));
    expect(incomes).toHaveLength(0);

    expect(await fetchReportedEbitdaByYear(coId)).toEqual({});

    // Balance was written (the doc IS a balance sheet)
    const balContribs = await db
      .select()
      .from(financialContributions)
      .where(
        and(
          eq(financialContributions.targetCompanyId, coId),
          eq(financialContributions.statementType, 'balance'),
        ),
      );
    expect(balContribs).toHaveLength(1);
  });

  // ══════════════════════════════════════════════════════════════════════════
  // Sc-13  Delete → fallback → re-add
  // ══════════════════════════════════════════════════════════════════════════

  it('Sc-13: Delete statutory → management fallback; re-add statutory → statutory wins again', async () => {
    const coId = await mkCompany('FPG SC13 Delete Fallback');

    // Seed: statutory + management both present
    await financialDataService.processExtractedData('profit_and_loss', sc13Stat, coId);
    await financialDataService.processExtractedData('profit_and_loss', sc13Mgmt, coId);

    // Phase 1: statutory wins — 55k + 9k = 64k
    let ebitda = await fetchReportedEbitdaByYear(coId);
    expect(ebitda['2024']).toBe(64000);

    // Phase 2: delete statutory → management fallback — 40k + 6k = 46k
    await db.delete(financialContributions).where(
      and(
        eq(financialContributions.targetCompanyId, coId),
        eq(financialContributions.sourceTier, 'statutory'),
      ),
    );
    await reselect(coId);
    ebitda = await fetchReportedEbitdaByYear(coId);
    expect(ebitda['2024']).toBe(46000);

    // Phase 3: re-add statutory → statutory wins again — 64k
    await financialDataService.processExtractedData('profit_and_loss', sc13Stat, coId);
    ebitda = await fetchReportedEbitdaByYear(coId);
    expect(ebitda['2024']).toBe(64000);

    // At least 2 contributions exist (statutory re-added, management still there)
    const contribs = await db
      .select()
      .from(financialContributions)
      .where(eq(financialContributions.targetCompanyId, coId));
    expect(contribs.length).toBeGreaterThanOrEqual(2);
  });

  // ══════════════════════════════════════════════════════════════════════════
  // Sc-14  Ghost prune / one-per-year — exactly one full-year container
  // ══════════════════════════════════════════════════════════════════════════

  it('Sc-14: Ghost prune / one-per-year — container stable across winner changes; ghost pruned', async () => {
    const coId = await mkCompany('FPG SC14 Ghost Prune One-Per-Year');

    // Upload management v1 → period container created
    await financialDataService.processExtractedData('profit_and_loss', sc14MgV1, coId);
    const pid1 = await getPeriodId(coId, 2024);
    expect(pid1).toBeDefined();

    // Attach an ebitda_adjustment to the container
    const [adj] = await db
      .insert(ebitdaAdjustments)
      .values({
        targetCompanyId: coId,
        financialPeriodId: pid1!,
        description: 'SC14 owner add-back',
        amount: '10000',
        category: 'one_off',
      })
      .returning();

    // Upload statutory → reselect promotes statutory; container id MUST NOT change
    await financialDataService.processExtractedData('profit_and_loss', sc14Stat, coId);
    const pid2 = await getPeriodId(coId, 2024);
    expect(pid2).toBe(pid1); // stable container

    // Adjustment survives on the same period
    const [adjAfter] = await db
      .select()
      .from(ebitdaAdjustments)
      .where(eq(ebitdaAdjustments.id, adj.id));
    expect(adjAfter.financialPeriodId).toBe(pid1);

    // Exactly one full-year period for FY2024
    let fullYearPeriods = await db
      .select()
      .from(financialPeriods)
      .where(and(eq(financialPeriods.targetCompanyId, coId), eq(financialPeriods.isFullYear, true)));
    expect(fullYearPeriods).toHaveLength(1);

    // Inject an empty ghost period (old year, no data)
    await db.insert(financialPeriods).values({
      targetCompanyId: coId,
      periodType: 'management',
      sourceTier: 'management',
      periodEnd: '2020-12-31',
      fiscalYear: 2020,
      isFullYear: true,
      sourceDocumentId: null,
      periodLabel: 'FY 2020 (ghost)',
    });

    await reselect(coId);

    // Ghost pruned — still exactly one full-year period (FY2024)
    fullYearPeriods = await db
      .select()
      .from(financialPeriods)
      .where(and(eq(financialPeriods.targetCompanyId, coId), eq(financialPeriods.isFullYear, true)));
    expect(fullYearPeriods).toHaveLength(1);
    expect(fullYearPeriods[0].fiscalYear).toBe(2024);

    // EBITDA reflects statutory winner: 48k + 7k = 55k
    const ebitda = await fetchReportedEbitdaByYear(coId);
    expect(ebitda['2024']).toBe(55000);
  });
});
