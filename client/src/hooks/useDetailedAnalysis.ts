import { useMemo } from 'react';
import type { DetailedAnalysisData, DealSnapshot } from '@/components/detailed-analysis/types';

interface UseDetailedAnalysisResult {
  dealSnapshot: DealSnapshot | undefined;
  sectorAnalysis: any | undefined;
  growthAnalysis: any | undefined;
  valuationAnalysis: any | undefined;
  dealStructure: any | undefined;
  acquisitionSummary: any | undefined;
  dealSheet: any | undefined;
  hasData: boolean;
}

export function useDetailedAnalysis(data: DetailedAnalysisData): UseDetailedAnalysisResult {
  return useMemo(() => {
    const dealSnapshot = data.deal_snapshot;
    const sectorAnalysis = data.sector_analysis;
    const growthAnalysis = data.growth_analysis;
    const valuationAnalysis = data.valuation_analysis;
    const dealStructure = data.deal_structure;
    const acquisitionSummary = data.acquisition_summary;
    const dealSheet = data.deal_sheet;

    const hasData = !!(dealSnapshot || sectorAnalysis || growthAnalysis);

    return {
      dealSnapshot,
      sectorAnalysis,
      growthAnalysis,
      valuationAnalysis,
      dealStructure,
      acquisitionSummary,
      dealSheet,
      hasData,
    };
  }, [data]);
}
