import { eq, and, asc, inArray, notInArray } from 'drizzle-orm';
import { db } from '../db';
import {
  financialContributions,
  financialPeriods,
  incomeStatements,
  balanceSheets,
  ebitdaAdjustments,
  staffData,
  type FinancialPeriod,
} from '@shared/schema';
import {
  selectProjectionWinners,
  type Contribution,
} from '@shared/calculators/projection-selector';

function tierToPeriodType(sourceTier: string): 'statutory' | 'management' {
  return sourceTier === 'statutory' ? 'statutory' : 'management';
}

/**
 * Finds or creates the canonical CONTAINER period for (company, fiscalYear, isFullYear).
 *
 * When multiple periods exist for the same key (legacy duplicates), the survivor
 * is chosen by this priority — ordered by id ASC within each tier so the result
 * is always deterministic:
 *
 *   1. Lowest-id period that has an ebitda_adjustment (the FK must never move)
 *   2. Lowest-id period that has income or balance data
 *   3. Lowest-id period (existing[0])
 *
 * Once chosen, the survivor's metadata (tier, periodEnd, sourceDocumentId, …) is
 * updated to reflect the current winner.  The survivor's id is NEVER changed.
 */
async function findOrReusePeriod(
  targetCompanyId: number,
  fiscalYear: number,
  isFullYear: boolean,
  periodType: 'statutory' | 'management',
  sourceTier: string,
  periodEnd: string,
  monthsCovered: number | null,
  sourceDocumentId: number | null,
): Promise<FinancialPeriod> {
  const existing = await db
    .select()
    .from(financialPeriods)
    .where(
      and(
        eq(financialPeriods.targetCompanyId, targetCompanyId),
        eq(financialPeriods.fiscalYear, fiscalYear),
        eq(financialPeriods.isFullYear, isFullYear),
      ),
    )
    .orderBy(asc(financialPeriods.id)); // deterministic: lowest id first within each tier

  if (existing.length === 0) {
    const [created] = await db
      .insert(financialPeriods)
      .values({
        targetCompanyId,
        periodType,
        sourceTier,
        periodEnd,
        fiscalYear,
        isFullYear,
        monthsCovered: monthsCovered ?? null,
        sourceDocumentId: sourceDocumentId ?? null,
        periodLabel: `FY ${fiscalYear}`,
      })
      .returning();
    return created;
  }

  // Priority 1 — period that holds an ebitda_adjustment (FK must not be moved)
  let survivor = existing[0];
  let found = false;

  for (const p of existing) {
    const [adj] = await db
      .select({ id: ebitdaAdjustments.id })
      .from(ebitdaAdjustments)
      .where(eq(ebitdaAdjustments.financialPeriodId, p.id))
      .limit(1);
    if (adj) { survivor = p; found = true; break; }
  }

  // Priority 2 — period that already has income or balance data
  if (!found) {
    for (const p of existing) {
      const [inc] = await db
        .select({ id: incomeStatements.id })
        .from(incomeStatements)
        .where(eq(incomeStatements.financialPeriodId, p.id))
        .limit(1);
      if (inc) { survivor = p; found = true; break; }

      const [bal] = await db
        .select({ id: balanceSheets.id })
        .from(balanceSheets)
        .where(eq(balanceSheets.financialPeriodId, p.id))
        .limit(1);
      if (bal) { survivor = p; found = true; break; }
    }
  }
  // Priority 3 — existing[0] (lowest id) is already the default

  const [updated] = await db
    .update(financialPeriods)
    .set({
      periodType,
      sourceTier,
      periodEnd,
      isFullYear,
      monthsCovered: monthsCovered ?? survivor.monthsCovered,
      sourceDocumentId: sourceDocumentId ?? survivor.sourceDocumentId,
      updatedAt: new Date(),
    })
    .where(eq(financialPeriods.id, survivor.id))
    .returning();
  return updated;
}

async function upsertIncomeFromFigures(
  periodId: number,
  targetCompanyId: number,
  figures: Record<string, any>,
  winnerSourceDocumentId: number | null,
  isFullYear: boolean,
): Promise<void> {
  const data = {
    revenue: figures.revenue ?? null,
    costOfSales: figures.costOfSales ?? null,
    grossProfit: figures.grossProfit ?? null,
    administrativeExpenses: figures.administrativeExpenses ?? null,
    depreciationAmortisation: figures.depreciationAmortisation ?? null,
    otherOperatingIncome: figures.otherOperatingIncome ?? null,
    operatingProfit: figures.operatingProfit ?? null,
    interestReceivable: figures.interestReceivable ?? null,
    interestPayable: figures.interestPayable ?? null,
    profitBeforeTax: figures.profitBeforeTax ?? null,
    corporationTax: figures.corporationTax ?? null,
    netProfit: figures.netProfit ?? null,
    staffCosts: figures.staffCosts ?? null,
    directorsRemuneration: figures.directorsRemuneration ?? null,
    dividendsPaid: figures.dividendsPaid ?? null,
    revenueBreakdown: figures.revenueBreakdown ?? null,
    costOfSalesBreakdown: figures.costOfSalesBreakdown ?? null,
    overheadsBreakdown: figures.overheadsBreakdown ?? null,
    exceptionalItems: figures.exceptionalItems ?? null,
    isFullYear,
    sourceDocumentId: winnerSourceDocumentId,
  };

  const existing = await db
    .select({ id: incomeStatements.id })
    .from(incomeStatements)
    .where(eq(incomeStatements.financialPeriodId, periodId))
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(incomeStatements)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(incomeStatements.id, existing[0].id));
  } else {
    await db.insert(incomeStatements).values({ financialPeriodId: periodId, targetCompanyId, ...data });
  }
}

async function upsertBalanceFromFigures(
  periodId: number,
  targetCompanyId: number,
  figures: Record<string, any>,
  winnerSourceDocumentId: number | null,
): Promise<void> {
  const data = {
    intangibleAssets: figures.intangibleAssets ?? null,
    tangibleFixedAssets: figures.tangibleFixedAssets ?? null,
    freeholdProperty: figures.freeholdProperty ?? null,
    leaseholdProperty: figures.leaseholdProperty ?? null,
    plantMachinery: figures.plantMachinery ?? null,
    fixturesFittings: figures.fixturesFittings ?? null,
    motorVehicles: figures.motorVehicles ?? null,
    computerEquipment: figures.computerEquipment ?? null,
    stockInventory: figures.stockInventory ?? null,
    tradeDebtors: figures.tradeDebtors ?? null,
    prepayments: figures.prepayments ?? null,
    amountsOwedByDirectors: figures.amountsOwedByDirectors ?? null,
    amountsOwedByConnectedCompanies: figures.amountsOwedByConnectedCompanies ?? null,
    directorsCurrentAccount: figures.directorsCurrentAccount ?? null,
    otherDebtors: figures.otherDebtors ?? null,
    cashAtBank: figures.cashAtBank ?? null,
    totalCurrentAssets: figures.totalCurrentAssets ?? null,
    tradeCreditors: figures.tradeCreditors ?? null,
    taxationSocialSecurity: figures.taxationSocialSecurity ?? null,
    vatPayable: figures.vatPayable ?? null,
    corporationTaxDue: figures.corporationTaxDue ?? null,
    bankLoansOverdraftCurrent: figures.bankLoansOverdraftCurrent ?? null,
    hirePurchaseCurrent: figures.hirePurchaseCurrent ?? null,
    accruals: figures.accruals ?? null,
    amountsOwedToDirectors: figures.amountsOwedToDirectors ?? null,
    otherCreditors: figures.otherCreditors ?? null,
    totalCurrentLiabilities: figures.totalCurrentLiabilities ?? null,
    bankLoansLongTerm: figures.bankLoansLongTerm ?? null,
    hirePurchaseLongTerm: figures.hirePurchaseLongTerm ?? null,
    deferredTaxation: figures.deferredTaxation ?? null,
    otherLongTermDebt: figures.otherLongTermDebt ?? null,
    totalLongTermLiabilities: figures.totalLongTermLiabilities ?? null,
    shareCapital: figures.shareCapital ?? null,
    retainedEarnings: figures.retainedEarnings ?? null,
    totalEquity: figures.totalEquity ?? null,
    debtorsList: figures.debtorsList ?? null,
    creditorsList: figures.creditorsList ?? null,
    fixedAssetsDetail: figures.fixedAssetsDetail ?? null,
    sourceDocumentId: winnerSourceDocumentId,
  };

  const existing = await db
    .select({ id: balanceSheets.id })
    .from(balanceSheets)
    .where(eq(balanceSheets.financialPeriodId, periodId))
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(balanceSheets)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(balanceSheets.id, existing[0].id));
  } else {
    await db.insert(balanceSheets).values({ financialPeriodId: periodId, targetCompanyId, ...data });
  }
}

/**
 * Re-point ebitda_adjustments from non-survivor periods to the survivor for the
 * same (company, fiscalYear) slot.  Adjustments are YEAR-bound; they must always
 * stay on the year they were created for, adjusting whatever winner is currently
 * holding that year's income.
 */
async function repointAdjustments(
  targetCompanyId: number,
  yearToWinnerPeriodId: Map<number, number>,
): Promise<void> {
  for (const [fiscalYear, survivorId] of yearToWinnerPeriodId) {
    const allInYear = await db
      .select({ id: financialPeriods.id })
      .from(financialPeriods)
      .where(
        and(
          eq(financialPeriods.targetCompanyId, targetCompanyId),
          eq(financialPeriods.fiscalYear, fiscalYear),
          eq(financialPeriods.isFullYear, true),
        ),
      );

    for (const { id } of allInYear) {
      if (id === survivorId) continue;
      await db
        .update(ebitdaAdjustments)
        .set({ financialPeriodId: survivorId, updatedAt: new Date() })
        .where(eq(ebitdaAdjustments.financialPeriodId, id));
    }
  }
}

/**
 * Re-point ALL staff_data for this company to the latest winning full-year
 * period.  staff_data is a company-current singleton — it reflects the most
 * recent trading year's headcount/payroll and should always ride the latest
 * winner, not an historical or ghost period.
 */
async function repointStaffData(
  targetCompanyId: number,
  latestWinnerPeriodId: number,
): Promise<void> {
  await db
    .update(staffData)
    .set({ financialPeriodId: latestWinnerPeriodId })
    .where(eq(staffData.targetCompanyId, targetCompanyId));
}

/**
 * Clear income_statements and balance_sheets for full-year periods whose
 * fiscal year has no winning contribution this reselect run.
 *
 * This happens when ALL contributions for a year are removed (e.g. a document
 * is deleted and there is no fallback).  The container period is kept if it
 * holds an ebitda_adjustment; the stale figures are removed so the container
 * is honest about having no data.
 */
async function clearOrphanedFigures(
  targetCompanyId: number,
  winnerFiscalYears: Set<number>,
): Promise<void> {
  const allFull = await db
    .select({ id: financialPeriods.id, fiscalYear: financialPeriods.fiscalYear })
    .from(financialPeriods)
    .where(
      and(
        eq(financialPeriods.targetCompanyId, targetCompanyId),
        eq(financialPeriods.isFullYear, true),
      ),
    );

  for (const { id, fiscalYear } of allFull) {
    if (fiscalYear === null) continue;
    if (winnerFiscalYears.has(fiscalYear)) continue; // year has a winner — reconcile handled it
    // No winner for this year — remove stale figures
    await db.delete(incomeStatements).where(eq(incomeStatements.financialPeriodId, id));
    await db.delete(balanceSheets).where(eq(balanceSheets.financialPeriodId, id));
  }
}

/**
 * Prune full-year period shells that are completely empty:
 *   - NOT in the current winner set
 *   - NO income_statement
 *   - NO balance_sheet
 *   - NO staff_data
 *   - NO ebitda_adjustments
 *
 * A container that holds an ebitda_adjustment but no figures is KEPT — the
 * adjustment sits there ready to be applied when data returns.
 */
async function pruneGhostPeriods(
  targetCompanyId: number,
  winnerPeriodIds: Set<number>,
): Promise<void> {
  const winnerArr = [...winnerPeriodIds];

  const candidates = await db
    .select({ id: financialPeriods.id })
    .from(financialPeriods)
    .where(
      and(
        eq(financialPeriods.targetCompanyId, targetCompanyId),
        eq(financialPeriods.isFullYear, true),
        winnerArr.length > 0 ? notInArray(financialPeriods.id, winnerArr) : undefined,
      ),
    );

  if (candidates.length === 0) return;

  const ghostIds: number[] = [];

  for (const { id } of candidates) {
    const [inc] = await db
      .select({ id: incomeStatements.id })
      .from(incomeStatements)
      .where(eq(incomeStatements.financialPeriodId, id))
      .limit(1);
    if (inc) continue;

    const [bal] = await db
      .select({ id: balanceSheets.id })
      .from(balanceSheets)
      .where(eq(balanceSheets.financialPeriodId, id))
      .limit(1);
    if (bal) continue;

    const [sd] = await db
      .select({ id: staffData.id })
      .from(staffData)
      .where(eq(staffData.financialPeriodId, id))
      .limit(1);
    if (sd) continue;

    const [adj] = await db
      .select({ id: ebitdaAdjustments.id })
      .from(ebitdaAdjustments)
      .where(eq(ebitdaAdjustments.financialPeriodId, id))
      .limit(1);
    if (adj) continue;

    ghostIds.push(id);
  }

  if (ghostIds.length > 0) {
    await db.delete(financialPeriods).where(inArray(financialPeriods.id, ghostIds));
    console.log(`[RESELECT] Pruned ${ghostIds.length} empty ghost period(s): [${ghostIds.join(', ')}]`);
  }
}

/**
 * Reselect — rebuilds the income/balance projection for a company from its
 * financial_contributions (append-only truth) using the precedence selector.
 *
 * Invariants upheld:
 *   - financial_contributions is NEVER modified.
 *   - ebitda_adjustments are NEVER deleted; they are re-pointed to the survivor
 *     period when a year's winner changes.
 *   - staff_data is NEVER deleted; it is re-pointed to the latest winning
 *     full-year period.
 *   - financial_period container ids persist for the life of the deal.
 *   - Empty shell periods (no income, no balance, no staff_data, no
 *     ebitda_adjustments, not a current winner) ARE pruned.
 *   - A period that holds an ebitda_adjustment but no figures is KEPT.
 *   - After completion: exactly ONE income row and ONE balance row per
 *     (fiscalYear, isFullYear) slot, always on the survivor container.
 */
export async function reselect(targetCompanyId: number): Promise<void> {
  console.log(`[RESELECT] company=${targetCompanyId}`);

  // 1. Load contributions — read-only, never mutated
  const rawContribs = await db
    .select()
    .from(financialContributions)
    .where(eq(financialContributions.targetCompanyId, targetCompanyId));

  const contribs: Contribution[] = rawContribs.map(c => ({ ...c }));

  // 2. Deterministic winner selection — Slice 17 completed-year gate.
  // Contributions whose period_end is in the future (forecast years) are
  // excluded from winner selection so they are never projected into the live
  // income / balance tables.  They remain in financial_contributions
  // (append-only) and can become winners once their period_end passes.
  // A second guard on fiscalYear catches mislabelled contributions where
  // period_end fell in the past but the extractor assigned a future fiscal
  // year (e.g. a June 2026 YTD P&L recorded as fiscalYear=2027).
  const today = new Date().toISOString().split('T')[0];
  const currentYear = new Date().getFullYear();
  const completedContribs = contribs.filter(
    c =>
      (!c.periodEnd || c.periodEnd <= today) &&
      (c.fiscalYear === null || c.fiscalYear <= currentYear),
  );

  const winners = selectProjectionWinners(completedContribs);
  console.log(
    `[RESELECT] ${contribs.length} contributions (${contribs.length - completedContribs.length} future-gated) → ${winners.length} winners`,
  );

  // 3. For each winner: find-or-reuse the canonical container, upsert figures,
  //    evict loser income/balance rows from sibling periods in the same slot.
  const winnerPeriodIds = new Set<number>();
  const yearToWinnerPeriodId = new Map<number, number>(); // fiscalYear → survivor period id (full-year only)
  let latestWinnerPeriodId: number | null = null;
  let latestWinnerFiscalYear: number | null = null;

  for (const winner of winners) {
    if (winner.fiscalYear === null) {
      console.warn(`[RESELECT] Skipping winner with null fiscalYear (id=${winner.id})`);
      continue;
    }

    const periodType = tierToPeriodType(winner.sourceTier);
    const periodEnd = winner.periodEnd ?? `${winner.fiscalYear}-12-31`;
    const figures = winner.figures as Record<string, any>;

    const period = await findOrReusePeriod(
      targetCompanyId,
      winner.fiscalYear,
      winner.isFullYear,
      periodType,
      winner.sourceTier,
      periodEnd,
      winner.monthsCovered ?? null,
      winner.sourceDocumentId ?? null,
    );

    winnerPeriodIds.add(period.id);

    if (winner.isFullYear) {
      yearToWinnerPeriodId.set(winner.fiscalYear, period.id);
      if (latestWinnerFiscalYear === null || winner.fiscalYear > latestWinnerFiscalYear) {
        latestWinnerFiscalYear = winner.fiscalYear;
        latestWinnerPeriodId = period.id;
      }
    }

    // Upsert winner figures into the projection table
    const winnerSourceDocId = winner.sourceDocumentId ?? null;
    if (winner.statementType === 'income') {
      // Slice 20: stamp the income statement's own is_full_year from the INCOME
      // contribution's span — not the period container.  This lets
      // fetchReportedEbitdaByYear gate on income_statements.is_full_year so that
      // a YTD P&L whose contribution was flipped to is_full_year=false by Slice 18
      // is excluded from valuation even when it lives in an is_full_year=true
      // period container (stamped true by the balance sheet winner).
      await upsertIncomeFromFigures(period.id, targetCompanyId, figures, winnerSourceDocId, winner.isFullYear);
    } else {
      await upsertBalanceFromFigures(period.id, targetCompanyId, figures, winnerSourceDocId);
    }

    // 4. Reconcile: remove income/balance rows from OTHER periods that lost
    //    the election for this fiscal year.
    //
    //    Income winners span ALL is_full_year slots in this fiscal year.
    //    This is critical for the split-attribution case where a container period
    //    was created by one document (e.g. a Company Accounts PDF, stamping
    //    is_full_year=true) while the actual income figures were written by a
    //    different part-year document (e.g. a YTD P&L).  After Slice 18 flips the
    //    income contribution's is_full_year to false, the income winner lands in a
    //    new is_full_year=false container.  Without the wider scope, the old
    //    is_full_year=true container's income_statement would never be evicted and
    //    would keep leaking into fetchReportedEbitdaByYear.
    //
    //    Balance winners remain scoped to their own is_full_year slot so that
    //    balance and income reconcile independently.
    const slotPeriods = await db
      .select({ id: financialPeriods.id })
      .from(financialPeriods)
      .where(
        and(
          eq(financialPeriods.targetCompanyId, targetCompanyId),
          eq(financialPeriods.fiscalYear, winner.fiscalYear),
          winner.statementType === 'balance'
            ? eq(financialPeriods.isFullYear, winner.isFullYear)
            : undefined,
        ),
      );

    for (const other of slotPeriods) {
      if (other.id === period.id) continue;
      if (winner.statementType === 'income') {
        await db.delete(incomeStatements).where(eq(incomeStatements.financialPeriodId, other.id));
      } else {
        await db.delete(balanceSheets).where(eq(balanceSheets.financialPeriodId, other.id));
      }
    }
  }

  // 5. Re-point ebitda_adjustments from non-survivor periods to the survivor,
  //    per fiscal year.  Adjustments must never lose their year binding.
  await repointAdjustments(targetCompanyId, yearToWinnerPeriodId);

  // 6. Re-point staff_data to the latest winning full-year period.
  if (latestWinnerPeriodId !== null) {
    await repointStaffData(targetCompanyId, latestWinnerPeriodId);
  }

  // 7. Clear stale income/balance from full-year periods whose fiscal year has
  //    no winning contribution this run (all sources deleted, no fallback).
  await clearOrphanedFigures(targetCompanyId, new Set(yearToWinnerPeriodId.keys()));

  // 8. Prune fully empty shell periods.
  await pruneGhostPeriods(targetCompanyId, winnerPeriodIds);

  console.log(`[RESELECT] Done. company=${targetCompanyId}`);
}
