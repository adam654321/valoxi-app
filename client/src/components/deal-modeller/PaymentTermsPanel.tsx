import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/format-utils';
import { toNum, type CalculationResult } from '@shared/calculators/deal-model.calc';
import type { DealModelFundingLine, DealModelSellerPayment, DealModelContingentConsideration } from '@shared/schema';
import { Banknote, CalendarClock, TrendingUp, AlertTriangle } from 'lucide-react';

const DEFERRED_FUNDING_TYPES = ['seller_financing', 'earnout'];

function pmt(principal: number, monthlyRate: number, numPayments: number): number {
  if (principal <= 0 || numPayments <= 0) return 0;
  if (monthlyRate === 0) return principal / numPayments;
  const factor = Math.pow(1 + monthlyRate, numPayments);
  return (principal * monthlyRate * factor) / (factor - 1);
}

interface PaymentTermsPanelProps {
  calculations: CalculationResult | null;
  fundingLines: DealModelFundingLine[];
  sellerPayments: DealModelSellerPayment[];
  contingentConsideration: DealModelContingentConsideration[];
  cashFromBusiness: number;
  transactionType: string;
}

export default function PaymentTermsPanel({
  calculations,
  fundingLines,
  sellerPayments,
  contingentConsideration,
  cashFromBusiness,
  transactionType,
}: PaymentTermsPanelProps) {
  const offerPrice = calculations?.offerPrice ?? 0;

  const activeSellerPayments = useMemo(
    () => sellerPayments.filter(s => s.isActive),
    [sellerPayments]
  );
  const activeEarnouts = useMemo(
    () => contingentConsideration.filter(c => c.isActive),
    [contingentConsideration]
  );

  const deferredTotal = useMemo(
    () => activeSellerPayments.reduce((sum, s) => sum + toNum(s.amount), 0),
    [activeSellerPayments]
  );
  const earnoutTotal = useMemo(
    () => activeEarnouts.reduce((sum, c) => sum + toNum(c.maximumAmount), 0),
    [activeEarnouts]
  );

  const fundedByYou = useMemo(
    () => fundingLines
      .filter(fl => fl.isActive && !DEFERRED_FUNDING_TYPES.includes(fl.fundingType))
      .reduce((sum, fl) => sum + toNum(fl.amountUsed), 0),
    [fundingLines]
  );

  const cash = Math.max(0, cashFromBusiness);

  // Day one to the seller is the contractual obligation at completion: offer price less deferred and earnout.
  const dayOneToSeller = Math.max(0, offerPrice - deferredTotal - earnoutTotal);
  // The obligation is met by funded sources + business cash; any remainder is cash still to introduce.
  const shortfall = Math.max(0, Math.round((dayOneToSeller - fundedByYou - cash) * 100) / 100);

  // What you pay excludes the business's own cash (which passes to the seller but is not your money).
  const yourConsideration = Math.max(0, offerPrice - cash);

  // Single seller payment shows its term + monthly; multiple shows the total only.
  const singleSeller = activeSellerPayments.length === 1 ? activeSellerPayments[0] : null;
  const deferredTermMonths = singleSeller ? (singleSeller.termMonths ?? 0) : 0;
  const deferredMonthly = singleSeller && deferredTermMonths > 0
    ? (toNum(singleSeller.interestRate) > 0
        ? pmt(toNum(singleSeller.amount), toNum(singleSeller.interestRate) / 100 / 12, deferredTermMonths)
        : toNum(singleSeller.amount) / deferredTermMonths)
    : 0;

  const singleEarnout = activeEarnouts.length === 1 ? activeEarnouts[0] : null;
  const earnoutTermMonths = singleEarnout ? (singleEarnout.termMonths ?? 0) : 0;
  const earnoutMetric = singleEarnout ? (singleEarnout.triggerDescription || '') : '';

  if (offerPrice <= 0) return null;

  const hasCash = cash > 0;
  const hasDeferred = deferredTotal > 0;
  const hasEarnout = earnoutTotal > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <span className="flex items-center justify-center h-6 w-6 rounded-full bg-muted text-xs font-bold">5</span>
          <Banknote className="h-4 w-4 text-muted-foreground" />
          How Does The Seller Get Paid?
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Consideration structure for this{' '}
          <span className="font-medium text-foreground">
            {transactionType === 'asset_sale' ? 'asset sale' : 'share sale'}
          </span>
          . These figures flow into the offer letter and heads of terms.
        </p>

        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <tbody>
              <tr className="bg-muted/50 text-xs text-muted-foreground uppercase">
                <td className="px-4 py-2 font-medium" colSpan={3}>Day One — at completion</td>
              </tr>
              <tr className="border-t">
                <td className="px-4 py-2.5">Funded by you</td>
                <td className="px-4 py-2.5 text-muted-foreground text-xs">Equity and day-one debt</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{formatCurrency(fundedByYou)}</td>
              </tr>
              {hasCash && (
                <tr className="border-t">
                  <td className="px-4 py-2.5">Cash in the business</td>
                  <td className="px-4 py-2.5 text-muted-foreground text-xs">Surplus cash after working capital</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{formatCurrency(cash)}</td>
                </tr>
              )}
              {shortfall > 0 && (
                <tr className="border-t bg-amber-50 dark:bg-amber-950/20">
                  <td className="px-4 py-2.5 text-amber-700 dark:text-amber-400">
                    <span className="flex items-center gap-1"><AlertTriangle className="h-3.5 w-3.5 shrink-0" />Cash still to introduce</span>
                  </td>
                  <td className="px-4 py-2.5 text-amber-700/80 dark:text-amber-400/80 text-xs">Day one is not yet fully funded</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-amber-700 dark:text-amber-400">{formatCurrency(shortfall)}</td>
                </tr>
              )}
              <tr className="border-t bg-green-50 dark:bg-green-950/20 font-semibold">
                <td className="px-4 py-3 text-green-800 dark:text-green-300" colSpan={2}>Day one to seller</td>
                <td className="px-4 py-3 text-right text-green-800 dark:text-green-300 tabular-nums text-base">{formatCurrency(dayOneToSeller)}</td>
              </tr>

              {(hasDeferred || hasEarnout) && (
                <tr className="bg-muted/50 text-xs text-muted-foreground uppercase">
                  <td className="px-4 py-2 font-medium" colSpan={3}>Deferred — after completion</td>
                </tr>
              )}
              {hasDeferred && (
                <>
                  <tr className="border-t">
                    <td className="px-4 py-2.5 font-medium">Seller deferred</td>
                    <td className="px-4 py-2.5 text-muted-foreground text-xs">
                      {singleSeller
                        ? (deferredTermMonths > 0 ? `Over ${deferredTermMonths} months` : 'Terms to be agreed')
                        : `${activeSellerPayments.length} payments`}
                    </td>
                    <td className="px-4 py-2.5 text-right font-semibold tabular-nums">{formatCurrency(deferredTotal)}</td>
                  </tr>
                  {singleSeller && deferredMonthly > 0 && (
                    <tr className="border-t bg-muted/20">
                      <td className="px-4 py-2 text-muted-foreground text-xs pl-8">
                        <span className="flex items-center gap-1"><CalendarClock className="h-3 w-3 shrink-0" />Monthly instalment</span>
                      </td>
                      <td className="px-4 py-2 text-muted-foreground text-xs">{deferredTermMonths} payments</td>
                      <td className="px-4 py-2 text-right text-sm font-medium tabular-nums text-muted-foreground">{formatCurrency(deferredMonthly)} / month</td>
                    </tr>
                  )}
                </>
              )}
              {hasEarnout && (
                <tr className="border-t">
                  <td className="px-4 py-2.5 font-medium">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
                      Earnout (maximum)
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">Conditional</Badge>
                    </div>
                    {earnoutMetric && (
                      <p className="text-xs text-muted-foreground font-normal mt-0.5">{earnoutMetric}</p>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground text-xs">
                    {singleEarnout
                      ? (earnoutTermMonths > 0 ? `Over ${earnoutTermMonths} months` : 'Period to be agreed')
                      : `${activeEarnouts.length} earnouts`}
                  </td>
                  <td className="px-4 py-2.5 text-right font-semibold tabular-nums">{formatCurrency(earnoutTotal)}</td>
                </tr>
              )}
            </tbody>
            <tfoot>
              {hasCash && (
                <tr className="border-t-2 bg-muted/30">
                  <td className="px-4 py-2.5" colSpan={2}>
                    Your consideration<span className="text-xs text-muted-foreground font-normal"> (excludes business cash)</span>
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{formatCurrency(yourConsideration)}</td>
                </tr>
              )}
              <tr className={(hasCash ? 'border-t' : 'border-t-2') + ' bg-muted/50 font-semibold'}>
                <td className="px-4 py-3" colSpan={2}>
                  Total consideration to seller{hasCash && <span className="text-xs text-muted-foreground font-normal"> (includes business cash)</span>}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-base">{formatCurrency(offerPrice)}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        {!hasDeferred && !hasEarnout && (
          <p className="text-xs text-muted-foreground">
            Full consideration payable at completion. Add seller financing or an earnout in Section 4 to model deferred or conditional payments.
          </p>
        )}

        {hasCash && (
          <p className="text-xs text-muted-foreground">
            Business cash is the company's own money, not part of what you pay. It passes to the seller on day one and is reflected in the total consideration only.
          </p>
        )}

        {hasDeferred && singleSeller && deferredTermMonths === 0 && (
          <p className="text-xs text-amber-600 flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" /> Seller deferred has no term set — expand the seller payment in Section 4 and enter the term in months.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
