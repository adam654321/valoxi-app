import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { formatCurrency } from '@/lib/format-utils';
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
  new_senior_debt: 'Senior Debt',
  deferred_consideration: 'Deferred Consideration',
  cash_equity: 'Cash Equity',
  investor_equity: 'Investor Equity',
  mezzanine: 'Mezzanine',
};

const RATING_CONFIG: Record<string, { label: string; color: string; bgColor: string; borderColor: string; icon: typeof CheckCircle; description: string }> = {
  strong: {
    label: 'Strong',
    color: 'text-green-700',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
    icon: ShieldCheck,
    description: 'Excellent debt serviceability. The business comfortably covers all debt repayments with significant headroom.',
  },
  adequate: {
    label: 'Adequate',
    color: 'text-blue-700',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    icon: CheckCircle,
    description: 'Acceptable debt serviceability. The business can cover debt repayments with reasonable headroom.',
  },
  tight: {
    label: 'Tight',
    color: 'text-amber-700',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
    icon: AlertTriangle,
    description: 'Marginal debt serviceability. The business can cover debt repayments but with limited headroom. Any downturn could be problematic.',
  },
  unfundable: {
    label: 'Unfundable',
    color: 'text-red-700',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    icon: XCircle,
    description: 'Insufficient cash flow to cover debt repayments. The deal structure needs to be revised.',
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
  if (ratio <= 0) return 2;
  if (ratio >= 4) return 100;
  return (ratio / 4) * 100;
}

export default function ViabilitySection({ modelId, model, calculations, fundingLines, isLocked, onDataChange }: ViabilitySectionProps) {
  const feeLines = useMemo(() => {
    if (!calculations) return [];
    const lines: Array<{ label: string; amount: number }> = [
      { label: 'Legal Due Diligence', amount: calculations.feeLegalDd },
      { label: 'Accounting Due Diligence', amount: calculations.feeAccountingDd },
      { label: 'Broker Fee', amount: calculations.feeBroker },
      { label: 'Loan Arrangement Fee', amount: calculations.feeLoanArrangement },
      { label: 'Deal Maker Fee', amount: calculations.feeDealMaker },
    ];
    if (calculations.customFeeAmounts?.length) {
      for (const cf of calculations.customFeeAmounts) {
        lines.push({ label: cf.label, amount: cf.amount });
      }
    }
    return lines;
  }, [calculations]);

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

    if (calculations.fundingGap > 0) {
      issues.push(`Funding shortfall of ${formatCurrency(calculations.fundingGap)} needs to be addressed`);
    } else {
      positives.push('Fully funded — no additional cash required');
    }

    if (calculations.paymentCoverRating === 'unfundable') {
      issues.push('Debt service exceeds available cash flow');
    } else if (calculations.paymentCoverRating === 'tight') {
      issues.push('Debt service coverage is tight with limited headroom');
    } else if (calculations.paymentCoverRating === 'strong') {
      positives.push('Strong debt service coverage');
    } else if (calculations.paymentCoverRating === 'adequate') {
      positives.push('Adequate debt service coverage');
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
                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                  <span>0x</span>
                  <span>1x</span>
                  <span>1.5x</span>
                  <span>2x</span>
                  <span>4x+</span>
                </div>
                <div className="relative h-3 bg-white/80 rounded-full overflow-hidden border">
                  <div className="absolute inset-y-0 left-0 flex w-full">
                    <div className="bg-red-400 h-full" style={{ width: '25%' }} />
                    <div className="bg-amber-400 h-full" style={{ width: '12.5%' }} />
                    <div className="bg-blue-400 h-full" style={{ width: '12.5%' }} />
                    <div className="bg-green-400 h-full" style={{ width: '50%' }} />
                  </div>
                  {calculations?.paymentCoverRatio != null && (
                    <div
                      className="absolute top-[-2px] bottom-[-2px] w-1 bg-slate-900 rounded-full shadow-sm"
                      style={{ left: `${getRatioBarWidth(calculations.paymentCoverRatio)}%` }}
                    />
                  )}
                </div>
                <div className="flex justify-between text-[10px] text-muted-foreground mt-0.5">
                  <span className="text-red-600">Unfundable</span>
                  <span className="text-amber-600">Tight</span>
                  <span className="text-blue-600">Adequate</span>
                  <span className="text-green-600">Strong</span>
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

        {hasDebtService && (
          <div className="bg-slate-50 rounded-lg border border-slate-200 p-4">
            <div className="flex items-start gap-2 mb-2">
              <Info className="h-4 w-4 text-slate-500 mt-0.5 shrink-0" />
              <h4 className="text-sm font-medium text-slate-700">Lender Context</h4>
            </div>
            <ul className="space-y-1.5 text-xs text-slate-600 ml-6">
              <li>Most lenders require a minimum DSCR of 1.25x–1.50x for senior debt.</li>
              <li>A DSCR above 2.0x provides comfortable headroom for covenant compliance.</li>
              <li>DSCR below 1.0x means the business cannot service its debt from operating cash flow.</li>
            </ul>
          </div>
        )}

        <Separator />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Receipt className="h-4 w-4 text-muted-foreground" />
              Fees Breakdown
            </h3>
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <tbody>
                  {feeLines.map((fee, idx) => (
                    <tr key={idx} className={idx % 2 === 0 ? 'bg-muted/30' : ''}>
                      <td className="px-3 py-2 text-muted-foreground">{fee.label}</td>
                      <td className="px-3 py-2 text-right font-medium tabular-nums">
                        {formatCurrency(fee.amount)}
                      </td>
                    </tr>
                  ))}
                  {calculations && calculations.fundingLines.reduce((s, fl) => s + fl.arrangementFee, 0) > 0 && (
                    <tr className={feeLines.length % 2 === 0 ? 'bg-muted/30' : ''}>
                      <td className="px-3 py-2 text-muted-foreground">Funding Arrangement Fees</td>
                      <td className="px-3 py-2 text-right font-medium tabular-nums">
                        {formatCurrency(calculations.fundingLines.reduce((s, fl) => s + fl.arrangementFee, 0))}
                      </td>
                    </tr>
                  )}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 font-semibold bg-muted/50">
                    <td className="px-3 py-2">Total Fees</td>
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
                    <td className="px-3 py-2 text-muted-foreground">+ Transaction Fees</td>
                    <td className="px-3 py-2 text-right font-medium tabular-nums">
                      {calculations ? formatCurrency(calculations.totalFees) : '—'}
                    </td>
                  </tr>
                  <tr className="border-t font-semibold bg-muted/50">
                    <td className="px-3 py-2">Total Funding Required</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {calculations ? formatCurrency(calculations.totalFundingRequired) : '—'}
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
                    : calculations.fundingGap <= 0 ? 'bg-green-50 text-green-800'
                    : 'bg-red-50 text-red-800'
                  }`}>
                    <td className="px-3 py-2">
                      {calculations && calculations.fundingGap <= 0 ? 'Surplus / Fully Funded' : 'Cash to Introduce'}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {calculations ? formatCurrency(Math.abs(calculations.fundingGap)) : '—'}
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
