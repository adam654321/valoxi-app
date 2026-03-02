import { eq, desc, and } from 'drizzle-orm';
import { db } from '../db';
import {
  dealModels,
  dealMetricsSnapshots,
  targetCompanies,
  incomeStatements,
  financialPeriods,
  dealModelFundingLines,
  expertAnalysisResults,
} from '@shared/schema';
import { toNum } from '../../shared/calculators/deal-model.calc';

interface MetricsPayload {
  adjustedEbitda?: number;
  ebitdaMultiple?: number;
  offerPrice?: number;
  fundingStack?: { type: string; amount: number }[];
  dscr?: number;
  dscrZone?: string;
  impliedValuationRange?: { low: number; high: number };
  revenueLatestYear?: number;
  grossMarginPct?: number;
  netProfitPct?: number;
  employeeCount?: number;
  sector?: string;
  snapshotDate: string;
}

async function getTargetCompanyData(targetCompanyId: number) {
  const [company] = await db
    .select()
    .from(targetCompanies)
    .where(eq(targetCompanies.id, targetCompanyId));
  return company;
}

async function getLatestFinancials(targetCompanyId: number) {
  const rows = await db
    .select({
      revenue: incomeStatements.revenue,
      grossProfit: incomeStatements.grossProfit,
      operatingProfit: incomeStatements.operatingProfit,
      netProfit: incomeStatements.netProfit,
      depreciationAmortisation: incomeStatements.depreciationAmortisation,
    })
    .from(incomeStatements)
    .innerJoin(financialPeriods, eq(incomeStatements.financialPeriodId, financialPeriods.id))
    .where(eq(incomeStatements.targetCompanyId, targetCompanyId))
    .orderBy(desc(financialPeriods.periodEnd))
    .limit(1);

  return rows[0] || null;
}

export async function captureMetricsSnapshot(dealModelId: number, userId: number): Promise<void> {
  try {
    const [model] = await db
      .select()
      .from(dealModels)
      .where(eq(dealModels.id, dealModelId));

    if (!model) return;

    const company = await getTargetCompanyData(model.targetCompanyId);
    if (!company) return;

    const financials = await getLatestFinancials(model.targetCompanyId);

    const fundingRows = await db
      .select()
      .from(dealModelFundingLines)
      .where(eq(dealModelFundingLines.dealModelId, dealModelId));

    const revenue = financials ? toNum(financials.revenue) : undefined;
    const grossProfit = financials ? toNum(financials.grossProfit) : undefined;
    const netProfit = financials ? toNum(financials.netProfit) : undefined;

    const metrics: MetricsPayload = {
      adjustedEbitda: toNum(model.adjustedEbitda) || undefined,
      ebitdaMultiple: toNum(model.ebitdaMultiple) || undefined,
      offerPrice: toNum(model.totalPurchasePrice) || undefined,
      fundingStack: fundingRows
        .filter(f => f.isActive && toNum(f.amountUsed) > 0)
        .map(f => ({ type: f.fundingType, amount: toNum(f.amountUsed) })),
      revenueLatestYear: revenue || undefined,
      grossMarginPct: revenue && grossProfit ? (grossProfit / revenue) * 100 : undefined,
      netProfitPct: revenue && netProfit ? (netProfit / revenue) * 100 : undefined,
      employeeCount: company.employeeCount || undefined,
      sector: company.industry || undefined,
      snapshotDate: new Date().toISOString(),
    };

    const [userCompanyRow] = await db
      .select({ userCompanyId: targetCompanies.userCompanyId })
      .from(targetCompanies)
      .where(eq(targetCompanies.id, model.targetCompanyId));

    if (!userCompanyRow) return;

    await db.insert(dealMetricsSnapshots).values({
      userCompanyId: userCompanyRow.userCompanyId,
      targetCompanyId: model.targetCompanyId,
      dealModelId,
      triggerEvent: 'model_saved',
      schemaVersion: 1,
      metrics,
    });

    console.log(`[METRICS_SNAPSHOT] Captured model_saved snapshot for deal model ${dealModelId}`);
  } catch (error) {
    console.error(`[METRICS_SNAPSHOT] Failed to capture snapshot for deal model ${dealModelId}:`, error);
  }
}

export async function captureAnalysisSnapshot(targetCompanyId: number, userCompanyId: number): Promise<void> {
  try {
    const company = await getTargetCompanyData(targetCompanyId);
    if (!company) return;

    const financials = await getLatestFinancials(targetCompanyId);

    const [latestModel] = await db
      .select()
      .from(dealModels)
      .where(eq(dealModels.targetCompanyId, targetCompanyId))
      .orderBy(desc(dealModels.updatedAt))
      .limit(1);

    const revenue = financials ? toNum(financials.revenue) : undefined;
    const grossProfit = financials ? toNum(financials.grossProfit) : undefined;
    const netProfit = financials ? toNum(financials.netProfit) : undefined;

    const [valuationResult] = await db
      .select({ analysisData: expertAnalysisResults.analysisData })
      .from(expertAnalysisResults)
      .where(
        and(
          eq(expertAnalysisResults.targetCompanyId, targetCompanyId),
          eq(expertAnalysisResults.expertType, 'valuation'),
          eq(expertAnalysisResults.status, 'success')
        )
      )
      .orderBy(desc(expertAnalysisResults.updatedAt))
      .limit(1);

    const valData = valuationResult?.analysisData as any;
    const evRange = valData?.ebitda_valuation?.enterprise_value_range;

    const metrics: MetricsPayload = {
      adjustedEbitda: latestModel ? toNum(latestModel.adjustedEbitda) || undefined : undefined,
      ebitdaMultiple: latestModel ? toNum(latestModel.ebitdaMultiple) || undefined : undefined,
      impliedValuationRange: evRange ? { low: toNum(evRange.conservative), high: toNum(evRange.optimistic) } : undefined,
      revenueLatestYear: revenue || undefined,
      grossMarginPct: revenue && grossProfit ? (grossProfit / revenue) * 100 : undefined,
      netProfitPct: revenue && netProfit ? (netProfit / revenue) * 100 : undefined,
      employeeCount: company.employeeCount || undefined,
      sector: company.industry || undefined,
      snapshotDate: new Date().toISOString(),
    };

    await db.insert(dealMetricsSnapshots).values({
      userCompanyId,
      targetCompanyId,
      dealModelId: null,
      triggerEvent: 'analysis_completed',
      schemaVersion: 1,
      metrics,
    });

    console.log(`[METRICS_SNAPSHOT] Captured analysis_completed snapshot for company ${targetCompanyId}`);
  } catch (error) {
    console.error(`[METRICS_SNAPSHOT] Failed to capture analysis snapshot for company ${targetCompanyId}:`, error);
  }
}
