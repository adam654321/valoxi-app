import { eq, and, desc } from 'drizzle-orm';
import { db } from '../db';
import {
  expertAnalysisResults,
  dealModels,
  dealModelAdjustments,
  dealModelFundingLines,
  balanceSheets,
  incomeStatements,
  fixedAssetsRegister,
  financialPeriods,
  type DealModel,
  type InsertDealModel,
  type ExpertAnalysisResult,
} from '@shared/schema';

const CATEGORY_MAP: Record<string, string> = {
  owner_salary: 'owner_salary_excess',
  one_off_cost: 'one_off_cost',
  personal_expense: 'personal_expense',
  related_party: 'related_party',
  redundant_cost: 'redundant_cost',
  replacement_salary: 'replacement_salary',
  missing_management: 'missing_management',
  deferred_maintenance: 'deferred_maintenance',
  unsustainable_revenue: 'unsustainable_revenue',
  bad_debt_provision: 'bad_debt_provision',
};

function mapCategory(rawCategory: string | undefined, fallback: string): string {
  if (!rawCategory) return fallback;
  const normalised = rawCategory.toLowerCase().replace(/\s+/g, '_');
  return CATEGORY_MAP[normalised] || fallback;
}

function toDecimalString(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined;
  const num = Number(value);
  if (isNaN(num)) return undefined;
  return String(num);
}

export class DealModelMappingService {
  async createDealModelFromExperts(
    targetCompanyId: number,
    createdBy: number,
    userCompanyId: number,
    modelName?: string
  ): Promise<DealModel> {
    console.log(`[DEAL_MODEL_MAPPING] Starting deal model creation for company ${targetCompanyId}`);

    const expertResults = await db
      .select()
      .from(expertAnalysisResults)
      .where(
        and(
          eq(expertAnalysisResults.targetCompanyId, targetCompanyId),
          eq(expertAnalysisResults.status, 'success')
        )
      )
      .orderBy(desc(expertAnalysisResults.createdAt));

    const expertsByType: Record<string, ExpertAnalysisResult> = {};
    for (const result of expertResults) {
      if (!expertsByType[result.expertType]) {
        expertsByType[result.expertType] = result;
      }
    }

    if (!expertsByType['qoe'] || !expertsByType['valuation']) {
      throw new Error('Expert analysis must be completed first. Both QoE and Valuation experts are required.');
    }

    console.log(`[DEAL_MODEL_MAPPING] Found completed experts: ${Object.keys(expertsByType).join(', ')}`);

    let qoeData: Record<string, any> = {};
    let valuationData: Record<string, any> = {};
    let dealStructureData: Record<string, any> = {};
    let financialData: Record<string, any> = {};

    try { qoeData = (expertsByType['qoe'].analysisData as Record<string, any>) || {}; } catch { qoeData = {}; }
    try { valuationData = (expertsByType['valuation'].analysisData as Record<string, any>) || {}; } catch { valuationData = {}; }
    try { dealStructureData = expertsByType['deal_structure'] ? (expertsByType['deal_structure'].analysisData as Record<string, any>) || {} : {}; } catch { dealStructureData = {}; }
    try { financialData = expertsByType['financial'] ? (expertsByType['financial'].analysisData as Record<string, any>) || {} : {}; } catch { financialData = {}; }

    const existingModels = await db
      .select({ version: dealModels.version })
      .from(dealModels)
      .where(eq(dealModels.targetCompanyId, targetCompanyId))
      .orderBy(desc(dealModels.version))
      .limit(1);

    const nextVersion = existingModels.length > 0 && existingModels[0].version
      ? existingModels[0].version + 1
      : 1;

    const modelValues: Partial<InsertDealModel> & Pick<InsertDealModel, 'targetCompanyId' | 'createdBy' | 'name'> = {
      targetCompanyId,
      createdBy,
      name: modelName || `Deal Model v${nextVersion}`,
      status: 'draft',
      version: nextVersion,
      isLocked: false,
      averagingYears: 3,
    };

    try {
      const multiples = valuationData?.ebitda_multiple_valuation;
      if (multiples) {
        modelValues.ebitdaMultiple = toDecimalString(multiples.selected_multiple);
        modelValues.multipleLow = toDecimalString(multiples.sector_multiple_range?.low);
        modelValues.multipleHigh = toDecimalString(multiples.sector_multiple_range?.high);
      }

      const bridge = valuationData?.ev_to_equity_bridge;
      if (bridge) {
        modelValues.plusExcessCash = toDecimalString(bridge.plus_cash);
        modelValues.minusPrimaryDebt = toDecimalString(bridge.minus_long_term_debt);
        modelValues.minusOtherDebt = toDecimalString(bridge.minus_director_loans);
        modelValues.minusWorkingCapitalAdj = toDecimalString(bridge.minus_working_capital_adjustment);
      }

      const adjustedEbitdaBase = valuationData?.ebitda_multiple_valuation?.adjusted_ebitda_base;
      if (adjustedEbitdaBase) {
        modelValues.adjustedEbitda = toDecimalString(adjustedEbitdaBase);
      } else {
        const qoeAdjusted = qoeData?.adjusted_ebitda?.base;
        if (qoeAdjusted) {
          modelValues.adjustedEbitda = toDecimalString(qoeAdjusted);
        }
      }

      const evBase = valuationData?.ebitda_multiple_valuation?.enterprise_value_range?.base;
      if (evBase) {
        modelValues.enterpriseValue = toDecimalString(evBase);
      }

      console.log(`[DEAL_MODEL_MAPPING] Mapped valuation data: multiple=${modelValues.ebitdaMultiple}, adjustedEbitda=${modelValues.adjustedEbitda}`);
    } catch (err) {
      console.log(`[DEAL_MODEL_MAPPING] Warning: Error parsing valuation data, using defaults`, err);
    }

    try {
      if (dealStructureData?.structures && Array.isArray(dealStructureData.structures)) {
        const balanced = dealStructureData.structures.find((s: any) => {
          const name = (s.name || '').toLowerCase();
          return name.includes('balanced') || name.includes('moderate');
        });

        if (balanced?.consideration) {
          const c = balanced.consideration;
          modelValues.upfrontCash = toDecimalString(c.upfront_cash);
          modelValues.deferredAmount = toDecimalString(c.deferred ?? c.deferred_amount);
          modelValues.deferredTerms = c.deferred_schedule || undefined;
          modelValues.earnoutMaximum = toDecimalString(c.earnout_maximum);
          modelValues.earnoutMetric = c.earnout_metric || undefined;
          modelValues.earnoutPeriodMonths = c.earnout_period_months != null ? Number(c.earnout_period_months) : undefined;
          modelValues.retentionEscrow = toDecimalString(c.retention_escrow);
          console.log(`[DEAL_MODEL_MAPPING] Mapped deal structure: upfront=${modelValues.upfrontCash}, deferred=${modelValues.deferredAmount}`);
        } else {
          console.log(`[DEAL_MODEL_MAPPING] No balanced/moderate structure found in deal structure data`);
        }
      }
    } catch (err) {
      console.log(`[DEAL_MODEL_MAPPING] Warning: Error parsing deal structure data`, err);
    }

    modelValues.feeLegalDdPercent = '25000';
    modelValues.feeLegalDdType = 'fixed';
    modelValues.feeAccountingDdPercent = '15000';
    modelValues.feeAccountingDdType = 'fixed';
    modelValues.feeBrokerPercent = '2.0';
    modelValues.feeBrokerType = 'percent';
    modelValues.feeLoanArrangementPercent = '1.0';
    modelValues.feeLoanArrangementType = 'percent';
    modelValues.feeDealMakerPercent = '5.0';
    modelValues.feeDealMakerType = 'percent';

    const latestBalance = await this.getLatestBalanceSheet(targetCompanyId);
    const latestAssets = await this.getLatestFixedAssets(targetCompanyId);
    const latestIncome = await this.getLatestIncomeStatement(targetCompanyId);

    if (latestBalance?.corporationTaxDue) {
      modelValues.minusCorpTaxDue = String(latestBalance.corporationTaxDue);
    }

    if (latestIncome) {
      const cos = Number(latestIncome.costOfSales) || 0;
      const admin = Number(latestIncome.administrativeExpenses) || 0;
      const annualOpex = Math.abs(cos) + Math.abs(admin);
      if (annualOpex > 0) {
        const monthlyAmount = Math.round(annualOpex / 12);
        modelValues.workingCapitalMonthlyAmount = String(monthlyAmount);
        modelValues.workingCapitalMonths = 3;
        modelValues.minusWorkingCapitalAdj = String(monthlyAmount * 3);
        console.log(`[DEAL_MODEL_MAPPING] Working capital: monthly=${monthlyAmount}, total=${monthlyAmount * 3} (from COS=${cos}, Admin=${admin})`);
      }
    }

    modelValues.expertDataSnapshot = {
      qoe: qoeData,
      valuation: valuationData,
      deal_structure: dealStructureData,
      financial: financialData,
    };
    modelValues.financialDataSnapshot = {
      balanceSheet: latestBalance || null,
      fixedAssets: latestAssets || null,
    };

    const [dealModel] = await db
      .insert(dealModels)
      .values(modelValues)
      .returning();

    console.log(`[DEAL_MODEL_MAPPING] Created deal model id=${dealModel.id}`);

    const qoeResultId = expertsByType['qoe'].id;

    const availableYears = await this.getAvailableFiscalYears(targetCompanyId);
    await this.createAdjustmentsFromQoE(dealModel.id, qoeData, qoeResultId, availableYears);

    await this.createFundingLineSeeds(dealModel.id, targetCompanyId, latestBalance, latestAssets);

    console.log(`[DEAL_MODEL_MAPPING] Deal model creation complete for company ${targetCompanyId}, model id=${dealModel.id}`);

    return dealModel;
  }

  private async createAdjustmentsFromQoE(
    dealModelId: number,
    qoeData: Record<string, any>,
    qoeResultId: number,
    availableYears: string[]
  ): Promise<void> {
    let sortOrder = 0;
    const processedAdjustmentKeys = new Set<string>();

    try {
      const addBacks = qoeData?.add_backs;
      if (Array.isArray(addBacks)) {
        for (const item of addBacks) {
          if (!item || item.amount == null) continue;
          const amount = Number(item.amount);
          if (isNaN(amount) || amount === 0) continue;

          let amountsByYear: Record<string, number> | undefined = undefined;
          if ((item.recurrence === 'one_off' || item.category === 'one_off_cost') && item.year && availableYears.length > 0) {
            amountsByYear = {};
            for (const y of availableYears) {
              amountsByYear[y] = y === String(item.year) ? amount : 0;
            }
          }

          await db.insert(dealModelAdjustments).values({
            dealModelId,
            sourceExpertResultId: qoeResultId,
            adjustmentType: 'add_back',
            category: mapCategory(item.category, 'one_off_cost'),
            description: item.item || item.description || 'Add-back',
            amount: String(amount),
            amountsByYear: amountsByYear ?? undefined,
            sourceExpert: 'qoe',
            reasoning: item.justification || item.reasoning || undefined,
            confidence: item.confidence || undefined,
            defensibilityScore: typeof item.defensibility_score === 'number' ? item.defensibility_score : undefined,
            caseForInclusion: item.case_for_inclusion || undefined,
            caseForExclusion: item.case_for_exclusion || undefined,
            status: 'suggested',
            isAccepted: false,
            isManual: false,
            sortOrder: sortOrder++,
          });
          processedAdjustmentKeys.add(`add_back:${mapCategory(item.category, 'one_off_cost')}:${amount}`);
        }
        console.log(`[DEAL_MODEL_MAPPING] Created ${addBacks.length} add-back adjustments`);
      }
    } catch (err) {
      console.log(`[DEAL_MODEL_MAPPING] Warning: Error creating add-back adjustments`, err);
    }

    try {
      const deductions = qoeData?.deductions;
      if (Array.isArray(deductions)) {
        for (const item of deductions) {
          if (!item || item.amount == null) continue;
          const amount = Number(item.amount);
          if (isNaN(amount) || amount === 0) continue;

          let amountsByYear: Record<string, number> | undefined = undefined;
          if ((item.recurrence === 'one_off' || item.category === 'one_off_cost') && item.year && availableYears.length > 0) {
            amountsByYear = {};
            for (const y of availableYears) {
              amountsByYear[y] = y === String(item.year) ? amount : 0;
            }
          }

          await db.insert(dealModelAdjustments).values({
            dealModelId,
            sourceExpertResultId: qoeResultId,
            adjustmentType: 'deduction',
            category: mapCategory(item.category, 'replacement_salary'),
            description: item.item || item.description || 'Deduction',
            amount: String(amount),
            amountsByYear: amountsByYear ?? undefined,
            sourceExpert: 'qoe',
            reasoning: item.justification || item.reasoning || undefined,
            confidence: item.confidence || undefined,
            defensibilityScore: typeof item.defensibility_score === 'number' ? item.defensibility_score : undefined,
            caseForInclusion: item.case_for_inclusion || undefined,
            caseForExclusion: item.case_for_exclusion || undefined,
            status: 'suggested',
            isAccepted: false,
            isManual: false,
            sortOrder: sortOrder++,
          });
          processedAdjustmentKeys.add(`deduction:${mapCategory(item.category, 'replacement_salary')}:${amount}`);
        }
        console.log(`[DEAL_MODEL_MAPPING] Created ${deductions.length} deduction adjustments`);
      }
    } catch (err) {
      console.log(`[DEAL_MODEL_MAPPING] Warning: Error creating deduction adjustments`, err);
    }

    try {
      const directorAnalysis = qoeData?.director_salary_analysis?.directors;
      if (Array.isArray(directorAnalysis)) {
        for (const director of directorAnalysis) {
          if (!director) continue;

          const currentSalary = Number(director.current_salary);
          const marketRate = Number(director.estimated_market_rate);
          if (isNaN(currentSalary) || isNaN(marketRate) || currentSalary === marketRate) continue;

          const diff = Math.abs(currentSalary - marketRate);
          if (diff === 0) continue;

          const adjType = currentSalary > marketRate ? 'add_back' : 'deduction';
          const adjCategory = currentSalary > marketRate ? 'owner_salary_excess' : 'replacement_salary';
          const dupKey = `${adjType}:${adjCategory}:${diff}`;
          if (processedAdjustmentKeys.has(dupKey)) {
            console.log(`[DEAL_MODEL_MAPPING] Skipping duplicate director salary adjustment: amount=${diff}, category=${adjCategory}`);
            continue;
          }

          if (currentSalary > marketRate) {
            await db.insert(dealModelAdjustments).values({
              dealModelId,
              sourceExpertResultId: qoeResultId,
              adjustmentType: 'add_back',
              category: 'owner_salary_excess',
              description: `Director salary adjustment: ${director.name || 'Director'} (current: ${currentSalary}, market: ${marketRate})`,
              amount: String(diff),
              sourceExpert: 'qoe',
              reasoning: `Director ${director.name || ''} current salary exceeds estimated market rate`,
              confidence: 'medium',
              defensibilityScore: 6,
              caseForInclusion: `Director compensation of £${currentSalary.toLocaleString()} differs from the UK SME market rate of £${marketRate.toLocaleString()} for this role and company size.`,
              caseForExclusion: `Market rate estimates are benchmarks, not exact figures. The seller may argue the director's specific skills or responsibilities justify their current compensation.`,
              status: 'suggested',
              isAccepted: false,
              isManual: false,
              sortOrder: sortOrder++,
            });
          } else {
            await db.insert(dealModelAdjustments).values({
              dealModelId,
              sourceExpertResultId: qoeResultId,
              adjustmentType: 'deduction',
              category: 'replacement_salary',
              description: `Director replacement cost: ${director.name || 'Director'} (current: ${currentSalary}, market: ${marketRate})`,
              amount: String(diff),
              sourceExpert: 'qoe',
              reasoning: `Director ${director.name || ''} current salary is below market rate; replacement would cost more`,
              confidence: 'medium',
              defensibilityScore: 6,
              caseForInclusion: `Director compensation of £${currentSalary.toLocaleString()} differs from the UK SME market rate of £${marketRate.toLocaleString()} for this role and company size.`,
              caseForExclusion: `Market rate estimates are benchmarks, not exact figures. The seller may argue the director's specific skills or responsibilities justify their current compensation.`,
              status: 'suggested',
              isAccepted: false,
              isManual: false,
              sortOrder: sortOrder++,
            });
          }
        }
        console.log(`[DEAL_MODEL_MAPPING] Processed ${directorAnalysis.length} director salary adjustments`);
      }
    } catch (err) {
      console.log(`[DEAL_MODEL_MAPPING] Warning: Error creating director salary adjustments`, err);
    }
  }

  private async createFundingLineSeeds(
    dealModelId: number,
    targetCompanyId: number,
    latestBalance: Record<string, any> | null,
    latestAssets: Record<string, any> | null
  ): Promise<void> {
    let sortOrder = 0;

    try {
      if (latestBalance?.tradeDebtors) {
        const tradeDebtors = Number(latestBalance.tradeDebtors);
        if (!isNaN(tradeDebtors) && tradeDebtors > 0) {
          const available = tradeDebtors * 0.8;
          await db.insert(dealModelFundingLines).values({
            dealModelId,
            fundingType: 'receivables_finance',
            label: 'Receivables Finance (Invoice Factoring)',
            assetBaseValue: String(tradeDebtors),
            ltvPercent: '80',
            availableAmount: String(Math.round(available)),
            amountUsed: '0',
            interestRate: '4.5',
            termMonths: 0,
            isDebt: true,
            isActive: false,
            sortOrder: sortOrder++,
          });
          console.log(`[DEAL_MODEL_MAPPING] Created receivables_finance line: base=${tradeDebtors}, available=${Math.round(available)}`);
        }
      }
    } catch (err) {
      console.log(`[DEAL_MODEL_MAPPING] Warning: Error creating receivables finance line`, err);
    }

    try {
      if (latestAssets) {
        const plantNBV = Number(latestAssets.plantMachineryNetBookValue) || 0;
        const vehiclesNBV = Number(latestAssets.vehiclesNetBookValue) || 0;
        const assetTotal = plantNBV + vehiclesNBV;

        if (assetTotal > 0) {
          const available = assetTotal * 0.6;
          await db.insert(dealModelFundingLines).values({
            dealModelId,
            fundingType: 'asset_finance',
            label: 'Asset Finance (Plant, Machinery & Vehicles)',
            assetBaseValue: String(assetTotal),
            ltvPercent: '60',
            availableAmount: String(Math.round(available)),
            amountUsed: '0',
            interestRate: '6.0',
            termMonths: 60,
            isDebt: true,
            isActive: false,
            sortOrder: sortOrder++,
          });
          console.log(`[DEAL_MODEL_MAPPING] Created asset_finance line: base=${assetTotal}, available=${Math.round(available)}`);
        }
      }
    } catch (err) {
      console.log(`[DEAL_MODEL_MAPPING] Warning: Error creating asset finance line`, err);
    }

    try {
      if (latestAssets?.propertyNetBookValue) {
        const propNBV = Number(latestAssets.propertyNetBookValue);
        if (!isNaN(propNBV) && propNBV > 0) {
          const available = propNBV * 0.65;
          await db.insert(dealModelFundingLines).values({
            dealModelId,
            fundingType: 'property_finance',
            label: 'Property Finance (Commercial Mortgage)',
            assetBaseValue: String(propNBV),
            ltvPercent: '65',
            availableAmount: String(Math.round(available)),
            amountUsed: '0',
            interestRate: '5.0',
            termMonths: 240,
            isDebt: true,
            isActive: false,
            sortOrder: sortOrder++,
          });
          console.log(`[DEAL_MODEL_MAPPING] Created property_finance line: base=${propNBV}, available=${Math.round(available)}`);
        }
      }
    } catch (err) {
      console.log(`[DEAL_MODEL_MAPPING] Warning: Error creating property finance line`, err);
    }

    try {
      await db.insert(dealModelFundingLines).values({
        dealModelId,
        fundingType: 'cash_equity',
        label: 'Cash Equity (Cash to Introduce)',
        amountUsed: '0',
        isDebt: false,
        isActive: true,
        sortOrder: sortOrder++,
      });
      console.log(`[DEAL_MODEL_MAPPING] Created cash_equity line`);
    } catch (err) {
      console.log(`[DEAL_MODEL_MAPPING] Warning: Error creating cash equity line`, err);
    }
  }

  private async getAvailableFiscalYears(targetCompanyId: number): Promise<string[]> {
    try {
      const rows = await db
        .select({ fiscalYear: financialPeriods.fiscalYear })
        .from(financialPeriods)
        .where(eq(financialPeriods.targetCompanyId, targetCompanyId))
        .orderBy(financialPeriods.fiscalYear);

      return rows
        .map(r => r.fiscalYear?.toString())
        .filter((y): y is string => !!y);
    } catch (err) {
      console.log(`[DEAL_MODEL_MAPPING] Warning: Could not fetch fiscal years`, err);
      return [];
    }
  }

  private async getLatestBalanceSheet(targetCompanyId: number): Promise<Record<string, any> | null> {
    try {
      const [result] = await db
        .select()
        .from(balanceSheets)
        .innerJoin(financialPeriods, eq(balanceSheets.financialPeriodId, financialPeriods.id))
        .where(eq(balanceSheets.targetCompanyId, targetCompanyId))
        .orderBy(desc(financialPeriods.periodEnd))
        .limit(1);

      return result?.balance_sheets || null;
    } catch (err) {
      console.log(`[DEAL_MODEL_MAPPING] Warning: Could not fetch balance sheet`, err);
      return null;
    }
  }

  private async getLatestIncomeStatement(targetCompanyId: number): Promise<Record<string, any> | null> {
    try {
      const [result] = await db
        .select()
        .from(incomeStatements)
        .innerJoin(financialPeriods, eq(incomeStatements.financialPeriodId, financialPeriods.id))
        .where(eq(incomeStatements.targetCompanyId, targetCompanyId))
        .orderBy(desc(financialPeriods.periodEnd))
        .limit(1);

      return result?.income_statements || null;
    } catch (err) {
      console.log(`[DEAL_MODEL_MAPPING] Warning: Could not fetch income statement`, err);
      return null;
    }
  }

  private async getLatestFixedAssets(targetCompanyId: number): Promise<Record<string, any> | null> {
    try {
      const [result] = await db
        .select()
        .from(fixedAssetsRegister)
        .where(eq(fixedAssetsRegister.targetCompanyId, targetCompanyId))
        .orderBy(desc(fixedAssetsRegister.reportDate))
        .limit(1);

      return result || null;
    } catch (err) {
      console.log(`[DEAL_MODEL_MAPPING] Warning: Could not fetch fixed assets`, err);
      return null;
    }
  }
}

export const dealModelMappingService = new DealModelMappingService();
