import { eq, and, asc, inArray, notInArray } from 'drizzle-orm';
import { db } from '../db';
import {
  financialContributions,
  financialPeriods,
  incomeStatements,
  balanceSheets,
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
 * Finds the canonical period for a (company, fiscalYear, isFullYear) slot,
 * or creates one if none exists.
 *
 * Key: (target_company_id, fiscal_year, is_full_year).
 * Rows are ordered by id ASC so both the income winner and the balance winner
 * for the same year always land on the same (lowest-id) canonical row — even
 * when ghost duplicates exist — preventing new rows from being created.
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
    .orderBy(asc(financialPeriods.id)); // lowest id = oldest = canonical

  if (existing.length > 0) {
    // Prefer the period whose type matches the current winner (avoids changing the
    // type unnecessarily and preserves ebitda_adjustments on the historically
    // canonical row).  ORDER BY id ASC ensures that when multiple periods share
    // the same type, we deterministically pick the oldest (lowest-id) one.
    const preferred =
      existing.find(p => p.periodType === periodType) ?? existing[0];
    const [updated] = await db
      .update(financialPeriods)
      .set({
        periodType,
        sourceTier,
        periodEnd,
        isFullYear,
        monthsCovered: monthsCovered ?? preferred.monthsCovered,
        sourceDocumentId: sourceDocumentId ?? preferred.sourceDocumentId,
        updatedAt: new Date(),
      })
      .where(eq(financialPeriods.id, preferred.id))
      .returning();
    return updated;
  }

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

async function upsertIncomeFromFigures(
  periodId: number,
  targetCompanyId: number,
  figures: Record<string, any>,
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
    sourceDocumentId: figures.sourceDocumentId ?? null,
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
    await db.insert(incomeStatements).values({
      financialPeriodId: periodId,
      targetCompanyId,
      ...data,
    });
  }
}

async function upsertBalanceFromFigures(
  periodId: number,
  targetCompanyId: number,
  figures: Record<string, any>,
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
    sourceDocumentId: figures.sourceDocumentId ?? null,
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
    await db.insert(balanceSheets).values({
      financialPeriodId: periodId,
      targetCompanyId,
      ...data,
    });
  }
}

/**
 * Prune empty ghost periods — full-year period rows that are not part of the
 * current winner set AND have no attached income_statement or balance_sheet.
 *
 * These arise when a document is deleted or superseded: the old period row
 * loses its winner status but was never cleaned up (reselect is additive-only
 * on period creation).  Pruning is safe because data-bearing periods are
 * explicitly protected by the NOT EXISTS guards.
 *
 * financial_contributions is never touched.
 */
async function pruneGhostPeriods(
  targetCompanyId: number,
  winnerPeriodIds: Set<number>,
): Promise<void> {
  const winnerArr = [...winnerPeriodIds];

  // Identify full-year periods outside the current winner set
  const candidates = await db
    .select({ id: financialPeriods.id })
    .from(financialPeriods)
    .where(
      and(
        eq(financialPeriods.targetCompanyId, targetCompanyId),
        eq(financialPeriods.isFullYear, true),
        // If winner set is non-empty, exclude winners; otherwise all are candidates.
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
    const [bal] = await db
      .select({ id: balanceSheets.id })
      .from(balanceSheets)
      .where(eq(balanceSheets.financialPeriodId, id))
      .limit(1);
    if (!inc && !bal) ghostIds.push(id);
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
 *   - ebitda_adjustments and staff_data are NEVER touched.
 *   - financial_periods with income OR balance attached are NEVER deleted.
 *   - Empty shell periods (no income, no balance, not a current winner) ARE
 *     pruned — they are stale artefacts from prior reselect runs.
 *   - After completion: exactly ONE income row and ONE balance row per
 *     (fiscalYear, isFullYear) slot, on the canonical (lowest-id) period row.
 */
export async function reselect(targetCompanyId: number): Promise<void> {
  console.log(`[RESELECT] company=${targetCompanyId}`);

  // 1. Load contributions — read-only, never mutated
  const rawContribs = await db
    .select()
    .from(financialContributions)
    .where(eq(financialContributions.targetCompanyId, targetCompanyId));

  const contribs: Contribution[] = rawContribs.map(c => ({ ...c }));

  // 2. Deterministic winner selection
  const winners = selectProjectionWinners(contribs);
  console.log(`[RESELECT] ${contribs.length} contributions → ${winners.length} winners`);

  // 3. For each winner: find-or-reuse canonical period, upsert figures,
  //    evict loser income/balance rows from sibling periods in the same slot.
  const winnerPeriodIds = new Set<number>();

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

    // Upsert winner figures into the projection table
    if (winner.statementType === 'income') {
      await upsertIncomeFromFigures(period.id, targetCompanyId, figures);
    } else {
      await upsertBalanceFromFigures(period.id, targetCompanyId, figures);
    }

    // 4. Reconcile: remove income/balance rows from OTHER periods in the same
    //    (fiscalYear, isFullYear) slot — they lost the election.
    const slotPeriods = await db
      .select({ id: financialPeriods.id })
      .from(financialPeriods)
      .where(
        and(
          eq(financialPeriods.targetCompanyId, targetCompanyId),
          eq(financialPeriods.fiscalYear, winner.fiscalYear),
          eq(financialPeriods.isFullYear, winner.isFullYear),
        ),
      );

    for (const other of slotPeriods) {
      if (other.id === period.id) continue;
      if (winner.statementType === 'income') {
        await db
          .delete(incomeStatements)
          .where(eq(incomeStatements.financialPeriodId, other.id));
      } else {
        await db
          .delete(balanceSheets)
          .where(eq(balanceSheets.financialPeriodId, other.id));
      }
    }
  }

  // 5. Prune empty ghost period shells left over from prior reselect runs.
  //    Only full-year periods are managed here; part-year periods are left intact.
  await pruneGhostPeriods(targetCompanyId, winnerPeriodIds);

  console.log(`[RESELECT] Done. company=${targetCompanyId}`);
}
