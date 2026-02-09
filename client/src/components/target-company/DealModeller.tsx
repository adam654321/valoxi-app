import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import {
  calculateFullDealModel,
  toNum,
  type AdjustmentInput,
  type FundingLineInput,
  type DealModelInput,
  type CalculationResult,
} from '@shared/calculators/deal-model.calc';
import type { DealModel, DealModelAdjustment, DealModelFundingLine } from '@shared/schema';
import { formatCurrency } from '@/lib/format-utils';
import PLSummarySection from '@/components/deal-modeller/PLSummarySection';
import AdjustmentsSection from '@/components/deal-modeller/AdjustmentsSection';
import {
  Plus,
  Lock,
  Calculator,
  PoundSterling,
  Banknote,
  Scale,
  CreditCard,
  CheckCircle,
  Loader2,
} from 'lucide-react';

interface DealModellerProps {
  companyId: number;
}

interface DealModelWithDetails extends DealModel {
  adjustments: DealModelAdjustment[];
  fundingLines: DealModelFundingLine[];
  calculations?: CalculationResult;
}

interface FinancialPeriod {
  id: number;
  targetCompanyId: number;
  periodType: string;
  periodEnd: string;
  fiscalYear: number | null;
}

interface IncomeStatement {
  id: number;
  financialPeriodId: number;
  operatingProfit: string | null;
  depreciationAmortisation: string | null;
}

interface FinancialsData {
  periods: FinancialPeriod[];
  incomeStatements: IncomeStatement[];
}

const STATUS_COLOURS: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-700',
  active: 'bg-blue-100 text-blue-700',
  sent: 'bg-amber-100 text-amber-700',
  accepted: 'bg-green-100 text-green-700',
  archived: 'bg-gray-100 text-gray-500',
};

const SECTIONS = [
  { num: 3, title: "What's It Worth?", desc: 'Set the EBITDA multiple and EV-to-equity bridge to calculate the offer price.', icon: Scale },
  { num: 4, title: 'How Do We Pay For It?', desc: 'Build the funding structure with debt facilities and equity.', icon: CreditCard },
  { num: 5, title: 'Does The Deal Work?', desc: 'Payment cover ratio, fees breakdown, and deal viability summary.', icon: CheckCircle },
];

export default function DealModeller({ companyId }: DealModellerProps) {
  const { toast } = useToast();
  const [selectedModelId, setSelectedModelId] = useState<number | null>(null);

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

  const { data: modelDetails, isLoading: detailsLoading } = useQuery<DealModelWithDetails>({
    queryKey: ['/api/v2/deal-models', selectedModelId],
    select: (response: any) => response?.data || response,
    enabled: !!selectedModelId,
  });

  const { data: financialsRaw } = useQuery<FinancialsData>({
    queryKey: ['/api/v2/financial-data/company', companyId, 'financials'],
    select: (response: any) => response?.data || response,
    enabled: !!companyId,
  });

  const reportedEbitdaByYear = useMemo<Record<string, number>>(() => {
    if (!financialsRaw?.periods || !financialsRaw?.incomeStatements) return {};
    const result: Record<string, number> = {};
    for (const period of financialsRaw.periods) {
      if (period.periodType !== 'statutory' || !period.fiscalYear) continue;
      const income = financialsRaw.incomeStatements.find(i => i.financialPeriodId === period.id);
      if (!income) continue;
      const op = toNum(income.operatingProfit);
      const da = toNum(income.depreciationAmortisation);
      result[String(period.fiscalYear)] = op + da;
    }
    return result;
  }, [financialsRaw]);

  const calculations = useMemo<CalculationResult | null>(() => {
    if (!modelDetails) return null;

    const adjustments: AdjustmentInput[] = (modelDetails.adjustments || []).map(a => ({
      adjustmentType: a.adjustmentType as 'add_back' | 'deduction',
      amount: a.amount,
      amountsByYear: a.amountsByYear as Record<string, number> | null,
      status: a.status || 'suggested',
      userOverrideAmount: null,
    }));

    const fundingLines: FundingLineInput[] = (modelDetails.fundingLines || []).map(f => ({
      fundingType: f.fundingType,
      assetBaseValue: f.assetBaseValue,
      ltvPercent: f.ltvPercent,
      amountUsed: f.amountUsed,
      interestRate: f.interestRate,
      termMonths: f.termMonths,
      arrangementFeePercent: null,
      isActive: f.isActive ?? false,
    }));

    const modelInput: DealModelInput = {
      averagingYears: modelDetails.averagingYears ?? 3,
      ebitdaMultiple: modelDetails.ebitdaMultiple ?? '3.0',
      plusExcessCash: modelDetails.plusExcessCash ?? '0',
      minusPrimaryDebt: modelDetails.minusPrimaryDebt ?? '0',
      minusOtherDebt: modelDetails.minusOtherDebt ?? '0',
      minusCorpTaxDue: '0',
      minusWorkingCapitalAdj: modelDetails.minusWorkingCapitalAdj ?? '0',
      plusPropertyValue: modelDetails.propertyValue ?? '0',
      otherAdjustments: null,
      feeLegalDdPercent: modelDetails.feeLegalDdPercent ?? '2.5',
      feeAccountingDdPercent: modelDetails.feeAccountingDdPercent ?? '1.5',
      feeBrokerPercent: modelDetails.feeBrokerPercent ?? '2.0',
      feeLoanArrangementPercent: modelDetails.feeLoanArrangementPercent ?? '1.0',
      feeDealMakerPercent: modelDetails.feeDealMakerPercent ?? '5.0',
      customFees: null,
    };

    return calculateFullDealModel(reportedEbitdaByYear, adjustments, fundingLines, modelInput);
  }, [modelDetails, reportedEbitdaByYear]);

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', `/api/v2/deal-models/create/${companyId}`);
      return res.json();
    },
    onSuccess: (response: any) => {
      const newModel = response?.data || response;
      queryClient.invalidateQueries({ queryKey: ['/api/v2/deal-models/company', companyId] });
      if (newModel?.id) {
        setSelectedModelId(newModel.id);
      }
      toast({ title: 'Deal model created', description: 'Your deal model has been generated from expert analysis data.' });
    },
    onError: (error: Error) => {
      toast({
        title: 'Could not create deal model',
        description: error.message.includes('Expert analysis')
          ? 'Expert analysis must be completed before creating a deal model. Run the analysis first.'
          : error.message,
        variant: 'destructive',
      });
    },
  });

  if (modelsLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-16 w-full" />
        <div className="grid grid-cols-3 gap-4">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  const hasModels = models.length > 0;
  const selectedModel = models.find(m => m.id === selectedModelId);
  const isLocked = selectedModel?.isLocked ?? false;

  return (
    <div className="space-y-6">
      {!hasModels ? (
        <Card>
          <CardContent className="py-10 flex flex-col items-center text-center gap-4">
            <div className="rounded-full bg-primary/10 p-4">
              <Calculator className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">No Deal Models Yet</h3>
              <p className="text-sm text-muted-foreground mt-1 max-w-md">
                Create a deal model to calculate the offer price, build a funding structure, and assess deal viability. Data is automatically pulled from your expert analysis.
              </p>
            </div>
            <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
              {createMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Plus className="h-4 w-4 mr-2" />
              )}
              Create Deal Model
            </Button>
            <p className="text-xs text-muted-foreground">Requires completed expert analysis.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="flex items-center gap-3 flex-wrap">
            <Select
              value={selectedModelId ? String(selectedModelId) : undefined}
              onValueChange={(val) => setSelectedModelId(Number(val))}
            >
              <SelectTrigger className="w-[280px]">
                <SelectValue placeholder="Select a model" />
              </SelectTrigger>
              <SelectContent>
                {models.map(m => (
                  <SelectItem key={m.id} value={String(m.id)}>
                    {m.name} (v{m.version})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {selectedModel && (
              <Badge className={STATUS_COLOURS[selectedModel.status || 'draft'] || STATUS_COLOURS.draft}>
                {selectedModel.status || 'draft'}
              </Badge>
            )}

            {isLocked && (
              <span className="flex items-center gap-1 text-sm text-muted-foreground">
                <Lock className="h-4 w-4" />
                Locked
              </span>
            )}

            <Button
              variant="secondary"
              size="sm"
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending}
              className="ml-auto"
            >
              {createMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Plus className="h-4 w-4 mr-2" />
              )}
              New Model
            </Button>
          </div>

          {detailsLoading ? (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Skeleton className="h-24" />
                <Skeleton className="h-24" />
                <Skeleton className="h-24" />
              </div>
              {[1, 2, 3, 4, 5].map(i => (
                <Skeleton key={i} className="h-32" />
              ))}
            </div>
          ) : (
            <>
              <div className="sticky top-0 z-10 bg-background pt-2 pb-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card className="border-l-4 border-l-primary">
                    <CardContent className="py-4">
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <PoundSterling className="h-3.5 w-3.5" />
                        Offer Price
                      </p>
                      <p className="text-2xl font-bold mt-1">
                        {calculations ? formatCurrency(calculations.offerPrice) : '—'}
                      </p>
                    </CardContent>
                  </Card>

                  <Card className="border-l-4 border-l-amber-500">
                    <CardContent className="py-4">
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <Banknote className="h-3.5 w-3.5" />
                        Total Funding Required
                      </p>
                      <p className="text-2xl font-bold mt-1">
                        {calculations ? formatCurrency(calculations.totalFundingRequired) : '—'}
                      </p>
                    </CardContent>
                  </Card>

                  <Card className={`border-l-4 ${
                    !calculations ? 'border-l-muted'
                    : calculations.fundingGap <= 0 ? 'border-l-green-500'
                    : calculations.fundingGap < calculations.offerPrice * 0.5 ? 'border-l-amber-500'
                    : 'border-l-red-500'
                  }`}>
                    <CardContent className="py-4">
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <CreditCard className="h-3.5 w-3.5" />
                        Cash to Introduce
                      </p>
                      <p className={`text-2xl font-bold mt-1 ${
                        !calculations ? ''
                        : calculations.fundingGap <= 0 ? 'text-green-700'
                        : calculations.fundingGap < calculations.offerPrice * 0.5 ? 'text-amber-700'
                        : 'text-red-700'
                      }`}>
                        {calculations ? formatCurrency(calculations.fundingGap) : '—'}
                      </p>
                    </CardContent>
                  </Card>
                </div>
              </div>

              <Separator />

              <div className="space-y-6">
                <PLSummarySection
                  financialData={financialsRaw}
                  adjustments={modelDetails?.adjustments || []}
                  calculations={calculations}
                  averagingYears={modelDetails?.averagingYears ?? 3}
                />

                {selectedModelId && modelDetails && (
                  <AdjustmentsSection
                    modelId={selectedModelId}
                    adjustments={modelDetails.adjustments || []}
                    calculations={calculations}
                    isLocked={isLocked}
                    onDataChange={() => {
                      queryClient.invalidateQueries({ queryKey: ['/api/v2/deal-models', selectedModelId] });
                    }}
                  />
                )}

                {SECTIONS.map(section => {
                  const Icon = section.icon;
                  return (
                    <Card key={section.num} className="opacity-70">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-base">
                          <span className="flex items-center justify-center h-6 w-6 rounded-full bg-muted text-xs font-bold">
                            {section.num}
                          </span>
                          <Icon className="h-4 w-4 text-muted-foreground" />
                          {section.title}
                        </CardTitle>
                        <CardDescription>{section.desc}</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center justify-center h-20 text-sm text-muted-foreground">
                          Section content coming soon
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
