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
} from 'lucide-react';
import ExplainButton from '@/components/analysis/ExplainButton';

interface DealModelWithDetails extends DealModel {
  adjustments: DealModelAdjustment[];
  fundingLines: DealModelFundingLine[];
}

interface ExplainContext {
  companyName: string;
  sector: string;
  revenue?: number;
  adjustedEbitda?: number;
}

interface ValuationSectionProps {
  modelId: number;
  model: DealModelWithDetails;
  calculations: CalculationResult | null;
  isLocked: boolean;
  reportedEbitdaByYear: Record<string, number>;
  onDataChange: () => void;
  explainContext?: ExplainContext;
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
  workingCapitalMonths: number;
  workingCapitalMonthlyAmount: number;
  workingCapitalOverride: boolean;
}

function initLocal(model: DealModel): LocalValues {
  const m = model as any;
  const monthlyAmount = toNum(m.workingCapitalMonthlyAmount);
  const months = m.workingCapitalMonths ?? 3;
  const calculatedTotal = monthlyAmount * months;
  const storedTotal = toNum(model.minusWorkingCapitalAdj);
  const isOverridden = monthlyAmount > 0 && Math.abs(storedTotal - calculatedTotal) > 1;

  return {
    averagingYears: model.averagingYears ?? 3,
    ebitdaMultiple: toNum(model.ebitdaMultiple),
    plusExcessCash: toNum(model.plusExcessCash),
    plusPropertyValue: toNum(model.propertyValue),
    minusPrimaryDebt: toNum(model.minusPrimaryDebt),
    minusOtherDebt: toNum(model.minusOtherDebt),
    minusCorpTaxDue: toNum((model as any).minusCorpTaxDue),
    minusWorkingCapitalAdj: storedTotal,
    workingCapitalMonths: months,
    workingCapitalMonthlyAmount: monthlyAmount,
    workingCapitalOverride: isOverridden,
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
    workingCapitalMonths: local.workingCapitalMonths,
    workingCapitalMonthlyAmount: local.workingCapitalMonthlyAmount,
    workingCapitalOverride: local.workingCapitalOverride,
    otherAdjustments: null,
    feeLegalDdAmount: model.feeLegalDdAmount ?? '0',
    feeAccountingDdAmount: model.feeAccountingDdAmount ?? '0',
    feeLoanArrangementAmount: model.feeLoanArrangementAmount ?? '0',
    feeDealMakerAmount: model.feeDealMakerAmount ?? '0',
    customFees: (model.customFees as Array<{ label: string; amount: string | number }>) ?? [],
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
  explainContext,
}: ValuationSectionProps) {
  const { toast } = useToast();
  const [local, setLocal] = useState<LocalValues>(() => initLocal(model));
  const [displayValues, setDisplayValues] = useState<Record<string, string>>(() => {
    const init = initLocal(model);
    return {
      ebitdaMultiple: String(init.ebitdaMultiple),
      plusExcessCash: String(init.plusExcessCash),
      plusPropertyValue: String(init.plusPropertyValue),
      minusPrimaryDebt: String(init.minusPrimaryDebt),
      minusOtherDebt: String(init.minusOtherDebt),
      minusCorpTaxDue: String(init.minusCorpTaxDue),
      minusWorkingCapitalAdj: String(init.minusWorkingCapitalAdj),
    };
  });
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef<Partial<Record<string, any>> | null>(null);
  const isEditingRef = useRef(false);
  const prevModelIdRef = useRef(model.id);
  const savePendingRef = useRef(false);

  const syncDisplayFromLocal = useCallback((values: LocalValues) => {
    setDisplayValues({
      ebitdaMultiple: String(values.ebitdaMultiple),
      plusExcessCash: String(values.plusExcessCash),
      plusPropertyValue: String(values.plusPropertyValue),
      minusPrimaryDebt: String(values.minusPrimaryDebt),
      minusOtherDebt: String(values.minusOtherDebt),
      minusCorpTaxDue: String(values.minusCorpTaxDue),
      minusWorkingCapitalAdj: String(values.minusWorkingCapitalAdj),
    });
  }, []);

  useEffect(() => {
    if (model.id !== prevModelIdRef.current) {
      prevModelIdRef.current = model.id;
      const init = initLocal(model);
      setLocal(init);
      syncDisplayFromLocal(init);
      return;
    }
    if (!isEditingRef.current && !savePendingRef.current) {
      const init = initLocal(model);
      setLocal(init);
      syncDisplayFromLocal(init);
    }
  }, [model.id, model.updatedAt, syncDisplayFromLocal]);

  const handleFocus = useCallback(() => {
    isEditingRef.current = true;
  }, []);

  const handleBlur = useCallback(() => {
    isEditingRef.current = false;
  }, []);

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
      savePendingRef.current = false;
      if (!isEditingRef.current) {
        onDataChange();
      }
    },
    onError: (error: Error) => {
      setSaveStatus('idle');
      savePendingRef.current = false;
      toast({ title: 'Save failed', description: error.message, variant: 'destructive' });
    },
  });

  const debounceSave = useCallback((updates: Record<string, any>) => {
    pendingRef.current = { ...(pendingRef.current || {}), ...updates };
    savePendingRef.current = true;
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
  const receivablesInterestAnnual = localCalcs?.receivablesInterestAnnual ?? 0;
  const valuationEbitda = localCalcs?.valuationEbitda ?? avgEbitda;

  type NumericLocalField = Exclude<keyof LocalValues, 'workingCapitalOverride'>;
  const bridgeItems: Array<{
    label: string;
    field: NumericLocalField;
    dbField: string;
    direction: '+' | '-';
    expertField?: string;
  }> = [
    { label: 'Excess Cash', field: 'plusExcessCash', dbField: 'plusExcessCash', direction: '+', expertField: 'plusExcessCash' },
    { label: 'Property Value', field: 'plusPropertyValue', dbField: 'propertyValue', direction: '+', expertField: 'propertyValue' },
    { label: 'Primary Debt', field: 'minusPrimaryDebt', dbField: 'minusPrimaryDebt', direction: '-', expertField: 'minusPrimaryDebt' },
    { label: 'Other Debt / Director Loans', field: 'minusOtherDebt', dbField: 'minusOtherDebt', direction: '-', expertField: 'minusOtherDebt' },
    { label: 'Corporation Tax Due', field: 'minusCorpTaxDue', dbField: 'minusCorpTaxDue', direction: '-', expertField: 'minusCorpTaxDue' },
  ];


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
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                Average Adjusted EBITDA
                {explainContext && <ExplainButton metricKey="Average Adjusted EBITDA" metricValue={formatCurrency(avgEbitda)} context={explainContext} />}
              </p>
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
          <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
            EBITDA Multiple
            {explainContext && <ExplainButton metricKey="EBITDA Multiple" metricValue={`${local.ebitdaMultiple.toFixed(1)}x`} context={explainContext} />}
          </h4>

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
                onValueChange={([v]) => {
                  const rounded = Math.round(v * 10) / 10;
                  updateLocal('ebitdaMultiple', rounded, 'ebitdaMultiple');
                  setDisplayValues(prev => ({ ...prev, ebitdaMultiple: String(rounded) }));
                }}
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
                type="text"
                inputMode="decimal"
                value={displayValues.ebitdaMultiple}
                onFocus={handleFocus}
                onBlur={() => {
                  handleBlur();
                  const parsed = parseFloat(displayValues.ebitdaMultiple);
                  if (isNaN(parsed) || displayValues.ebitdaMultiple.trim() === '') {
                    setDisplayValues(prev => ({ ...prev, ebitdaMultiple: String(local.ebitdaMultiple) }));
                  } else {
                    const clamped = Math.max(1, Math.min(10, Math.round(parsed * 10) / 10));
                    setDisplayValues(prev => ({ ...prev, ebitdaMultiple: String(clamped) }));
                    updateLocal('ebitdaMultiple', clamped, 'ebitdaMultiple');
                  }
                }}
                onChange={e => {
                  const raw = e.target.value;
                  setDisplayValues(prev => ({ ...prev, ebitdaMultiple: raw }));
                  const parsed = parseFloat(raw);
                  if (!isNaN(parsed)) {
                    setLocal(prev => ({ ...prev, ebitdaMultiple: parsed }));
                  }
                }}
                disabled={isLocked}
                className="text-center text-base font-semibold"
              />
            </div>
          </div>

          <div className="bg-muted/50 rounded-lg p-4">
            {receivablesInterestAnnual > 0 && (
              <div className="mb-3 space-y-1 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Average Adjusted EBITDA</span>
                  <span className="tabular-nums">{formatCurrency(avgEbitda)}</span>
                </div>
                <div className="flex items-center justify-between text-amber-700 dark:text-amber-400">
                  <span>Less invoice finance cost</span>
                  <span className="tabular-nums">−{formatCurrency(receivablesInterestAnnual)}</span>
                </div>
                <div className="flex items-center justify-between font-medium border-t pt-1">
                  <span>Valuation EBITDA</span>
                  <span className="tabular-nums">{formatCurrency(valuationEbitda)}</span>
                </div>
              </div>
            )}
            <p className="text-sm text-muted-foreground">Enterprise Value</p>
            <p className="text-xl font-bold">
              EV = {formatCurrency(valuationEbitda)} × {local.ebitdaMultiple.toFixed(1)}x = {formatCurrency(ev)}
            </p>
            {receivablesInterestAnnual > 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                Invoice finance is a revolving working capital cost, so it reduces the EBITDA the business is valued on. The interest is still serviced in the debt cover ratio.
              </p>
            )}
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
              const val = local[item.field] as number;
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
                        type="text"
                        inputMode="numeric"
                        value={displayValues[item.field] ?? String(val)}
                        onFocus={handleFocus}
                        onBlur={() => {
                          handleBlur();
                          const raw = displayValues[item.field] ?? '';
                          const parsed = parseFloat(raw);
                          if (isNaN(parsed) || raw.trim() === '') {
                            const numVal = raw.trim() === '' ? 0 : val;
                            setDisplayValues(prev => ({ ...prev, [item.field]: String(numVal) }));
                            updateLocal(item.field, numVal, item.dbField);
                          } else {
                            setDisplayValues(prev => ({ ...prev, [item.field]: String(parsed) }));
                            updateLocal(item.field, parsed, item.dbField);
                          }
                        }}
                        onChange={e => {
                          const raw = e.target.value;
                          setDisplayValues(prev => ({ ...prev, [item.field]: raw }));
                          const parsed = parseFloat(raw);
                          if (!isNaN(parsed)) {
                            setLocal(prev => ({ ...prev, [item.field]: parsed }));
                          }
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

            {(() => {
              const hasAutoCalc = local.workingCapitalMonthlyAmount > 0;
              const calculatedTotal = local.workingCapitalMonthlyAmount * local.workingCapitalMonths;
              const displayValue = local.workingCapitalOverride ? local.minusWorkingCapitalAdj : calculatedTotal;

              if (!hasAutoCalc) {
                return (
                  <div className="flex items-center gap-3 px-4 py-3 border-b border-l-4 border-l-red-400">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <span className="text-sm font-bold text-red-600">−</span>
                      <span className="text-sm font-medium truncate">Working Capital Adjustment</span>
                      <span className="text-xs text-muted-foreground">(no income data)</span>
                    </div>
                    <div className="w-36 shrink-0">
                      <div className="relative">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">£</span>
                        <Input
                          type="text"
                          inputMode="numeric"
                          value={displayValues.minusWorkingCapitalAdj ?? String(local.minusWorkingCapitalAdj)}
                          onFocus={handleFocus}
                          onBlur={() => {
                            handleBlur();
                            const raw = displayValues.minusWorkingCapitalAdj ?? '';
                            const parsed = parseFloat(raw);
                            if (isNaN(parsed) || raw.trim() === '') {
                              const numVal = raw.trim() === '' ? 0 : local.minusWorkingCapitalAdj;
                              setDisplayValues(prev => ({ ...prev, minusWorkingCapitalAdj: String(numVal) }));
                              updateLocal('minusWorkingCapitalAdj', numVal, 'minusWorkingCapitalAdj');
                            } else {
                              setDisplayValues(prev => ({ ...prev, minusWorkingCapitalAdj: String(parsed) }));
                              updateLocal('minusWorkingCapitalAdj', parsed, 'minusWorkingCapitalAdj');
                            }
                          }}
                          onChange={e => {
                            const raw = e.target.value;
                            setDisplayValues(prev => ({ ...prev, minusWorkingCapitalAdj: raw }));
                            const parsed = parseFloat(raw);
                            if (!isNaN(parsed)) {
                              setLocal(prev => ({ ...prev, minusWorkingCapitalAdj: parsed }));
                            }
                          }}
                          disabled={isLocked}
                          className="pl-7 text-right text-base h-9"
                          placeholder="0"
                        />
                      </div>
                    </div>
                  </div>
                );
              }

              return (
                <div className="border-b border-l-4 border-l-red-400">
                  <div className="px-4 py-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-red-600">−</span>
                        <span className="text-sm font-medium">Working Capital Adjustment</span>
                        {!local.workingCapitalOverride && (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                            Auto-calculated
                          </Badge>
                        )}
                      </div>
                      <span className="font-semibold text-base tabular-nums">
                        {formatCurrency(displayValue)}
                      </span>
                    </div>

                    {!local.workingCapitalOverride ? (
                      <div className="space-y-2 ml-5">
                        <div className="flex items-center gap-3 text-sm text-muted-foreground">
                          <span>{formatCurrency(local.workingCapitalMonthlyAmount)}/mo</span>
                          <span>×</span>
                          <div className="flex items-center gap-2 flex-1">
                            <Slider
                              value={[local.workingCapitalMonths]}
                              onValueChange={([v]) => {
                                isEditingRef.current = true;
                                const months = Math.round(v);
                                const newTotal = Math.round(local.workingCapitalMonthlyAmount * months);
                                setLocal(prev => ({
                                  ...prev,
                                  workingCapitalMonths: months,
                                  minusWorkingCapitalAdj: newTotal,
                                }));
                                setDisplayValues(prev => ({ ...prev, minusWorkingCapitalAdj: String(newTotal) }));
                                if (!isLocked) {
                                  debounceSave({
                                    workingCapitalMonths: String(months),
                                    minusWorkingCapitalAdj: String(newTotal),
                                  });
                                }
                              }}
                              onValueCommit={() => {
                                isEditingRef.current = false;
                                if (debounceRef.current) {
                                  clearTimeout(debounceRef.current);
                                  debounceRef.current = null;
                                }
                                if (pendingRef.current) {
                                  updateMutation.mutate(pendingRef.current);
                                  pendingRef.current = null;
                                }
                              }}
                              min={1}
                              max={12}
                              step={1}
                              disabled={isLocked}
                              className="flex-1"
                            />
                            <span className="font-medium w-16 text-right tabular-nums text-foreground">
                              {local.workingCapitalMonths} month{local.workingCapitalMonths !== 1 ? 's' : ''}
                            </span>
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            setLocal(prev => ({ ...prev, workingCapitalOverride: true }));
                          }}
                          disabled={isLocked}
                          className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
                        >
                          Override manually
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-2 ml-5">
                        <div className="flex items-center gap-2">
                          <div className="relative flex-1">
                            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">£</span>
                            <Input
                              type="text"
                              inputMode="numeric"
                              value={displayValues.minusWorkingCapitalAdj ?? String(local.minusWorkingCapitalAdj)}
                              onFocus={handleFocus}
                              onBlur={() => {
                                handleBlur();
                                const raw = displayValues.minusWorkingCapitalAdj ?? '';
                                const parsed = parseFloat(raw);
                                if (isNaN(parsed) || raw.trim() === '') {
                                  const numVal = raw.trim() === '' ? 0 : local.minusWorkingCapitalAdj;
                                  setDisplayValues(prev => ({ ...prev, minusWorkingCapitalAdj: String(numVal) }));
                                  updateLocal('minusWorkingCapitalAdj', numVal, 'minusWorkingCapitalAdj');
                                } else {
                                  setDisplayValues(prev => ({ ...prev, minusWorkingCapitalAdj: String(parsed) }));
                                  updateLocal('minusWorkingCapitalAdj', parsed, 'minusWorkingCapitalAdj');
                                }
                              }}
                              onChange={e => {
                                const raw = e.target.value;
                                setDisplayValues(prev => ({ ...prev, minusWorkingCapitalAdj: raw }));
                                const parsed = parseFloat(raw);
                                if (!isNaN(parsed)) {
                                  setLocal(prev => ({ ...prev, minusWorkingCapitalAdj: parsed }));
                                }
                              }}
                              disabled={isLocked}
                              className="pl-7 text-right text-base h-9"
                              placeholder="0"
                            />
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <button
                            onClick={() => {
                              const newTotal = Math.round(local.workingCapitalMonthlyAmount * local.workingCapitalMonths);
                              setLocal(prev => ({
                                ...prev,
                                workingCapitalOverride: false,
                                minusWorkingCapitalAdj: newTotal,
                              }));
                              setDisplayValues(prev => ({ ...prev, minusWorkingCapitalAdj: String(newTotal) }));
                              if (!isLocked) {
                                if (debounceRef.current) {
                                  clearTimeout(debounceRef.current);
                                  debounceRef.current = null;
                                }
                                pendingRef.current = null;
                                updateMutation.mutate({ minusWorkingCapitalAdj: String(newTotal) });
                              }
                            }}
                            disabled={isLocked}
                            className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
                          >
                            ← Use auto-calculation
                          </button>
                          <span className="text-xs text-muted-foreground">
                            Auto would be: {formatCurrency(calculatedTotal)}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

            <div className="flex items-center justify-between px-4 py-3 bg-primary/5">
              <span className="text-base font-semibold">Offer Price</span>
              <span className="font-bold text-xl">{formatCurrency(offerPrice)}</span>
            </div>
          </div>
        </div>

      </CardContent>
    </Card>
  );
}
