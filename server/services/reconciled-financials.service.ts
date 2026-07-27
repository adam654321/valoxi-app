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

/**
 * Sign-convention note attached to every reconciled block.
 * Authoritative single source — do not duplicate in prompt files.
 */
export interface ReconciledSignConventions {
  amountsOwedToDirectors: string;
  amountsOwedByDirectors: string;
}

export interface ReconciledFinancials {
  incomeByYear: Record<string, ReconciledIncomeYear>;
  balanceSheetsByYear: Record<string, Record<string, unknown>>;
  currentBalanceSheet: Record<string, unknown> | null;
  _signConventions: ReconciledSignConventions;
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

/**
 * Tier precedence for balanceSheetsByYear winner selection.
 * Lower rank = higher authority.
 * user_override (0) > statutory (1) > management (2) > information_memorandum (3) > unknown (4)
 */
function sourceTierRank(tier: string | null | undefined): number {
  if (tier === 'user_override') return 0;
  if (tier === 'statutory') return 1;
  if (tier === 'management') return 2;
  if (tier === 'information_memorandum') return 3;
  return 4;
}

type EligibleBsRow = {
  bs: Record<string, unknown>;
  fiscalYear: string;
  periodEnd: string;
  sourceTier: string | null;
  tierRank: number;
};

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
      // D&A is economically non-negative; abs() normalises credit-balance sign
      // convention from extraction (see tc=220 FY2026, tc=219 FY2024).
      ebitda: op + Math.abs(da),
    };
  }

  // ── Balance sheets: collect all eligible rows ─────────────────────────────
  // Guards applied per row:
  //   (a) not future-dated: periodEnd <= today
  //   (b) not all-null core fields (empty row)
  // Fetched periodEnd DESC so eligibleRows[0] is the globally latest passing row.
  const bsRows = await db
    .select()
    .from(balanceSheets)
    .innerJoin(financialPeriods, eq(balanceSheets.financialPeriodId, financialPeriods.id))
    .where(eq(balanceSheets.targetCompanyId, companyId))
    .orderBy(desc(financialPeriods.periodEnd));

  const eligibleRows: EligibleBsRow[] = [];

  for (const row of bsRows) {
    const bs = row.balance_sheets as Record<string, unknown>;
    const fp = row.financial_periods;
    const periodEnd = fp.periodEnd as string | null;
    const fiscalYear = fp.fiscalYear as number | null;
    const sourceTier = (fp.sourceTier as string | null) ?? null;

    if (periodEnd == null || fiscalYear == null) continue;
    if (periodEnd > today) continue; // future-dated guard
    if (isBalanceSheetEmpty(bs)) continue; // empty row guard

    eligibleRows.push({
      bs,
      fiscalYear: fiscalYear.toString(),
      periodEnd,
      sourceTier,
      tierRank: sourceTierRank(sourceTier),
    });
  }

  // ── balanceSheetsByYear: tier precedence first, periodEnd DESC as tiebreak ─
  // user_override > statutory > management > information_memorandum > unknown
  const candidates = new Map<string, EligibleBsRow>();
  for (const row of eligibleRows) {
    const existing = candidates.get(row.fiscalYear);
    if (
      !existing ||
      row.tierRank < existing.tierRank ||
      (row.tierRank === existing.tierRank && row.periodEnd > existing.periodEnd)
    ) {
      candidates.set(row.fiscalYear, row);
    }
  }

  const balanceSheetsByYear: Record<string, Record<string, unknown>> = {};
  for (const [year, row] of candidates) {
    balanceSheetsByYear[year] = {
      ...row.bs,
      fiscalYear: year,
      periodEnd: row.periodEnd,
      sourceTier: row.sourceTier,
    };
  }

  // ── currentBalanceSheet: latest passing row overall (periodEnd DESC) ───────
  // Does NOT apply tier precedence — always the most recent snapshot regardless of tier.
  // Carries _label so the LLM knows this is the current position.
  let currentBalanceSheet: Record<string, unknown> | null = null;
  if (eligibleRows.length > 0) {
    const latest = eligibleRows[0]; // already ordered DESC by periodEnd
    currentBalanceSheet = {
      ...latest.bs,
      fiscalYear: latest.fiscalYear,
      periodEnd: latest.periodEnd,
      sourceTier: latest.sourceTier,
      _label: 'CURRENT POSITION',
    };
  }

  const _signConventions: ReconciledSignConventions = {
    amountsOwedToDirectors:
      'LIABILITY — money the company owes to its directors. Both positive and negative stored values represent this liability; a negative sign reflects the source document\'s credit-balance notation, not a reversal of direction. Use abs(value) as the liability amount.',
    amountsOwedByDirectors:
      'ASSET — money directors owe TO the company (a debtor). Use abs(value). In any EV-to-equity bridge this ADDS to equity value (enter as a negative deduction), never a subtraction.',
  };

  return { incomeByYear, balanceSheetsByYear, currentBalanceSheet, _signConventions };
}
