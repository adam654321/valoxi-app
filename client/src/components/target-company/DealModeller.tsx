import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import ValuationSection from '@/components/deal-modeller/ValuationSection';
import FundingSection from '@/components/deal-modeller/FundingSection';
import ViabilitySection from '@/components/deal-modeller/ViabilitySection';
import PaymentTermsPanel from '@/components/deal-modeller/PaymentTermsPanel';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Plus,
  Lock,
  Calculator,
  PoundSterling,
  Banknote,
  CreditCard,
  Loader2,
  Send,
  Download,
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useHasFeature } from "@/context/subscription-context";

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
  archived: 'bg-muted text-muted-foreground',
};


export interface ExplainContext {
  companyName: string;
  sector: string;
  revenue?: number;
  adjustedEbitda?: number;
}

export default function DealModeller({ companyId }: DealModellerProps) {
  const { toast } = useToast();
  const [selectedModelId, setSelectedModelId] = useState<number | null>(null);
  const [transactionType, setTransactionType] = useState<string>('share_sale');

  const { data: targetCompany } = useQuery<any>({
    queryKey: ['/api/v2/target-companies', companyId],
    select: (response: any) => response?.data || response,
    enabled: !!companyId,
  });

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

  useEffect(() => {
    if (modelDetails) {
      setTransactionType((modelDetails as any).transactionType || 'share_sale');
    }
  }, [modelDetails?.id]);

  const { data: financialsRaw } = useQuery<FinancialsData>({
    queryKey: ['/api/v2/financial-data/company', companyId, 'financials'],
    select: (response: any) => response?.data || response,
    enabled: !!companyId,
  });

  const financialYears = useMemo<string[]>(() => {
    if (!financialsRaw?.periods) return [];
    return financialsRaw.periods
      .filter((p: any) => (p.periodType === 'statutory' || p.periodType === 'historic') && p.fiscalYear)
      .sort((a: any, b: any) => new Date(a.periodEnd).getTime() - new Date(b.periodEnd).getTime())
      .map((p: any) => String(p.fiscalYear));
  }, [financialsRaw]);

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
      isDebt: f.isDebt ?? false,
      isActive: f.isActive ?? false,
    }));

    const modelInput: DealModelInput = {
      averagingYears: modelDetails.averagingYears ?? 3,
      ebitdaMultiple: modelDetails.ebitdaMultiple ?? '3.0',
      plusExcessCash: modelDetails.plusExcessCash ?? '0',
      minusPrimaryDebt: modelDetails.minusPrimaryDebt ?? '0',
      minusOtherDebt: modelDetails.minusOtherDebt ?? '0',
      minusCorpTaxDue: (modelDetails as any).minusCorpTaxDue ?? '0',
      minusWorkingCapitalAdj: modelDetails.minusWorkingCapitalAdj ?? '0',
      plusPropertyValue: modelDetails.propertyValue ?? '0',
      otherAdjustments: null,
      feeLegalDdPercent: modelDetails.feeLegalDdPercent ?? '2.5',
      feeAccountingDdPercent: modelDetails.feeAccountingDdPercent ?? '1.5',
      feeBrokerPercent: modelDetails.feeBrokerPercent ?? '2.0',
      feeLoanArrangementPercent: modelDetails.feeLoanArrangementPercent ?? '1.0',
      feeDealMakerPercent: modelDetails.feeDealMakerPercent ?? '5.0',
      feeLegalDdType: (modelDetails.feeLegalDdType as 'percent' | 'fixed') ?? 'percent',
      feeAccountingDdType: (modelDetails.feeAccountingDdType as 'percent' | 'fixed') ?? 'percent',
      feeBrokerType: (modelDetails.feeBrokerType as 'percent' | 'fixed') ?? 'percent',
      feeLoanArrangementType: (modelDetails.feeLoanArrangementType as 'percent' | 'fixed') ?? 'percent',
      feeDealMakerType: (modelDetails.feeDealMakerType as 'percent' | 'fixed') ?? 'percent',
      customFees: null,
      workingCapitalMonths: (modelDetails as any).workingCapitalMonths ?? 3,
      workingCapitalMonthlyAmount: toNum((modelDetails as any).workingCapitalMonthlyAmount),
    };

    return calculateFullDealModel(reportedEbitdaByYear, adjustments, fundingLines, modelInput);
  }, [modelDetails, reportedEbitdaByYear]);

  const netCashFromBusiness = useMemo(() => {
    if (!modelDetails) return 0;
    const excessCash = toNum(modelDetails.plusExcessCash);
    const workingCap = toNum(modelDetails.minusWorkingCapitalAdj);
    return Math.max(0, excessCash - workingCap);
  }, [modelDetails]);

  const adjustedFundingGap = useMemo(() => {
    if (!calculations) return 0;
    const adjustedTotal = Math.max(0, calculations.offerPrice - netCashFromBusiness);
    return Math.round((adjustedTotal - calculations.totalFunded) * 100) / 100;
  }, [calculations, netCashFromBusiness]);

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

  const duplicateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', `/api/v2/deal-models/${selectedModelId}/duplicate`);
      return res.json();
    },
    onSuccess: (response: any) => {
      const newModel = response?.data || response;
      queryClient.invalidateQueries({ queryKey: ['/api/v2/deal-models/company', companyId] });
      if (newModel?.id) setSelectedModelId(newModel.id);
      toast({ title: 'New version created', description: `${newModel?.name || 'Deal model'} has been created as a new version.` });
    },
    onError: (error: Error) => {
      toast({ title: 'Could not create new version', description: error.message, variant: 'destructive' });
    },
  });

  const transactionTypeMutation = useMutation({
    mutationFn: async (value: string) => {
      const res = await apiRequest('PUT', `/api/v2/deal-models/${selectedModelId}`, { transactionType: value });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/v2/deal-models', selectedModelId] });
    },
    onError: (error: Error) => {
      toast({ title: 'Could not save transaction type', description: error.message, variant: 'destructive' });
    },
  });

  const sendOfferMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/v2/deal-documents/send-offer', {
        targetCompanyId: companyId,
        dealModelId: selectedModelId,
      });
      return res.json();
    },
    onSuccess: (data: any) => {
      toast({ title: 'Offer Sent', description: `Offer letter v${data.version} has been sent to the seller's portal.` });
    },
    onError: (err: Error) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  const downloadOfferMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/v2/deal-documents/create-offline', {
        targetCompanyId: companyId,
        documentType: 'offer_letter',
        dealModelId: selectedModelId,
      });
      const data = await res.json();
      const docId = data?.id ?? data?.data?.id;
      if (docId) window.location.href = `/api/v2/deal-documents/${docId}/download-word`;
    },
    onSuccess: () => {
      toast({ title: 'Download Started', description: "Offer letter downloading — send it to the seller then return here to record their response." });
    },
    onError: (err: Error) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  const hasFullDealModeller = useHasFeature("fullDealModeller");

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

            <div className="ml-auto flex items-center gap-2">
              {selectedModelId && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="default"
                      size="sm"
                      disabled={sendOfferMutation.isPending}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      {sendOfferMutation.isPending ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4 mr-2" />
                      )}
                      {sendOfferMutation.isPending ? 'Sending...' : 'Send Offer'}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Send Offer Letter</AlertDialogTitle>
                      <AlertDialogDescription>
                        Choose how to send this offer to the seller.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <div className="flex flex-col gap-3 w-full">
                        <div className="flex flex-col sm:flex-row gap-2">
                          <AlertDialogAction
                            className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                            disabled={sendOfferMutation.isPending}
                            onClick={() => sendOfferMutation.mutate()}
                          >
                            {sendOfferMutation.isPending
                              ? <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              : <Send className="h-4 w-4 mr-2" />}
                            Send via Portal
                          </AlertDialogAction>
                          <AlertDialogAction
                            className="flex-1 bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-border"
                            disabled={downloadOfferMutation.isPending}
                            onClick={() => downloadOfferMutation.mutate()}
                          >
                            {downloadOfferMutation.isPending
                              ? <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              : <Download className="h-4 w-4 mr-2" />}
                            Download Word Doc
                          </AlertDialogAction>
                        </div>
                        <AlertDialogCancel className="w-full">Cancel</AlertDialogCancel>
                      </div>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}

              {hasFullDealModeller === false ? (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-flex">
                        <Button variant="secondary" size="sm" disabled className="opacity-50 cursor-not-allowed pointer-events-none">
                          <Lock className="h-4 w-4 mr-2" />
                          New Version
                        </Button>
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="max-w-[200px] text-center">
                      <p className="font-medium">Version History</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Upgrade to Professional to create and compare multiple deal model versions.</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ) : (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => duplicateMutation.mutate()}
                  disabled={duplicateMutation.isPending || !selectedModelId}
                >
                  {duplicateMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4 mr-2" />
                  )}
                  New Version
                </Button>
              )}
            </div>
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
                        Deal Cost
                      </p>
                      <p className="text-2xl font-bold mt-1">
                        {calculations ? formatCurrency(calculations.offerPrice) : '—'}
                      </p>
                    </CardContent>
                  </Card>

                  <Card className={`border-l-4 ${
                    !calculations ? 'border-l-muted'
                    : adjustedFundingGap <= 0 ? 'border-l-green-500'
                    : adjustedFundingGap < calculations.offerPrice * 0.5 ? 'border-l-amber-500'
                    : 'border-l-red-500'
                  }`}>
                    <CardContent className="py-4">
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <CreditCard className="h-3.5 w-3.5" />
                        Cash to Introduce
                      </p>
                      <p className={`text-2xl font-bold mt-1 ${
                        !calculations ? ''
                        : adjustedFundingGap <= 0 ? 'text-green-700'
                        : adjustedFundingGap < calculations.offerPrice * 0.5 ? 'text-amber-700'
                        : 'text-red-700'
                      }`}>
                        {calculations ? formatCurrency(Math.max(0, adjustedFundingGap)) : '—'}
                      </p>
                    </CardContent>
                  </Card>
                </div>
              </div>

              <Separator />

              <div className="space-y-6">
                <Card>
                  <CardContent className="py-4">
                    <div className="flex items-center gap-4">
                      <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">
                        Transaction Type
                      </span>
                      <Select
                        value={transactionType}
                        onValueChange={(val) => {
                          setTransactionType(val);
                          transactionTypeMutation.mutate(val);
                        }}
                        disabled={isLocked}
                      >
                        <SelectTrigger className="w-[200px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="share_sale">Share Sale</SelectItem>
                          <SelectItem value="asset_sale">Asset Sale</SelectItem>
                        </SelectContent>
                      </Select>
                      <span className="text-xs text-muted-foreground">
                        {transactionType === 'share_sale'
                          ? 'Buyer acquires the company entity — shares transfer with all assets and liabilities.'
                          : 'Buyer acquires specific assets only — liabilities remain with the seller entity.'}
                      </span>
                    </div>
                  </CardContent>
                </Card>

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
                    financialYears={financialYears}
                    onDataChange={() => {
                      queryClient.invalidateQueries({ queryKey: ['/api/v2/deal-models', selectedModelId] });
                    }}
                  />
                )}

                {selectedModelId && modelDetails && (
                  <ValuationSection
                    modelId={selectedModelId}
                    model={modelDetails}
                    calculations={calculations}
                    isLocked={isLocked}
                    reportedEbitdaByYear={reportedEbitdaByYear}
                    onDataChange={() => {
                      queryClient.invalidateQueries({ queryKey: ['/api/v2/deal-models', selectedModelId] });
                    }}
                    explainContext={targetCompany ? {
                      companyName: targetCompany.companyName || 'Unknown',
                      sector: targetCompany.industry || targetCompany.subSector || 'Unknown',
                      revenue: toNum(targetCompany.annualRevenue) || undefined,
                      adjustedEbitda: calculations?.averageAdjustedEbitda || undefined,
                    } : undefined}
                  />
                )}

                {selectedModelId && modelDetails && (
                  <FundingSection
                    modelId={selectedModelId}
                    fundingLines={modelDetails.fundingLines || []}
                    calculations={calculations}
                    totalFundingRequired={calculations?.offerPrice ?? 0}
                    cashFromBusiness={netCashFromBusiness}
                    isLocked={isLocked}
                    onDataChange={() => {
                      queryClient.invalidateQueries({ queryKey: ['/api/v2/deal-models', selectedModelId] });
                    }}
                  />
                )}

                <PaymentTermsPanel
                  calculations={calculations}
                  fundingLines={modelDetails?.fundingLines || []}
                  transactionType={transactionType}
                />

                <ViabilitySection
                  modelId={selectedModelId}
                  model={modelDetails}
                  calculations={calculations}
                  fundingLines={modelDetails?.fundingLines || []}
                  isLocked={isLocked}
                  cashFromBusiness={netCashFromBusiness}
                  onDataChange={() => {
                    queryClient.invalidateQueries({ queryKey: ['/api/v2/deal-models', selectedModelId] });
                  }}
                  explainContext={targetCompany ? {
                    companyName: targetCompany.companyName || 'Unknown',
                    sector: targetCompany.industry || targetCompany.subSector || 'Unknown',
                    revenue: toNum(targetCompany.annualRevenue) || undefined,
                    adjustedEbitda: calculations?.averageAdjustedEbitda || undefined,
                  } : undefined}
                />
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
