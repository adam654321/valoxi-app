import { db } from '../db';
import {
  incomeStatements,
  balanceSheets,
  financialPeriods,
  financialContributions,
  documents,
} from '@shared/schema';
import { eq, sql } from 'drizzle-orm';

/**
 * Resolves the source tier for a financial contribution.
 * Pure function — no DB calls.
 *
 * @param isIM - When true, forces 'information_memorandum' tier regardless of
 *               category/period_type. Supports the content-based IM detector.
 */
export function resolveSourceTier(
  periodType: string,
  documentCategory: string | null,
  isIM: boolean = false,
): string {
  if (isIM) return 'information_memorandum';
  if (documentCategory === 'Deal Documents') return 'information_memorandum';
  if (periodType === 'statutory') return 'statutory';
  return 'management';
}

export async function backfillFinancialContributions(): Promise<{ income: number; balance: number }> {
  // Print host for V-check
  const hostResult = await db.execute(sql`SELECT current_database() AS db, inet_server_addr() AS host`);
  console.log('[BACKFILL] Connected host/db:', hostResult.rows?.[0]);

  // Idempotent: truncate first so re-runs don't duplicate
  await db.delete(financialContributions);
  console.log('[BACKFILL] Cleared financial_contributions — starting fresh');

  let incomeInserted = 0;
  let balanceInserted = 0;

  // ── Income statements ────────────────────────────────────────────────────
  const incomeRows = await db
    .select({
      id: incomeStatements.id,
      targetCompanyId: incomeStatements.targetCompanyId,
      sourceDocumentId: incomeStatements.sourceDocumentId,
      financialPeriodId: incomeStatements.financialPeriodId,
      revenue: incomeStatements.revenue,
      costOfSales: incomeStatements.costOfSales,
      grossProfit: incomeStatements.grossProfit,
      administrativeExpenses: incomeStatements.administrativeExpenses,
      depreciationAmortisation: incomeStatements.depreciationAmortisation,
      otherOperatingIncome: incomeStatements.otherOperatingIncome,
      operatingProfit: incomeStatements.operatingProfit,
      interestReceivable: incomeStatements.interestReceivable,
      interestPayable: incomeStatements.interestPayable,
      profitBeforeTax: incomeStatements.profitBeforeTax,
      corporationTax: incomeStatements.corporationTax,
      netProfit: incomeStatements.netProfit,
      staffCosts: incomeStatements.staffCosts,
      directorsRemuneration: incomeStatements.directorsRemuneration,
      dividendsPaid: incomeStatements.dividendsPaid,
      revenueBreakdown: incomeStatements.revenueBreakdown,
      costOfSalesBreakdown: incomeStatements.costOfSalesBreakdown,
      overheadsBreakdown: incomeStatements.overheadsBreakdown,
      exceptionalItems: incomeStatements.exceptionalItems,
    })
    .from(incomeStatements);

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

  console.log(`[BACKFILL] Income statements inserted: ${incomeInserted}`);

  // ── Balance sheets ───────────────────────────────────────────────────────
  const balanceRows = await db
    .select({
      id: balanceSheets.id,
      targetCompanyId: balanceSheets.targetCompanyId,
      sourceDocumentId: balanceSheets.sourceDocumentId,
      financialPeriodId: balanceSheets.financialPeriodId,
      intangibleAssets: balanceSheets.intangibleAssets,
      tangibleFixedAssets: balanceSheets.tangibleFixedAssets,
      freeholdProperty: balanceSheets.freeholdProperty,
      leaseholdProperty: balanceSheets.leaseholdProperty,
      plantMachinery: balanceSheets.plantMachinery,
      fixturesFittings: balanceSheets.fixturesFittings,
      motorVehicles: balanceSheets.motorVehicles,
      computerEquipment: balanceSheets.computerEquipment,
      stockInventory: balanceSheets.stockInventory,
      tradeDebtors: balanceSheets.tradeDebtors,
      prepayments: balanceSheets.prepayments,
      amountsOwedByDirectors: balanceSheets.amountsOwedByDirectors,
      amountsOwedByConnectedCompanies: balanceSheets.amountsOwedByConnectedCompanies,
      directorsCurrentAccount: balanceSheets.directorsCurrentAccount,
      otherDebtors: balanceSheets.otherDebtors,
      cashAtBank: balanceSheets.cashAtBank,
      totalCurrentAssets: balanceSheets.totalCurrentAssets,
      tradeCreditors: balanceSheets.tradeCreditors,
      taxationSocialSecurity: balanceSheets.taxationSocialSecurity,
      vatPayable: balanceSheets.vatPayable,
      corporationTaxDue: balanceSheets.corporationTaxDue,
      bankLoansOverdraftCurrent: balanceSheets.bankLoansOverdraftCurrent,
      hirePurchaseCurrent: balanceSheets.hirePurchaseCurrent,
      accruals: balanceSheets.accruals,
      amountsOwedToDirectors: balanceSheets.amountsOwedToDirectors,
      otherCreditors: balanceSheets.otherCreditors,
      totalCurrentLiabilities: balanceSheets.totalCurrentLiabilities,
      bankLoansLongTerm: balanceSheets.bankLoansLongTerm,
      hirePurchaseLongTerm: balanceSheets.hirePurchaseLongTerm,
      deferredTaxation: balanceSheets.deferredTaxation,
      otherLongTermDebt: balanceSheets.otherLongTermDebt,
      totalLongTermLiabilities: balanceSheets.totalLongTermLiabilities,
      shareCapital: balanceSheets.shareCapital,
      retainedEarnings: balanceSheets.retainedEarnings,
      totalEquity: balanceSheets.totalEquity,
      debtorsList: balanceSheets.debtorsList,
      creditorsList: balanceSheets.creditorsList,
      fixedAssetsDetail: balanceSheets.fixedAssetsDetail,
    })
    .from(balanceSheets);

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

  console.log(`[BACKFILL] Balance sheets inserted: ${balanceInserted}`);
  console.log(`[BACKFILL] Total: income=${incomeInserted} balance=${balanceInserted}`);

  return { income: incomeInserted, balance: balanceInserted };
}
