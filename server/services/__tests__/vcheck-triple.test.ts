/**
 * V-CHECK: Triple-Test Company (Slice 16 final)
 *
 * Creates a fresh "triple-test company" with:
 *   – 4 documents: statutory accounts, information memorandum, flyer, staff-matrix
 *   – Contributions: statutory (FY2022–2025 income+balance), IM (FY2022–2025 income+balance),
 *     flyer (FY2024 income only — retained but doesn't win)
 *   – ebitda_adjustments on each of FY2022–2025 (adj1–adj4)
 *   – staff_data on the latest winning full-year period (FY2025)
 *
 * Checks A–H:
 *   A. documentCategory vs analyzed type (flyer ≠ company_accounts; Staff_Matrix ≠ staff_matrix)
 *   B. Contributions by tier; statutory wins FY2022–2025; flyer FY2024 retained but not projected
 *   C. No periods with fiscalYear > 2026 for this company
 *   D. Exactly one full-year period per fiscal year — no duplicates, no ghosts
 *   E. fetchReportedEbitdaByYear (statutory only) + adjusted EBITDA; isProvisionalFinancials = false
 *   F. IM & flyer tier = information_memorandum (do not satisfy primary slot alone)
 *   G. year-4 delete: delete FY2025 statutory → IM fallback; adj4 stays on same period id
 *   H. staff_data is on the latest winning full-year period; exactly one row
 *
 * HOST GUARD: aborts if DATABASE_URL points at ep-old-recipe (prod).
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq, and, gt, ne } from 'drizzle-orm';
import { db } from '../../db';
import {
  users,
  targetCompanies,
  documents,
  fileUploadEvents,
  documentAnalysisResults,
  financialContributions,
  financialPeriods,
  incomeStatements,
  balanceSheets,
  ebitdaAdjustments,
  staffData,
} from '@shared/schema';
import { reselect } from '../projection-reselect.service';
import { fetchReportedEbitdaByYear } from '../deal-model.service';
import { isProvisionalFinancials } from '../../../shared/utils/provisional-financials';

// ─── HOST GUARD ────────────────────────────────────────────────────────────────
const dbUrl = process.env.DATABASE_URL ?? '';
const dbHost = dbUrl.match(/@([^/]+)\//)?.[1] ?? 'unknown';
if (dbHost.includes('ep-old-recipe')) {
  throw new Error(`V-CHECK ABORT: DATABASE_URL points at PROD host (${dbHost}). Run only on dev (helium).`);
}

// ─── CONSTANTS ─────────────────────────────────────────────────────────────────
const USER_COMPANY_ID = 71;

// Realistic fiscal years — safe since the test company gets a fresh id
const FY22 = 2022;
const FY23 = 2023;
const FY24 = 2024;
const FY25 = 2025; // "year 4" — deleted in check G

// Statutory income figures: operatingProfit + D&A → EBITDA
const STAT_INC = {
  [FY22]: { operatingProfit: '100000', depreciationAmortisation: '10000', revenue: '800000' },
  [FY23]: { operatingProfit: '120000', depreciationAmortisation: '11000', revenue: '900000' },
  [FY24]: { operatingProfit: '140000', depreciationAmortisation: '12000', revenue: '1000000' },
  [FY25]: { operatingProfit: '160000', depreciationAmortisation: '13000', revenue: '1100000' },
};
// Reported EBITDA = operatingProfit + D&A
const STAT_EBITDA: Record<number, number> = {
  [FY22]: 110000,
  [FY23]: 131000,
  [FY24]: 152000,
  [FY25]: 173000,
};

// IM income figures (lower priority than statutory)
const IM_INC = {
  [FY22]: { operatingProfit: '90000', depreciationAmortisation: '9000', revenue: '700000' },
  [FY23]: { operatingProfit: '110000', depreciationAmortisation: '10000', revenue: '800000' },
  [FY24]: { operatingProfit: '130000', depreciationAmortisation: '11000', revenue: '900000' },
  [FY25]: { operatingProfit: '150000', depreciationAmortisation: '12000', revenue: '1000000' },
};

// Balance sheet figures (used to fill balance slot in check D)
const STAT_BAL = { totalAssets: '500000', cashAtBank: '50000', totalEquity: '300000' };
const IM_BAL   = { totalAssets: '480000', cashAtBank: '45000', totalEquity: '280000' };

// Flyer income FY2024 only (information_memorandum tier, lowest priority)
const FLYER_INC_FY24 = { operatingProfit: '125000', depreciationAmortisation: '10000', revenue: '950000' };

// Add-back amounts
const ADJ_AMOUNTS = { [FY22]: 20000, [FY23]: 35000, [FY24]: 60000, [FY25]: 25000 };

// ─── TEST STATE ────────────────────────────────────────────────────────────────
describe('V-Check A–H: triple-test company', () => {
  let testCompanyId: number;
  let userId: number;

  let docStatId: number;
  let docIMId:   number;
  let docFlyerId: number;
  let docStaffId: number;

  // Period ids recorded after initial reselect
  let pid22: number;
  let pid23: number;
  let pid24: number;
  let pid25: number; // year-4

  // Adjustment ids
  let adjId22: number;
  let adjId23: number;
  let adjId24: number;
  let adjId25: number; // year-4

  const mkToken = () => `vchk-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  async function getPeriodId(fy: number): Promise<number | undefined> {
    const [row] = await db
      .select({ id: financialPeriods.id })
      .from(financialPeriods)
      .where(and(
        eq(financialPeriods.targetCompanyId, testCompanyId),
        eq(financialPeriods.fiscalYear, fy),
        eq(financialPeriods.isFullYear, true),
      ))
      .limit(1);
    return row?.id;
  }

  async function getIncomeRow(periodId: number) {
    const [row] = await db
      .select()
      .from(incomeStatements)
      .where(eq(incomeStatements.financialPeriodId, periodId))
      .limit(1);
    return row;
  }

  // ─── SETUP ──────────────────────────────────────────────────────────────────

  beforeAll(async () => {
    // 1. Find a user in userCompanyId 71
    const [userRow] = await db.select({ id: users.id }).from(users)
      .where(eq(users.userCompanyId, USER_COMPANY_ID)).limit(1);
    if (!userRow) throw new Error(`No user for userCompanyId ${USER_COMPANY_ID}`);
    userId = userRow.id;

    // 2. Create triple-test company
    const [company] = await db.insert(targetCompanies)
      .values({ userCompanyId: USER_COMPANY_ID, companyName: 'V-Check Triple-Test Co' })
      .returning();
    testCompanyId = company.id;
    console.log(`TRIPLE_TEST_COMPANY_ID=${testCompanyId}  name="${company.companyName}"  host=${dbHost}`);

    // 3. Create 4 documents
    const [dStat, dIM, dFlyer, dStaff] = await db.insert(documents).values([
      {
        targetCompanyId: testCompanyId, uploadedBy: userId,
        documentName: 'FY2022-2025 Statutory Accounts',
        originalFilename: 'statutory-2225.pdf',
        filePath: 'uploads/vchk-stat.pdf', fileSize: 2000,
        fileType: 'application/pdf', documentCategory: 'Statutory Accounts',
        publicToken: mkToken(),
      },
      {
        targetCompanyId: testCompanyId, uploadedBy: userId,
        documentName: 'Company Information Memorandum',
        originalFilename: 'im-pack.pdf',
        filePath: 'uploads/vchk-im.pdf', fileSize: 3000,
        fileType: 'application/pdf', documentCategory: 'Information Memorandum',
        publicToken: mkToken(),
      },
      {
        targetCompanyId: testCompanyId, uploadedBy: userId,
        documentName: 'Sales Flyer 2024',
        originalFilename: 'sales-flyer-2024.pdf',
        filePath: 'uploads/vchk-flyer.pdf', fileSize: 500,
        fileType: 'application/pdf', documentCategory: 'Flyer',
        publicToken: mkToken(),
      },
      {
        targetCompanyId: testCompanyId, uploadedBy: userId,
        documentName: 'The_Company_Staff_Matrix.csv',
        originalFilename: 'Staff_Matrix.csv',
        filePath: 'uploads/vchk-staff.csv', fileSize: 100,
        fileType: 'text/csv', documentCategory: 'Staff Matrix',
        publicToken: mkToken(),
      },
    ]).returning();
    docStatId  = dStat.id;
    docIMId    = dIM.id;
    docFlyerId = dFlyer.id;
    docStaffId = dStaff.id;

    // 4. Insert fileUploadEvents + documentAnalysisResults for flyer & staff-matrix (check A)
    const [fueFlyer] = await db.insert(fileUploadEvents).values({
      documentId: docFlyerId, targetCompanyId: testCompanyId, uploadedBy: userId,
      fileName: 'sales-flyer-2024.pdf', fileUrl: 'uploads/vchk-flyer.pdf',
    }).returning();
    const [fueStaff] = await db.insert(fileUploadEvents).values({
      documentId: docStaffId, targetCompanyId: testCompanyId, uploadedBy: userId,
      fileName: 'Staff_Matrix.csv', fileUrl: 'uploads/vchk-staff.csv',
    }).returning();
    await db.insert(documentAnalysisResults).values([
      {
        documentId: docFlyerId, fileUploadEventId: fueFlyer.id,
        documentType: 'company_presentation',
        analysisData: { confidence: 0.97, note: 'marketing one-pager, no financial accounts' },
      },
      {
        documentId: docStaffId, fileUploadEventId: fueStaff.id,
        documentType: 'staff_data',
        analysisData: { confidence: 0.99, note: 'headcount and salary breakdown CSV' },
      },
    ]);

    // 5. Insert financial contributions
    const years = [FY22, FY23, FY24, FY25];
    const statIncContribs = years.flatMap(fy => [
      {
        targetCompanyId: testCompanyId, sourceDocumentId: docStatId,
        statementType: 'income' as const, sourceTier: 'statutory',
        isFullYear: true, isPrimaryYear: true,
        periodEnd: `${fy}-12-31`, fiscalYear: fy,
        figures: STAT_INC[fy] as any,
      },
      {
        targetCompanyId: testCompanyId, sourceDocumentId: docStatId,
        statementType: 'balance' as const, sourceTier: 'statutory',
        isFullYear: true, isPrimaryYear: true,
        periodEnd: `${fy}-12-31`, fiscalYear: fy,
        figures: STAT_BAL as any,
      },
    ]);
    const imIncContribs = years.flatMap(fy => [
      {
        targetCompanyId: testCompanyId, sourceDocumentId: docIMId,
        statementType: 'income' as const, sourceTier: 'information_memorandum',
        isFullYear: true, isPrimaryYear: true,
        periodEnd: `${fy}-12-31`, fiscalYear: fy,
        figures: IM_INC[fy] as any,
      },
      {
        targetCompanyId: testCompanyId, sourceDocumentId: docIMId,
        statementType: 'balance' as const, sourceTier: 'information_memorandum',
        isFullYear: true, isPrimaryYear: true,
        periodEnd: `${fy}-12-31`, fiscalYear: fy,
        figures: IM_BAL as any,
      },
    ]);
    // Flyer: one income-only contribution for FY2024
    const flyerContrib = {
      targetCompanyId: testCompanyId, sourceDocumentId: docFlyerId,
      statementType: 'income' as const, sourceTier: 'information_memorandum',
      isFullYear: true, isPrimaryYear: false,
      periodEnd: `${FY24}-12-31`, fiscalYear: FY24,
      figures: FLYER_INC_FY24 as any,
    };
    await db.insert(financialContributions).values([
      ...statIncContribs, ...imIncContribs, flyerContrib,
    ]);

    // 6. Initial reselect — statutory wins all 4 years
    await reselect(testCompanyId);

    // 7. Record winning period ids
    pid22 = (await getPeriodId(FY22))!;
    pid23 = (await getPeriodId(FY23))!;
    pid24 = (await getPeriodId(FY24))!;
    pid25 = (await getPeriodId(FY25))!;

    // 8. Insert ebitda_adjustments (add-backs) on each year's period
    const [a22] = await db.insert(ebitdaAdjustments).values({
      targetCompanyId: testCompanyId, financialPeriodId: pid22,
      description: 'FY2022 legal one-off', amount: String(ADJ_AMOUNTS[FY22]), category: 'one_off',
    }).returning();
    const [a23] = await db.insert(ebitdaAdjustments).values({
      targetCompanyId: testCompanyId, financialPeriodId: pid23,
      description: 'FY2023 directors remuneration', amount: String(ADJ_AMOUNTS[FY23]), category: 'one_off',
    }).returning();
    const [a24] = await db.insert(ebitdaAdjustments).values({
      targetCompanyId: testCompanyId, financialPeriodId: pid24,
      description: 'FY2024 non-recurring marketing', amount: String(ADJ_AMOUNTS[FY24]), category: 'one_off',
    }).returning();
    const [a25] = await db.insert(ebitdaAdjustments).values({
      targetCompanyId: testCompanyId, financialPeriodId: pid25,
      description: 'FY2025 exceptional cost (year-4)', amount: String(ADJ_AMOUNTS[FY25]), category: 'one_off',
    }).returning();
    adjId22 = a22.id;
    adjId23 = a23.id;
    adjId24 = a24.id;
    adjId25 = a25.id;

    // 9. Insert staff_data on FY2025 (latest winning full-year period)
    await db.insert(staffData).values({
      targetCompanyId: testCompanyId,
      financialPeriodId: pid25,
      totalHeadcount: 42,
      sourceDocumentId: docStaffId,
    });

    console.log(`  periods: pid22=${pid22} pid23=${pid23} pid24=${pid24} pid25=${pid25}`);
    console.log(`  adjs:    adj22=${adjId22} adj23=${adjId23} adj24=${adjId24} adj25=${adjId25}`);
    console.log(`  docs:    stat=${docStatId} im=${docIMId} flyer=${docFlyerId} staff=${docStaffId}`);
  });

  afterAll(async () => {
    try {
      await db.delete(documentAnalysisResults).where(eq(documentAnalysisResults.documentId, docFlyerId));
      await db.delete(documentAnalysisResults).where(eq(documentAnalysisResults.documentId, docStaffId));
      await db.delete(fileUploadEvents).where(eq(fileUploadEvents.targetCompanyId, testCompanyId));
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

  // ─── CHECK A: documentCategory vs analyzed type ─────────────────────────────

  it('A. documentCategory vs analyzed type', async () => {
    const [dFlyer] = await db.select({ cat: documents.documentCategory, name: documents.documentName })
      .from(documents).where(eq(documents.id, docFlyerId));
    const [dStaff] = await db.select({ cat: documents.documentCategory, name: documents.documentName })
      .from(documents).where(eq(documents.id, docStaffId));

    const [arFlyer] = await db.select({ dtype: documentAnalysisResults.documentType })
      .from(documentAnalysisResults).where(eq(documentAnalysisResults.documentId, docFlyerId));
    const [arStaff] = await db.select({ dtype: documentAnalysisResults.documentType })
      .from(documentAnalysisResults).where(eq(documentAnalysisResults.documentId, docStaffId));

    console.log(`  A. Flyer:  documentCategory="${dFlyer.cat}"  analyzedType="${arFlyer.dtype}"`);
    console.log(`  A. Staff:  documentCategory="${dStaff.cat}"  analyzedType="${arStaff.dtype}"`);

    // Flyer: category is NOT 'company_accounts' / 'Statutory Accounts'
    expect(dFlyer.cat).toBe('Flyer');
    expect(arFlyer.dtype).not.toBe('company_accounts');
    expect(arFlyer.dtype).toBe('company_presentation');

    // Staff Matrix: documentCategory uses display-name format (not snake_case 'staff_matrix')
    expect(dStaff.cat).toBe('Staff Matrix');
    expect(arStaff.dtype).not.toBe('staff_matrix');
    expect(arStaff.dtype).toBe('staff_data');
  });

  // ─── CHECK B: contributions by tier; winners + retained non-winners ──────────

  it('B. Contributions by tier and period winners', async () => {
    const contribs = await db
      .select({
        fy: financialContributions.fiscalYear,
        type: financialContributions.statementType,
        tier: financialContributions.sourceTier,
        docId: financialContributions.sourceDocumentId,
      })
      .from(financialContributions)
      .where(eq(financialContributions.targetCompanyId, testCompanyId));

    // Group by (fy, type, tier)
    const summary: Record<string, string[]> = {};
    for (const c of contribs) {
      const key = `FY${c.fy}/${c.type}`;
      (summary[key] ??= []).push(c.tier!);
    }
    for (const [k, tiers] of Object.entries(summary).sort()) {
      console.log(`  B. ${k}: [${tiers.sort().join(', ')}]`);
    }

    // Each full year has statutory + IM income and balance
    for (const fy of [FY22, FY23, FY24, FY25]) {
      const incTiers = contribs.filter(c => c.fy === fy && c.type === 'income').map(c => c.tier!);
      const balTiers = contribs.filter(c => c.fy === fy && c.type === 'balance').map(c => c.tier!);
      expect(incTiers).toContain('statutory');
      expect(incTiers).toContain('information_memorandum');
      expect(balTiers).toContain('statutory');
      expect(balTiers).toContain('information_memorandum');
    }

    // FY2024 income also has the flyer contribution
    const fy24IncContribs = contribs.filter(c => c.fy === FY24 && c.type === 'income');
    expect(fy24IncContribs.filter(c => c.docId === docFlyerId)).toHaveLength(1);

    // Projected winner for each year = statutory (income_statements contain statutory figures)
    for (const fy of [FY22, FY23, FY24, FY25]) {
      const pid = await getPeriodId(fy);
      const inc = await getIncomeRow(pid!);
      const winnerPeriod = await db.select({ tier: financialPeriods.sourceTier })
        .from(financialPeriods).where(eq(financialPeriods.id, pid!)).limit(1);
      console.log(`  B. FY${fy} winner period tier="${winnerPeriod[0].tier}"  revenue="${inc?.revenue}"`);
      expect(winnerPeriod[0].tier).toBe('statutory');
      expect(inc?.revenue).toBe(STAT_INC[fy].revenue);
    }

    // Flyer FY2024 income contribution is retained but its figures NOT in the projected income statement
    const inc24 = await getIncomeRow(pid24);
    expect(inc24?.revenue).toBe(STAT_INC[FY24].revenue); // statutory revenue, not flyer's
    expect(inc24?.revenue).not.toBe(FLYER_INC_FY24.revenue);
  });

  // ─── CHECK C: no periods with fiscalYear > 2026 ──────────────────────────────

  it('C. No periods with fiscalYear > 2026 for this company', async () => {
    const futurePeriods = await db
      .select({ id: financialPeriods.id, fy: financialPeriods.fiscalYear })
      .from(financialPeriods)
      .where(and(
        eq(financialPeriods.targetCompanyId, testCompanyId),
        gt(financialPeriods.fiscalYear, 2026),
      ));
    console.log(`  C. Periods with fy > 2026: ${futurePeriods.length} (expected 0)`);
    expect(futurePeriods).toHaveLength(0);
  });

  // ─── CHECK D: one full-year period per fiscal year; no duplicates, no ghosts ─

  it('D. Exactly one full-year period per fiscal year; no duplicates; no ghosts', async () => {
    const periods = await db
      .select({ id: financialPeriods.id, fy: financialPeriods.fiscalYear, tier: financialPeriods.sourceTier })
      .from(financialPeriods)
      .where(and(
        eq(financialPeriods.targetCompanyId, testCompanyId),
        eq(financialPeriods.isFullYear, true),
      ));

    const fySet = new Set(periods.map(p => p.fy));
    console.log(`  D. Full-year periods: ${periods.map(p => `FY${p.fy}(id=${p.id},tier=${p.tier})`).join(' ')}`);

    // Exactly 4 full-year periods (FY2022–2025), each fiscal year appears once
    expect(periods).toHaveLength(4);
    expect(fySet.size).toBe(4); // no duplicate fiscal years
    expect(fySet).toContain(FY22);
    expect(fySet).toContain(FY23);
    expect(fySet).toContain(FY24);
    expect(fySet).toContain(FY25);

    // Each period has an income statement AND a balance sheet (no ghosts)
    for (const p of periods) {
      const incRows = await db.select({ id: incomeStatements.id }).from(incomeStatements)
        .where(eq(incomeStatements.financialPeriodId, p.id));
      const balRows = await db.select({ id: balanceSheets.id }).from(balanceSheets)
        .where(eq(balanceSheets.financialPeriodId, p.id));
      console.log(`  D.   FY${p.fy}(id=${p.id}): income=${incRows.length} balance=${balRows.length}`);
      expect(incRows).toHaveLength(1); // exactly one income statement
      expect(balRows).toHaveLength(1); // exactly one balance sheet
    }
  });

  // ─── CHECK E: reportedEbitdaByYear + adjusted EBITDA; isProvisionalFinancials ─

  it('E. fetchReportedEbitdaByYear + adjusted EBITDA; isProvisionalFinancials = false', async () => {
    const reportedEbitda = await fetchReportedEbitdaByYear(testCompanyId);
    console.log('  E. reportedEbitda:', reportedEbitda);

    // Statutory years FY2022–2025, IM excluded (tier = information_memorandum filtered out)
    expect(Object.keys(reportedEbitda)).toHaveLength(4);
    for (const fy of [FY22, FY23, FY24, FY25]) {
      expect(reportedEbitda[String(fy)]).toBeCloseTo(STAT_EBITDA[fy], 0);
    }

    // Adjusted EBITDA = reported + add-backs
    const adjs = await db.select({ fy: financialPeriods.fiscalYear, amount: ebitdaAdjustments.amount })
      .from(ebitdaAdjustments)
      .innerJoin(financialPeriods, eq(ebitdaAdjustments.financialPeriodId, financialPeriods.id))
      .where(eq(ebitdaAdjustments.targetCompanyId, testCompanyId));

    const adjsByYear: Record<string, number> = {};
    for (const a of adjs) {
      adjsByYear[String(a.fy)] = (adjsByYear[String(a.fy)] ?? 0) + Number(a.amount);
    }
    console.log('  E. adjsByYear:', adjsByYear);

    for (const fy of [FY22, FY23, FY24, FY25]) {
      const adjusted = reportedEbitda[String(fy)] + (adjsByYear[String(fy)] ?? 0);
      const expected = STAT_EBITDA[fy] + ADJ_AMOUNTS[fy];
      console.log(`  E.   FY${fy}: reported=${reportedEbitda[String(fy)]} + addBack=${adjsByYear[String(fy)]} = adjusted=${adjusted} (expected ${expected})`);
      expect(adjusted).toBeCloseTo(expected, 0);
    }

    // isProvisionalFinancials = false (have statutory contributions)
    const contribs = await db
      .select({ sourceTier: financialContributions.sourceTier })
      .from(financialContributions)
      .where(eq(financialContributions.targetCompanyId, testCompanyId));
    const provisional = isProvisionalFinancials(contribs as { sourceTier: string }[]);
    console.log(`  E. isProvisionalFinancials=${provisional} (expected false — have statutory)`);
    expect(provisional).toBe(false);
  });

  // ─── CHECK F: IM and flyer contributions are information_memorandum tier ──────

  it('F. IM and flyer contributions are information_memorandum; do not satisfy primary slot alone', async () => {
    const imContribs = await db
      .select({ tier: financialContributions.sourceTier, docId: financialContributions.sourceDocumentId, fy: financialContributions.fiscalYear })
      .from(financialContributions)
      .where(and(
        eq(financialContributions.targetCompanyId, testCompanyId),
        eq(financialContributions.sourceTier, 'information_memorandum'),
      ));

    const flyerContribs = imContribs.filter(c => c.docId === docFlyerId);
    const imDocContribs = imContribs.filter(c => c.docId === docIMId);

    console.log(`  F. IM doc contributions (tier=information_memorandum): ${imDocContribs.length} rows across years [${[...new Set(imDocContribs.map(c => c.fy))].sort().join(', ')}]`);
    console.log(`  F. Flyer doc contributions (tier=information_memorandum): ${flyerContribs.length} row(s) — FY${flyerContribs[0]?.fy}`);

    // All IM + flyer contributions are information_memorandum tier
    for (const c of imContribs) {
      expect(c.tier).toBe('information_memorandum');
    }
    expect(imDocContribs.length).toBeGreaterThan(0);
    expect(flyerContribs).toHaveLength(1); // one flyer contribution (FY2024 only)

    // If we removed statutory contributions, isProvisionalFinancials would be true
    const imOnlyContribs = imContribs.map(c => ({ sourceTier: c.tier! }));
    const provisionalImOnly = isProvisionalFinancials(imOnlyContribs);
    console.log(`  F. isProvisionalFinancials(IM+flyer only)=${provisionalImOnly} (expected true — no statutory)`);
    expect(provisionalImOnly).toBe(true);

    // With full contribution set (including statutory), it's false
    const allContribs = await db.select({ sourceTier: financialContributions.sourceTier })
      .from(financialContributions).where(eq(financialContributions.targetCompanyId, testCompanyId));
    expect(isProvisionalFinancials(allContribs as { sourceTier: string }[])).toBe(false);
  });

  // ─── CHECK G: year-4 delete → IM fallback; adj4 stays on same period id ──────

  it('G. year-4 delete: FY2025 statutory deleted → IM fallback; adj4 on same period id', async () => {
    // --- BEFORE state ---
    const [adj25before] = await db.select().from(ebitdaAdjustments).where(eq(ebitdaAdjustments.id, adjId25));
    const incBefore = await getIncomeRow(pid25);
    const reportedBefore = await fetchReportedEbitdaByYear(testCompanyId);
    const periodTierBefore = (await db.select({ tier: financialPeriods.sourceTier })
      .from(financialPeriods).where(eq(financialPeriods.id, pid25)).limit(1))[0];

    console.log(`  G. BEFORE  pid25=${pid25}  period.tier="${periodTierBefore.tier}"  revenue="${incBefore?.revenue}"  adj25.period=${adj25before.financialPeriodId}  adj25.amount=${adj25before.amount}`);
    console.log(`  G. BEFORE  reportedEbitda[2025]=${reportedBefore['2025']}`);

    expect(adj25before.financialPeriodId).toBe(pid25);
    expect(Number(adj25before.amount)).toBe(ADJ_AMOUNTS[FY25]);
    expect(periodTierBefore.tier).toBe('statutory');
    expect(incBefore?.revenue).toBe(STAT_INC[FY25].revenue);

    // --- YEAR-4 DELETE: remove FY2025 statutory contributions ---
    await db.delete(financialContributions).where(and(
      eq(financialContributions.targetCompanyId, testCompanyId),
      eq(financialContributions.fiscalYear, FY25),
      eq(financialContributions.sourceTier, 'statutory'),
    ));

    // Reselect — IM becomes the fallback winner for FY2025
    await reselect(testCompanyId);

    // --- AFTER state ---
    const pid25After = await getPeriodId(FY25);
    const [adj25after] = await db.select().from(ebitdaAdjustments).where(eq(ebitdaAdjustments.id, adjId25));
    const incAfter = await getIncomeRow(pid25After!);
    const reportedAfter = await fetchReportedEbitdaByYear(testCompanyId);
    const periodTierAfter = (await db.select({ tier: financialPeriods.sourceTier })
      .from(financialPeriods).where(eq(financialPeriods.id, pid25After!)).limit(1))[0];

    console.log(`  G. AFTER   pid25After=${pid25After}  period.tier="${periodTierAfter.tier}"  revenue="${incAfter?.revenue}"  adj25.period=${adj25after.financialPeriodId}  adj25.amount=${adj25after.amount}`);
    console.log(`  G. AFTER   reportedEbitda[2025]=${reportedAfter['2025']} (expected undefined — IM excluded from reported)`);

    // Period id UNCHANGED (container stability)
    expect(pid25After).toBe(pid25);

    // adj25 STILL on the same period id (not deleted, not moved)
    expect(adj25after.financialPeriodId).toBe(pid25);
    expect(Number(adj25after.amount)).toBe(ADJ_AMOUNTS[FY25]);

    // Period now shows IM figures (IM won the fallback)
    expect(periodTierAfter.tier).toBe('information_memorandum');
    expect(incAfter?.revenue).toBe(IM_INC[FY25].revenue);

    // FY2025 is now IM-tiered → excluded from fetchReportedEbitdaByYear
    expect(reportedAfter['2025']).toBeUndefined();

    // FY2022-2024 still have statutory reported EBITDA (unchanged)
    for (const fy of [FY22, FY23, FY24]) {
      expect(reportedAfter[String(fy)]).toBeCloseTo(STAT_EBITDA[fy], 0);
    }

    // Other period ids are unchanged
    expect(await getPeriodId(FY22)).toBe(pid22);
    expect(await getPeriodId(FY23)).toBe(pid23);
    expect(await getPeriodId(FY24)).toBe(pid24);
  });

  // ─── CHECK H: staff_data is on the latest winning full-year period ────────────
  // NOTE: must run before check I, which adds a FY2026 full-year period that
  // would shift staff_data to FY2026 and invalidate this check.

  it('H. staff_data: exactly one row, on the latest winning full-year period (FY2025 container)', async () => {
    const sdRows = await db
      .select({ id: staffData.id, periodId: staffData.financialPeriodId, headcount: staffData.totalHeadcount, docId: staffData.sourceDocumentId })
      .from(staffData)
      .where(eq(staffData.targetCompanyId, testCompanyId));

    console.log(`  H. staffData rows: ${sdRows.length} (expected 1)`);
    for (const r of sdRows) {
      const [p] = await db.select({ fy: financialPeriods.fiscalYear, tier: financialPeriods.sourceTier })
        .from(financialPeriods).where(eq(financialPeriods.id, r.periodId)).limit(1);
      console.log(`  H.   id=${r.id}  periodId=${r.periodId}  FY${p.fy}(tier=${p.tier})  headcount=${r.headcount}  sourceDoc=${r.docId}`);
    }

    // Exactly one row
    expect(sdRows).toHaveLength(1);

    // On the FY2025 container (pid25 — same id even after year-4 delete / IM fallback)
    expect(sdRows[0].periodId).toBe(pid25);

    // FY2025 period is the latest full-year period
    const [period] = await db.select({ fy: financialPeriods.fiscalYear, tier: financialPeriods.sourceTier })
      .from(financialPeriods).where(eq(financialPeriods.id, pid25!)).limit(1);
    expect(period.fy).toBe(FY25);

    // Now IM-tiered (after year-4 delete in check G) but same container id
    expect(period.tier).toBe('information_memorandum');

    // headcount and sourceDoc are intact
    expect(sdRows[0].headcount).toBe(42);
    expect(sdRows[0].docId).toBe(docStaffId);
  });

  // ─── CHECK I: Slice 19 — part-year income win evicts stale full-year income ───
  //
  // Adversarial scenario:
  //   FY2026 income contribution starts as is_full_year=true → reselect writes it
  //   into the is_full_year=true container → appears in reportedEbitdaByYear.
  //   ALSO a full-year BALANCE contribution exists for FY2026 (this is the trap:
  //   it would make yearToWinnerPeriodId include FY2026, causing clearOrphanedFigures
  //   to skip FY2026 and leave the stale income intact — the pre-Slice-19 bug).
  //   After flipping income to is_full_year=false (Slice 18), reselect must:
  //     a) evict income from the is_full_year=true container period (widened reconcile)
  //     b) leave balance on the is_full_year=true container untouched
  //     c) result in FY2026 absent from fetchReportedEbitdaByYear

  it('I. Slice 19: part-year income win evicts income from full-year container; balance unaffected', async () => {
    const FY26 = 2026;
    const FY26_INC = { operatingProfit: '200000', depreciationAmortisation: '15000', revenue: '2000000' };
    const FY26_EBITDA = 215000; // 200000 + 15000

    // ── Step 1: seed FY2026 as fully full-year (pre-Slice 18 state) ────────────
    const [contribInc26] = await db.insert(financialContributions).values({
      targetCompanyId: testCompanyId, sourceDocumentId: docStatId,
      statementType: 'income' as const, sourceTier: 'statutory',
      isFullYear: true, isPrimaryYear: true,
      periodEnd: `${FY26}-03-31`, fiscalYear: FY26,
      figures: FY26_INC as any,
    }).returning();

    // Full-year BALANCE for FY2026 — adversarial: adds FY2026 to yearToWinnerPeriodId
    // so clearOrphanedFigures would skip it (the pre-Slice-19 bug path)
    await db.insert(financialContributions).values({
      targetCompanyId: testCompanyId, sourceDocumentId: docStatId,
      statementType: 'balance' as const, sourceTier: 'statutory',
      isFullYear: true, isPrimaryYear: true,
      periodEnd: `${FY26}-03-31`, fiscalYear: FY26,
      figures: STAT_BAL as any,
    });

    await reselect(testCompanyId);
    const reportedBefore = await fetchReportedEbitdaByYear(testCompanyId);
    const pid26full = await getPeriodId(FY26);
    console.log(`  I. BEFORE  FY2026 in reportedEbitda: ${reportedBefore['2026']}  (expected ≈${FY26_EBITDA})  pid26full=${pid26full}`);
    expect(reportedBefore['2026']).toBeCloseTo(FY26_EBITDA, 0);
    expect(pid26full).toBeDefined();

    // ── Step 2: Slice 18 patch — flip income contribution to is_full_year=false ─
    await db.update(financialContributions)
      .set({ isFullYear: false })
      .where(eq(financialContributions.id, contribInc26.id));

    // ── Step 3: reselect — Slice 19 widened reconcile must evict income from pid26full
    await reselect(testCompanyId);

    const reportedAfter = await fetchReportedEbitdaByYear(testCompanyId);
    console.log(`  I. AFTER   FY2026 in reportedEbitda: ${reportedAfter['2026']}  (expected undefined)`);

    // FY2026 must have dropped out — part-year income cannot feed valuation
    expect(reportedAfter['2026']).toBeUndefined();

    // The is_full_year=true container must have NO income_statement left
    const incOnFullPeriod = await db
      .select({ id: incomeStatements.id })
      .from(incomeStatements)
      .where(eq(incomeStatements.financialPeriodId, pid26full!));
    console.log(`  I. is_full_year=true period(${pid26full}) income rows: ${incOnFullPeriod.length}  (expected 0)`);
    expect(incOnFullPeriod).toHaveLength(0);

    // Balance on the full-year container must be PRESERVED — balance winner is still full-year
    const balOnFullPeriod = await db
      .select({ id: balanceSheets.id })
      .from(balanceSheets)
      .where(eq(balanceSheets.financialPeriodId, pid26full!));
    console.log(`  I. is_full_year=true period(${pid26full}) balance rows: ${balOnFullPeriod.length}  (expected 1)`);
    expect(balOnFullPeriod).toHaveLength(1);

    // Prior years unaffected (FY2025 still IM-tiered from check G)
    expect(reportedAfter['2022']).toBeCloseTo(STAT_EBITDA[FY22], 0);
    expect(reportedAfter['2023']).toBeCloseTo(STAT_EBITDA[FY23], 0);
    expect(reportedAfter['2024']).toBeCloseTo(STAT_EBITDA[FY24], 0);
    expect(reportedAfter['2025']).toBeUndefined();

    // Cleanup FY2026 contributions so afterAll is clean
    await db.delete(financialContributions).where(and(
      eq(financialContributions.targetCompanyId, testCompanyId),
      eq(financialContributions.fiscalYear, FY26),
    ));
  });
});
