import { financialDataRepository } from '../repositories/financial-data.repository';
import { eventBus, type FinancialDataUpdateEvent } from './event-bus.service';
import { db } from '../db';
import { financialContributions } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import { reselect } from './projection-reselect.service';
import { detectInformationMemorandum } from '../../shared/utils/im-detector';
import { computeSpan } from '../../shared/utils/derive-span';
import { hasAnyValue, hasCoreIncomeValue, hasCoreBalanceValue } from '../../shared/utils/has-any-value';
import { isProvisionalFinancials } from '../../shared/utils/provisional-financials';

type PeriodType = 'statutory' | 'management';

export interface IMOptions {
  rawText?: string;
  llmIsIM?: boolean;
  llmReason?: string;
}

/**
 * Resolve the source tier for a financial contribution.
 *
 * @param isIM - When true, forces 'information_memorandum' tier regardless of
 *               the category or period type. Set by the content-based IM
 *               detector so that marketing packs never outrank real accounts.
 */
function contributionTier(
  periodType: string,
  documentCategory: string | null | undefined,
  isIM: boolean = false,
): string {
  if (isIM) return 'information_memorandum';
  if (documentCategory === 'Deal Documents') return 'information_memorandum';
  if (periodType === 'statutory') return 'statutory';
  return 'management';
}

interface ProcessingResult {
  success: boolean;
  message: string;
  recordsCreated?: number;
  errors?: string[];
}

export class FinancialDataService {
  async processExtractedData(
    documentType: string,
    analysisData: any,
    targetCompanyId: number,
    sourceDocumentId?: number,
    documentCategory?: string,
    imOptions?: IMOptions,
    documentName?: string,
  ): Promise<ProcessingResult> {
    console.log(`[FINANCIAL_DATA] Processing ${documentType} for company ${targetCompanyId}`);

    // Run IM detector before routing so the isIM flag flows to every insert path.
    const extractedYears = Object.keys(analysisData?.years ?? {})
      .map(Number)
      .filter(y => !isNaN(y));
    const currentFiscalYear = new Date().getFullYear();
    const imResult = detectInformationMemorandum({
      rawText: imOptions?.rawText,
      extractedYears,
      documentSource: analysisData?.source ?? null,
      currentFiscalYear,
      llmIsIM: imOptions?.llmIsIM,
      llmReason: imOptions?.llmReason,
    });
    const isIM = imResult.isIM;
    if (isIM) {
      console.log(
        `[FINANCIAL_DATA] IM detected for doc ${sourceDocumentId ?? 'unknown'} — reasons: ${imResult.reasons.join(' | ')}`,
      );
    }

    try {
      switch (documentType) {
        case 'profit_and_loss':
        case 'profit_loss':
        case 'p_and_l':
          return await this.processProfitAndLoss(analysisData, targetCompanyId, sourceDocumentId, documentCategory, isIM, documentName);
        
        case 'balance_sheet':
          return await this.processBalanceSheet(analysisData, targetCompanyId, sourceDocumentId, documentCategory, isIM, documentName);
        
        case 'staff_matrix':
          return await this.processStaffMatrix(analysisData, targetCompanyId, sourceDocumentId, documentCategory);
        
        case 'sales_ledger':
        case 'aged_debtors':
          return await this.processSalesLedger(analysisData, targetCompanyId, sourceDocumentId);
        
        case 'asset_register':
        case 'fixed_assets':
          return await this.processAssetRegister(analysisData, targetCompanyId, sourceDocumentId);
        
        case 'company_accounts':
          return await this.processCompanyAccounts(analysisData, targetCompanyId, sourceDocumentId, documentCategory, isIM, documentName);
        
        default:
          console.log(`[FINANCIAL_DATA] Unknown document type: ${documentType}, skipping normalization`);
          return { success: true, message: `Document type ${documentType} does not require normalization` };
      }
    } catch (error) {
      console.error(`[FINANCIAL_DATA] Error processing ${documentType}:`, error);
      return {
        success: false,
        message: `Failed to process ${documentType}`,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
      };
    }
  }

  private deriveSpan(
    data: any,
    yearKey: string,
    documentCategory?: string,
    docId?: number,
    documentType?: string,
    documentName?: string,
  ): { monthsCovered: number | null; isFullYear: boolean } {
    const periodEnd: string | null =
      data.period_ends?.[yearKey] ?? data.period_end ?? null;
    const reportDate: string | null = data.report_date ?? null;
    const monthsCovered: number | null = data.months_covered?.[yearKey] ?? null;

    const result = computeSpan({
      monthsCovered,
      periodEnd,
      reportDate,
      documentType,
      ytdHintText: documentName ?? null,
    });

    if (result.isFullYear !== (monthsCovered == null || monthsCovered >= 11)) {
      console.log(
        `[FINANCIAL_DATA] deriveSpan: doc ${docId ?? 'unknown'} FY ${yearKey}` +
          ` → isFullYear=${result.isFullYear}` +
          ` (periodEnd=${periodEnd}, reportDate=${reportDate}, months=${monthsCovered}, type=${documentType ?? 'n/a'})`,
      );
    }

    return result;
  }

  private hasAnyValue(obj: Record<string, any>): boolean {
    return hasAnyValue(obj);
  }

  private async processProfitAndLoss(
    data: any,
    targetCompanyId: number,
    sourceDocumentId?: number,
    documentCategory?: string,
    isIM: boolean = false,
    documentName?: string,
  ): Promise<ProcessingResult> {
    const errors: string[] = [];
    let recordsCreated = 0;

    const years = data.years || {};
    const periodType: PeriodType = data.source === 'statutory' ? 'statutory' : 'management';

    // Identify the primary year: the highest fiscal year present in this document.
    // In statutory accounts the most recent year is the primary; all others are comparatives.
    const yearKeys = Object.keys(years).map(Number).filter(n => !isNaN(n));
    const primaryYear = data.years_covered
      ? Math.max(...(data.years_covered as number[]))
      : yearKeys.length > 0 ? Math.max(...yearKeys) : null;

    // Idempotent: drop existing income contributions for this document before re-writing
    if (sourceDocumentId) {
      await db.delete(financialContributions).where(
        and(
          eq(financialContributions.sourceDocumentId, sourceDocumentId),
          eq(financialContributions.statementType, 'income'),
        ),
      );
    }

    for (const [yearKey, yearData] of Object.entries(years)) {
      try {
        const fiscalYear = parseInt(yearKey);
        if (isNaN(fiscalYear)) continue;

        const periodEnd = this.inferPeriodEnd(data, yearKey) || `${fiscalYear}-12-31`;
        const isPrimary = primaryYear === null || fiscalYear === primaryYear;
        const span = this.deriveSpan(data, yearKey, documentCategory, sourceDocumentId, undefined, documentName);

        const pl = (yearData as any).profit_and_loss || yearData;
        const yd = yearData as any;

        const plFields = {
          revenue: this.parseDecimal(pl.revenue),
          costOfSales: this.parseDecimal(pl.cost_of_sales),
          grossProfit: this.parseDecimal(pl.gross_profit),
          administrativeExpenses: this.parseDecimal(pl.administrative_expenses || pl.admin_expenses),
          depreciationAmortisation: this.parseDecimal(pl.depreciation_amortisation || pl.depreciation),
          otherOperatingIncome: this.parseDecimal(pl.other_operating_income),
          operatingProfit: this.parseDecimal(pl.operating_profit),
          interestReceivable: this.parseDecimal(pl.interest_receivable),
          interestPayable: this.parseDecimal(pl.interest_payable),
          profitBeforeTax: this.parseDecimal(pl.profit_before_tax),
          corporationTax: this.parseDecimal(pl.tax || pl.corporation_tax),
          netProfit: this.parseDecimal(pl.net_profit),
          staffCosts: this.deriveStaffCosts(yd, pl),
          directorsRemuneration: this.parseDecimal(yd.total_directors_remuneration || pl.total_directors_remuneration),
          dividendsPaid: this.parseDecimal(yd.dividends_paid || pl.dividends_paid),
          revenueBreakdown: yd.revenue_breakdown || pl.revenue_breakdown || null,
          costOfSalesBreakdown: yd.cost_of_sales_breakdown || pl.cost_of_sales_breakdown || null,
          overheadsBreakdown: yd.overheads_breakdown || pl.overheads_breakdown || null,
          exceptionalItems: yd.exceptional_items || pl.exceptional_items || null,
          sourceDocumentId,
        };

        if (!this.hasAnyValue(plFields)) {
          console.log(`[FINANCIAL_DATA] Skipping empty income statement for FY ${fiscalYear} (doc ${sourceDocumentId})`);
          continue;
        }

        if (!hasCoreIncomeValue(plFields)) {
          console.log(`[FINANCIAL_DATA] Skipping no-core-P&L income statement for FY ${fiscalYear} (doc ${sourceDocumentId}) — likely balance-sheet artefact`);
          continue;
        }

        const period = await financialDataRepository.findOrCreateFinancialPeriod(
          targetCompanyId,
          periodType,
          periodEnd,
          {
            fiscalYear,
            periodLabel: `FY ${fiscalYear}`,
            labelPriority: 'financial',
            ...span,
            sourceDocumentId,
          }
        );

        await financialDataRepository.upsertIncomeStatement(period.id, targetCompanyId, plFields, isPrimary);

        // Append contribution to the append-only truth table
        await db.insert(financialContributions).values({
          targetCompanyId,
          fiscalYear,
          statementType: 'income',
          sourceDocumentId: sourceDocumentId ?? null,
          sourceTier: contributionTier(periodType, documentCategory, isIM),
          isFullYear: span.isFullYear,
          isPrimaryYear: isPrimary,
          monthsCovered: span.monthsCovered ?? null,
          periodEnd,
          asAtDate: null,
          figures: plFields as any,
        });

        recordsCreated++;
        console.log(`[FINANCIAL_DATA] Created income statement for ${fiscalYear}`);
      } catch (yearError) {
        errors.push(`Failed to process year ${yearKey}: ${yearError instanceof Error ? yearError.message : 'Unknown'}`);
      }
    }

    if (Object.keys(years).length === 0 && data.profit_and_loss) {
      try {
        const pl = data.profit_and_loss;
        const fiscalYear = data.fiscal_year || new Date().getFullYear();
        const periodEnd = data.period_end || `${fiscalYear}-12-31`;
        
        const fallbackSpan = this.deriveSpan(data, String(fiscalYear), documentCategory, sourceDocumentId, undefined, documentName);

        const plFields = {
          revenue: this.parseDecimal(pl.revenue),
          costOfSales: this.parseDecimal(pl.cost_of_sales),
          grossProfit: this.parseDecimal(pl.gross_profit),
          administrativeExpenses: this.parseDecimal(pl.administrative_expenses),
          depreciationAmortisation: this.parseDecimal(pl.depreciation_amortisation),
          otherOperatingIncome: this.parseDecimal(pl.other_operating_income),
          operatingProfit: this.parseDecimal(pl.operating_profit),
          interestReceivable: this.parseDecimal(pl.interest_receivable),
          interestPayable: this.parseDecimal(pl.interest_payable),
          profitBeforeTax: this.parseDecimal(pl.profit_before_tax),
          corporationTax: this.parseDecimal(pl.corporation_tax),
          netProfit: this.parseDecimal(pl.net_profit),
          revenueBreakdown: pl.revenue_breakdown || null,
          costOfSalesBreakdown: pl.cost_of_sales_breakdown || null,
          overheadsBreakdown: pl.overheads_breakdown || null,
          exceptionalItems: pl.exceptional_items || null,
          sourceDocumentId,
        };

        if (!this.hasAnyValue(plFields)) {
          console.log(`[FINANCIAL_DATA] Skipping empty income statement for FY ${fiscalYear} (doc ${sourceDocumentId})`);
          return { success: true, message: `Skipped empty income statement for FY ${fiscalYear}`, recordsCreated: 0 };
        }

        if (!hasCoreIncomeValue(plFields)) {
          console.log(`[FINANCIAL_DATA] Skipping no-core-P&L income statement for FY ${fiscalYear} (doc ${sourceDocumentId}) — likely balance-sheet artefact`);
          return { success: true, message: `Skipped no-core-P&L income statement for FY ${fiscalYear}`, recordsCreated: 0 };
        }

        const period = await financialDataRepository.findOrCreateFinancialPeriod(
          targetCompanyId,
          'management',
          periodEnd,
          { fiscalYear, periodLabel: `FY ${fiscalYear}`, labelPriority: 'financial', ...fallbackSpan, sourceDocumentId }
        );

        await financialDataRepository.upsertIncomeStatement(period.id, targetCompanyId, plFields);

        // Append contribution for fallback single-year path
        await db.insert(financialContributions).values({
          targetCompanyId,
          fiscalYear,
          statementType: 'income',
          sourceDocumentId: sourceDocumentId ?? null,
          sourceTier: contributionTier(periodType, documentCategory, isIM),
          isFullYear: fallbackSpan.isFullYear,
          isPrimaryYear: true,
          monthsCovered: fallbackSpan.monthsCovered ?? null,
          periodEnd,
          asAtDate: null,
          figures: plFields as any,
        });

        recordsCreated++;
      } catch (error) {
        errors.push(`Failed to process single P&L: ${error instanceof Error ? error.message : 'Unknown'}`);
      }
    }

    this.emitFinancialDataUpdate(targetCompanyId, 'income_statement', recordsCreated);

    try {
      await reselect(targetCompanyId);
    } catch (reselectErr) {
      console.error('[FINANCIAL_DATA] reselect (income) failed (non-fatal):', reselectErr);
    }

    return {
      success: errors.length === 0,
      message: `Processed ${recordsCreated} income statement records`,
      recordsCreated,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  private async processBalanceSheet(
    data: any,
    targetCompanyId: number,
    sourceDocumentId?: number,
    documentCategory?: string,
    isIM: boolean = false,
    documentName?: string,
  ): Promise<ProcessingResult> {
    const errors: string[] = [];
    let recordsCreated = 0;

    const years = data.years || {};
    const periodType: PeriodType = data.source === 'statutory' ? 'statutory' : 'management';

    // Identify the primary year (highest fiscal year in this document); all others are comparatives
    const bsYearKeys = Object.keys(years).map(Number).filter(n => !isNaN(n));
    const bsPrimaryYear = data.years_covered
      ? Math.max(...(data.years_covered as number[]))
      : bsYearKeys.length > 0 ? Math.max(...bsYearKeys) : null;

    // Idempotent: drop existing balance contributions for this document before re-writing
    if (sourceDocumentId) {
      await db.delete(financialContributions).where(
        and(
          eq(financialContributions.sourceDocumentId, sourceDocumentId),
          eq(financialContributions.statementType, 'balance'),
        ),
      );
    }

    for (const [yearKey, yearData] of Object.entries(years)) {
      try {
        const fiscalYear = parseInt(yearKey);
        if (isNaN(fiscalYear)) continue;

        const periodEnd = this.inferPeriodEnd(data, yearKey) || `${fiscalYear}-12-31`;
        const bsIsPrimary = bsPrimaryYear === null || fiscalYear === bsPrimaryYear;
        const bsSpan = this.deriveSpan(data, yearKey, documentCategory, sourceDocumentId, 'balance_sheet', documentName);
        
        const bs = (yearData as any).balance_sheet || yearData;
        const fixedAssets = bs.fixed_assets || {};
        const currentAssets = bs.current_assets || {};
        const currentLiabilities = bs.current_liabilities || {};
        const longTermLiabilities = bs.long_term_liabilities || {};
        const equity = bs.equity || {};

        const bsFields = {
          intangibleAssets: this.parseDecimal(fixedAssets.intangible_assets),
          tangibleFixedAssets: this.parseDecimal(fixedAssets.tangible_assets || fixedAssets.total),
          freeholdProperty: this.parseDecimal(fixedAssets.freehold_property),
          leaseholdProperty: this.parseDecimal(fixedAssets.leasehold_property),
          plantMachinery: this.parseDecimal(fixedAssets.plant_machinery),
          fixturesFittings: this.parseDecimal(fixedAssets.fixtures_fittings),
          motorVehicles: this.parseDecimal(fixedAssets.motor_vehicles),
          computerEquipment: this.parseDecimal(fixedAssets.computer_equipment),
          stockInventory: this.parseDecimal(currentAssets.stock || currentAssets.inventory),
          tradeDebtors: this.parseDecimal(currentAssets.trade_debtors || currentAssets.receivables),
          prepayments: this.parseDecimal(currentAssets.prepayments),
          amountsOwedByDirectors: this.parseDecimal(currentAssets.amounts_owed_by_directors),
          amountsOwedByConnectedCompanies: this.parseDecimal(currentAssets.amounts_owed_by_connected_companies),
          directorsCurrentAccount: this.parseDecimal(currentAssets.directors_current_account),
          otherDebtors: this.parseDecimal(currentAssets.other_debtors),
          cashAtBank: this.parseDecimal(currentAssets.cash_at_bank || currentAssets.cash),
          totalCurrentAssets: this.parseDecimal(currentAssets.total),
          tradeCreditors: this.parseDecimal(currentLiabilities.trade_creditors || currentLiabilities.payables),
          taxationSocialSecurity: this.parseDecimal(currentLiabilities.taxation_social_security),
          vatPayable: this.parseDecimal(currentLiabilities.vat_payable),
          corporationTaxDue: this.parseDecimal(currentLiabilities.corporation_tax),
          bankLoansOverdraftCurrent: this.parseDecimal(currentLiabilities.bank_loans_current),
          hirePurchaseCurrent: this.parseDecimal(currentLiabilities.hire_purchase_current),
          accruals: this.parseDecimal(currentLiabilities.accruals),
          amountsOwedToDirectors: this.parseDecimal(currentLiabilities.amounts_owed_to_directors),
          otherCreditors: this.parseDecimal(currentLiabilities.other_creditors),
          totalCurrentLiabilities: this.parseDecimal(currentLiabilities.total),
          bankLoansLongTerm: this.parseDecimal(longTermLiabilities.bank_loans),
          hirePurchaseLongTerm: this.parseDecimal(longTermLiabilities.hire_purchase_long_term),
          deferredTaxation: this.parseDecimal(longTermLiabilities.deferred_taxation),
          otherLongTermDebt: this.parseDecimal(longTermLiabilities.other_debt),
          totalLongTermLiabilities: this.deriveLongTermLiabilitiesTotal(longTermLiabilities),
          shareCapital: this.parseDecimal(equity.share_capital),
          retainedEarnings: this.parseDecimal(equity.retained_earnings),
          totalEquity: this.parseDecimal(equity.total),
          debtorsList: currentAssets.debtors_list || null,
          creditorsList: currentLiabilities.creditors_list || null,
          fixedAssetsDetail: fixedAssets.detail || null,
          sourceDocumentId,
        };

        if (!this.hasAnyValue(bsFields)) {
          console.log(`[FINANCIAL_DATA] Skipping empty balance sheet for FY ${fiscalYear} (doc ${sourceDocumentId})`);
          continue;
        }

        if (!hasCoreBalanceValue(bsFields)) {
          console.log(`[FINANCIAL_DATA] Skipping no-core-BS balance sheet for FY ${fiscalYear} (doc ${sourceDocumentId}) — likely P&L artefact`);
          continue;
        }

        const period = await financialDataRepository.findOrCreateFinancialPeriod(
          targetCompanyId,
          periodType,
          periodEnd,
          { fiscalYear, periodLabel: `FY ${fiscalYear}`, labelPriority: 'financial', ...bsSpan, sourceDocumentId }
        );

        await financialDataRepository.upsertBalanceSheet(period.id, targetCompanyId, bsFields);

        // Append contribution to the append-only truth table
        await db.insert(financialContributions).values({
          targetCompanyId,
          fiscalYear,
          statementType: 'balance',
          sourceDocumentId: sourceDocumentId ?? null,
          sourceTier: contributionTier(periodType, documentCategory, isIM),
          isFullYear: bsSpan.isFullYear,
          isPrimaryYear: bsIsPrimary,
          monthsCovered: bsSpan.monthsCovered ?? null,
          periodEnd,
          asAtDate: null,
          figures: bsFields as any,
        });

        recordsCreated++;
        console.log(`[FINANCIAL_DATA] Created balance sheet for ${fiscalYear}`);
      } catch (yearError) {
        errors.push(`Failed to process balance sheet year ${yearKey}: ${yearError instanceof Error ? yearError.message : 'Unknown'}`);
      }
    }

    if (Object.keys(years).length === 0 && (data.balance_sheet || data.fixed_assets)) {
      try {
        const bs = data.balance_sheet || data;
        const fiscalYear = data.fiscal_year || new Date().getFullYear();
        const periodEnd = data.period_end || data.report_date || `${fiscalYear}-12-31`;
        
        const bsFallbackSpan = this.deriveSpan(data, String(fiscalYear), documentCategory, sourceDocumentId, 'balance_sheet', documentName);

        const fixedAssets = bs.fixed_assets || {};
        const currentAssets = bs.current_assets || {};
        const currentLiabilities = bs.current_liabilities || {};
        const longTermLiabilities = bs.long_term_liabilities || {};
        const equity = bs.equity || {};

        const bsFields = {
          intangibleAssets: this.parseDecimal(fixedAssets.intangible_assets),
          tangibleFixedAssets: this.parseDecimal(fixedAssets.tangible_assets),
          freeholdProperty: this.parseDecimal(fixedAssets.freehold_property),
          leaseholdProperty: this.parseDecimal(fixedAssets.leasehold_property),
          plantMachinery: this.parseDecimal(fixedAssets.plant_machinery),
          fixturesFittings: this.parseDecimal(fixedAssets.fixtures_fittings),
          motorVehicles: this.parseDecimal(fixedAssets.motor_vehicles),
          computerEquipment: this.parseDecimal(fixedAssets.computer_equipment),
          stockInventory: this.parseDecimal(currentAssets.stock),
          tradeDebtors: this.parseDecimal(currentAssets.trade_debtors),
          prepayments: this.parseDecimal(currentAssets.prepayments),
          amountsOwedByDirectors: this.parseDecimal(currentAssets.amounts_owed_by_directors),
          amountsOwedByConnectedCompanies: this.parseDecimal(currentAssets.amounts_owed_by_connected_companies),
          directorsCurrentAccount: this.parseDecimal(currentAssets.directors_current_account),
          otherDebtors: this.parseDecimal(currentAssets.other_debtors),
          cashAtBank: this.parseDecimal(currentAssets.cash_at_bank || currentAssets.cash),
          totalCurrentAssets: this.parseDecimal(currentAssets.total),
          tradeCreditors: this.parseDecimal(currentLiabilities.trade_creditors),
          taxationSocialSecurity: this.parseDecimal(currentLiabilities.taxation_social_security),
          vatPayable: this.parseDecimal(currentLiabilities.vat_payable),
          corporationTaxDue: this.parseDecimal(currentLiabilities.corporation_tax),
          bankLoansOverdraftCurrent: this.parseDecimal(currentLiabilities.bank_loans_current),
          hirePurchaseCurrent: this.parseDecimal(currentLiabilities.hire_purchase_current),
          accruals: this.parseDecimal(currentLiabilities.accruals),
          amountsOwedToDirectors: this.parseDecimal(currentLiabilities.amounts_owed_to_directors),
          otherCreditors: this.parseDecimal(currentLiabilities.other_creditors),
          totalCurrentLiabilities: this.parseDecimal(currentLiabilities.total),
          bankLoansLongTerm: this.parseDecimal(longTermLiabilities.bank_loans),
          hirePurchaseLongTerm: this.parseDecimal(longTermLiabilities.hire_purchase_long_term),
          deferredTaxation: this.parseDecimal(longTermLiabilities.deferred_taxation),
          otherLongTermDebt: this.parseDecimal(longTermLiabilities.other_debt),
          totalLongTermLiabilities: this.deriveLongTermLiabilitiesTotal(longTermLiabilities),
          shareCapital: this.parseDecimal(equity.share_capital),
          retainedEarnings: this.parseDecimal(equity.retained_earnings),
          totalEquity: this.parseDecimal(equity.total),
          sourceDocumentId,
        };

        if (!this.hasAnyValue(bsFields)) {
          console.log(`[FINANCIAL_DATA] Skipping empty balance sheet for FY ${fiscalYear} (doc ${sourceDocumentId})`);
          return { success: true, message: `Skipped empty balance sheet for FY ${fiscalYear}`, recordsCreated: 0 };
        }

        if (!hasCoreBalanceValue(bsFields)) {
          console.log(`[FINANCIAL_DATA] Skipping no-core-BS balance sheet for FY ${fiscalYear} (doc ${sourceDocumentId}) — likely P&L artefact`);
          return { success: true, message: `Skipped no-core-BS balance sheet for FY ${fiscalYear}`, recordsCreated: 0 };
        }

        const period = await financialDataRepository.findOrCreateFinancialPeriod(
          targetCompanyId,
          'management',
          periodEnd,
          { fiscalYear, periodLabel: `FY ${fiscalYear}`, labelPriority: 'financial', ...bsFallbackSpan, sourceDocumentId }
        );

        await financialDataRepository.upsertBalanceSheet(period.id, targetCompanyId, bsFields);

        // Append contribution for fallback single-year path
        await db.insert(financialContributions).values({
          targetCompanyId,
          fiscalYear,
          statementType: 'balance',
          sourceDocumentId: sourceDocumentId ?? null,
          sourceTier: contributionTier(periodType, documentCategory, isIM),
          isFullYear: bsFallbackSpan.isFullYear,
          isPrimaryYear: true,
          monthsCovered: bsFallbackSpan.monthsCovered ?? null,
          periodEnd,
          asAtDate: null,
          figures: bsFields as any,
        });

        recordsCreated++;
      } catch (error) {
        errors.push(`Failed to process single balance sheet: ${error instanceof Error ? error.message : 'Unknown'}`);
      }
    }

    this.emitFinancialDataUpdate(targetCompanyId, 'balance_sheet', recordsCreated);

    try {
      await reselect(targetCompanyId);
    } catch (reselectErr) {
      console.error('[FINANCIAL_DATA] reselect (balance) failed (non-fatal):', reselectErr);
    }

    return {
      success: errors.length === 0,
      message: `Processed ${recordsCreated} balance sheet records`,
      recordsCreated,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  private async processStaffMatrix(
    data: any,
    targetCompanyId: number,
    sourceDocumentId?: number,
    _documentCategory?: string
  ): Promise<ProcessingResult> {
    try {
      const reportDate = data.report_date || data.period_end || new Date().toISOString().split('T')[0];
      const fiscalYear = data.fiscal_year || new Date().getFullYear();

      const period = await financialDataRepository.findOrCreateFinancialPeriod(
        targetCompanyId,
        'management',
        reportDate,
        { fiscalYear, periodLabel: 'Staff Matrix', labelPriority: 'weak', monthsCovered: null, isFullYear: false, sourceDocumentId }
      );

      const summary = data.summary || data;
      const staff = data.staff || data.employees || [];

      await financialDataRepository.upsertStaffData(period.id, targetCompanyId, {
        totalHeadcount: summary.total_headcount || staff.length || null,
        totalStaffCosts: this.parseDecimal(summary.total_staff_costs || summary.total_cost),
        totalGrossSalaries: this.parseDecimal(summary.total_gross_salaries),
        totalEmployerNi: this.parseDecimal(summary.total_employer_ni),
        totalEmployerPension: this.parseDecimal(summary.total_employer_pension),
        directorCount: summary.director_count || null,
        directorRemuneration: this.parseDecimal(summary.director_remuneration),
        workingDirectorCount: summary.working_director_count || null,
        nonWorkingDirectorCount: summary.non_working_director_count || null,
        employeeCount: summary.employee_count || null,
        employeeCosts: this.parseDecimal(summary.employee_costs),
        staffRecords: staff.length > 0 ? staff : null,
        sourceDocumentId,
      });

      this.emitFinancialDataUpdate(targetCompanyId, 'staff_data', 1);

      return {
        success: true,
        message: 'Processed staff matrix data',
        recordsCreated: 1,
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to process staff matrix',
        errors: [error instanceof Error ? error.message : 'Unknown error'],
      };
    }
  }

  private async processSalesLedger(
    data: any,
    targetCompanyId: number,
    sourceDocumentId?: number
  ): Promise<ProcessingResult> {
    try {
      const reportDate = data.report_date || data.as_at_date || new Date().toISOString().split('T')[0];
      
      const aging = data.aging || data.aged_analysis || {};
      const summary = data.summary || data;

      await financialDataRepository.upsertAgedDebtors(targetCompanyId, reportDate, {
        totalTradeDebtors: this.parseDecimal(summary.total_trade_debtors || summary.total),
        current0To30: this.parseDecimal(aging.current || aging['0_30'] || aging.current_0_to_30),
        days31To60: this.parseDecimal(aging['31_60'] || aging.days_31_to_60),
        days61To90: this.parseDecimal(aging['61_90'] || aging.days_61_to_90),
        days90Plus: this.parseDecimal(aging['90_plus'] || aging.days_90_plus || aging.over_90),
        badDebtProvision: this.parseDecimal(summary.bad_debt_provision),
        doubtfulDebts: this.parseDecimal(summary.doubtful_debts),
        recentRevenue: this.parseDecimal(summary.recent_revenue),
        debtorDays: this.parseDecimal(summary.debtor_days),
        topDebtors: data.top_debtors || data.largest_debtors || null,
        sourceDocumentId,
      });

      this.emitFinancialDataUpdate(targetCompanyId, 'aged_debtors', 1);

      return {
        success: true,
        message: 'Processed aged debtors data',
        recordsCreated: 1,
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to process sales ledger',
        errors: [error instanceof Error ? error.message : 'Unknown error'],
      };
    }
  }

  private async processAssetRegister(
    data: any,
    targetCompanyId: number,
    sourceDocumentId?: number
  ): Promise<ProcessingResult> {
    try {
      const reportDate = data.report_date || data.as_at_date || new Date().toISOString().split('T')[0];
      
      const summary = data.summary || data;
      const categories = data.categories || {};

      await financialDataRepository.upsertFixedAssetsRegister(targetCompanyId, reportDate, {
        totalGrossBookValue: this.parseDecimal(summary.total_gross_book_value || summary.total_cost),
        totalAccumulatedDepreciation: this.parseDecimal(summary.total_accumulated_depreciation),
        totalNetBookValue: this.parseDecimal(summary.total_net_book_value || summary.total_nbv),
        propertyGrossValue: this.parseDecimal(categories.property?.gross_value),
        propertyNetBookValue: this.parseDecimal(categories.property?.net_book_value),
        plantMachineryGrossValue: this.parseDecimal(categories.plant_machinery?.gross_value),
        plantMachineryNetBookValue: this.parseDecimal(categories.plant_machinery?.net_book_value),
        vehiclesGrossValue: this.parseDecimal(categories.vehicles?.gross_value),
        vehiclesNetBookValue: this.parseDecimal(categories.vehicles?.net_book_value),
        itEquipmentGrossValue: this.parseDecimal(categories.it_equipment?.gross_value || categories.computer_equipment?.gross_value),
        itEquipmentNetBookValue: this.parseDecimal(categories.it_equipment?.net_book_value || categories.computer_equipment?.net_book_value),
        otherAssetsGrossValue: this.parseDecimal(categories.other?.gross_value),
        otherAssetsNetBookValue: this.parseDecimal(categories.other?.net_book_value),
        refinanceableAssetsValue: this.parseDecimal(summary.refinanceable_assets_value),
        fullyDepreciatedStillInUse: this.parseDecimal(summary.fully_depreciated_still_in_use),
        assetItems: data.assets || data.asset_items || null,
        propertyDetails: data.property_details || null,
        vehicleDetails: data.vehicle_details || null,
        sourceDocumentId,
      });

      this.emitFinancialDataUpdate(targetCompanyId, 'fixed_assets', 1);

      return {
        success: true,
        message: 'Processed fixed assets register',
        recordsCreated: 1,
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to process asset register',
        errors: [error instanceof Error ? error.message : 'Unknown error'],
      };
    }
  }

  private async processCompanyAccounts(
    data: any,
    targetCompanyId: number,
    sourceDocumentId?: number,
    documentCategory?: string,
    isIM: boolean = false,
    documentName?: string,
  ): Promise<ProcessingResult> {
    const results: ProcessingResult[] = [];

    if (data.profit_and_loss || data.years) {
      const plResult = await this.processProfitAndLoss(
        { ...data, source: 'statutory' },
        targetCompanyId,
        sourceDocumentId,
        documentCategory,
        isIM,
        documentName,
      );
      results.push(plResult);
    }

    if (data.balance_sheet || (data.years && Object.values(data.years).some((y: any) => y.balance_sheet))) {
      const bsResult = await this.processBalanceSheet(
        { ...data, source: 'statutory' },
        targetCompanyId,
        sourceDocumentId,
        documentCategory,
        isIM,
        documentName,
      );
      results.push(bsResult);
    }

    const totalRecords = results.reduce((sum, r) => sum + (r.recordsCreated || 0), 0);
    const allErrors = results.flatMap(r => r.errors || []);

    return {
      success: allErrors.length === 0,
      message: `Processed company accounts: ${totalRecords} records created`,
      recordsCreated: totalRecords,
      errors: allErrors.length > 0 ? allErrors : undefined,
    };
  }

  /** Round a computed money figure to pence. Removes binary float error introduced by
   *  summing decimal inputs. Not a rounding of the source figures themselves. */
  private toMoney(n: number): string {
    return (Math.round(n * 100) / 100).toString();
  }

  /**
   * CONTRACT 1 — `long_term_liabilities.total` holds the printed "Creditors: amounts
   * falling due after more than one year" line. Provisions for liabilities, including
   * deferred taxation, sit OUTSIDE it.
   * See claude/CONTRACT-field-composition.md.
   *
   * Measured read-only 20 Aug 2026: 82 of 82 dev periods and 32 of 32 prod periods that
   * carry a non-zero deferred taxation figure have it folded INSIDE the extracted total.
   * already_outside and neither were both zero on both databases.
   *
   * Derived by SUBTRACTION, never by summing the children. A note listing only some
   * categories would make a children-sum understate the total, which is the failure mode
   * already documented in the BS6 comment in shared/utils/evidence-mapper.ts. Across all
   * 114 affected rows, extracted_total minus deferred equals the children sum exactly.
   *
   * Subtracts ONLY where the fold is demonstrably present. Every other shape is returned
   * unchanged. This method never guesses.
   */
  private deriveLongTermLiabilitiesTotal(ltl: any): string | null {
    const extracted = this.parseDecimal(ltl?.total);
    if (extracted === null) return null;

    const deferredStr = this.parseDecimal(ltl?.deferred_taxation);
    if (deferredStr === null) return extracted;

    const total = Number(extracted);
    const deferred = Number(deferredStr);
    if (!Number.isFinite(total) || !Number.isFinite(deferred) || deferred === 0) {
      return extracted;
    }

    let children = 0;
    for (const key of ['bank_loans', 'hire_purchase_long_term', 'other_debt']) {
      const v = this.parseDecimal(ltl?.[key]);
      if (v === null) continue;
      const n = Number(v);
      if (Number.isFinite(n)) children += n;
    }

    const tolerance = Math.max(1, Math.abs(total) * 0.0001);

    // Fold present: total === children + deferred. Remove the provision.
    if (Math.abs(total - (children + deferred)) <= tolerance) {
      return this.toMoney(total - deferred);
    }

    // Already correct (total === children), or a shape we do not recognise.
    // Do not guess. BS4b will flag the unrecognised case in apply 2.
    return extracted;
  }

  /**
   * CONTRACT 3 — staff_costs = staff wages and salaries + employer's national insurance
   * + staff pension contributions. Excludes staff training and recruitment. Excludes
   * directors' remuneration, which stays counted inside administrative_expenses via
   * overheads_breakdown.directors_salaries.
   * See claude/CONTRACT-field-composition.md.
   *
   * This is already the P&L prompt's own definition. The extracted aggregate follows it
   * in only 4 of 10 observed cases and produces three different formulas over the same
   * four components, including two different answers from md5-identical input. Every
   * component is read correctly every time, so the aggregate is derived rather than
   * extracted, per item 432.
   *
   * Requires ALL THREE components. A document carrying only some of them would produce an
   * understated sum, so the extracted aggregate is kept in that case.
   */
  private deriveStaffCosts(yd: any, pl: any): string | null {
    const extracted = this.parseDecimal(yd?.total_staff_costs || pl?.total_staff_costs);

    const overheads = yd?.overheads_breakdown || pl?.overheads_breakdown || null;
    if (!overheads || typeof overheads !== 'object') return extracted;

    const read = (key: string): number | null => {
      const v = this.parseDecimal((overheads as any)[key]);
      if (v === null) return null;
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    };

    const wages    = read('staff_wages_salaries');
    const ni       = read('employers_national_insurance');
    const pension  = read('staff_pension_contributions');
    const training = read('staff_training_recruitment');

    if (wages === null || ni === null || pension === null) return extracted;

    // A breakdown reporting zero wages is not describing a payroll. Prod row 1036 has
    // wages 0, NI 0, pension 0 against a stored 519,174; deriving from it would write 0.
    // parseDecimal(0) returns "0", not null, so a null check alone does not catch this.
    if (wages <= 0) return extracted;

    const contract = this.toMoney(wages + ni + pension);

    // Nothing stored: deriving adds information rather than overwriting it.
    if (extracted === null) return contract;

    const stored = Number(extracted);
    if (!Number.isFinite(stored)) return contract;

    const tol = Math.max(1, Math.abs(stored) * 0.0001);
    const near = (candidate: number) => Math.abs(stored - candidate) <= tol;

    // Overwrite ONLY where the stored aggregate matches a formula we can name.
    // Measured on prod 20 Aug: of 119 would-change rows, 51 include training, 22 drop
    // employer's NI, and 46 match NOTHING. Those 46 are not understood, so they are left
    // alone and surface as a cross-source conflict at step 3 rather than being rewritten.
    const t = training === null ? 0 : training;
    const includesTraining = near(wages + ni + pension + t);
    const niDropped        = near(wages + pension + t);

    if (includesTraining || niDropped) return contract;

    return extracted;
  }

  private parseDecimal(value: any): string | null {
    if (value === null || value === undefined || value === '') return null;
    if (typeof value === 'number') return value.toString();
    if (typeof value === 'string') {
      const cleaned = value.replace(/[£$,\s]/g, '');
      const parsed = parseFloat(cleaned);
      return isNaN(parsed) ? null : parsed.toString();
    }
    return null;
  }

  private inferPeriodEnd(data: any, yearKey: string): string | null {
    if (data.period_ends && data.period_ends[yearKey]) {
      return data.period_ends[yearKey];
    }
    if (data.period_end) {
      return data.period_end;
    }
    return null;
  }

  private emitFinancialDataUpdate(targetCompanyId: number, dataType: string, recordCount: number): void {
    eventBus.emit('financial_data:update', {
      targetCompanyId,
      dataType,
      recordCount,
      timestamp: new Date(),
    });
  }

  async getFinancialSummary(targetCompanyId: number) {
    const [summary, contributions] = await Promise.all([
      financialDataRepository.getFinancialSummary(targetCompanyId),
      db.select({ sourceTier: financialContributions.sourceTier })
        .from(financialContributions)
        .where(eq(financialContributions.targetCompanyId, targetCompanyId)),
    ]);
    return {
      ...summary,
      isProvisionalFinancials: isProvisionalFinancials(contributions),
    };
  }

  calculateEBITDA(incomeStatement: {
    operatingProfit?: string | null;
    depreciationAmortisation?: string | null;
  }): number | null {
    const operatingProfit = parseFloat(incomeStatement.operatingProfit || '0');
    const depreciation = parseFloat(incomeStatement.depreciationAmortisation || '0');
    
    if (isNaN(operatingProfit)) return null;
    
    // D&A is economically non-negative; abs() normalises credit-balance sign
    // convention from extraction (see tc=220 FY2026, tc=219 FY2024).
    return operatingProfit + (isNaN(depreciation) ? 0 : Math.abs(depreciation));
  }

  calculateGrossMargin(incomeStatement: {
    grossProfit?: string | null;
    revenue?: string | null;
  }): number | null {
    const grossProfit = parseFloat(incomeStatement.grossProfit || '0');
    const revenue = parseFloat(incomeStatement.revenue || '0');
    
    if (isNaN(grossProfit) || isNaN(revenue) || revenue === 0) return null;
    
    return (grossProfit / revenue) * 100;
  }

  calculateNetMargin(incomeStatement: {
    netProfit?: string | null;
    revenue?: string | null;
  }): number | null {
    const netProfit = parseFloat(incomeStatement.netProfit || '0');
    const revenue = parseFloat(incomeStatement.revenue || '0');
    
    if (isNaN(netProfit) || isNaN(revenue) || revenue === 0) return null;
    
    return (netProfit / revenue) * 100;
  }

  calculate3YearAverage(values: (string | null | undefined)[]): number | null {
    const numericValues = values
      .map(v => parseFloat(v || '0'))
      .filter(v => !isNaN(v));
    
    if (numericValues.length === 0) return null;
    
    return numericValues.reduce((a, b) => a + b, 0) / numericValues.length;
  }
}

export const financialDataService = new FinancialDataService();
