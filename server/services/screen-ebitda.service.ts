import type { ExpertAnalysisResult } from '@shared/schema/documents';
import type { FinancialPeriod } from '@shared/schema/financials';
import { isPartYearPeriod } from '@shared/utils/period';
import { expertAnalysisService } from './expert-analysis.service';
import { financialDataRepository } from '../repositories/financial-data.repository';

type ScreenPeriod = Pick<
  FinancialPeriod,
  'fiscalYear' | 'monthsCovered' | 'isFullYear'
> & {
  documentCategory?: string | null;
};

type YearlyMetric = {
  ebitda?: number | string | null;
};

export function buildScreenEbitdaByYear(
  expertResults: ReadonlyArray<
    Pick<ExpertAnalysisResult, 'expertType' | 'status' | 'analysisData'>
  >,
  periods: ReadonlyArray<ScreenPeriod>,
): Record<string, number> {
  const financialExpert = expertResults.find(
    result => result.expertType === 'financial' && result.status === 'success',
  );
  if (!financialExpert?.analysisData) return {};

  const analysisData = typeof financialExpert.analysisData === 'string'
    ? JSON.parse(financialExpert.analysisData)
    : financialExpert.analysisData;
  const yearlyMetrics = (analysisData as { yearly_metrics?: Record<string, YearlyMetric> })
    ?.yearly_metrics;
  if (!yearlyMetrics) return {};

  const result: Record<string, number> = {};
  for (const [year, metrics] of Object.entries(yearlyMetrics)) {
    const fiscalYear = Number.parseInt(year, 10);
    const rawMatch = periods.find(
      period => period.fiscalYear === fiscalYear && !isPartYearPeriod(period),
    );
    const screenPeriod = rawMatch ?? {
      fiscalYear,
      monthsCovered: null,
      isFullYear: true,
      documentCategory: null,
    };
    if (isPartYearPeriod(screenPeriod)) continue;
    if (metrics.ebitda != null) result[year] = Number(metrics.ebitda);
  }

  return result;
}

export async function getScreenEbitdaByYear(
  targetCompanyId: number,
): Promise<Record<string, number>> {
  const [expertResults, periods] = await Promise.all([
    expertAnalysisService.getExpertResults(targetCompanyId),
    financialDataRepository.getFinancialPeriodsByCompany(targetCompanyId),
  ]);
  return buildScreenEbitdaByYear(expertResults, periods);
}