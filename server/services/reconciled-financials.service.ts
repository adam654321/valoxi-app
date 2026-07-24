/**
 * Shared accessor for reconciled financial figures.
 *
 * Single source of truth that both the deal model and expert analysis read.
 * Reads ONLY from the reconciled tables (financial_periods / income_statements
 * / balance_sheets) — never from document_analysis_results.
 */
import { eq, and, ne, or, isNull, lte, desc } from 'drizzle-orm';
import { db } from '../db';
import { financialPeriods, incomeStatements, balanceSheets } from '@shared/schema';

export interface ReconciledIncomeYear {
  fiscalYear: string;
  periodEnd: string | null;
  revenue: string | null;
  costOfSales: string | null;
  grossProfit: string | null;
  administrativeExpenses: string | null;
  depreciationAmortisation: string | null;
  otherOperatingIncome: string | null;
  operatingProfit: string | null;
  interestReceivable: string | null;
  interestPayable: string | null;
  profitBeforeTax: string | null;
  corporationTax: string | null;
  netProfit: string | null;
  staffCosts: string | null;
  directorsRemuneration: string | null;
  dividendsPaid: string | null;
  revenueBreakdown: unknown;
  costOfSalesBreakdown: unknown;
  overheadsBreakdown: unknown;
  exceptionalItems: unknown;
  ebitda: number;
}

export interface ReconciledFinancials {
  incomeByYear: Record<string, ReconciledIncomeYear>;
  balanceSheetsByYear: Record<string, Record<string, unknown>>;
  currentBalanceSheet: Record<string, unknown> | null;
}

const BS_CORE_FIELDS = [
  'cashAtBank',
  'tradeDebtors',
  'totalCurrentAssets',
  'tradeCreditors',
  'totalCurrentLiabilities',
  'totalEquity',
  'retainedEarnings',
  'tangibleFixedAssets',
  'stockInventory',
] as const;

export function isBalanceSheetEmpty(row: Record<string, unknown>): boolean {
  return BS_CORE_FIELDS.every((f) => row[f] == null);
}

export async function getReconciledFinancials(companyId: number): Promise<ReconciledFinancials> {
  const today = new Date().toISOString().split('T')[0];
  const currentYear = new Date().getFullYear();

  // ── Income by fiscal year ─────────────────────────────────────────────────
  // Same gates as fetchReportedEbitdaByYear:
  //   is_full_year = true (stamped by reselect on the income statement row)
  //   source_tier != information_memorandum
  //   period_end <= today
  //   fiscal_year <= currentYear
  const incomeRows = await db
    .select({
      periodEnd: financialPeriods.periodEnd,
      fiscalYear: financialPeriods.fiscalYear,
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
    .from(incomeStatements)
    .innerJoin(financialPeriods, eq(incomeStatements.financialPeriodId, financialPeriods.id))
    .where(
      and(
        eq(incomeStatements.targetCompanyId, companyId),
        eq(incomeStatements.isFullYear, true),
        or(
          isNull(financialPeriods.sourceTier),
          ne(financialPeriods.sourceTier, 'information_memorandum'),
        ),
        lte(financialPeriods.periodEnd, today),
        lte(financialPeriods.fiscalYear, currentYear),
      ),
    )
    .orderBy(desc(financialPeriods.periodEnd));

  const incomeByYear: Record<string, ReconciledIncomeYear> = {};
  for (const row of incomeRows) {
    const year =
      row.fiscalYear?.toString() ||
      (row.periodEnd ? new Date(row.periodEnd).getFullYear().toString() : null);
    if (!year || year in incomeByYear) continue; // first (most-recent) row wins per year

    const op = parseFloat(row.operatingProfit ?? '0') || 0;
    const da = parseFloat(row.depreciationAmortisation ?? '0') || 0;

    incomeByYear[year] = {
      fiscalYear: year,
      periodEnd: row.periodEnd,
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
      ebitda: op + da,
    };
  }

  // ── Balance sheets ordered most-recent first ──────────────────────────────
  // Guards applied per row:
  //   (a) not future-dated: periodEnd <= today
  //   (b) not all-null core fields (empty row)
  const bsRows = await db
    .select()
    .from(balanceSheets)
    .innerJoin(financialPeriods, eq(balanceSheets.financialPeriodId, financialPeriods.id))
    .where(eq(balanceSheets.targetCompanyId, companyId))
    .orderBy(desc(financialPeriods.periodEnd));

  const balanceSheetsByYear: Record<string, Record<string, unknown>> = {};
  let currentBalanceSheet: Record<string, unknown> | null = null;

  for (const row of bsRows) {
    const bs = row.balance_sheets as Record<string, unknown>;
    const fp = row.financial_periods;
    const periodEnd = fp.periodEnd as string | null;
    const fiscalYear = fp.fiscalYear as number | null;

    const isFuture = periodEnd != null && periodEnd > today;
    const isEmpty = isBalanceSheetEmpty(bs);

    // balanceSheetsByYear: most-recent valid row per fiscal year
    if (fiscalYear != null && !isFuture && !isEmpty) {
      const key = fiscalYear.toString();
      if (!(key in balanceSheetsByYear)) {
        balanceSheetsByYear[key] = bs;
      }
    }

    // currentBalanceSheet: first non-empty, non-future-dated row in descending order
    if (currentBalanceSheet == null && !isFuture && !isEmpty) {
      currentBalanceSheet = bs;
    }
  }

  return { incomeByYear, balanceSheetsByYear, currentBalanceSheet };
}
