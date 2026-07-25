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

// ── H6: insert-only dedup key ───────────────────────────────────────────────
// FIVE parts. is_full_year is load-bearing: a part-year stub and a full-year
// statement from the same document and year are legitimately distinct
// contributions, and projection-selector.ts groupKey includes isFullYear.
function contribKey(
  targetCompanyId: number | null,
  fiscalYear: number | null,
  statementType: string,
  sourceDocumentId: number | null,
  isFullYear: boolean,
): string {
  return [
    targetCompanyId ?? 'null',
    fiscalYear ?? 'null',
    statementType,
    sourceDocumentId ?? 'null',
    isFullYear ? 't' : 'f',
  ].join('|');
}

export async function backfillFinancialContributions(): Promise<{ income: number; balance: number }> {
  // ── H1: Host + dry-run guard ─────────────────────────────────────────────
  const DRY_RUN = process.env.DRY_RUN !== 'false';

  const rawUrl = process.env.DATABASE_URL;
  if (!rawUrl) throw new Error('[BACKFILL] DATABASE_URL is not set. Refusing.');
  let host: string;
  try {
    host = new URL(rawUrl).hostname;
  } catch {
    throw new Error('[BACKFILL] DATABASE_URL is not parseable. Refusing.');
  }
  const expectHost = process.env.EXPECT_DB_HOST;
  if (!expectHost) {
    throw new Error('[BACKFILL] EXPECT_DB_HOST is not set. Refusing to run. Set it to a distinctive substring of the host you intend to hit.');
  }
  if (!host.includes(expectHost)) {
    throw new Error(`[BACKFILL] HOST MISMATCH. Connected host is ${host}, EXPECT_DB_HOST="${expectHost}" did not match. Refusing.`);
  }
  const dbNameRes = await db.execute(sql`SELECT current_database() AS db`);
  console.log(`[BACKFILL] host=${host} db=${dbNameRes.rows?.[0]?.db} DRY_RUN=${DRY_RUN}`);

  // ── H2: Row count ────────────────────────────────────────────────────────
  const existingCountRes = await db.execute(sql`SELECT count(*)::int AS n FROM financial_contributions`);
  const existingCount = Number(existingCountRes.rows?.[0]?.n ?? 0);
  console.log(`[BACKFILL] financial_contributions currently holds ${existingCount} rows`);

  // ── H4: Primary-year map ─────────────────────────────────────────────────
  const primaryRes = await db.execute(sql`
    SELECT source_document_id, MAX(fiscal_year) AS max_year
    FROM financial_periods
    WHERE source_document_id IS NOT NULL AND fiscal_year IS NOT NULL
    GROUP BY source_document_id
  `);
  const primaryYearByDoc = new Map<number, number>();
  for (const r of primaryRes.rows ?? []) {
    primaryYearByDoc.set(Number(r.source_document_id), Number(r.max_year));
  }
  console.log(`[BACKFILL] primary-year map built for ${primaryYearByDoc.size} documents`);

  // ── H6: existing-key snapshot. Replaces the H3 truncate. ─────────────────
  // Dedup is against the START-OF-RUN snapshot ONLY. We deliberately do NOT
  // add keys as we insert: two source rows can legitimately share a five-part
  // key (e.g. two rows with NULL source_document_id for the same company-year)
  // and intra-run dedup would under-insert them. Snapshot-only dedup protects
  // rows written by the live forward path, leaves legacy rows behaving as the
  // validated design intended, and is still idempotent across runs because a
  // previous run's inserts are inside the next run's snapshot.
  const existingRes = await db.execute(sql`
    SELECT target_company_id, fiscal_year, statement_type, source_document_id, is_full_year
    FROM financial_contributions
  `);
  const existingRows = existingRes.rows ?? [];
  const existingKeys = new Set<string>();
  for (const r of existingRows) {
    existingKeys.add(contribKey(
      r.target_company_id == null ? null : Number(r.target_company_id),
      r.fiscal_year == null ? null : Number(r.fiscal_year),
      String(r.statement_type),
      r.source_document_id == null ? null : Number(r.source_document_id),
      r.is_full_year === true || r.is_full_year === 't',
    ));
  }
  console.log(`[BACKFILL] MODE: INSERT-ONLY. Nothing in this script deletes.`);
  console.log(`[BACKFILL] existing-key snapshot: ${existingKeys.size} distinct keys from ${existingRows.length} rows`);
  if (existingKeys.size !== existingRows.length) {
    console.warn(`[BACKFILL] NOTE: ${existingRows.length - existingKeys.size} pre-existing rows share a key with another pre-existing row. Not created by this run.`);
  }
  if (DRY_RUN) {
    console.log('[BACKFILL] DRY RUN: counting only, no inserts.');
  }

  let incomeInserted = 0;
  let balanceInserted = 0;

  // Distribution counters (run in both DRY_RUN and live mode)
  const tierCount: Record<string, number> = {};
  let primaryYearTrue = 0;
  let primaryYearFalse = 0;
  let partYearCount = 0;
  const skipsTotal = 0;
  const skipReasons: Record<string, number> = {};
  let incomeSkippedExisting = 0;
  let balanceSkippedExisting = 0;

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

    const isPrimaryYear = (() => {
      if (row.sourceDocumentId == null) return true;
      const maxYear = primaryYearByDoc.get(row.sourceDocumentId);
      if (maxYear == null || period?.fiscalYear == null) return true;
      return period.fiscalYear === maxYear;
    })();

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

    // ── H6: insert-only skip ───────────────────────────────────────────────
    const contribDedupKey = contribKey(
      row.targetCompanyId,
      period?.fiscalYear ?? null,
      'income',
      row.sourceDocumentId ?? null,
      period?.isFullYear ?? true,
    );
    if (existingKeys.has(contribDedupKey)) {
      incomeSkippedExisting++;
      continue;
    }

    // Track distributions (both modes)
    tierCount[tier] = (tierCount[tier] ?? 0) + 1;
    if (isPrimaryYear) { primaryYearTrue++; } else { primaryYearFalse++; }
    if (period?.isFullYear === false) { partYearCount++; }

    if (!DRY_RUN) {
      await db.insert(financialContributions).values({
        targetCompanyId: row.targetCompanyId,
        fiscalYear: period?.fiscalYear ?? null,
        statementType: 'income',
        sourceDocumentId: row.sourceDocumentId ?? null,
        sourceTier: tier,
        isFullYear: period?.isFullYear ?? true,
        isPrimaryYear,
        monthsCovered: period?.monthsCovered ?? null,
        periodEnd: period?.periodEnd ?? null,
        asAtDate: null,
        figures,
      });
    }

    incomeInserted++;
  }

  console.log(`[BACKFILL] Income statements counted: ${incomeInserted}`);

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

    const isPrimaryYear = (() => {
      if (row.sourceDocumentId == null) return true;
      const maxYear = primaryYearByDoc.get(row.sourceDocumentId);
      if (maxYear == null || period?.fiscalYear == null) return true;
      return period.fiscalYear === maxYear;
    })();

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

    // ── H6: insert-only skip ───────────────────────────────────────────────
    const contribDedupKey = contribKey(
      row.targetCompanyId,
      period?.fiscalYear ?? null,
      'balance',
      row.sourceDocumentId ?? null,
      period?.isFullYear ?? true,
    );
    if (existingKeys.has(contribDedupKey)) {
      balanceSkippedExisting++;
      continue;
    }

    // Track distributions (both modes)
    tierCount[tier] = (tierCount[tier] ?? 0) + 1;
    if (isPrimaryYear) { primaryYearTrue++; } else { primaryYearFalse++; }
    if (period?.isFullYear === false) { partYearCount++; }

    if (!DRY_RUN) {
      await db.insert(financialContributions).values({
        targetCompanyId: row.targetCompanyId,
        fiscalYear: period?.fiscalYear ?? null,
        statementType: 'balance',
        sourceDocumentId: row.sourceDocumentId ?? null,
        sourceTier: tier,
        isFullYear: period?.isFullYear ?? true,
        isPrimaryYear,
        monthsCovered: period?.monthsCovered ?? null,
        periodEnd: period?.periodEnd ?? null,
        asAtDate: period?.periodEnd ?? null,
        figures,
      });
    }

    balanceInserted++;
  }

  console.log(`[BACKFILL] Balance sheets counted: ${balanceInserted}`);

  // ── H5: Summary report ───────────────────────────────────────────────────
  const total = incomeInserted + balanceInserted;
  console.log(`[BACKFILL] --- Summary ---`);
  console.log(`[BACKFILL] Income contributions counted: ${incomeInserted}`);
  console.log(`[BACKFILL] Balance contributions counted: ${balanceInserted}`);
  console.log(`[BACKFILL] Total contributions counted: ${total}`);
  console.log(`[BACKFILL] Tier distribution:`);
  for (const [t, count] of Object.entries(tierCount).sort()) {
    console.log(`[BACKFILL]   ${t}: ${count}`);
  }
  console.log(`[BACKFILL] isPrimaryYear distribution: true=${primaryYearTrue} false=${primaryYearFalse}`);
  console.log(`[BACKFILL] isFullYear=false (part-year) contributions: ${partYearCount}`);
  console.log(`[BACKFILL] Total skips: ${skipsTotal}`);
  for (const [reason, count] of Object.entries(skipReasons)) {
    console.log(`[BACKFILL]   ${reason}: ${count}`);
  }
  console.log(`[BACKFILL] skipped as already present: income=${incomeSkippedExisting} balance=${balanceSkippedExisting} total=${incomeSkippedExisting + balanceSkippedExisting}`);

  return { income: incomeInserted, balance: balanceInserted };
}

const isMain = process.argv[1]?.includes('backfill-financial-contributions');
if (isMain) {
  backfillFinancialContributions()
    .then(r => { console.log('[BACKFILL] DONE', r); process.exit(0); })
    .catch(e => { console.error('[BACKFILL] FAILED', e); process.exit(1); });
}
