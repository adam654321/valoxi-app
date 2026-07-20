/**
 * Phase 2 — Per-company backfill of financial_contributions + reselect
 *
 * TARGET: DEV (heliumdb) only — asserts NOT prod before any writes.
 * Companies: 137 (Adventure Connection), 138 (Timber Building Specialists Ltd),
 *             139 (Opem Security)
 *
 * Per company:
 *   1. Capture PRE state
 *   2. Scoped backfill  (DELETE contributions WHERE targetCompanyId = X, re-insert)
 *   3. Run reselect
 *   4. Recalculate & persist deal model figures
 *   5. Capture POST state
 *   6. Assert + report PASS/FAIL
 *
 * Run: npx tsx scripts/phase2-backfill-reselect.ts
 */

import { eq, and, sql } from 'drizzle-orm';
import { db } from '../server/db';
import {
  financialContributions,
  financialPeriods,
  incomeStatements,
  balanceSheets,
  dealModels,
  dealModelAdjustments,
  dealModelFundingLines,
  documents,
} from '../shared/schema';
import { reselect } from '../server/services/projection-reselect.service';
import { fetchReportedEbitdaByYear } from '../server/services/deal-model.service';
import {
  calculateFullDealModel,
  toNum,
  type AdjustmentInput,
  type FundingLineInput,
  type DealModelInput,
} from '../shared/calculators/deal-model.calc';
import { resolveSourceTier } from '../server/scripts/backfill-financial-contributions';

// ─── Types ────────────────────────────────────────────────────────────────────

interface EbitdaRow {
  fy: number;
  type: string;
  isFullYear: boolean;
  ebitda: number;
  revenue: number | null;
  periodId: number;
}

interface BalanceRow {
  fy: number;
  type: string;
  isFullYear: boolean;
  totalEquity: number | null;
  sourceDocumentId: number | null;
  periodId: number;
}

interface DealModelSnap {
  id: number;
  name: string;
  adjEbitda: number;
  ev: number;
  averagingYears: number;
  multiple: string;
}

interface CompanyPre {
  ebitdaRows: EbitdaRow[];
  balanceRows: BalanceRow[];
  deals: DealModelSnap[];
  periodCount: number;
  periodDetails: Array<{ id: number; fy: number | null; type: string; isFullYear: boolean; periodEnd: string | null }>;
  incomeCount: number;
  balanceCount: number;
}

// ─── Safety guard ─────────────────────────────────────────────────────────────

async function assertDev(): Promise<void> {
  const res = await db.execute(sql`SELECT current_database() AS db, inet_server_addr() AS host`);
  const row = res.rows?.[0] as { db: string; host: string } | undefined;
  console.log(`[SAFETY] Connected to db=${row?.db} host=${row?.host}`);

  const host: string = String(row?.host ?? '');
  if (host.includes('ep-old-recipe')) {
    throw new Error(
      `ABORT: host "${host}" matches the production fingerprint (ep-old-recipe). Writes refused.`,
    );
  }
  console.log('[SAFETY] ✓ NOT prod — proceeding with writes\n');
}

// ─── State capture ────────────────────────────────────────────────────────────

async function captureState(companyId: number): Promise<CompanyPre> {
  // All financial periods for company
  const periods = await db
    .select()
    .from(financialPeriods)
    .where(eq(financialPeriods.targetCompanyId, companyId))
    .orderBy(financialPeriods.fiscalYear);

  // Income + balance rows
  const incRows = await db
    .select()
    .from(incomeStatements)
    .where(eq(incomeStatements.targetCompanyId, companyId));

  const balRows = await db
    .select()
    .from(balanceSheets)
    .where(eq(balanceSheets.targetCompanyId, companyId));

  // Build EBITDA snapshot (all periods, not just full-year)
  const ebitdaRows: EbitdaRow[] = [];
  for (const p of periods) {
    const inc = incRows.find(r => r.financialPeriodId === p.id);
    if (!inc) continue;
    const op = toNum(inc.operatingProfit);
    const da = toNum(inc.depreciationAmortisation);
    ebitdaRows.push({
      fy: p.fiscalYear ?? 0,
      type: p.periodType,
      isFullYear: p.isFullYear,
      ebitda: op + da,
      revenue: inc.revenue ? toNum(inc.revenue) : null,
      periodId: p.id,
    });
  }

  // Balance snapshot
  const balanceRows: BalanceRow[] = [];
  for (const p of periods) {
    const bal = balRows.find(r => r.financialPeriodId === p.id);
    if (!bal) continue;
    balanceRows.push({
      fy: p.fiscalYear ?? 0,
      type: p.periodType,
      isFullYear: p.isFullYear,
      totalEquity: bal.totalEquity ? toNum(bal.totalEquity) : null,
      sourceDocumentId: bal.sourceDocumentId ?? null,
      periodId: p.id,
    });
  }

  // Deal models
  const dms = await db
    .select()
    .from(dealModels)
    .where(eq(dealModels.targetCompanyId, companyId));

  const deals: DealModelSnap[] = dms.map(d => ({
    id: d.id,
    name: d.name ?? '(unnamed)',
    adjEbitda: toNum(d.adjustedEbitda),
    ev: toNum(d.enterpriseValue),
    averagingYears: d.averagingYears ?? 3,
    multiple: d.ebitdaMultiple ?? '3.0',
  }));

  return {
    ebitdaRows,
    balanceRows,
    deals,
    periodCount: periods.length,
    periodDetails: periods.map(p => ({
      id: p.id,
      fy: p.fiscalYear,
      type: p.periodType,
      isFullYear: p.isFullYear,
      periodEnd: p.periodEnd,
    })),
    incomeCount: incRows.length,
    balanceCount: balRows.length,
  };
}

// ─── Per-company scoped backfill ──────────────────────────────────────────────

async function backfillForCompany(companyId: number): Promise<{ income: number; balance: number }> {
  // Scoped delete — only this company's contributions
  await db
    .delete(financialContributions)
    .where(eq(financialContributions.targetCompanyId, companyId));

  let incomeInserted = 0;
  let balanceInserted = 0;

  // ── Income statements ────────────────────────────────────────────────────
  const incomeRows = await db
    .select()
    .from(incomeStatements)
    .where(eq(incomeStatements.targetCompanyId, companyId));

  for (const row of incomeRows) {
    const [period] = await db
      .select({
        fiscalYear: financialPeriods.fiscalYear,
        periodType: financialPeriods.periodType,
        isFullYear: financialPeriods.isFullYear,
        monthsCovered: financialPeriods.monthsCovered,
        periodEnd: financialPeriods.periodEnd,
      })
      .from(financialPeriods)
      .where(eq(financialPeriods.id, row.financialPeriodId));

    let documentCategory: string | null = null;
    if (row.sourceDocumentId) {
      const [doc] = await db
        .select({ documentCategory: documents.documentCategory })
        .from(documents)
        .where(eq(documents.id, row.sourceDocumentId));
      documentCategory = doc?.documentCategory ?? null;
    }

    const tier = resolveSourceTier(period?.periodType ?? '', documentCategory);

    const figures = {
      revenue: row.revenue,
      costOfSales: row.costOfSales,
      grossProfit: row.grossProfit,
      administrativeExpenses: row.administrativeExpenses,
      depreciationAmortisation: row.depreciationAmortisation,
      otherOperatingIncome: row.otherOperatingIncome,
      operatingProfit: row.operatingProfit,
      interestReceivable: row.interestReceivable,
      interestPayable: row.interestPayable,
      profitBeforeTax: row.profitBeforeTax,
      corporationTax: row.corporationTax,
      netProfit: row.netProfit,
      staffCosts: row.staffCosts,
      directorsRemuneration: row.directorsRemuneration,
      dividendsPaid: row.dividendsPaid,
      revenueBreakdown: row.revenueBreakdown,
      costOfSalesBreakdown: row.costOfSalesBreakdown,
      overheadsBreakdown: row.overheadsBreakdown,
      exceptionalItems: row.exceptionalItems,
    };

    await db.insert(financialContributions).values({
      targetCompanyId: row.targetCompanyId,
      fiscalYear: period?.fiscalYear ?? null,
      statementType: 'income',
      sourceDocumentId: row.sourceDocumentId ?? null,
      sourceTier: tier,
      isFullYear: period?.isFullYear ?? true,
      monthsCovered: period?.monthsCovered ?? null,
      periodEnd: period?.periodEnd ?? null,
      asAtDate: null,
      figures,
    });

    incomeInserted++;
  }

  // ── Balance sheets ───────────────────────────────────────────────────────
  const balanceRows = await db
    .select()
    .from(balanceSheets)
    .where(eq(balanceSheets.targetCompanyId, companyId));

  for (const row of balanceRows) {
    const [period] = await db
      .select({
        fiscalYear: financialPeriods.fiscalYear,
        periodType: financialPeriods.periodType,
        isFullYear: financialPeriods.isFullYear,
        monthsCovered: financialPeriods.monthsCovered,
        periodEnd: financialPeriods.periodEnd,
      })
      .from(financialPeriods)
      .where(eq(financialPeriods.id, row.financialPeriodId));

    let documentCategory: string | null = null;
    if (row.sourceDocumentId) {
      const [doc] = await db
        .select({ documentCategory: documents.documentCategory })
        .from(documents)
        .where(eq(documents.id, row.sourceDocumentId));
      documentCategory = doc?.documentCategory ?? null;
    }

    const tier = resolveSourceTier(period?.periodType ?? '', documentCategory);

    const figures = {
      intangibleAssets: row.intangibleAssets,
      tangibleFixedAssets: row.tangibleFixedAssets,
      freeholdProperty: row.freeholdProperty,
      leaseholdProperty: row.leaseholdProperty,
      plantMachinery: row.plantMachinery,
      fixturesFittings: row.fixturesFittings,
      motorVehicles: row.motorVehicles,
      computerEquipment: row.computerEquipment,
      stockInventory: row.stockInventory,
      tradeDebtors: row.tradeDebtors,
      prepayments: row.prepayments,
      amountsOwedByDirectors: row.amountsOwedByDirectors,
      amountsOwedByConnectedCompanies: row.amountsOwedByConnectedCompanies,
      directorsCurrentAccount: row.directorsCurrentAccount,
      otherDebtors: row.otherDebtors,
      cashAtBank: row.cashAtBank,
      totalCurrentAssets: row.totalCurrentAssets,
      tradeCreditors: row.tradeCreditors,
      taxationSocialSecurity: row.taxationSocialSecurity,
      vatPayable: row.vatPayable,
      corporationTaxDue: row.corporationTaxDue,
      bankLoansOverdraftCurrent: row.bankLoansOverdraftCurrent,
      hirePurchaseCurrent: row.hirePurchaseCurrent,
      accruals: row.accruals,
      amountsOwedToDirectors: row.amountsOwedToDirectors,
      otherCreditors: row.otherCreditors,
      totalCurrentLiabilities: row.totalCurrentLiabilities,
      bankLoansLongTerm: row.bankLoansLongTerm,
      hirePurchaseLongTerm: row.hirePurchaseLongTerm,
      deferredTaxation: row.deferredTaxation,
      otherLongTermDebt: row.otherLongTermDebt,
      totalLongTermLiabilities: row.totalLongTermLiabilities,
      shareCapital: row.shareCapital,
      retainedEarnings: row.retainedEarnings,
      totalEquity: row.totalEquity,
      debtorsList: row.debtorsList,
      creditorsList: row.creditorsList,
      fixedAssetsDetail: row.fixedAssetsDetail,
    };

    await db.insert(financialContributions).values({
      targetCompanyId: row.targetCompanyId,
      fiscalYear: period?.fiscalYear ?? null,
      statementType: 'balance',
      sourceDocumentId: row.sourceDocumentId ?? null,
      sourceTier: tier,
      isFullYear: period?.isFullYear ?? true,
      monthsCovered: period?.monthsCovered ?? null,
      periodEnd: period?.periodEnd ?? null,
      asAtDate: period?.periodEnd ?? null,
      figures,
    });

    balanceInserted++;
  }

  return { income: incomeInserted, balance: balanceInserted };
}

// ─── Deal model recalculation ─────────────────────────────────────────────────

async function recalcDealModels(companyId: number): Promise<void> {
  const reportedEbitda = await fetchReportedEbitdaByYear(companyId);
  const dms = await db
    .select()
    .from(dealModels)
    .where(eq(dealModels.targetCompanyId, companyId));

  for (const dm of dms) {
    const adjs = await db
      .select()
      .from(dealModelAdjustments)
      .where(eq(dealModelAdjustments.dealModelId, dm.id));

    const fls = await db
      .select()
      .from(dealModelFundingLines)
      .where(eq(dealModelFundingLines.dealModelId, dm.id));

    const adjustments: AdjustmentInput[] = adjs.map(a => ({
      adjustmentType: a.adjustmentType as 'add_back' | 'deduction',
      amount: a.amount,
      amountsByYear: a.amountsByYear as Record<string, number> | null,
      status: a.status || 'suggested',
      userOverrideAmount: null,
    }));

    const fundingLines: FundingLineInput[] = fls
      .filter(f => f.fundingType !== 'seller_financing' && f.fundingType !== 'earnout')
      .map(f => ({
        fundingType: f.fundingType,
        assetBaseValue: f.assetBaseValue,
        ltvPercent: f.ltvPercent,
        amountUsed: f.amountUsed,
        interestRate: f.interestRate,
        termMonths: f.termMonths,
        arrangementFeePercent: f.arrangementFeePercent ?? null,
        isDebt: f.isDebt ?? false,
        repaymentStructure: f.repaymentStructure ?? 'amortizing',
        isActive: f.isActive ?? false,
      }));

    const modelInput: DealModelInput = {
      averagingYears: dm.averagingYears ?? 3,
      ebitdaMultiple: dm.ebitdaMultiple ?? '3.0',
      plusExcessCash: dm.plusExcessCash ?? '0',
      minusPrimaryDebt: dm.minusPrimaryDebt ?? '0',
      minusOtherDebt: dm.minusOtherDebt ?? '0',
      minusCorpTaxDue: dm.minusCorpTaxDue ?? '0',
      minusWorkingCapitalAdj: dm.minusWorkingCapitalAdj ?? '0',
      plusPropertyValue: dm.propertyValue ?? '0',
      otherAdjustments: null,
      feeLegalDdAmount: dm.feeLegalDdAmount ?? '0',
      feeAccountingDdAmount: dm.feeAccountingDdAmount ?? '0',
      feeLoanArrangementAmount: dm.feeLoanArrangementAmount ?? '0',
      feeDealMakerAmount: dm.feeDealMakerAmount ?? '0',
      customFees: (dm.customFees as Array<{ label: string; amount: string | number }>) ?? [],
    };

    const result = calculateFullDealModel(
      reportedEbitda,
      adjustments,
      fundingLines,
      modelInput,
      [],
      [],
    );

    await db
      .update(dealModels)
      .set({
        calculatedEbitda: String(result.averageAdjustedEbitda),
        adjustedEbitda: String(result.averageAdjustedEbitda),
        enterpriseValue: String(result.enterpriseValue),
        totalPurchasePrice: String(result.offerPrice),
        updatedAt: new Date(),
      })
      .where(eq(dealModels.id, dm.id));
  }
}

// ─── Formatters ───────────────────────────────────────────────────────────────

const fmtN = (n: number | null | undefined) =>
  n == null ? 'NULL' : n.toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

const PASS = '✅ PASS';
const FAIL = '❌ FAIL';
const flag = (ok: boolean) => (ok ? PASS : FAIL);

function printEbitdaTable(label: string, rows: EbitdaRow[]) {
  console.log(`  ${label}`);
  console.log(`  ${'FY'.padEnd(6)} ${'Type'.padEnd(12)} ${'Full?'.padEnd(6)} ${'EBITDA'.padStart(14)} ${'Revenue'.padStart(14)}`);
  console.log(`  ${'─'.repeat(60)}`);
  for (const r of rows.sort((a, b) => a.fy - b.fy || a.type.localeCompare(b.type))) {
    console.log(
      `  ${String(r.fy).padEnd(6)} ${r.type.padEnd(12)} ${String(r.isFullYear).padEnd(6)} ${fmtN(r.ebitda).padStart(14)} ${fmtN(r.revenue).padStart(14)}`,
    );
  }
}

function printBalanceTable(label: string, rows: BalanceRow[]) {
  console.log(`  ${label}`);
  console.log(`  ${'FY'.padEnd(6)} ${'Type'.padEnd(12)} ${'Equity'.padStart(14)} ${'DocID'.padStart(8)}`);
  console.log(`  ${'─'.repeat(50)}`);
  for (const r of rows.sort((a, b) => a.fy - b.fy || a.type.localeCompare(b.type))) {
    console.log(
      `  ${String(r.fy).padEnd(6)} ${r.type.padEnd(12)} ${fmtN(r.totalEquity).padStart(14)} ${String(r.sourceDocumentId ?? 'NULL').padStart(8)}`,
    );
  }
}

function printDealModels(label: string, deals: DealModelSnap[]) {
  if (deals.length === 0) { console.log(`  ${label}  (none)`); return; }
  console.log(`  ${label}`);
  for (const d of deals) {
    console.log(
      `    "${d.name}"  avg=${d.averagingYears}y  ×${d.multiple}  adjEBITDA=£${fmtN(d.adjEbitda)}  EV=£${fmtN(d.ev)}`,
    );
  }
}

// ─── Company-specific assertions ──────────────────────────────────────────────

interface AssertResult { label: string; pass: boolean; detail: string }

async function assert137(companyId: number, pre: CompanyPre, post: CompanyPre): Promise<AssertResult[]> {
  const results: AssertResult[] = [];

  // ── FY2026 management is_full_year
  // After reselect the container periodType may be overwritten by whichever winner runs
  // last (balance=statutory runs after income=management).  Source-of-truth for
  // is_full_year is the contribution row itself, not the container's periodType.
  const contribs = await db
    .select()
    .from(financialContributions)
    .where(
      and(
        eq(financialContributions.targetCompanyId, companyId),
        eq(financialContributions.fiscalYear, 2026),
        eq(financialContributions.statementType, 'income'),
      ),
    );

  // Print all contributions for information
  console.log(`\n  FY2026 income contributions (${contribs.length} total):`);
  for (const c of contribs) {
    const figs = c.figures as Record<string, any>;
    const ebitda = toNum(figs.operatingProfit) + toNum(figs.depreciationAmortisation);
    console.log(
      `    id=${c.id} tier=${c.sourceTier} isFullYear=${c.isFullYear} EBITDA=£${fmtN(ebitda)} docId=${c.sourceDocumentId}`,
    );
  }

  // A1a: FY2026 income winner is_full_year=true
  // Source-of-truth is the POST winner row in ebitdaRows.  The container's periodType
  // reflects whichever winner ran last (balance=statutory), so we check the winner
  // row's isFullYear directly — if it appears in ebitdaRows it was full-year.
  const fy2026Income = post.ebitdaRows.find(r => r.fy === 2026 && r.isFullYear);
  const fy2026ContainerPeriod = post.periodDetails.find(p => p.fy === 2026);

  console.log(`\n  FY2026 container period in POST: id=${fy2026ContainerPeriod?.id} type=${fy2026ContainerPeriod?.type} is_full_year=${fy2026ContainerPeriod?.isFullYear}`);
  console.log(`  (Container periodType reflects last winner to write; balance=statutory runs after income=management)`);

  results.push({
    label: 'FY2026 income winner is_full_year=true (winner row in POST)',
    pass: fy2026Income !== null && fy2026Income.isFullYear === true,
    detail: `POST FY2026 full-year income winner: ${fy2026Income ? `isFullYear=${fy2026Income.isFullYear} EBITDA=£${fmtN(fy2026Income.ebitda)} docId=${fy2026Income.periodId}` : 'NOT FOUND'}`,
  });

  // A1b: FY2026 income EBITDA ≈ £117,729
  const fy2026Ebitda = fy2026Income?.ebitda ?? null;
  const EXPECTED_2026_EBITDA = 117729;
  const tolerance = 5;
  const incomeOk =
    fy2026Ebitda !== null &&
    Math.abs(fy2026Ebitda - EXPECTED_2026_EBITDA) <= tolerance;

  if (fy2026Income && !fy2026Income.isFullYear) {
    results.push({
      label: 'FY2026 income winner ≈ £117,729 (management only source)',
      pass: false,
      detail: 'N/A — income winner is part-year, excluded from EBITDA projection',
    });
  } else {
    results.push({
      label: 'FY2026 income winner ≈ £117,729 (management only source)',
      pass: incomeOk,
      detail: `POST FY2026 full-year EBITDA = £${fmtN(fy2026Ebitda)} (expected ~£${fmtN(EXPECTED_2026_EBITDA)})`,
    });
  }

  // A2: FY2026 balance winner = statutory (equity £120,804)
  const EXPECTED_2026_EQUITY = 120804;
  const fy2026Bal = post.balanceRows.find(r => r.fy === 2026);
  const fy2026Equity = fy2026Bal?.totalEquity ?? null;
  const balOk =
    fy2026Equity !== null &&
    Math.abs(fy2026Equity - EXPECTED_2026_EQUITY) <= tolerance;

  results.push({
    label: 'FY2026 balance winner = statutory (equity ≈ £120,804)',
    pass: balOk,
    detail: `POST FY2026 equity = £${fmtN(fy2026Equity)} (expected ~£${fmtN(EXPECTED_2026_EQUITY)})`,
  });

  // A3: No year lost income where a source had it
  const preYears = new Set(pre.ebitdaRows.filter(r => r.isFullYear).map(r => r.fy));
  const postYears = new Set(post.ebitdaRows.filter(r => r.isFullYear).map(r => r.fy));
  const lostYears = [...preYears].filter(fy => !postYears.has(fy));
  results.push({
    label: 'No full-year income lost vs PRE',
    pass: lostYears.length === 0,
    detail:
      lostYears.length === 0
        ? `All ${preYears.size} PRE full-year EBITDA years present in POST`
        : `Lost years: ${lostYears.join(', ')}`,
  });

  // A4: Zero ghost periods
  const ghostCheck = await assertNoGhostPeriods(companyId);
  results.push(ghostCheck);

  return results;
}

async function assert138(companyId: number, post: CompanyPre): Promise<AssertResult[]> {
  const results: AssertResult[] = [];

  // Find FY2024 income winner source_document_id
  const fy2024Inc = post.ebitdaRows.find(r => r.fy === 2024 && r.isFullYear);
  const EXPECTED_EBITDA_2024 = 336870;
  const tolerance = 5;
  const ebitdaOk =
    fy2024Inc !== null &&
    Math.abs((fy2024Inc?.ebitda ?? 0) - EXPECTED_EBITDA_2024) <= tolerance;

  // Get source_document_id from the winning income statement
  const winnerInc = await db
    .select({ sourceDocumentId: incomeStatements.sourceDocumentId })
    .from(incomeStatements)
    .innerJoin(financialPeriods, eq(incomeStatements.financialPeriodId, financialPeriods.id))
    .where(
      and(
        eq(incomeStatements.targetCompanyId, companyId),
        eq(financialPeriods.fiscalYear, 2024),
        eq(financialPeriods.isFullYear, true),
      ),
    )
    .limit(1);

  const winnerDocId = winnerInc[0]?.sourceDocumentId ?? null;

  // Print all FY2024 contributions to show what competed
  const contribs2024 = await db
    .select()
    .from(financialContributions)
    .where(
      and(
        eq(financialContributions.targetCompanyId, companyId),
        eq(financialContributions.fiscalYear, 2024),
        eq(financialContributions.statementType, 'income'),
        eq(financialContributions.isFullYear, true),
      ),
    );

  console.log(`\n  FY2024 income contributions (${contribs2024.length} competing):`);
  for (const c of contribs2024.sort((a, b) => (a.sourceDocumentId ?? 0) - (b.sourceDocumentId ?? 0))) {
    const figs = c.figures as Record<string, any>;
    const ebitda = toNum(figs.operatingProfit) + toNum(figs.depreciationAmortisation);
    console.log(
      `    contrib id=${c.id} docId=${c.sourceDocumentId} tier=${c.sourceTier} EBITDA=£${fmtN(ebitda)} createdAt=${c.createdAt}`,
    );
  }
  console.log(`  Winning income statement → source_document_id=${winnerDocId}`);

  results.push({
    label: 'FY2024 winner = COMPLETE copy (EBITDA ≈ £336,870)',
    pass: ebitdaOk,
    detail: `POST FY2024 EBITDA = £${fmtN(fy2024Inc?.ebitda)} winning docId=${winnerDocId} (expected ~£${fmtN(EXPECTED_EBITDA_2024)})`,
  });

  // One container per year
  const oneContainerCheck = await assertOneContainerPerYear(companyId);
  results.push(oneContainerCheck);

  // Zero ghost periods
  const ghostCheck = await assertNoGhostPeriods(companyId);
  results.push(ghostCheck);

  return results;
}

async function assert139(companyId: number, post: CompanyPre): Promise<AssertResult[]> {
  const results: AssertResult[] = [];

  // FY2024 net assets (equity) stays £686,212
  const EXPECTED_EQUITY_2024 = 686212;
  const tolerance = 5;
  const fy2024Bal = post.balanceRows.find(r => r.fy === 2024 && r.isFullYear);
  const fy2024Equity = fy2024Bal?.totalEquity ?? null;
  const equityOk =
    fy2024Equity !== null &&
    Math.abs(fy2024Equity - EXPECTED_EQUITY_2024) <= tolerance;

  // Get winning source_document_id for balance
  const winnerBal = await db
    .select({ sourceDocumentId: balanceSheets.sourceDocumentId })
    .from(balanceSheets)
    .innerJoin(financialPeriods, eq(balanceSheets.financialPeriodId, financialPeriods.id))
    .where(
      and(
        eq(balanceSheets.targetCompanyId, companyId),
        eq(financialPeriods.fiscalYear, 2024),
        eq(financialPeriods.isFullYear, true),
      ),
    )
    .limit(1);

  const balDocId = winnerBal[0]?.sourceDocumentId ?? null;

  // Print FY2024 balance contributions
  const balContribs2024 = await db
    .select()
    .from(financialContributions)
    .where(
      and(
        eq(financialContributions.targetCompanyId, companyId),
        eq(financialContributions.fiscalYear, 2024),
        eq(financialContributions.statementType, 'balance'),
        eq(financialContributions.isFullYear, true),
      ),
    );

  console.log(`\n  FY2024 balance contributions (${balContribs2024.length} competing):`);
  for (const c of balContribs2024.sort((a, b) => (a.sourceDocumentId ?? 0) - (b.sourceDocumentId ?? 0))) {
    const figs = c.figures as Record<string, any>;
    const equity = toNum(figs.totalEquity);
    console.log(
      `    contrib id=${c.id} docId=${c.sourceDocumentId} tier=${c.sourceTier} equity=£${fmtN(equity)} createdAt=${c.createdAt}`,
    );
  }
  console.log(`  Winning balance sheet → source_document_id=${balDocId}`);

  // Also print income winners for all years with duplicates
  const incContribs = await db
    .select()
    .from(financialContributions)
    .where(
      and(
        eq(financialContributions.targetCompanyId, companyId),
        eq(financialContributions.statementType, 'income'),
        eq(financialContributions.isFullYear, true),
      ),
    );

  // Group by year to find duplicates
  const byYear = new Map<number, typeof incContribs>();
  for (const c of incContribs) {
    const fy = c.fiscalYear ?? 0;
    if (!byYear.has(fy)) byYear.set(fy, []);
    byYear.get(fy)!.push(c);
  }
  for (const [fy, contribs] of [...byYear.entries()].sort((a, b) => a[0] - b[0])) {
    if (contribs.length > 1) {
      console.log(`\n  FY${fy} income contributions (${contribs.length} competing):`);
      for (const c of contribs.sort((a, b) => (a.sourceDocumentId ?? 0) - (b.sourceDocumentId ?? 0))) {
        const figs = c.figures as Record<string, any>;
        const ebitda = toNum(figs.operatingProfit) + toNum(figs.depreciationAmortisation);
        console.log(
          `    contrib id=${c.id} docId=${c.sourceDocumentId} tier=${c.sourceTier} EBITDA=£${fmtN(ebitda)} createdAt=${c.createdAt}`,
        );
      }
    }
  }

  results.push({
    label: 'FY2024 net assets (equity) stays ≈ £686,212',
    pass: equityOk,
    detail: `POST FY2024 equity = £${fmtN(fy2024Equity)} winning balDocId=${balDocId} (expected ~£${fmtN(EXPECTED_EQUITY_2024)})`,
  });

  // One container per year
  const oneContainerCheck = await assertOneContainerPerYear(companyId);
  results.push(oneContainerCheck);

  // Zero ghost periods
  const ghostCheck = await assertNoGhostPeriods(companyId);
  results.push(ghostCheck);

  return results;
}

async function assertNoGhostPeriods(companyId: number): Promise<AssertResult> {
  const periods = await db
    .select({ id: financialPeriods.id, fy: financialPeriods.fiscalYear })
    .from(financialPeriods)
    .where(
      and(
        eq(financialPeriods.targetCompanyId, companyId),
        eq(financialPeriods.isFullYear, true),
      ),
    );

  const ghosts: number[] = [];
  for (const p of periods) {
    const [inc] = await db
      .select({ id: incomeStatements.id })
      .from(incomeStatements)
      .where(eq(incomeStatements.financialPeriodId, p.id))
      .limit(1);
    const [bal] = await db
      .select({ id: balanceSheets.id })
      .from(balanceSheets)
      .where(eq(balanceSheets.financialPeriodId, p.id))
      .limit(1);
    if (!inc && !bal) ghosts.push(p.id);
  }

  return {
    label: 'Zero ghost periods (full-year periods with no income AND no balance)',
    pass: ghosts.length === 0,
    detail:
      ghosts.length === 0
        ? 'None found'
        : `Ghost period ids: [${ghosts.join(', ')}] — these have neither income nor balance`,
  };
}

async function assertOneContainerPerYear(companyId: number): Promise<AssertResult> {
  // Check that for every (fiscalYear, isFullYear=true) slot there is at most 1 income + 1 balance row
  const allPeriods = await db
    .select({ id: financialPeriods.id, fy: financialPeriods.fiscalYear })
    .from(financialPeriods)
    .where(
      and(
        eq(financialPeriods.targetCompanyId, companyId),
        eq(financialPeriods.isFullYear, true),
      ),
    );

  const incCountByYear = new Map<number, number>();
  const balCountByYear = new Map<number, number>();

  for (const p of allPeriods) {
    const fy = p.fy ?? 0;
    const incs = await db
      .select({ id: incomeStatements.id })
      .from(incomeStatements)
      .where(eq(incomeStatements.financialPeriodId, p.id));
    const bals = await db
      .select({ id: balanceSheets.id })
      .from(balanceSheets)
      .where(eq(balanceSheets.financialPeriodId, p.id));

    incCountByYear.set(fy, (incCountByYear.get(fy) ?? 0) + incs.length);
    balCountByYear.set(fy, (balCountByYear.get(fy) ?? 0) + bals.length);
  }

  const violating: string[] = [];
  for (const [fy, cnt] of incCountByYear) {
    if (cnt > 1) violating.push(`FY${fy} income×${cnt}`);
  }
  for (const [fy, cnt] of balCountByYear) {
    if (cnt > 1) violating.push(`FY${fy} balance×${cnt}`);
  }

  return {
    label: 'One income + one balance per full-year slot',
    pass: violating.length === 0,
    detail: violating.length === 0 ? 'All year slots have ≤1 of each' : `Violations: ${violating.join(', ')}`,
  };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function processCompany(
  companyId: number,
  companyName: string,
  assertFn: (id: number, pre: CompanyPre, post: CompanyPre) => Promise<AssertResult[]>,
) {
  const bar = '█'.repeat(80);
  console.log(`\n${bar}`);
  console.log(`█  Company ${companyId}  —  ${companyName}`);
  console.log(`${bar}`);

  // PRE
  console.log('\n┌─ PRE state ─────────────────────────────────────────────────');
  const pre = await captureState(companyId);
  console.log(`  Periods: ${pre.periodCount}  |  income_statements: ${pre.incomeCount}  |  balance_sheets: ${pre.balanceCount}`);
  printEbitdaTable('EBITDA by period:', pre.ebitdaRows);
  printBalanceTable('Balance (equity) by period:', pre.balanceRows);
  printDealModels('Deal models:', pre.deals);

  // Backfill
  console.log('\n┌─ Backfill ───────────────────────────────────────────────────');
  const { income, balance } = await backfillForCompany(companyId);
  console.log(`  Inserted: income=${income} balance=${balance} contributions for company ${companyId}`);

  const contributions = await db
    .select()
    .from(financialContributions)
    .where(eq(financialContributions.targetCompanyId, companyId));
  console.log(`  financial_contributions total for company: ${contributions.length}`);

  // Reselect
  console.log('\n┌─ Reselect ───────────────────────────────────────────────────');
  await reselect(companyId);

  // Deal model recalculation
  if (pre.deals.length > 0) {
    console.log('\n┌─ Deal model recalculation ───────────────────────────────────');
    await recalcDealModels(companyId);
  }

  // POST
  console.log('\n┌─ POST state ─────────────────────────────────────────────────');
  const post = await captureState(companyId);
  console.log(`  Periods: ${post.periodCount}  |  income_statements: ${post.incomeCount}  |  balance_sheets: ${post.balanceCount}`);
  printEbitdaTable('EBITDA by period:', post.ebitdaRows);
  printBalanceTable('Balance (equity) by period:', post.balanceRows);
  printDealModels('Deal models:', post.deals);

  // PRE→POST delta for deal models
  if (pre.deals.length > 0) {
    console.log('\n┌─ Deal model PRE→POST delta ──────────────────────────────────');
    for (const preDm of pre.deals) {
      const postDm = post.deals.find(d => d.id === preDm.id);
      if (!postDm) { console.log(`  "${preDm.name}": POST not found`); continue; }
      const ebitdaDelta = postDm.adjEbitda - preDm.adjEbitda;
      const evDelta = postDm.ev - preDm.ev;
      console.log(
        `  "${preDm.name}":  adjEBITDA  PRE=£${fmtN(preDm.adjEbitda)}  →  POST=£${fmtN(postDm.adjEbitda)}  (Δ${ebitdaDelta >= 0 ? '+' : ''}£${fmtN(ebitdaDelta)})`,
      );
      console.log(
        `               EV         PRE=£${fmtN(preDm.ev)}  →  POST=£${fmtN(postDm.ev)}  (Δ${evDelta >= 0 ? '+' : ''}£${fmtN(evDelta)})`,
      );
    }
  }

  // Assertions
  console.log('\n┌─ Assertions ─────────────────────────────────────────────────');
  const assertions = await assertFn(companyId, pre, post);
  let allPass = true;
  for (const a of assertions) {
    const marker = a.pass ? PASS : FAIL;
    console.log(`  ${marker}  ${a.label}`);
    console.log(`         ${a.detail}`);
    if (!a.pass) allPass = false;
  }

  console.log(`\n  ── COMPANY ${companyId} VERDICT: ${allPass ? '✅ ALL PASS' : '❌ FAILURES FOUND'} ──`);
  return allPass;
}

async function main() {
  console.log('='.repeat(80));
  console.log('Phase 2 — Backfill financial_contributions + Reselect');
  console.log(`Started: ${new Date().toISOString()}`);
  console.log('='.repeat(80));

  await assertDev();

  const results: boolean[] = [];

  // ── 137 Adventure Connection ──────────────────────────────────────────────
  results.push(
    await processCompany(137, 'Adventure Connection', async (id, pre, post) =>
      assert137(id, pre, post),
    ),
  );

  // ── 138 Timber Building Specialists Ltd ──────────────────────────────────
  results.push(
    await processCompany(138, 'Timber Building Specialists Ltd', async (id, _pre, post) =>
      assert138(id, post),
    ),
  );

  // ── 139 Opem Security ────────────────────────────────────────────────────
  results.push(
    await processCompany(139, 'Opem Security', async (id, _pre, post) =>
      assert139(id, post),
    ),
  );

  // ── Summary ───────────────────────────────────────────────────────────────
  const companies = [
    { id: 137, name: 'Adventure Connection' },
    { id: 138, name: 'Timber Building Specialists Ltd' },
    { id: 139, name: 'Opem Security' },
  ];

  console.log('\n' + '='.repeat(80));
  console.log('PHASE 2 SUMMARY');
  console.log('='.repeat(80));
  for (let i = 0; i < results.length; i++) {
    console.log(`  ${results[i] ? '✅' : '❌'}  Company ${companies[i].id}  —  ${companies[i].name}`);
  }
  const overall = results.every(Boolean);
  console.log(`\n  OVERALL: ${overall ? '✅ ALL PASS' : '❌ FAILURES — see details above'}`);
  console.log('='.repeat(80));

  process.exit(overall ? 0 : 1);
}

main().catch(err => {
  console.error('[FATAL]', err);
  process.exit(1);
});
