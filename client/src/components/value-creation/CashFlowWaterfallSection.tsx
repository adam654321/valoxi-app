import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  ChartContainer,
  ChartTooltip,
  type ChartConfig,
} from '@/components/ui/chart';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ComposedChart,
} from 'recharts';
import { formatCurrency } from '@/lib/format-utils';
import {
  calculateDebtSchedules,
  calculateWaterfall,
  type ProjectedYear,
  type FundingLineForProjection,
  type DebtFacilitySchedule,
  type WaterfallYear,
} from '@shared/calculators/value-creation.calc';
import {
  Droplets,
  ChevronDown,
  ChevronRight,
  Landmark,
  Info,
  TrendingDown,
  TrendingUp,
  Banknote,
  BarChart3,
  Table as TableIcon,
} from 'lucide-react';

interface CashFlowWaterfallSectionProps {
  projections: ProjectedYear[];
  fundingLines: FundingLineForProjection[];
  baseYearLabel: string;
}

const chartConfig: ChartConfig = {
  EBITDA: { label: 'EBITDA', color: 'hsl(142, 71%, 45%)' },
  Tax: { label: 'Tax', color: 'hsl(0, 72%, 51%)' },
  Interest: { label: 'Interest', color: 'hsl(25, 95%, 53%)' },
  'Debt Repayment': { label: 'Debt Repayment', color: 'hsl(45, 93%, 47%)' },
  Capex: { label: 'Capex', color: 'hsl(262, 83%, 58%)' },
  'WC Change': { label: 'WC Change', color: 'hsl(199, 89%, 48%)' },
  'Free Cash Flow': { label: 'Free Cash Flow', color: 'hsl(160, 84%, 39%)' },
};

function WaterfallTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-background px-3 py-2 shadow-xl">
      <p className="text-sm font-medium mb-1">{label}</p>
      {payload
        .filter((entry: any) => entry.value !== 0)
        .map((entry: any, i: number) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            <div className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
            <span className="text-muted-foreground">{entry.name}:</span>
            <span className="font-mono font-medium">{formatCurrency(entry.value)}</span>
          </div>
        ))}
    </div>
  );
}

export default function CashFlowWaterfallSection({
  projections,
  fundingLines,
  baseYearLabel,
}: CashFlowWaterfallSectionProps) {
  const [view, setView] = useState<'chart' | 'table'>('chart');
  const [debtOpen, setDebtOpen] = useState(false);

  const debtSchedules = useMemo(() => calculateDebtSchedules(fundingLines), [fundingLines]);
  const waterfallData = useMemo(() => calculateWaterfall(projections), [projections]);

  const barChartData = useMemo(() => {
    return waterfallData.map(w => ({
      name: `Y${w.year}`,
      EBITDA: w.ebitda,
      Tax: w.tax,
      Interest: w.interest,
      'Debt Repayment': w.principalRepayments,
      Capex: w.capex,
      'WC Change': w.workingCapitalChange,
      'Free Cash Flow': w.freeCashFlow,
    }));
  }, [waterfallData]);

  const summaryMetrics = useMemo(() => {
    const totalInterest = waterfallData.reduce((sum, w) => sum + Math.abs(w.interest), 0);
    const totalPrincipal = waterfallData.reduce((sum, w) => sum + Math.abs(w.principalRepayments), 0);
    const totalTax = waterfallData.reduce((sum, w) => sum + Math.abs(w.tax), 0);
    const totalCapex = waterfallData.reduce((sum, w) => sum + Math.abs(w.capex), 0);
    const totalFCF = waterfallData.reduce((sum, w) => sum + w.freeCashFlow, 0);
    const cumulativeFCF: number[] = [];
    let running = 0;
    for (const w of waterfallData) {
      running += w.freeCashFlow;
      cumulativeFCF.push(running);
    }
    const allPositive = waterfallData.every(w => w.freeCashFlow > 0);
    return { totalInterest, totalPrincipal, totalTax, totalCapex, totalFCF, cumulativeFCF, allPositive };
  }, [waterfallData]);

  const debtTotals = useMemo(() => {
    const years = projections.map((_, i) => {
      let totalInterest = 0;
      let totalPrincipal = 0;
      for (const schedule of debtSchedules) {
        const yearData = schedule.years[i];
        if (yearData) {
          totalInterest += yearData.interestPayment;
          totalPrincipal += yearData.principalRepayment;
        }
      }
      return { year: i + 1, totalInterest, totalPrincipal, totalDebtService: totalInterest + totalPrincipal };
    });
    return years;
  }, [debtSchedules, projections]);

  const activeDebtCount = fundingLines.filter(f => f.isDebt && f.isActive).length;

  const formatAxis = (v: number) => {
    if (Math.abs(v) >= 1000000) return `\u00A3${(v / 1000000).toFixed(1)}M`;
    if (Math.abs(v) >= 1000) return `\u00A3${(v / 1000).toFixed(0)}K`;
    return `\u00A3${v}`;
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <span className="flex items-center justify-center h-6 w-6 rounded-full bg-purple-100 dark:bg-purple-900/30 text-xs font-bold text-purple-700 dark:text-purple-300">4</span>
            Cash Flow Waterfall
          </CardTitle>
          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-3 mr-2">
              <Badge variant="secondary" className="text-[10px] h-5 gap-1">
                <Banknote className="h-3 w-3" />
                Interest: {formatCurrency(summaryMetrics.totalInterest)}
              </Badge>
              <Badge
                variant="secondary"
                className={`text-[10px] h-5 gap-1 ${
                  summaryMetrics.totalFCF >= 0
                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                    : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                }`}
              >
                FCF: {formatCurrency(summaryMetrics.totalFCF)}
              </Badge>
            </div>
            <div className="flex border rounded-md overflow-hidden">
              <button
                onClick={() => setView('chart')}
                className={`px-2.5 py-1.5 text-xs font-medium transition-colors ${
                  view === 'chart' ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-muted'
                }`}
              >
                <BarChart3 className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => setView('table')}
                className={`px-2.5 py-1.5 text-xs font-medium transition-colors border-l ${
                  view === 'table' ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-muted'
                }`}
              >
                <TableIcon className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {view === 'chart' ? (
          <ChartContainer config={chartConfig} className="h-[320px] w-full">
            <BarChart data={barChartData} stackOffset="sign" margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
              <YAxis
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={formatAxis}
                width={70}
              />
              <ChartTooltip content={<WaterfallTooltip />} />
              <Bar dataKey="EBITDA" stackId="waterfall" fill="var(--color-EBITDA)" />
              <Bar dataKey="Tax" stackId="waterfall" fill="var(--color-Tax)" />
              <Bar dataKey="Interest" stackId="waterfall" fill="var(--color-Interest)" />
              <Bar dataKey="Debt Repayment" stackId="waterfall" fill="var(--color-Debt Repayment)" />
              <Bar dataKey="Capex" stackId="waterfall" fill="var(--color-Capex)" />
              <Bar dataKey="WC Change" stackId="waterfall" fill="var(--color-WC Change)" />
              <Bar dataKey="Free Cash Flow" fill="var(--color-Free Cash Flow)" barSize={20} />
            </BarChart>
          </ChartContainer>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[200px] min-w-[160px] sticky left-0 bg-background z-10"></TableHead>
                  {waterfallData.map(w => (
                    <TableHead key={w.year} className="text-right px-3 min-w-[100px]">
                      Year {w.year}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell colSpan={waterfallData.length + 1} className="h-1 p-0">
                    <div className="border-t border-dashed border-muted-foreground/20" />
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="text-xs font-semibold sticky left-0 bg-background z-10">EBITDA</TableCell>
                  {waterfallData.map(w => (
                    <TableCell key={w.year} className="text-right tabular-nums px-3 text-xs font-semibold">
                      {formatCurrency(w.ebitda)}
                    </TableCell>
                  ))}
                </TableRow>
                {[
                  { label: 'Less: Corporation Tax', field: 'tax' as const },
                  { label: 'Less: Interest', field: 'interest' as const },
                  { label: 'Less: Debt Repayment', field: 'principalRepayments' as const },
                  { label: 'Less: Capex', field: 'capex' as const },
                  { label: 'Less: Working Capital Change', field: 'workingCapitalChange' as const },
                ].map(row => (
                  <TableRow key={row.label}>
                    <TableCell className="text-xs sticky left-0 bg-background z-10">{row.label}</TableCell>
                    {waterfallData.map(w => {
                      const val = w[row.field];
                      return (
                        <TableCell key={w.year} className="text-right tabular-nums px-3 text-xs">
                          <span className={val < 0 ? 'text-red-600 dark:text-red-400' : ''}>
                            {formatCurrency(val)}
                          </span>
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
                <TableRow>
                  <TableCell colSpan={waterfallData.length + 1} className="h-1 p-0">
                    <div className="border-t border-dashed border-muted-foreground/20" />
                  </TableCell>
                </TableRow>
                <TableRow className="bg-primary/5 font-semibold">
                  <TableCell className="text-xs font-semibold sticky left-0 bg-background z-10">Free Cash Flow</TableCell>
                  {waterfallData.map(w => (
                    <TableCell key={w.year} className="text-right tabular-nums px-3 text-xs font-semibold">
                      <span className={w.freeCashFlow < 0 ? 'text-red-600 dark:text-red-400' : 'text-green-700 dark:text-green-400'}>
                        {formatCurrency(w.freeCashFlow)}
                      </span>
                    </TableCell>
                  ))}
                </TableRow>
                <TableRow>
                  <TableCell className="text-xs text-muted-foreground italic sticky left-0 bg-background z-10">Cumulative FCF</TableCell>
                  {summaryMetrics.cumulativeFCF.map((val, i) => (
                    <TableCell key={i} className="text-right tabular-nums px-3 text-xs text-muted-foreground italic">
                      {formatCurrency(val)}
                    </TableCell>
                  ))}
                </TableRow>
              </TableBody>
            </Table>
          </div>
        )}

        <Collapsible open={debtOpen} onOpenChange={setDebtOpen}>
          <CollapsibleTrigger className="flex items-center gap-2 w-full py-2 hover:bg-muted/50 rounded-md px-2 transition-colors">
            {debtOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            <Landmark className="h-4 w-4 text-blue-600" />
            <span className="text-sm font-medium flex-1 text-left">Debt Amortisation Schedule</span>
            <Badge variant="secondary" className="text-[10px] h-5">
              {activeDebtCount} facilit{activeDebtCount === 1 ? 'y' : 'ies'}
            </Badge>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-4 pt-2">
            {debtSchedules.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">No debt facilities configured in the Deal Modeller.</p>
            ) : (
              <>
                {debtSchedules.map((schedule, idx) => {
                  const fundingLine = fundingLines[schedule.facilityIndex];
                  return (
                    <div key={idx} className="border rounded-lg p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold">Facility {idx + 1}</p>
                        {fundingLine && (
                          <Badge variant="outline" className="text-[10px]">
                            {formatCurrency(fundingLine.amountUsed)}
                          </Badge>
                        )}
                      </div>
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-[140px] min-w-[120px] text-xs"></TableHead>
                              {schedule.years.map(y => (
                                <TableHead key={y.year} className="text-right px-2 min-w-[90px] text-xs">
                                  Y{y.year}
                                </TableHead>
                              ))}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            <TableRow>
                              <TableCell className="text-xs">Opening Balance</TableCell>
                              {schedule.years.map(y => (
                                <TableCell key={y.year} className="text-right tabular-nums px-2 text-xs">
                                  {formatCurrency(y.openingBalance)}
                                </TableCell>
                              ))}
                            </TableRow>
                            <TableRow>
                              <TableCell className="text-xs">Interest</TableCell>
                              {schedule.years.map(y => (
                                <TableCell key={y.year} className="text-right tabular-nums px-2 text-xs text-red-600 dark:text-red-400">
                                  {formatCurrency(-Math.abs(y.interestPayment))}
                                </TableCell>
                              ))}
                            </TableRow>
                            <TableRow>
                              <TableCell className="text-xs">Principal</TableCell>
                              {schedule.years.map(y => (
                                <TableCell key={y.year} className="text-right tabular-nums px-2 text-xs text-red-600 dark:text-red-400">
                                  {formatCurrency(-Math.abs(y.principalRepayment))}
                                </TableCell>
                              ))}
                            </TableRow>
                            <TableRow>
                              <TableCell className="text-xs font-semibold">Closing Balance</TableCell>
                              {schedule.years.map(y => (
                                <TableCell key={y.year} className={`text-right tabular-nums px-2 text-xs font-semibold ${y.closingBalance === 0 ? 'text-green-600' : ''}`}>
                                  {formatCurrency(y.closingBalance)}
                                </TableCell>
                              ))}
                            </TableRow>
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  );
                })}

                <div className="border rounded-lg p-3 bg-muted/20">
                  <p className="text-xs font-semibold mb-2">Totals (All Facilities)</p>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[140px] min-w-[120px] text-xs"></TableHead>
                          {debtTotals.map(t => (
                            <TableHead key={t.year} className="text-right px-2 min-w-[90px] text-xs">
                              Y{t.year}
                            </TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        <TableRow>
                          <TableCell className="text-xs">Total Interest</TableCell>
                          {debtTotals.map(t => (
                            <TableCell key={t.year} className="text-right tabular-nums px-2 text-xs text-red-600 dark:text-red-400">
                              {formatCurrency(-Math.abs(t.totalInterest))}
                            </TableCell>
                          ))}
                        </TableRow>
                        <TableRow>
                          <TableCell className="text-xs">Total Principal</TableCell>
                          {debtTotals.map(t => (
                            <TableCell key={t.year} className="text-right tabular-nums px-2 text-xs text-red-600 dark:text-red-400">
                              {formatCurrency(-Math.abs(t.totalPrincipal))}
                            </TableCell>
                          ))}
                        </TableRow>
                        <TableRow>
                          <TableCell className="text-xs font-semibold">Total Debt Service</TableCell>
                          {debtTotals.map(t => (
                            <TableCell key={t.year} className="text-right tabular-nums px-2 text-xs font-semibold text-red-600 dark:text-red-400">
                              {formatCurrency(-Math.abs(t.totalDebtService))}
                            </TableCell>
                          ))}
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </>
            )}
          </CollapsibleContent>
        </Collapsible>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Card className="border-l-4 border-l-amber-500">
            <CardContent className="py-3 px-4">
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Banknote className="h-3 w-3" />
                Total Interest Paid
              </p>
              <p className="text-base font-bold mt-0.5">{formatCurrency(summaryMetrics.totalInterest)}</p>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-blue-500">
            <CardContent className="py-3 px-4">
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <TrendingDown className="h-3 w-3" />
                Total Debt Repaid
              </p>
              <p className="text-base font-bold mt-0.5">{formatCurrency(summaryMetrics.totalPrincipal)}</p>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-red-500">
            <CardContent className="py-3 px-4">
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Landmark className="h-3 w-3" />
                Total Tax
              </p>
              <p className="text-base font-bold mt-0.5">{formatCurrency(summaryMetrics.totalTax)}</p>
            </CardContent>
          </Card>
          <Card className={`border-l-4 ${summaryMetrics.totalFCF >= 0 ? 'border-l-green-500' : 'border-l-red-500'}`}>
            <CardContent className="py-3 px-4">
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <TrendingUp className="h-3 w-3" />
                5-Year FCF
              </p>
              <p className={`text-base font-bold mt-0.5 ${summaryMetrics.totalFCF >= 0 ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
                {formatCurrency(summaryMetrics.totalFCF)}
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Info className="h-3 w-3 shrink-0" />
          Cash flow waterfall shows how EBITDA converts to free cash after all obligations.
          Debt schedules are derived from the Deal Modeller funding stack.
        </div>
      </CardContent>
    </Card>
  );
}
