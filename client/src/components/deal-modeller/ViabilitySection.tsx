import { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { formatCurrency } from '@/lib/format-utils';
import { apiRequest } from '@/lib/queryClient';
import type { CalculationResult } from '@shared/calculators/deal-model.calc';
import type { DealModelFundingLine } from '@shared/schema';
import {
  CheckCircle,
  AlertTriangle,
  XCircle,
  ShieldCheck,
  TrendingUp,
  Receipt,
  PoundSterling,
  Gauge,
  Info,
} from 'lucide-react';

interface ViabilitySectionProps {
  modelId: number | null;
  model: any | null;
  calculations: CalculationResult | null;
  fundingLines: DealModelFundingLine[];
  isLocked: boolean;
  onDataChange: () => void;
}

const FUNDING_TYPE_LABELS: Record<string, string> = {
  receivables_finance: 'Receivables Finance',
  asset_finance: 'Asset Finance',
  property_finance: 'Property Finance',
  seller_financing: 'Seller Financing',
  earnout: 'Earnout',
  new_senior_debt: 'Senior Debt',
  cash_equity: 'Cash Equity',
  investor_equity: 'Investor Equity',
  mezzanine: 'Mezzanine',
  cashflow_loan: 'Cashflow Loan',
};

const RATING_CONFIG: Record<string, { label: string; color: string; bgColor: string; borderColor: string; icon: typeof CheckCircle; description: string }> = {
  strong: {
    label: 'Strong',
    color: 'text-green-700',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
    icon: ShieldCheck,
    description: 'Excellent debt serviceability. Lenders compete for this deal — strong covenant headroom even in a downturn.',
  },
  fundable: {
    label: 'Fundable',
    color: 'text-blue-700',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    icon: CheckCircle,
    description: 'Meets standard lending thresholds. Most cash flow lenders are comfortable at this level with reasonable headroom for fluctuations.',
  },
  challenging: {
    label: 'Challenging',
    color: 'text-amber-700',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
    icon: AlertTriangle,
    description: 'Below the 1.5x threshold most mainstream lenders require. Specialist or alternative lenders may consider, but expect tighter covenants and higher rates.',
  },
  critical: {
    label: 'Critical',
    color: 'text-orange-700',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-200',
    icon: AlertTriangle,
    description: 'Technically covers debt service but with virtually no headroom. One bad month risks default. Very few lenders will fund at this level.',
  },
  unfundable: {
    label: 'Unfundable',
    color: 'text-red-700',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    icon: XCircle,
    description: 'Cash flow does not cover debt repayments. The deal structure must be revised — reduce debt, extend terms, or increase equity.',
  },
  no_debt: {
    label: 'No Debt Service',
    color: 'text-slate-700',
    bgColor: 'bg-slate-50',
    borderColor: 'border-slate-200',
    icon: Info,
    description: 'No debt facilities with repayment terms are active. Add funding sources with interest rates and terms to calculate the DSCR.',
  },
};

function getRatioBarWidth(ratio: number | null): number {
  if (ratio === null) return 0;
  if (ratio <= 0) return 1;
  if (ratio <= 1.0) {
    return (ratio / 1.0) * 20;
  } else if (ratio <= 1.25) {
    return 20 + ((ratio - 1.0) / 0.25) * 12;
  } else if (ratio <= 1.5) {
    return 32 + ((ratio - 1.25) / 0.25) * 13;
  } else if (ratio <= 2.0) {
    return 45 + ((ratio - 1.5) / 0.5) * 25;
  } else {
    const pct = 70 + ((Math.min(ratio, 4.0) - 2.0) / 2.0) * 30;
    return Math.min(pct, 100);
  }
}

export default function ViabilitySection({ modelId, model, calculations, fundingLines, isLocked, onDataChange }: ViabilitySectionProps) {
  const FEE_FIELDS = [
    { key: 'feeLegalDd', label: 'Legal Due Diligence', valueField: 'feeLegalDdPercent', typeField: 'feeLegalDdType' },
    { key: 'feeAccountingDd', label: 'Accounting Due Diligence', valueField: 'feeAccountingDdPercent', typeField: 'feeAccountingDdType' },
    { key: 'feeBroker', label: 'Broker Fee', valueField: 'feeBrokerPercent', typeField: 'feeBrokerType' },
    { key: 'feeLoanArrangement', label: 'Loan Arrangement Fee', valueField: 'feeLoanArrangementPercent', typeField: 'feeLoanArrangementType' },
    { key: 'feeDealMaker', label: 'Deal Maker Fee', valueField: 'feeDealMakerPercent', typeField: 'feeDealMakerType' },
  ] as const;

  type FeeLocalValues = Record<string, string>;

  const initFeeValues = (m: any): FeeLocalValues => {
    if (!m) return {};
    const vals: FeeLocalValues = {};
    for (const f of FEE_FIELDS) {
      vals[f.valueField] = m[f.valueField] ?? '';
      vals[f.typeField] = m[f.typeField] ?? 'percent';
    }
    return vals;
  };

  const [feeValues, setFeeValues] = useState<FeeLocalValues>(() => initFeeValues(model));
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const isEditingRef = useRef(false);
  const savePendingRef = useRef(false);
  const pendingRef = useRef<Record<string, any>>({});
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevModelIdRef = useRef(model?.id);

  useEffect(() => {
    if (!model) return;
    if (model.id !== prevModelIdRef.current) {
      prevModelIdRef.current = model.id;
      setFeeValues(initFeeValues(model));
      return;
    }
    if (!isEditingRef.current && !savePendingRef.current) {
      setFeeValues(initFeeValues(model));
    }
  }, [model?.id, model?.updatedAt]);

  const updateMutation = useMutation({
    mutationFn: async (updates: Record<string, any>) => {
      return apiRequest('PUT', `/api/v2/deal-models/${modelId}`, updates);
    },
    onSuccess: () => {
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 1500);
      savePendingRef.current = false;
      onDataChange();
    },
    onError: () => {
      savePendingRef.current = false;
    },
  });

  const debounceSave = useCallback((field: string, value: any) => {
    pendingRef.current[field] = value;
    savePendingRef.current = true;
    setSaveStatus('saving');
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const updates = { ...pendingRef.current };
      pendingRef.current = {};
      updateMutation.mutate(updates);
    }, 600);
  }, [modelId, updateMutation]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (Object.keys(pendingRef.current).length > 0) {
        const updates = { ...pendingRef.current };
        pendingRef.current = {};
        apiRequest('PUT', `/api/v2/deal-models/${modelId}`, updates).catch(() => {});
      }
    };
  }, [modelId]);

  const handleFeeValueChange = (field: string, value: string) => {
    setFeeValues(prev => ({ ...prev, [field]: value }));
    debounceSave(field, value);
  };

  const handleFeeTypeToggle = (valueField: string, typeField: string) => {
    const currentType = feeValues[typeField] || 'percent';
    const newType = currentType === 'percent' ? 'fixed' : 'percent';
    setFeeValues(prev => ({ ...prev, [typeField]: newType }));
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const allUpdates = { ...pendingRef.current, [typeField]: newType };
    pendingRef.current = {};
    savePendingRef.current = true;
    setSaveStatus('saving');
    updateMutation.mutate(allUpdates);
  };

  const handleFocus = useCallback(() => { isEditingRef.current = true; }, []);
  const handleBlur = useCallback(() => {
    isEditingRef.current = false;
  }, []);

  const debtServiceBreakdown = useMemo(() => {
    if (!calculations || !fundingLines.length) return [];
    const items: Array<{ label: string; annualRepayment: number }> = [];

    fundingLines.forEach((fl, idx) => {
      const calcLine = calculations.fundingLines[idx];
      if (!calcLine || !fl.isActive || calcLine.annualRepayment <= 0) return;
      if (!fl.isDebt) return;
      const label = fl.label || FUNDING_TYPE_LABELS[fl.fundingType] || fl.fundingType;
      items.push({ label, annualRepayment: calcLine.annualRepayment });
    });

    return items;
  }, [calculations, fundingLines]);

  const rating = calculations ? RATING_CONFIG[calculations.paymentCoverRating] || RATING_CONFIG.no_debt : RATING_CONFIG.no_debt;
  const RatingIcon = rating.icon;

  const overallVerdict = useMemo(() => {
    if (!calculations) return null;

    const issues: string[] = [];
    const positives: string[] = [];

    if (calculations.fundingGap > 0 && Math.abs(calculations.fundingGap) >= 1) {
      issues.push(`Deal funding shortfall of ${formatCurrency(calculations.fundingGap)} (before transaction fees)`);
    } else {
      positives.push('Deal fully funded — no additional cash required for the purchase');
    }

    if (calculations.paymentCoverRating === 'unfundable') {
      issues.push('Debt service exceeds available cash flow — deal structure must be revised');
    } else if (calculations.paymentCoverRating === 'critical') {
      issues.push('Debt service coverage is critical with virtually no headroom — very few lenders will fund at this level');
    } else if (calculations.paymentCoverRating === 'challenging') {
      issues.push('Below the 1.5x threshold most lenders require — specialist lenders may consider but expect tighter terms');
    } else if (calculations.paymentCoverRating === 'fundable') {
      positives.push('Meets standard lending thresholds with reasonable headroom');
    } else if (calculations.paymentCoverRating === 'strong') {
      positives.push('Strong debt service coverage — excellent covenant headroom');
    }

    if (calculations.totalFees > calculations.offerPrice * 0.15) {
      issues.push('Total fees exceed 15% of the offer price');
    }

    const viable = issues.length === 0;
    return { viable, issues, positives };
  }, [calculations]);

  const hasDebtService = calculations != null && calculations.totalAnnualDebtService > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <span className="flex items-center justify-center h-6 w-6 rounded-full bg-muted text-xs font-bold">5</span>
          <CheckCircle className="h-4 w-4 text-muted-foreground" />
          Does The Deal Work?
        </CardTitle>
        <CardDescription>Debt service coverage ratio, fees breakdown, and deal viability summary.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className={`rounded-lg border p-5 ${rating.borderColor} ${rating.bgColor}`}>
          <div className="flex items-start gap-4">
            <div className={`flex items-center justify-center h-12 w-12 rounded-full ${rating.bgColor} ${rating.color} shrink-0`}>
              <RatingIcon className="h-6 w-6" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-1 flex-wrap">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Gauge className="h-4 w-4 text-muted-foreground" />
                  Debt Service Coverage Ratio (DSCR)
                </h3>
                <Badge variant="outline" className={`${rating.color} ${rating.borderColor}`}>
                  {rating.label}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mb-2">Also known as Payment Cover Ratio</p>

              <div className="flex items-baseline gap-2 mb-3">
                <span className={`text-3xl font-bold ${rating.color}`}>
                  {calculations?.paymentCoverRatio != null
                    ? `${calculations.paymentCoverRatio.toFixed(2)}x`
                    : '—'}
                </span>
              </div>

              {hasDebtService && calculations && (
                <div className="bg-white/60 rounded border p-3 mb-3">
                  <p className="text-sm font-mono text-muted-foreground">
                    DSCR = {formatCurrency(calculations.averageAdjustedEbitda)}{' '}
                    <span className="text-xs">(Adjusted EBITDA)</span>{' '}
                    &divide; {formatCurrency(calculations.totalAnnualDebtService)}{' '}
                    <span className="text-xs">(Annual Debt Service)</span>{' '}
                    = <span className={`font-bold ${rating.color}`}>{calculations.paymentCoverRatio?.toFixed(2)}x</span>
                  </p>
                </div>
              )}

              <div className="mb-3">
                <div className="relative h-3 bg-white/80 rounded-full overflow-hidden border">
                  <div className="absolute inset-y-0 left-0 flex w-full">
                    <div className="bg-red-500 h-full" style={{ width: '20%' }} />
                    <div className="bg-orange-400 h-full" style={{ width: '12%' }} />
                    <div className="bg-amber-400 h-full" style={{ width: '13%' }} />
                    <div className="bg-blue-400 h-full" style={{ width: '25%' }} />
                    <div className="bg-green-400 h-full" style={{ width: '30%' }} />
                  </div>
                  {calculations?.paymentCoverRatio != null && (
                    <div
                      className="absolute top-[-2px] bottom-[-2px] w-1 bg-slate-900 rounded-full shadow-sm"
                      style={{ left: `${getRatioBarWidth(calculations.paymentCoverRatio)}%` }}
                    />
                  )}
                </div>
                <div className="relative flex text-[10px] text-muted-foreground mt-1" style={{ height: '14px' }}>
                  <span className="absolute text-red-600 font-medium" style={{ left: '0%' }}>Unfundable</span>
                  <span className="absolute text-orange-600 font-medium" style={{ left: '20%' }}>Critical</span>
                  <span className="absolute text-amber-600 font-medium" style={{ left: '32%' }}>Challenging</span>
                  <span className="absolute text-blue-600 font-medium" style={{ left: '45%' }}>Fundable</span>
                  <span className="absolute text-green-600 font-medium" style={{ right: '0%' }}>Strong</span>
                </div>
                <div className="relative flex text-[9px] text-muted-foreground mt-0.5" style={{ height: '12px' }}>
                  <span className="absolute" style={{ left: '0%' }}>0x</span>
                  <span className="absolute" style={{ left: '20%', transform: 'translateX(-50%)' }}>1.0x</span>
                  <span className="absolute" style={{ left: '32%', transform: 'translateX(-50%)' }}>1.25x</span>
                  <span className="absolute" style={{ left: '45%', transform: 'translateX(-50%)' }}>1.5x</span>
                  <span className="absolute" style={{ left: '70%', transform: 'translateX(-50%)' }}>2.0x</span>
                  <span className="absolute" style={{ right: '0%' }}>4x+</span>
                </div>
              </div>

              <p className="text-sm text-muted-foreground">{rating.description}</p>
            </div>
          </div>
        </div>

        {debtServiceBreakdown.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Gauge className="h-4 w-4 text-muted-foreground" />
              Annual Debt Service Breakdown
            </h3>
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50 text-xs text-muted-foreground uppercase">
                    <th className="px-3 py-2 text-left font-medium">Funding Source</th>
                    <th className="px-3 py-2 text-right font-medium">Annual Repayment</th>
                  </tr>
                </thead>
                <tbody>
                  {debtServiceBreakdown.map((item, idx) => (
                    <tr key={idx} className={idx % 2 === 0 ? 'bg-muted/30' : ''}>
                      <td className="px-3 py-2">{item.label}</td>
                      <td className="px-3 py-2 text-right font-medium tabular-nums">
                        {formatCurrency(item.annualRepayment)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 font-semibold bg-muted/50">
                    <td className="px-3 py-2">Total Annual Debt Service</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {calculations ? formatCurrency(calculations.totalAnnualDebtService) : '—'}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        {hasDebtService && calculations && calculations.averageAdjustedEbitda > 0 && (() => {
          const debtBurdenPct = (calculations.totalAnnualDebtService / calculations.averageAdjustedEbitda) * 100;
          const residualCash = calculations.averageAdjustedEbitda - calculations.totalAnnualDebtService;
          
          let burdenColor: string;
          let burdenBg: string;
          let burdenBorder: string;
          let burdenLabel: string;
          let burdenDescription: string;
          
          if (debtBurdenPct <= 40) {
            burdenColor = 'text-green-700';
            burdenBg = 'bg-green-50';
            burdenBorder = 'border-green-200';
            burdenLabel = 'Comfortable';
            burdenDescription = 'Low debt burden — significant cash flow remains for operations, reinvestment, and absorbing downturns.';
          } else if (debtBurdenPct <= 60) {
            burdenColor = 'text-blue-700';
            burdenBg = 'bg-blue-50';
            burdenBorder = 'border-blue-200';
            burdenLabel = 'Moderate';
            burdenDescription = 'Manageable debt burden — adequate cash flow for operations but limited room for unexpected costs or revenue dips.';
          } else if (debtBurdenPct <= 80) {
            burdenColor = 'text-amber-700';
            burdenBg = 'bg-amber-50';
            burdenBorder = 'border-amber-200';
            burdenLabel = 'Heavy';
            burdenDescription = 'High debt burden — most cash flow consumed by debt servicing. Minimal headroom for operational issues or investment.';
          } else {
            burdenColor = 'text-red-700';
            burdenBg = 'bg-red-50';
            burdenBorder = 'border-red-200';
            burdenLabel = 'Unsustainable';
            burdenDescription = debtBurdenPct >= 100 
              ? 'Debt service exceeds EBITDA — the business cannot cover repayments from operating cash flow.'
              : 'Near-total EBITDA consumed by debt — virtually no cash remains for operations.';
          }

          return (
            <div className={`rounded-lg border p-4 mt-4 ${burdenBorder} ${burdenBg}`}>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-semibold flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  EBITDA Debt Burden
                </h4>
                <Badge variant="outline" className={`${burdenColor} ${burdenBorder}`}>
                  {burdenLabel}
                </Badge>
              </div>
              
              <div className="flex items-baseline gap-3 mb-3">
                <span className={`text-2xl font-bold ${burdenColor}`}>
                  {debtBurdenPct.toFixed(1)}%
                </span>
                <span className="text-sm text-muted-foreground">
                  of EBITDA used for debt service
                </span>
              </div>

              <div className="mb-3">
                <div className="relative h-3 bg-white/80 rounded-full overflow-hidden border">
                  <div className="absolute inset-y-0 left-0 flex w-full">
                    <div className="bg-green-400 h-full" style={{ width: '40%' }} />
                    <div className="bg-blue-400 h-full" style={{ width: '20%' }} />
                    <div className="bg-amber-400 h-full" style={{ width: '20%' }} />
                    <div className="bg-red-400 h-full" style={{ width: '20%' }} />
                  </div>
                  <div
                    className="absolute top-[-2px] bottom-[-2px] w-1 bg-slate-900 rounded-full shadow-sm"
                    style={{ left: `${Math.min(debtBurdenPct, 100)}%` }}
                  />
                </div>
                <div className="relative flex text-[10px] text-muted-foreground mt-0.5" style={{ height: '14px' }}>
                  <span className="absolute text-green-600 font-medium" style={{ left: '0%' }}>0%</span>
                  <span className="absolute text-green-600 font-medium" style={{ left: '40%', transform: 'translateX(-50%)' }}>40%</span>
                  <span className="absolute text-blue-600 font-medium" style={{ left: '60%', transform: 'translateX(-50%)' }}>60%</span>
                  <span className="absolute text-amber-600 font-medium" style={{ left: '80%', transform: 'translateX(-50%)' }}>80%</span>
                  <span className="absolute text-red-600 font-medium" style={{ right: '0%' }}>100%</span>
                </div>
              </div>

              <div className="bg-white/60 rounded border p-3 mb-3">
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Adjusted EBITDA</p>
                    <p className="font-semibold tabular-nums">{formatCurrency(calculations.averageAdjustedEbitda)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Annual Debt Service</p>
                    <p className="font-semibold tabular-nums text-red-700">−{formatCurrency(calculations.totalAnnualDebtService)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Residual Cash Flow</p>
                    <p className={`font-semibold tabular-nums ${residualCash >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                      {formatCurrency(residualCash)}
                    </p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Monthly residual: {formatCurrency(residualCash / 12)} available for operations, reinvestment, and contingency.
                </p>
              </div>

              <p className="text-sm text-muted-foreground">{burdenDescription}</p>
            </div>
          );
        })()}

        {hasDebtService && (
          <div className="bg-slate-50 rounded-lg border border-slate-200 p-4">
            <div className="flex items-start gap-2 mb-2">
              <Info className="h-4 w-4 text-slate-500 mt-0.5 shrink-0" />
              <h4 className="text-sm font-medium text-slate-700">Lender Context</h4>
            </div>
            <ul className="space-y-1.5 text-xs text-slate-600 ml-6">
              <li><strong>1.5x is the key threshold</strong> — most mainstream cash flow lenders require a minimum DSCR of 1.5x for senior debt facilities.</li>
              <li>Below 1.25x, even specialist lenders are reluctant. The deal needs restructuring (less debt, longer terms, or more equity).</li>
              <li>Above 2.0x provides strong covenant headroom — the business can absorb a significant revenue downturn and still service its debt.</li>
              <li>DSCR below 1.0x means the business cannot service its debt from operating cash flow at all.</li>
            </ul>
          </div>
        )}

        <Separator />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Receipt className="h-4 w-4 text-muted-foreground" />
              Fees Breakdown
              {saveStatus === 'saving' && <span className="text-xs text-muted-foreground font-normal">Saving...</span>}
              {saveStatus === 'saved' && <span className="text-xs text-green-600 font-normal">Saved</span>}
            </h3>
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-xs text-muted-foreground">
                    <th className="px-3 py-1.5 text-left font-medium">Fee</th>
                    <th className="px-3 py-1.5 text-right font-medium">Rate / Amount</th>
                    <th className="px-3 py-1.5 text-right font-medium">Calculated</th>
                  </tr>
                </thead>
                <tbody>
                  {FEE_FIELDS.map((f, idx) => (
                    <tr key={f.key} className={idx % 2 === 0 ? 'bg-muted/30' : ''}>
                      <td className="px-3 py-2 text-muted-foreground">{f.label}</td>
                      <td className="px-3 py-2">
                        {!isLocked && modelId ? (
                          <div className="flex items-center gap-1.5 justify-end">
                            <button
                              type="button"
                              onClick={() => handleFeeTypeToggle(f.valueField, f.typeField)}
                              className="text-xs px-1.5 py-0.5 rounded border bg-background hover:bg-muted transition-colors min-w-[28px] text-center font-medium"
                              title={feeValues[f.typeField] === 'fixed' ? 'Fixed amount — click to switch to percentage' : 'Percentage — click to switch to fixed amount'}
                            >
                              {feeValues[f.typeField] === 'fixed' ? '£' : '%'}
                            </button>
                            <input
                              type="number"
                              value={feeValues[f.valueField] ?? ''}
                              onChange={(e) => handleFeeValueChange(f.valueField, e.target.value)}
                              onFocus={handleFocus}
                              onBlur={handleBlur}
                              className="w-24 text-right text-sm px-2 py-1 border rounded bg-background tabular-nums"
                              step={feeValues[f.typeField] === 'fixed' ? '1000' : '0.1'}
                              min="0"
                            />
                          </div>
                        ) : (
                          <span className="text-right font-medium tabular-nums block">
                            {feeValues[f.typeField] === 'fixed'
                              ? formatCurrency(Number(feeValues[f.valueField]) || 0)
                              : `${feeValues[f.valueField] || 0}%`
                            }
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right font-medium tabular-nums">
                        {calculations ? formatCurrency((calculations as any)[f.key] || 0) : '—'}
                      </td>
                    </tr>
                  ))}
                  {calculations && calculations.fundingLines.reduce((s, fl) => s + fl.arrangementFee, 0) > 0 && (
                    <tr className={FEE_FIELDS.length % 2 === 0 ? 'bg-muted/30' : ''}>
                      <td className="px-3 py-2 text-muted-foreground">Funding Arrangement Fees</td>
                      <td className="px-3 py-2"></td>
                      <td className="px-3 py-2 text-right font-medium tabular-nums">
                        {formatCurrency(calculations.fundingLines.reduce((s, fl) => s + fl.arrangementFee, 0))}
                      </td>
                    </tr>
                  )}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 font-semibold bg-muted/50">
                    <td className="px-3 py-2" colSpan={2}>Total Fees</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {calculations ? formatCurrency(calculations.totalFees) : '—'}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <PoundSterling className="h-4 w-4 text-muted-foreground" />
              Deal Summary
            </h3>
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <tbody>
                  <tr className="bg-muted/30">
                    <td className="px-3 py-2 text-muted-foreground">Offer Price</td>
                    <td className="px-3 py-2 text-right font-medium tabular-nums">
                      {calculations ? formatCurrency(calculations.offerPrice) : '—'}
                    </td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 text-muted-foreground">− Total Funded</td>
                    <td className="px-3 py-2 text-right font-medium tabular-nums text-green-700">
                      {calculations ? formatCurrency(calculations.totalFunded) : '—'}
                    </td>
                  </tr>
                  <tr className={`border-t font-semibold ${
                    !calculations ? ''
                    : Math.abs(calculations.fundingGap) < 1 || calculations.fundingGap <= 0 ? 'bg-green-50 text-green-800'
                    : 'bg-red-50 text-red-800'
                  }`}>
                    <td className="px-3 py-2">
                      {calculations && (Math.abs(calculations.fundingGap) < 1 || calculations.fundingGap <= 0) ? 'Surplus / Fully Funded' : 'Cash to Introduce'}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {calculations ? (Math.abs(calculations.fundingGap) < 1 ? '£0' : formatCurrency(Math.abs(calculations.fundingGap))) : '—'}
                    </td>
                  </tr>
                  <tr className="border-t bg-muted/30">
                    <td className="px-3 py-2 text-muted-foreground">+ Transaction Fees</td>
                    <td className="px-3 py-2 text-right font-medium tabular-nums">
                      {calculations ? formatCurrency(calculations.totalFees) : '—'}
                    </td>
                  </tr>
                  <tr className="border-t-2 font-semibold bg-primary/5">
                    <td className="px-3 py-2">Total Outlay</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {calculations ? formatCurrency(calculations.totalFundingRequired) : '—'}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {hasDebtService && calculations && (
              <div className="mt-3 border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <tbody>
                    <tr className="bg-muted/30">
                      <td className="px-3 py-2 text-muted-foreground">Annual Debt Service</td>
                      <td className="px-3 py-2 text-right font-medium tabular-nums">
                        {formatCurrency(calculations.totalAnnualDebtService)}
                      </td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2 text-muted-foreground">Monthly Debt Service</td>
                      <td className="px-3 py-2 text-right font-medium tabular-nums">
                        {formatCurrency(calculations.totalAnnualDebtService / 12)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {overallVerdict && (
          <>
            <Separator />
            <div>
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
                Deal Viability Assessment
              </h3>
              <div className={`rounded-lg border p-4 ${
                overallVerdict.viable
                  ? 'bg-green-50 border-green-200'
                  : overallVerdict.issues.length > 1
                    ? 'bg-red-50 border-red-200'
                    : 'bg-amber-50 border-amber-200'
              }`}>
                <div className="flex items-center gap-2 mb-3">
                  {overallVerdict.viable ? (
                    <ShieldCheck className="h-5 w-5 text-green-600" />
                  ) : overallVerdict.issues.length > 1 ? (
                    <XCircle className="h-5 w-5 text-red-600" />
                  ) : (
                    <AlertTriangle className="h-5 w-5 text-amber-600" />
                  )}
                  <span className={`font-semibold ${
                    overallVerdict.viable ? 'text-green-800' : overallVerdict.issues.length > 1 ? 'text-red-800' : 'text-amber-800'
                  }`}>
                    {overallVerdict.viable
                      ? 'Deal structure looks viable'
                      : overallVerdict.issues.length > 1
                        ? 'Deal structure has multiple issues'
                        : 'Deal structure needs attention'}
                  </span>
                </div>
                <div className="space-y-1.5">
                  {overallVerdict.positives.map((p, i) => (
                    <div key={`p-${i}`} className="flex items-start gap-2 text-sm">
                      <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                      <span className="text-green-800">{p}</span>
                    </div>
                  ))}
                  {overallVerdict.issues.map((issue, i) => (
                    <div key={`i-${i}`} className="flex items-start gap-2 text-sm">
                      <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                      <span className="text-amber-800">{issue}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
