import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { formatCurrency } from '@/lib/format-utils';
import {
  calculateFullDealModel,
  toNum,
  type CalculationResult,
  type AdjustmentInput,
  type FundingLineInput,
  type DealModelInput,
} from '@shared/calculators/deal-model.calc';
import type { DealModel, DealModelAdjustment, DealModelFundingLine } from '@shared/schema';
import {
  Scale,
  Check,
  Loader2,
  Info,
} from 'lucide-react';

interface DealModelWithDetails extends DealModel {
  adjustments: DealModelAdjustment[];
  fundingLines: DealModelFundingLine[];
}

interface ValuationSectionProps {
  modelId: number;
  model: DealModelWithDetails;
  calculations: CalculationResult | null;
  isLocked: boolean;
  reportedEbitdaByYear: Record<string, number>;
  onDataChange: () => void;
}

interface LocalValues {
  averagingYears: number;
  ebitdaMultiple: number;
  plusExcessCash: number;
  plusPropertyValue: number;
  minusPrimaryDebt: number;
  minusOtherDebt: number;
  minusCorpTaxDue: number;
  minusWorkingCapitalAdj: number;
}

function initLocal(model: DealModel): LocalValues {
  return {
    averagingYears: model.averagingYears ?? 3,
    ebitdaMultiple: toNum(model.ebitdaMultiple),
    plusExcessCash: toNum(model.plusExcessCash),
    plusPropertyValue: toNum(model.propertyValue),
    minusPrimaryDebt: toNum(model.minusPrimaryDebt),
    minusOtherDebt: toNum(model.minusOtherDebt),
    minusCorpTaxDue: toNum((model as any).minusCorpTaxDue),
    minusWorkingCapitalAdj: toNum(model.minusWorkingCapitalAdj),
  };
}

function buildModelInput(local: LocalValues, model: DealModel): DealModelInput {
  return {
    averagingYears: local.averagingYears,
    ebitdaMultiple: local.ebitdaMultiple,
    plusExcessCash: local.plusExcessCash,
    minusPrimaryDebt: local.minusPrimaryDebt,
    minusOtherDebt: local.minusOtherDebt,
    minusCorpTaxDue: local.minusCorpTaxDue,
    minusWorkingCapitalAdj: local.minusWorkingCapitalAdj,
    plusPropertyValue: local.plusPropertyValue,
    otherAdjustments: null,
    feeLegalDdPercent: model.feeLegalDdPercent ?? '2.5',
    feeAccountingDdPercent: model.feeAccountingDdPercent ?? '1.5',
    feeBrokerPercent: model.feeBrokerPercent ?? '2.0',
    feeLoanArrangementPercent: model.feeLoanArrangementPercent ?? '1.0',
    feeDealMakerPercent: model.feeDealMakerPercent ?? '5.0',
    customFees: null,
  };
}

function getExpertValue(snapshot: any, field: string): number | null {
  if (!snapshot || typeof snapshot !== 'object') return null;
  const val = snapshot[field];
  if (val === null || val === undefined) return null;
  const n = Number(val);
  return isNaN(n) ? null : n;
}

export default function ValuationSection({
  modelId,
  model,
  calculations: parentCalcs,
  isLocked,
  reportedEbitdaByYear,
  onDataChange,
}: ValuationSectionProps) {
  const { toast } = useToast();
  const [local, setLocal] = useState<LocalValues>(() => initLocal(model));
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef<Partial<Record<string, any>> | null>(null);
  const isEditingRef = useRef(false);
  const prevModelIdRef = useRef(model.id);

  useEffect(() => {
    if (model.id !== prevModelIdRef.current) {
      prevModelIdRef.current = model.id;
      setLocal(initLocal(model));
      return;
    }
    if (!isEditingRef.current) {
      setLocal(initLocal(model));
    }
  }, [model.id, model.updatedAt]);

  const handleFocus = useCallback(() => {
    isEditingRef.current = true;
  }, []);

  const handleBlur = useCallback(() => {
    isEditingRef.current = false;
    setTimeout(() => {
      if (!isEditingRef.current) {
        setLocal(initLocal(model));
      }
    }, 100);
  }, [model]);

  const adjustmentInputs: AdjustmentInput[] = useMemo(() =>
    (model.adjustments || []).map(a => ({
      adjustmentType: a.adjustmentType as 'add_back' | 'deduction',
      amount: a.amount,
      amountsByYear: a.amountsByYear as Record<string, number> | null,
      status: a.status || 'suggested',
      userOverrideAmount: null,
    })),
    [model.adjustments]
  );

  const fundingInputs: FundingLineInput[] = useMemo(() =>
    (model.fundingLines || []).map(f => ({
      fundingType: f.fundingType,
      assetBaseValue: f.assetBaseValue,
      ltvPercent: f.ltvPercent,
      amountUsed: f.amountUsed,
      interestRate: f.interestRate,
      termMonths: f.termMonths,
      arrangementFeePercent: null,
      isActive: f.isActive ?? false,
    })),
    [model.fundingLines]
  );

  const localCalcs = useMemo<CalculationResult | null>(() => {
    if (Object.keys(reportedEbitdaByYear).length === 0) return parentCalcs;
    const modelInput = buildModelInput(local, model);
    return calculateFullDealModel(reportedEbitdaByYear, adjustmentInputs, fundingInputs, modelInput);
  }, [local, reportedEbitdaByYear, adjustmentInputs, fundingInputs, model, parentCalcs]);

  const updateMutation = useMutation({
    mutationFn: async (updates: Record<string, any>) => {
      const res = await apiRequest('PUT', `/api/v2/deal-models/${modelId}`, updates);
      return res.json();
    },
    onSuccess: () => {
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 1500);
      if (!isEditingRef.current) {
        onDataChange();
      }
    },
    onError: (error: Error) => {
      setSaveStatus('idle');
      toast({ title: 'Save failed', description: error.message, variant: 'destructive' });
    },
  });

  const debounceSave = useCallback((updates: Record<string, any>) => {
    pendingRef.current = { ...(pendingRef.current || {}), ...updates };
    setSaveStatus('saving');
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (pendingRef.current) {
        updateMutation.mutate(pendingRef.current);
        pendingRef.current = null;
      }
    }, 600);
  }, [updateMutation]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const updateLocal = useCallback((field: keyof LocalValues, value: number, dbField?: string) => {
    setLocal(prev => ({ ...prev, [field]: value }));
    if (!isLocked) {
      const saveField = dbField || field;
      debounceSave({ [saveField]: String(value) });
    }
  }, [isLocked, debounceSave]);

  const acceptedCount = useMemo(() =>
    (model.adjustments || []).filter(a => a.status === 'accepted' || a.status === 'modified').length,
    [model.adjustments]
  );

  const snapshot = model.expertDataSnapshot as Record<string, any> | null;

  const multipleLow = toNum(model.multipleLow) || getExpertValue(snapshot, 'multipleLow') || null;
  const multipleHigh = toNum(model.multipleHigh) || getExpertValue(snapshot, 'multipleHigh') || null;
  const hasRange = multipleLow !== null && multipleHigh !== null && multipleLow < multipleHigh;

  const ev = localCalcs?.enterpriseValue ?? 0;
  const offerPrice = localCalcs?.offerPrice ?? 0;
  const avgEbitda = localCalcs?.averageAdjustedEbitda ?? 0;

  const bridgeItems: Array<{
    label: string;
    field: keyof LocalValues;
    dbField: string;
    direction: '+' | '-';
    expertField?: string;
  }> = [
    { label: 'Excess Cash', field: 'plusExcessCash', dbField: 'plusExcessCash', direction: '+', expertField: 'plusExcessCash' },
    { label: 'Property Value', field: 'plusPropertyValue', dbField: 'propertyValue', direction: '+', expertField: 'propertyValue' },
    { label: 'Primary Debt', field: 'minusPrimaryDebt', dbField: 'minusPrimaryDebt', direction: '-', expertField: 'minusPrimaryDebt' },
    { label: 'Other Debt / Director Loans', field: 'minusOtherDebt', dbField: 'minusOtherDebt', direction: '-', expertField: 'minusOtherDebt' },
    { label: 'Corporation Tax Due', field: 'minusCorpTaxDue', dbField: 'minusCorpTaxDue', direction: '-', expertField: 'minusCorpTaxDue' },
    { label: 'Working Capital Adjustment', field: 'minusWorkingCapitalAdj', dbField: 'minusWorkingCapitalAdj', direction: '-', expertField: 'minusWorkingCapitalAdj' },
  ];

  const upfrontCash = toNum(model.upfrontCash);
  const deferredAmount = toNum(model.deferredAmount);
  const earnoutMaximum = toNum(model.earnoutMaximum);
  const hasConsideration = upfrontCash > 0 || deferredAmount > 0 || earnoutMaximum > 0;
  const considerationTotal = upfrontCash + deferredAmount + earnoutMaximum;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <span className="flex items-center justify-center h-6 w-6 rounded-full bg-muted text-xs font-bold">3</span>
            <Scale className="h-4 w-4 text-muted-foreground" />
            What's It Worth?
          </CardTitle>
          {saveStatus !== 'idle' && (
            <span className="flex items-center gap-1 text-sm text-muted-foreground">
              {saveStatus === 'saving' ? (
                <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving...</>
              ) : (
                <><Check className="h-3.5 w-3.5 text-green-600" /> Saved</>
              )}
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-8">
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">EBITDA Basis</h4>
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex-1">
              <p className="text-sm text-muted-foreground">Average Adjusted EBITDA</p>
              <p className="text-2xl font-bold">{formatCurrency(avgEbitda)}</p>
            </div>
            <div className="flex flex-col gap-1.5">
              <p className="text-sm text-muted-foreground">Averaging period</p>
              <div className="flex border rounded-md overflow-hidden">
                {[2, 3, 4, 5].map(n => (
                  <button
                    key={n}
                    onClick={() => updateLocal('averagingYears', n, 'averagingYears')}
                    disabled={isLocked}
                    className={`px-3.5 py-2 text-sm font-medium transition-colors ${
                      local.averagingYears === n
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-background hover:bg-muted text-foreground'
                    } ${isLocked ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'} border-r last:border-r-0`}
                  >
                    {n}yr
                  </button>
                ))}
              </div>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            Based on {acceptedCount} accepted adjustment{acceptedCount !== 1 ? 's' : ''}
          </p>
        </div>

        <Separator />

        <div className="space-y-4">
          <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Valuation Multiple</h4>

          {hasRange && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Sector range (from expert analysis)</p>
              <div className="relative h-8">
                <div className="absolute top-3 left-0 right-0 h-2 bg-muted rounded-full" />
                <div
                  className="absolute top-3 h-2 bg-blue-100 rounded-full"
                  style={{
                    left: `${Math.max(0, ((multipleLow! - 1) / 9) * 100)}%`,
                    right: `${Math.max(0, 100 - ((multipleHigh! - 1) / 9) * 100)}%`,
                  }}
                />
                <div
                  className="absolute top-1.5 text-sm font-medium text-muted-foreground"
                  style={{ left: `${Math.max(0, ((multipleLow! - 1) / 9) * 100)}%`, transform: 'translateX(-50%)' }}
                >
                  {multipleLow!.toFixed(1)}x
                </div>
                <div
                  className="absolute top-1.5 text-sm font-medium text-muted-foreground"
                  style={{ left: `${Math.min(100, ((multipleHigh! - 1) / 9) * 100)}%`, transform: 'translateX(-50%)' }}
                >
                  {multipleHigh!.toFixed(1)}x
                </div>
                {(() => {
                  const pos = ((local.ebitdaMultiple - 1) / 9) * 100;
                  const inRange = local.ebitdaMultiple >= multipleLow! && local.ebitdaMultiple <= multipleHigh!;
                  return (
                    <div
                      className={`absolute top-2 w-4 h-4 rounded-full border-2 ${
                        inRange ? 'bg-primary border-primary' : 'bg-amber-500 border-amber-600'
                      }`}
                      style={{ left: `${Math.max(0, Math.min(100, pos))}%`, transform: 'translateX(-50%)' }}
                    />
                  );
                })()}
              </div>
              {local.ebitdaMultiple < multipleLow! && (
                <p className="text-sm text-amber-600">Below expert's suggested range</p>
              )}
              {local.ebitdaMultiple > multipleHigh! && (
                <p className="text-sm text-amber-600">Above expert's suggested range</p>
              )}
            </div>
          )}

          <div className="flex items-center gap-4">
            <div className="flex-1">
              <Slider
                value={[local.ebitdaMultiple]}
                onValueChange={([v]) => updateLocal('ebitdaMultiple', Math.round(v * 10) / 10, 'ebitdaMultiple')}
                min={1}
                max={10}
                step={0.1}
                disabled={isLocked}
                className="py-2"
              />
              <div className="flex justify-between text-sm text-muted-foreground mt-1">
                <span>1.0x</span>
                <span>10.0x</span>
              </div>
            </div>
            <div className="w-24">
              <Input
                type="number"
                step="0.1"
                min="1"
                max="10"
                value={local.ebitdaMultiple}
                onFocus={handleFocus}
                onBlur={handleBlur}
                onChange={e => {
                  const v = parseFloat(e.target.value);
                  if (!isNaN(v) && v >= 0.1 && v <= 20) {
                    updateLocal('ebitdaMultiple', Math.round(v * 10) / 10, 'ebitdaMultiple');
                  }
                }}
                disabled={isLocked}
                className="text-center text-base font-semibold"
              />
            </div>
          </div>

          <div className="bg-muted/50 rounded-lg p-4">
            <p className="text-sm text-muted-foreground">Enterprise Value</p>
            <p className="text-xl font-bold">
              EV = {formatCurrency(avgEbitda)} × {local.ebitdaMultiple.toFixed(1)}x = {formatCurrency(ev)}
            </p>
          </div>
        </div>

        <Separator />

        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">EV-to-Equity Bridge</h4>

          <div className="border rounded-lg overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 bg-primary/5 border-b">
              <span className="text-base font-semibold">Enterprise Value</span>
              <span className="font-bold text-xl">{formatCurrency(ev)}</span>
            </div>

            {bridgeItems.map((item) => {
              const val = local[item.field];
              const expertVal = getExpertValue(snapshot, item.expertField || '');
              const isPlus = item.direction === '+';
              const hasExpert = expertVal !== null;
              const diffFromExpert = hasExpert && Math.abs(val - expertVal) > 0.01;

              return (
                <div
                  key={item.field}
                  className={`flex items-center gap-3 px-4 py-3 border-b ${
                    isPlus ? 'border-l-4 border-l-green-400' : 'border-l-4 border-l-red-400'
                  }`}
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className={`text-sm font-bold ${isPlus ? 'text-green-600' : 'text-red-600'}`}>
                      {isPlus ? '+' : '−'}
                    </span>
                    <span className="text-sm font-medium truncate">{item.label}</span>
                    {hasExpert && !diffFromExpert && (
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 shrink-0">
                        From expert
                      </Badge>
                    )}
                    {hasExpert && diffFromExpert && (
                      <span className="text-xs text-muted-foreground shrink-0" title={`Expert: ${formatCurrency(expertVal)}`}>
                        (expert: {formatCurrency(expertVal)})
                      </span>
                    )}
                  </div>
                  <div className="w-36 shrink-0">
                    <div className="relative">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">£</span>
                      <Input
                        type="number"
                        value={val || ''}
                        onFocus={handleFocus}
                        onBlur={handleBlur}
                        onChange={e => {
                          const v = parseFloat(e.target.value);
                          updateLocal(item.field, isNaN(v) ? 0 : v, item.dbField);
                        }}
                        disabled={isLocked}
                        className="pl-7 text-right text-base h-9"
                        placeholder="0"
                      />
                    </div>
                  </div>
                </div>
              );
            })}

            <div className="flex items-center justify-between px-4 py-3 bg-primary/5">
              <span className="text-base font-semibold">Offer Price</span>
              <span className="font-bold text-xl">{formatCurrency(offerPrice)}</span>
            </div>
          </div>
        </div>

        {hasConsideration && (
          <>
            <Separator />
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  Indicative Consideration Structure
                </h4>
                <Badge variant="outline" className="text-xs h-5">From Deal Structure Expert</Badge>
              </div>

              <div className="bg-muted/30 rounded-lg p-4 space-y-2.5">
                {upfrontCash > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Upfront Cash</span>
                    <span className="font-medium">{formatCurrency(upfrontCash)}</span>
                  </div>
                )}
                {deferredAmount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Deferred Consideration</span>
                    <span className="font-medium">{formatCurrency(deferredAmount)}</span>
                  </div>
                )}
                {earnoutMaximum > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Earnout (maximum)</span>
                    <span className="font-medium">{formatCurrency(earnoutMaximum)}</span>
                  </div>
                )}
                <Separator />
                <div className="flex justify-between text-base font-semibold">
                  <span>Total</span>
                  <span>{formatCurrency(considerationTotal)}</span>
                </div>
                {Math.abs(considerationTotal - offerPrice) > 1 && offerPrice > 0 && (
                  <p className="text-sm text-amber-600 flex items-center gap-1 mt-1">
                    <Info className="h-3.5 w-3.5" />
                    Total differs from offer price by {formatCurrency(Math.abs(considerationTotal - offerPrice))}
                  </p>
                )}
              </div>
              <p className="text-sm text-muted-foreground italic">
                This can be refined in the deal structure section.
              </p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
