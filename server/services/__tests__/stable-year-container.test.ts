/**
 * Integration tests — Slice 16 (final): stable year-container periods.
 *
 * Model under test:
 *   - A full-year financial_period is a stable CONTAINER for (company, fiscal_year).
 *     Its id persists for the life of the deal.
 *   - reselect swaps figures into the container — it never mints a new period id
 *     when the winner for a year changes.
 *   - ebitda_adjustments are year-bound: they stay on the container, adjusting
 *     whatever currently wins that year.
 *   - staff_data rides the LATEST winning full-year period.
 *   - Prune only when: no income AND no balance AND no staff_data AND no adjustments.
 *
 * Test scenarios (a)–(f) are sequential; each builds on the prior state.
 * Far-future fiscal years (3920, 3923–3926) avoid collision with real data.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq, and } from 'drizzle-orm';
import { db } from '../../db';
import {
  users,
  targetCompanies,
  documents,
  financialContributions,
  financialPeriods,
  incomeStatements,
  balanceSheets,
  ebitdaAdjustments,
  staffData,
} from '@shared/schema';
import { reselect } from '../projection-reselect.service';

const USER_COMPANY_ID = 71;

const FY23 = 3923;
const FY24 = 3924;
const FY25 = 3925;
const FY26 = 3926;
const GHOST_YEAR = 3920;

const STAT_REV_23 = '2300000';
const STAT_REV_24 = '2400000';
const STAT_REV_25 = '2500000';
const STAT_REV_26 = '2600000';
const IM_REV      = '1000000';

describe('reselect — stable year-container periods (Slice 16 final)', () => {
  let testCompanyId: number;
  let userId: number;
  let docStatId: number;
  let docIMId: number;
  let docStat26Id: number;

  // Period ids recorded at the start of test (a)
  let pid23: number;
  let pid24: number;
  let pid25: number;

  // Adjustment ids inserted in test (a)
  let adjId23: number;
  let adjId24: number;
  let adjId25: number;

  const mkToken = () => `s16f-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  async function getPeriodId(fy: number): Promise<number | undefined> {
    const [row] = await db
      .select({ id: financialPeriods.id })
      .from(financialPeriods)
      .where(
        and(
          eq(financialPeriods.targetCompanyId, testCompanyId),
          eq(financialPeriods.fiscalYear, fy),
          eq(financialPeriods.isFullYear, true),
        ),
      )
      .limit(1);
    return row?.id;
  }

  async function getRevenue(fy: number): Promise<string | null> {
    const [row] = await db
      .select({ revenue: incomeStatements.revenue })
      .from(incomeStatements)
      .innerJoin(financialPeriods, eq(incomeStatements.financialPeriodId, financialPeriods.id))
      .where(
        and(
          eq(financialPeriods.targetCompanyId, testCompanyId),
          eq(financialPeriods.fiscalYear, fy),
          eq(financialPeriods.isFullYear, true),
        ),
      )
      .limit(1);
    return row?.revenue ?? null;
  }

  async function getIncomeCount(periodId: number): Promise<number> {
    const rows = await db
      .select({ id: incomeStatements.id })
      .from(incomeStatements)
      .where(eq(incomeStatements.financialPeriodId, periodId));
    return rows.length;
  }

  beforeAll(async () => {
    const [userRow] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.userCompanyId, USER_COMPANY_ID))
      .limit(1);
    if (!userRow) throw new Error(`No user for userCompanyId ${USER_COMPANY_ID}`);
    userId = userRow.id;

    const [company] = await db
      .insert(targetCompanies)
      .values({ userCompanyId: USER_COMPANY_ID, companyName: 'Slice-16F Container Test Co' })
      .returning();
    testCompanyId = company.id;

    const [dStat, dIM, dStat26] = await db
      .insert(documents)
      .values([
        {
          targetCompanyId: testCompanyId, uploadedBy: userId,
          documentName: 'Statutory FY23-25', originalFilename: 'stat-2325.pdf',
          filePath: 'uploads/s16f-stat.pdf', fileSize: 1000, fileType: 'application/pdf',
          documentCategory: 'statutory_accounts', publicToken: mkToken(),
        },
        {
          targetCompanyId: testCompanyId, uploadedBy: userId,
          documentName: 'IM FY23-25', originalFilename: 'im-2325.pdf',
          filePath: 'uploads/s16f-im.pdf', fileSize: 1000, fileType: 'application/pdf',
          documentCategory: 'information_memorandum', publicToken: mkToken(),
        },
        {
          targetCompanyId: testCompanyId, uploadedBy: userId,
          documentName: 'Statutory FY26', originalFilename: 'stat-26.pdf',
          filePath: 'uploads/s16f-stat26.pdf', fileSize: 1000, fileType: 'application/pdf',
          documentCategory: 'statutory_accounts', publicToken: mkToken(),
        },
      ])
      .returning();
    docStatId = dStat.id;
    docIMId   = dIM.id;
    docStat26Id = dStat26.id;

    // Seed contributions: statutory + IM for FY23/24/25 (statutory wins)
    const statFigs = (rev: string) => ({ revenue: rev, costOfSales: null, grossProfit: null });
    const imFigs   = { revenue: IM_REV, costOfSales: null, grossProfit: null };

    await db.insert(financialContributions).values([
      // Statutory income — FY23, FY24, FY25
      { targetCompanyId: testCompanyId, sourceDocumentId: docStatId, statementType: 'income',
        sourceTier: 'statutory', isFullYear: true, isPrimaryYear: true,
        periodEnd: `${FY23}-12-31`, fiscalYear: FY23, figures: statFigs(STAT_REV_23) as any },
      { targetCompanyId: testCompanyId, sourceDocumentId: docStatId, statementType: 'income',
        sourceTier: 'statutory', isFullYear: true, isPrimaryYear: true,
        periodEnd: `${FY24}-12-31`, fiscalYear: FY24, figures: statFigs(STAT_REV_24) as any },
      { targetCompanyId: testCompanyId, sourceDocumentId: docStatId, statementType: 'income',
        sourceTier: 'statutory', isFullYear: true, isPrimaryYear: true,
        periodEnd: `${FY25}-12-31`, fiscalYear: FY25, figures: statFigs(STAT_REV_25) as any },
      // IM income — FY23, FY24, FY25 (lower priority)
      { targetCompanyId: testCompanyId, sourceDocumentId: docIMId, statementType: 'income',
        sourceTier: 'information_memorandum', isFullYear: true, isPrimaryYear: true,
        periodEnd: `${FY23}-12-31`, fiscalYear: FY23, figures: imFigs as any },
      { targetCompanyId: testCompanyId, sourceDocumentId: docIMId, statementType: 'income',
        sourceTier: 'information_memorandum', isFullYear: true, isPrimaryYear: true,
        periodEnd: `${FY24}-12-31`, fiscalYear: FY24, figures: imFigs as any },
      { targetCompanyId: testCompanyId, sourceDocumentId: docIMId, statementType: 'income',
        sourceTier: 'information_memorandum', isFullYear: true, isPrimaryYear: true,
        periodEnd: `${FY25}-12-31`, fiscalYear: FY25, figures: imFigs as any },
    ]);

    // Initial reselect — statutory wins FY23/24/25
    await reselect(testCompanyId);
  });

  afterAll(async () => {
    try {
      await db.delete(ebitdaAdjustments).where(eq(ebitdaAdjustments.targetCompanyId, testCompanyId));
      await db.delete(staffData).where(eq(staffData.targetCompanyId, testCompanyId));
      await db.delete(incomeStatements).where(eq(incomeStatements.targetCompanyId, testCompanyId));
      await db.delete(balanceSheets).where(eq(balanceSheets.targetCompanyId, testCompanyId));
      await db.delete(financialContributions).where(eq(financialContributions.targetCompanyId, testCompanyId));
      await db.delete(financialPeriods).where(eq(financialPeriods.targetCompanyId, testCompanyId));
      await db.delete(documents).where(eq(documents.targetCompanyId, testCompanyId));
      await db.delete(targetCompanies).where(eq(targetCompanies.id, testCompanyId));
    } catch { /* best-effort */ }
  });

  // ─── (a) Add-backs series, reselect — each adjustment stays on its own year ───

  it('(a) add-backs 20k/35k/60k on FY23/24/25 survive reselect on their own period ids', async () => {
    pid23 = (await getPeriodId(FY23))!;
    pid24 = (await getPeriodId(FY24))!;
    pid25 = (await getPeriodId(FY25))!;

    expect(pid23).toBeDefined();
    expect(pid24).toBeDefined();
    expect(pid25).toBeDefined();

    const [a23] = await db.insert(ebitdaAdjustments).values({
      targetCompanyId: testCompanyId, financialPeriodId: pid23,
      description: 'FY23 add-back', amount: '20000', category: 'one_off',
    }).returning();
    const [a24] = await db.insert(ebitdaAdjustments).values({
      targetCompanyId: testCompanyId, financialPeriodId: pid24,
      description: 'FY24 add-back', amount: '35000', category: 'one_off',
    }).returning();
    const [a25] = await db.insert(ebitdaAdjustments).values({
      targetCompanyId: testCompanyId, financialPeriodId: pid25,
      description: 'FY25 add-back', amount: '60000', category: 'one_off',
    }).returning();
    adjId23 = a23.id;
    adjId24 = a24.id;
    adjId25 = a25.id;

    await reselect(testCompanyId);

    // Period ids must be unchanged
    expect(await getPeriodId(FY23)).toBe(pid23);
    expect(await getPeriodId(FY24)).toBe(pid24);
    expect(await getPeriodId(FY25)).toBe(pid25);

    // Adjustments must be on their own year's period, with correct amounts
    const [ra23] = await db.select().from(ebitdaAdjustments).where(eq(ebitdaAdjustments.id, adjId23));
    const [ra24] = await db.select().from(ebitdaAdjustments).where(eq(ebitdaAdjustments.id, adjId24));
    const [ra25] = await db.select().from(ebitdaAdjustments).where(eq(ebitdaAdjustments.id, adjId25));

    expect(ra23.financialPeriodId).toBe(pid23);
    expect(Number(ra23.amount)).toBe(20000);
    expect(ra24.financialPeriodId).toBe(pid24);
    expect(Number(ra24.amount)).toBe(35000);
    expect(ra25.financialPeriodId).toBe(pid25);
    expect(Number(ra25.amount)).toBe(60000);

    // Figures still correct (statutory wins)
    expect(await getRevenue(FY23)).toBe(STAT_REV_23);
    expect(await getRevenue(FY24)).toBe(STAT_REV_24);
    expect(await getRevenue(FY25)).toBe(STAT_REV_25);
  });

  // ─── (b) New FY26 doc → period ids for FY23–25 unchanged ───────────────────

  it('(b) new FY26 document → FY23-25 container ids unchanged, adjustments still attached', async () => {
    await db.insert(financialContributions).values({
      targetCompanyId: testCompanyId, sourceDocumentId: docStat26Id,
      statementType: 'income', sourceTier: 'statutory', isFullYear: true, isPrimaryYear: true,
      periodEnd: `${FY26}-12-31`, fiscalYear: FY26,
      figures: { revenue: STAT_REV_26, costOfSales: null, grossProfit: null } as any,
    });

    await reselect(testCompanyId);

    // FY23/24/25 container ids must be identical to those recorded in (a)
    expect(await getPeriodId(FY23)).toBe(pid23);
    expect(await getPeriodId(FY24)).toBe(pid24);
    expect(await getPeriodId(FY25)).toBe(pid25);

    // Adjustments still on the correct periods
    const [ra23] = await db.select().from(ebitdaAdjustments).where(eq(ebitdaAdjustments.id, adjId23));
    const [ra24] = await db.select().from(ebitdaAdjustments).where(eq(ebitdaAdjustments.id, adjId24));
    const [ra25] = await db.select().from(ebitdaAdjustments).where(eq(ebitdaAdjustments.id, adjId25));

    expect(ra23.financialPeriodId).toBe(pid23);
    expect(ra24.financialPeriodId).toBe(pid24);
    expect(ra25.financialPeriodId).toBe(pid25);

    // FY26 now has a period and correct revenue
    expect(await getPeriodId(FY26)).toBeDefined();
    expect(await getRevenue(FY26)).toBe(STAT_REV_26);
  });

  // ─── (c) Delete FY25 statutory → IM fallback drops into same FY25 container ─

  it('(c) FY25 statutory deleted, IM fallback → same container id, adjustment survives', async () => {
    // Remove only the statutory contribution for FY25
    await db
      .delete(financialContributions)
      .where(
        and(
          eq(financialContributions.targetCompanyId, testCompanyId),
          eq(financialContributions.fiscalYear, FY25),
          eq(financialContributions.sourceTier, 'statutory'),
        ),
      );

    await reselect(testCompanyId);

    // Container id must be unchanged
    expect(await getPeriodId(FY25)).toBe(pid25);

    // Figures now from IM fallback
    expect(await getRevenue(FY25)).toBe(IM_REV);

    // Adjustment still on FY25 container
    const [ra25] = await db.select().from(ebitdaAdjustments).where(eq(ebitdaAdjustments.id, adjId25));
    expect(ra25.financialPeriodId).toBe(pid25);

    // Other years unaffected
    expect(await getPeriodId(FY23)).toBe(pid23);
    expect(await getPeriodId(FY24)).toBe(pid24);
    expect(await getRevenue(FY23)).toBe(STAT_REV_23);
    expect(await getRevenue(FY24)).toBe(STAT_REV_24);
  });

  // ─── (d) Delete ALL FY25 → container kept (adjustment), figures empty ───────

  it('(d) ALL FY25 contributions deleted → container kept (adjustment present), figures empty', async () => {
    // Remove the IM contribution for FY25 too (no fallback left)
    await db
      .delete(financialContributions)
      .where(
        and(
          eq(financialContributions.targetCompanyId, testCompanyId),
          eq(financialContributions.fiscalYear, FY25),
        ),
      );

    await reselect(testCompanyId);

    // Container must still exist (the add-back prevents pruning)
    const stillPid25 = await getPeriodId(FY25);
    expect(stillPid25).toBe(pid25);

    // Figures must be empty (all sources gone → orphaned figures cleared)
    expect(await getIncomeCount(pid25)).toBe(0);
    expect(await getRevenue(FY25)).toBeNull();

    // Adjustment still attached
    const [ra25] = await db.select().from(ebitdaAdjustments).where(eq(ebitdaAdjustments.id, adjId25));
    expect(ra25.financialPeriodId).toBe(pid25);
  });

  // ─── (e) staff_data on ghost → re-pointed to latest winner, ghost pruned ────

  it('(e) staff_data on ghost period → re-pointed to latest winner; ghost pruned', async () => {
    // Inject an empty ghost period for an old year (no contributions)
    const [ghost] = await db
      .insert(financialPeriods)
      .values({
        targetCompanyId: testCompanyId, periodType: 'management',
        sourceTier: 'management', periodEnd: `${GHOST_YEAR}-12-31`,
        fiscalYear: GHOST_YEAR, isFullYear: true, sourceDocumentId: null,
        periodLabel: `FY ${GHOST_YEAR} (ghost)`,
      })
      .returning();

    // Add staff_data on the ghost period
    const [sd] = await db
      .insert(staffData)
      .values({
        targetCompanyId: testCompanyId,
        financialPeriodId: ghost.id,
        totalHeadcount: 42,
        totalStaffCosts: '500000',
      })
      .returning();

    await reselect(testCompanyId);

    // Ghost period must be pruned (no income, no balance, no adjustments;
    // staff_data was re-pointed away)
    const ghostCheck = await db
      .select({ id: financialPeriods.id })
      .from(financialPeriods)
      .where(eq(financialPeriods.id, ghost.id));
    expect(ghostCheck).toHaveLength(0);

    // staff_data must have been re-pointed to the latest winner (FY26 is highest)
    const pid26 = await getPeriodId(FY26);
    expect(pid26).toBeDefined();

    const [sdAfter] = await db
      .select({ financialPeriodId: staffData.financialPeriodId })
      .from(staffData)
      .where(eq(staffData.id, sd.id));
    expect(sdAfter.financialPeriodId).toBe(pid26);
  });

  // ─── (f) Idempotency ────────────────────────────────────────────────────────

  it('(f) reselect twice → no state changes on the second run', async () => {
    // Snapshot state before second run
    const p23_before = await getPeriodId(FY23);
    const p24_before = await getPeriodId(FY24);
    const p25_before = await getPeriodId(FY25);
    const p26_before = await getPeriodId(FY26);
    const rev23_before = await getRevenue(FY23);
    const rev24_before = await getRevenue(FY24);

    await reselect(testCompanyId);

    // Period ids unchanged
    expect(await getPeriodId(FY23)).toBe(p23_before);
    expect(await getPeriodId(FY24)).toBe(p24_before);
    expect(await getPeriodId(FY25)).toBe(p25_before); // container kept (adjustment)
    expect(await getPeriodId(FY26)).toBe(p26_before);

    // Figures unchanged
    expect(await getRevenue(FY23)).toBe(rev23_before);
    expect(await getRevenue(FY24)).toBe(rev24_before);
    expect(await getRevenue(FY25)).toBeNull(); // still no figures (no contributions)

    // Adjustments still on original periods
    const [ra23] = await db.select().from(ebitdaAdjustments).where(eq(ebitdaAdjustments.id, adjId23));
    const [ra24] = await db.select().from(ebitdaAdjustments).where(eq(ebitdaAdjustments.id, adjId24));
    const [ra25] = await db.select().from(ebitdaAdjustments).where(eq(ebitdaAdjustments.id, adjId25));

    expect(ra23.financialPeriodId).toBe(pid23);
    expect(ra24.financialPeriodId).toBe(pid24);
    expect(ra25.financialPeriodId).toBe(pid25);
  });
});
