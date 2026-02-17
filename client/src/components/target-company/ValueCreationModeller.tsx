import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { formatCurrency, formatPercent } from '@/lib/format-utils';
import { toNum } from '@shared/calculators/deal-model.calc';
import {
  calculateProjections,
  calculateDebtSchedules,
  calculateWaterfall,
  calculateReturns,
  calculateSensitivity,
  calculateScenarios,
  type BaseYearData,
  type YearAssumptions,
  type SynergyInput,
  type FundingLineForProjection,
  type ExitAssumptions as ExitAssumptionsType,
  type ScenarioMultipliers,
  type ProjectedYear,
  type ReturnMetrics,
} from '@shared/calculators/value-creation.calc';
import type {
  DealModel,
  DealModelFundingLine,
  ValueCreationScenario,
  ValueCreationAssumption,
  ValueCreationSynergy,
  ValueCreationExitAssumption,
} from '@shared/schema';
import AssumptionsPanel from '@/components/value-creation/AssumptionsPanel';
import PLProjectionsSection from '@/components/value-creation/PLProjectionsSection';
import SynergiesDetailSection from '@/components/value-creation/SynergiesDetailSection';
import CashFlowWaterfallSection from '@/components/value-creation/CashFlowWaterfallSection';
import ReturnsAnalysisSection from '@/components/value-creation/ReturnsAnalysisSection';
import SensitivityAnalysisSection from '@/components/value-creation/SensitivityAnalysisSection';
import ExitScenarioSection from '@/components/value-creation/ExitScenarioSection';
import {
  LineChart,
  Calculator,
  Loader2,
  PanelLeftClose,
  PanelLeftOpen,
  TrendingUp,
  Shield,
  DollarSign,
  BarChart3,
} from 'lucide-react';

interface ValueCreationModellerProps {
  companyId: number;
}

interface DealModelWithDetails extends DealModel {
  adjustments: any[];
  fundingLines: DealModelFundingLine[];
}

interface ValueCreationData {
  scenarios: ValueCreationScenario[];
  assumptions: ValueCreationAssumption[];
  synergies: ValueCreationSynergy[];
  exitAssumptions: ValueCreationExitAssumption | null;
}

export default function ValueCreationModeller({ companyId }: ValueCreationModellerProps) {
  const { toast } = useToast();
  const [selectedModelId, setSelectedModelId] = useState<number | null>(null);
  const [activeScenarioType, setActiveScenarioType] = useState<string>('base');
  const [panelCollapsed, setPanelCollapsed] = useState(false);

  const { data: models = [], isLoading: modelsLoading } = useQuery<DealModel[]>({
    queryKey: ['/api/v2/deal-models/company', companyId],
    select: (response: any) => response?.data || response || [],
    enabled: !!companyId,
  });

  useEffect(() => {
    if (models.length > 0 && selectedModelId === null) {
      setSelectedModelId(models[0].id);
    }
  }, [models, selectedModelId]);

  const { data: modelDetails } = useQuery<DealModelWithDetails>({
    queryKey: ['/api/v2/deal-models', selectedModelId],
    select: (response: any) => response?.data || response,
    enabled: !!selectedModelId,
  });

  const { data: financialsRaw } = useQuery<any>({
    queryKey: ['/api/v2/financial-data/company', companyId, 'financials'],
    select: (response: any) => response?.data || response,
    enabled: !!companyId,
  });

  const { data: vcData, isLoading: vcLoading } = useQuery<ValueCreationData>({
    queryKey: ['/api/v2/value-creation/deal-model', selectedModelId],
    select: (response: any) => response?.data || response,
    enabled: !!selectedModelId,
  });

  const baseYearData = useMemo<BaseYearData | null>(() => {
    if (!financialsRaw?.periods || !financialsRaw?.incomeStatements) return null;

    const incomeStatementPeriodIds = new Set(
      financialsRaw.incomeStatements.map((i: any) => i.financialPeriodId)
    );

    const statutory = financialsRaw.periods
      .filter((p: any) => (p.periodType === 'statutory' || p.periodType === 'historic') && p.fiscalYear && incomeStatementPeriodIds.has(p.id))
      .sort((a: any, b: any) => new Date(b.periodEnd).getTime() - new Date(a.periodEnd).getTime());

    if (statutory.length === 0) return null;

    const latestPeriod = statutory[0];
    const income = financialsRaw.incomeStatements.find(
      (i: any) => i.financialPeriodId === latestPeriod.id
    );

    if (!income) return null;

    const revenue = toNum(income.revenue);
    const costOfSales = toNum(income.costOfSales);
    const grossProfit = toNum(income.grossProfit) || (revenue - costOfSales);
    const rawAdmin = toNum(income.administrativeExpenses);
    const rawStaff = toNum(income.staffCosts);
    const depreciation = toNum(income.depreciationAmortisation);
    const operatingProfit = toNum(income.operatingProfit);
    const interestPayable = toNum(income.interestPayable);
    const corporationTax = toNum(income.corporationTax);
    const netProfit = toNum(income.netProfit);
    const adjustedEbitda = operatingProfit + depreciation;

    const actualOverheads = grossProfit - adjustedEbitda;
    const rawTotal = Math.abs(rawStaff) + Math.abs(rawAdmin);
    const staffProportion = rawTotal > 0 ? Math.abs(rawStaff) / rawTotal : 0.5;
    const adminProportion = rawTotal > 0 ? Math.abs(rawAdmin) / rawTotal : 0.5;

    return {
      revenue,
      costOfSales,
      grossProfit,
      administrativeExpenses: actualOverheads * adminProportion,
      staffCosts: actualOverheads * staffProportion,
      depreciationAmortisation: depreciation,
      operatingProfit,
      interestPayable,
      corporationTax,
      netProfit,
      adjustedEbitda,
    };
  }, [financialsRaw]);

  const baseYearLabel = useMemo<string>(() => {
    if (!financialsRaw?.periods || !financialsRaw?.incomeStatements) return 'Base';
    const incomeIds = new Set(financialsRaw.incomeStatements.map((i: any) => i.financialPeriodId));
    const statutory = financialsRaw.periods
      .filter((p: any) => (p.periodType === 'statutory' || p.periodType === 'historic') && p.fiscalYear && incomeIds.has(p.id))
      .sort((a: any, b: any) => new Date(b.periodEnd).getTime() - new Date(a.periodEnd).getTime());
    return statutory[0]?.fiscalYear ? `FY${statutory[0].fiscalYear}` : 'Base';
  }, [financialsRaw]);

  const activeScenario = useMemo(() => {
    if (!vcData?.scenarios) return null;
    return vcData.scenarios.find(s => s.scenarioType === activeScenarioType) || vcData.scenarios[0];
  }, [vcData, activeScenarioType]);

  const activeAssumptions = useMemo<YearAssumptions[]>(() => {
    if (!vcData?.assumptions || !activeScenario) return [];
    return vcData.assumptions
      .filter(a => a.scenarioId === activeScenario.id)
      .sort((a, b) => a.year - b.year)
      .map(a => ({
        year: a.year,
        revenueGrowthPercent: toNum(a.revenueGrowthPercent),
        costOfSalesGrowthPercent: toNum(a.costOfSalesGrowthPercent),
        adminCostGrowthPercent: toNum(a.adminCostGrowthPercent),
        staffCostGrowthPercent: toNum(a.staffCostGrowthPercent),
        depreciationGrowthPercent: toNum(a.depreciationGrowthPercent),
        capexPerYear: toNum(a.capexPerYear),
        workingCapitalPercent: toNum(a.workingCapitalPercent),
        taxRatePercent: toNum(a.taxRatePercent),
      }));
  }, [vcData, activeScenario]);

  const synergyInputs = useMemo<SynergyInput[]>(() => {
    if (!vcData?.synergies || !activeScenario) return [];
    return vcData.synergies
      .filter(s => s.scenarioId === activeScenario.id)
      .map(s => ({
        synergyType: s.synergyType as 'revenue' | 'cost',
        name: s.name,
        targetValue: toNum(s.targetValue),
        realisationByYear: [
          toNum(s.realisationY1) / 100,
          toNum(s.realisationY2) / 100,
          toNum(s.realisationY3) / 100,
          toNum(s.realisationY4) / 100,
          toNum(s.realisationY5) / 100,
        ],
        implementationCost: toNum(s.implementationCost),
      }));
  }, [vcData, activeScenario]);

  const fundingLineInputs = useMemo<FundingLineForProjection[]>(() => {
    if (!modelDetails?.fundingLines) return [];
    return modelDetails.fundingLines.map(f => ({
      amountUsed: toNum(f.amountUsed),
      interestRate: toNum(f.interestRate),
      termMonths: f.termMonths ?? 60,
      isDebt: f.isDebt ?? false,
      isActive: f.isActive ?? false,
    }));
  }, [modelDetails]);

  const exitAssumptions = useMemo<ExitAssumptionsType>(() => {
    if (!vcData?.exitAssumptions) {
      return { exitMultiple: 4.0, holdPeriodYears: 5, exitCostPercent: 3.0 };
    }
    return {
      exitMultiple: toNum(vcData.exitAssumptions.exitMultiple),
      holdPeriodYears: vcData.exitAssumptions.holdPeriodYears ?? 5,
      exitCostPercent: toNum(vcData.exitAssumptions.exitCostPercent),
    };
  }, [vcData]);

  const projections = useMemo<ProjectedYear[]>(() => {
    if (!baseYearData || activeAssumptions.length === 0) return [];
    return calculateProjections(baseYearData, activeAssumptions, synergyInputs, fundingLineInputs);
  }, [baseYearData, activeAssumptions, synergyInputs, fundingLineInputs]);

  const kpis = useMemo(() => {
    if (projections.length === 0) return null;
    const y5 = projections[projections.length - 1];
    const totalCash = projections.reduce((sum, p) => sum + p.freeCashFlow, 0);
    const avgDscr = projections.reduce((sum, p) => sum + p.dscr, 0) / projections.length;
    const worstDscr = Math.min(...projections.map(p => p.dscr));
    return {
      y5Revenue: y5.revenue,
      y5Ebitda: y5.ebitda,
      totalCashGenerated: totalCash,
      avgDscr,
      worstDscr,
    };
  }, [projections]);

  const handleDataChange = useCallback(() => {
    if (selectedModelId) {
      queryClient.invalidateQueries({ queryKey: ['/api/v2/value-creation/deal-model', selectedModelId] });
    }
  }, [selectedModelId]);

  const entryMultiple = toNum(modelDetails?.ebitdaMultiple);
  const entryEV = toNum(modelDetails?.enterpriseValue);
  const totalDebt = fundingLineInputs
    .filter(f => f.isDebt && f.isActive)
    .reduce((sum, f) => sum + f.amountUsed, 0);

  const entryEquity = useMemo(() => {
    return fundingLineInputs
      .filter(f => !f.isDebt && f.isActive)
      .reduce((sum, f) => sum + f.amountUsed, 0);
  }, [fundingLineInputs]);

  const totalFees = useMemo(() => {
    if (!modelDetails) return 0;
    const offerPrice = toNum(modelDetails.totalPurchasePrice) || toNum(modelDetails.enterpriseValue);
    if (offerPrice <= 0) return 0;
    const fee = (val: any, type: any) => type === 'fixed' ? toNum(val) : offerPrice * toNum(val) / 100;
    return fee(modelDetails.feeLegalDdPercent, modelDetails.feeLegalDdType)
         + fee(modelDetails.feeAccountingDdPercent, modelDetails.feeAccountingDdType)
         + fee(modelDetails.feeBrokerPercent, modelDetails.feeBrokerType)
         + fee(modelDetails.feeLoanArrangementPercent, modelDetails.feeLoanArrangementType)
         + fee(modelDetails.feeDealMakerPercent, modelDetails.feeDealMakerType);
  }, [modelDetails]);

  const returnMetrics = useMemo(() => {
    if (projections.length === 0 || entryEquity <= 0) return null;
    return calculateReturns(
      projections,
      exitAssumptions,
      entryEquity,
      entryMultiple,
      totalDebt,
      totalFees,
      fundingLineInputs
    );
  }, [projections, exitAssumptions, entryEquity, entryMultiple, totalDebt, totalFees, fundingLineInputs]);

  const sensitivityData = useMemo(() => {
    if (!baseYearData || activeAssumptions.length === 0 || entryEquity <= 0) return null;
    return calculateSensitivity(
      baseYearData,
      activeAssumptions,
      synergyInputs,
      fundingLineInputs,
      exitAssumptions,
      entryEquity,
      entryMultiple,
      totalDebt,
      totalFees
    );
  }, [baseYearData, activeAssumptions, synergyInputs, fundingLineInputs, exitAssumptions, entryEquity, entryMultiple, totalDebt, totalFees]);

  const scenarioComparison = useMemo(() => {
    if (!baseYearData || activeAssumptions.length === 0 || entryEquity <= 0 || !vcData?.scenarios) return null;

    const baseScenario = vcData.scenarios.find(s => s.scenarioType === 'base');
    const bearScenario = vcData.scenarios.find(s => s.scenarioType === 'bear');
    const bullScenario = vcData.scenarios.find(s => s.scenarioType === 'bull');

    if (!baseScenario) return null;

    const baseAssumptions = vcData.assumptions
      .filter(a => a.scenarioId === baseScenario.id)
      .sort((a, b) => a.year - b.year)
      .map(a => ({
        year: a.year,
        revenueGrowthPercent: toNum(a.revenueGrowthPercent),
        costOfSalesGrowthPercent: toNum(a.costOfSalesGrowthPercent),
        adminCostGrowthPercent: toNum(a.adminCostGrowthPercent),
        staffCostGrowthPercent: toNum(a.staffCostGrowthPercent),
        depreciationGrowthPercent: toNum(a.depreciationGrowthPercent),
        capexPerYear: toNum(a.capexPerYear),
        workingCapitalPercent: toNum(a.workingCapitalPercent),
        taxRatePercent: toNum(a.taxRatePercent),
      }));

    const baseSynergies = vcData.synergies
      .filter(s => s.scenarioId === baseScenario.id)
      .map(s => ({
        synergyType: s.synergyType as 'revenue' | 'cost',
        name: s.name,
        targetValue: toNum(s.targetValue),
        realisationByYear: [
          toNum(s.realisationY1) / 100,
          toNum(s.realisationY2) / 100,
          toNum(s.realisationY3) / 100,
          toNum(s.realisationY4) / 100,
          toNum(s.realisationY5) / 100,
        ],
        implementationCost: toNum(s.implementationCost),
      }));

    if (baseAssumptions.length === 0) return null;

    const bearMult: ScenarioMultipliers = bearScenario
      ? { revenueGrowthMultiplier: toNum(bearScenario.revenueGrowthMultiplier), costPressureAdjustment: toNum(bearScenario.costPressureAdjustment) }
      : { revenueGrowthMultiplier: 0.6, costPressureAdjustment: 1.5 };

    const bullMult: ScenarioMultipliers = bullScenario
      ? { revenueGrowthMultiplier: toNum(bullScenario.revenueGrowthMultiplier), costPressureAdjustment: toNum(bullScenario.costPressureAdjustment) }
      : { revenueGrowthMultiplier: 1.4, costPressureAdjustment: -0.5 };

    const scenarios = calculateScenarios(baseYearData, baseAssumptions, baseSynergies, fundingLineInputs, bearMult, bullMult);

    const bearReturns = calculateReturns(scenarios.bear, exitAssumptions, entryEquity, entryMultiple, totalDebt, totalFees, fundingLineInputs);
    const baseReturns = calculateReturns(scenarios.base, exitAssumptions, entryEquity, entryMultiple, totalDebt, totalFees, fundingLineInputs);
    const bullReturns = calculateReturns(scenarios.bull, exitAssumptions, entryEquity, entryMultiple, totalDebt, totalFees, fundingLineInputs);

    return {
      projections: scenarios,
      returns: { bear: bearReturns, base: baseReturns, bull: bullReturns },
    };
  }, [baseYearData, activeAssumptions, vcData, fundingLineInputs, exitAssumptions, entryEquity, entryMultiple, totalDebt, totalFees]);

  if (modelsLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (models.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 flex flex-col items-center text-center gap-4">
          <div className="rounded-full bg-primary/10 p-4">
            <LineChart className="h-8 w-8 text-primary" />
          </div>
          <div>
            <h3 className="text-lg font-semibold">Value Creation Modeller</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-md">
              Create a deal model first in the Deal Modeller tab. The value creation modeller projects
              what this business looks like over 5 years under your ownership.
            </p>
          </div>
          <Badge variant="secondary">Requires a Deal Model</Badge>
        </CardContent>
      </Card>
    );
  }

  const selectedModel = models.find(m => m.id === selectedModelId);

  const assumptionsPanelContent = activeScenario && vcData ? (
    <AssumptionsPanel
      scenario={activeScenario}
      assumptions={vcData.assumptions.filter(a => a.scenarioId === activeScenario.id)}
      synergies={vcData.synergies.filter(s => s.scenarioId === activeScenario.id)}
      exitAssumptions={vcData.exitAssumptions}
      dealModelId={selectedModelId!}
      fundingLines={modelDetails?.fundingLines || []}
      baseYearData={baseYearData}
      onDataChange={handleDataChange}
    />
  ) : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Select
          value={selectedModelId ? String(selectedModelId) : undefined}
          onValueChange={(val) => setSelectedModelId(Number(val))}
        >
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="Select deal model" />
          </SelectTrigger>
          <SelectContent>
            {models.map(m => (
              <SelectItem key={m.id} value={String(m.id)}>
                {m.name} (v{m.version})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Tabs value={activeScenarioType} onValueChange={setActiveScenarioType}>
          <TabsList className="h-9">
            <TabsTrigger value="bear" className="text-xs px-3 data-[state=active]:bg-red-100 data-[state=active]:text-red-700 dark:data-[state=active]:bg-red-900/30 dark:data-[state=active]:text-red-300">
              Bear
            </TabsTrigger>
            <TabsTrigger value="base" className="text-xs px-3 data-[state=active]:bg-blue-100 data-[state=active]:text-blue-700 dark:data-[state=active]:bg-blue-900/30 dark:data-[state=active]:text-blue-300">
              Base
            </TabsTrigger>
            <TabsTrigger value="bull" className="text-xs px-3 data-[state=active]:bg-green-100 data-[state=active]:text-green-700 dark:data-[state=active]:bg-green-900/30 dark:data-[state=active]:text-green-300">
              Bull
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex items-center gap-2 ml-auto">
          {entryMultiple > 0 && (
            <Badge variant="outline" className="text-xs">
              Entry: {entryMultiple.toFixed(1)}x
            </Badge>
          )}
          {totalDebt > 0 && (
            <Badge variant="outline" className="text-xs">
              Debt: {formatCurrency(totalDebt)}
            </Badge>
          )}

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setPanelCollapsed(!panelCollapsed)}
            className="hidden lg:flex"
          >
            {panelCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </Button>

          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm" className="lg:hidden">
                <PanelLeftOpen className="h-4 w-4 mr-2" />
                Assumptions
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[340px] p-0">
              <ScrollArea className="h-full">
                <div className="p-4">
                  {assumptionsPanelContent}
                </div>
              </ScrollArea>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      {kpis && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Card className="border-l-4 border-l-blue-500">
            <CardContent className="py-3 px-4">
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <TrendingUp className="h-3 w-3" />
                Y5 Revenue
              </p>
              <p className="text-lg font-bold mt-0.5">{formatCurrency(kpis.y5Revenue)}</p>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-green-500">
            <CardContent className="py-3 px-4">
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <BarChart3 className="h-3 w-3" />
                Y5 EBITDA
              </p>
              <p className="text-lg font-bold mt-0.5">{formatCurrency(kpis.y5Ebitda)}</p>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-emerald-500">
            <CardContent className="py-3 px-4">
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <DollarSign className="h-3 w-3" />
                Total Cash Generated
              </p>
              <p className="text-lg font-bold mt-0.5">{formatCurrency(kpis.totalCashGenerated)}</p>
            </CardContent>
          </Card>
          <Card className={`border-l-4 ${
            kpis.worstDscr >= 1.8 ? 'border-l-green-500' :
            kpis.worstDscr >= 1.4 ? 'border-l-blue-500' :
            kpis.worstDscr >= 1.0 ? 'border-l-amber-500' :
            'border-l-red-500'
          }`}>
            <CardContent className="py-3 px-4">
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Shield className="h-3 w-3" />
                Worst DSCR
              </p>
              <p className={`text-lg font-bold mt-0.5 ${
                kpis.worstDscr >= 1.8 ? 'text-green-700 dark:text-green-400' :
                kpis.worstDscr >= 1.4 ? 'text-blue-700 dark:text-blue-400' :
                kpis.worstDscr >= 1.0 ? 'text-amber-700 dark:text-amber-400' :
                'text-red-700 dark:text-red-400'
              }`}>
                {kpis.worstDscr >= 100 ? '\u221E' : kpis.worstDscr.toFixed(2)}x
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {vcLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-96 w-full" />
        </div>
      ) : (
        <div className="flex gap-4">
          {!panelCollapsed && (
            <div className="hidden lg:block w-[320px] shrink-0">
              <div className="sticky top-20">
                <ScrollArea className="h-[calc(100vh-200px)]">
                  {assumptionsPanelContent}
                </ScrollArea>
              </div>
            </div>
          )}

          <div className="flex-1 min-w-0 space-y-6">
            {!baseYearData ? (
              <Card>
                <CardContent className="py-10 text-center">
                  <Calculator className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
                  <h3 className="font-semibold mb-1">No Financial Data</h3>
                  <p className="text-sm text-muted-foreground max-w-md mx-auto">
                    Upload company accounts and run expert analysis to populate the base year data.
                    The value creation modeller needs at least one year of P&L data.
                  </p>
                </CardContent>
              </Card>
            ) : projections.length === 0 ? (
              <Card>
                <CardContent className="py-10 text-center">
                  <Loader2 className="h-8 w-8 mx-auto mb-3 text-muted-foreground animate-spin" />
                  <p className="text-sm text-muted-foreground">Calculating projections...</p>
                </CardContent>
              </Card>
            ) : (
              <>
                <PLProjectionsSection
                  projections={projections}
                  baseYearData={baseYearData!}
                  baseYearLabel={baseYearLabel}
                  synergies={synergyInputs}
                  scenarioType={activeScenarioType}
                />

                {synergyInputs.length > 0 && projections.length > 0 && (
                  <SynergiesDetailSection
                    synergies={synergyInputs}
                    projections={projections}
                  />
                )}

                <CashFlowWaterfallSection
                  projections={projections}
                  fundingLines={fundingLineInputs}
                  baseYearLabel={baseYearLabel}
                />

                {returnMetrics && (
                  <ReturnsAnalysisSection
                    metrics={returnMetrics}
                    projections={projections}
                    exitAssumptions={exitAssumptions}
                    entryMultiple={entryMultiple}
                  />
                )}

                {sensitivityData && (
                  <SensitivityAnalysisSection
                    data={sensitivityData}
                    baseAssumptions={activeAssumptions}
                    exitAssumptions={exitAssumptions}
                  />
                )}

                {scenarioComparison && (
                  <ExitScenarioSection
                    scenarios={scenarioComparison.projections}
                    returns={scenarioComparison.returns}
                    exitAssumptions={exitAssumptions}
                    entryMultiple={entryMultiple}
                    entryEquity={entryEquity}
                    baseYearData={baseYearData!}
                  />
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
