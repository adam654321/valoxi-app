import { eq, and } from 'drizzle-orm';
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
  // Load ALL periods for this (company, fiscalYear, isFullYear) so we preserve the existing id
  const existing = await db
    .select()
    .from(financialPeriods)
    .where(
      and(
        eq(financialPeriods.targetCompanyId, targetCompanyId),
        eq(financialPeriods.fiscalYear, fiscalYear),
        eq(financialPeriods.isFullYear, isFullYear),
      ),
    );

  if (existing.length > 0) {
    // Prefer period with matching type so we don't change the type unnecessarily;
    // fall back to first available — its id (and its ebitda_adjustments) are preserved.
    const preferred = existing.find(p => p.periodType === periodType) ?? existing[0];
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
 * Reselect — rebuilds the income/balance projection for a company from its
 * financial_contributions (append-only truth) using the precedence selector.
 *
 * Invariants upheld:
 *   - financial_contributions is NEVER modified.
 *   - ebitda_adjustments and staff_data are NEVER touched.
 *   - financial_periods are NEVER deleted (ids preserved for FK referents).
 *   - After completion: at most ONE income row and ONE balance row per
 *     (fiscalYear, isFullYear) slot.
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

  // 3. For each winner: find-or-reuse period, upsert figures, evict loser rows
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

    // Upsert winner figures into the projection table
    if (winner.statementType === 'income') {
      await upsertIncomeFromFigures(period.id, targetCompanyId, figures);
    } else {
      await upsertBalanceFromFigures(period.id, targetCompanyId, figures);
    }

    // 4. Reconcile: remove income/balance rows from OTHER periods with the same
    //    (fiscalYear, isFullYear) slot — they lost the election.
    //    Periods themselves are preserved (ebitda_adjustments remain intact).
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

  console.log(`[RESELECT] Done. company=${targetCompanyId}`);
}
