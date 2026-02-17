import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
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
  Cell,
  LabelList,
} from 'recharts';
import { formatCurrency, formatPercent } from '@/lib/format-utils';
import type { ReturnMetrics, ProjectedYear, ExitAssumptions } from '@shared/calculators/value-creation.calc';
import {
  TrendingUp,
  Percent,
  Timer,
  Layers,
  BarChart3,
  Table as TableIcon,
  Info,
  ArrowRight,
} from 'lucide-react';

interface ReturnsAnalysisSectionProps {
  metrics: ReturnMetrics;
  projections: ProjectedYear[];
  exitAssumptions: ExitAssumptions;
  entryMultiple: number;
}

const chartConfig: ChartConfig = {
  entryEquity: { label: 'Entry Equity', color: 'hsl(215, 20%, 65%)' },
  ebitdaGrowth: { label: 'EBITDA Growth', color: 'hsl(142, 71%, 45%)' },
  multipleExpansion: { label: 'Multiple Expansion', color: 'hsl(199, 89%, 48%)' },
  debtPaydown: { label: 'Debt Paydown', color: 'hsl(262, 83%, 58%)' },
  cashDistributions: { label: 'Cash Distributions', color: 'hsl(45, 93%, 47%)' },
  fees: { label: 'Fees & Costs', color: 'hsl(0, 72%, 51%)' },
  totalReturn: { label: 'Total Return', color: 'hsl(160, 84%, 39%)' },
};

const irrColor = (v: number) => {
  const pct = v * 100;
  if (pct >= 25) return 'text-green-600 dark:text-green-400';
  if (pct >= 15) return 'text-blue-600 dark:text-blue-400';
  if (pct >= 10) return 'text-amber-600 dark:text-amber-400';
  return 'text-red-600 dark:text-red-400';
};

const moicColor = (v: number) => {
  if (v >= 3) return 'text-green-600 dark:text-green-400';
  if (v >= 2) return 'text-blue-600 dark:text-blue-400';
  if (v >= 1.5) return 'text-amber-600 dark:text-amber-400';
  return 'text-red-600 dark:text-red-400';
};

const paybackColor = (v: number) => {
  if (v <= 3) return 'text-green-600 dark:text-green-400';
  if (v <= 4) return 'text-blue-600 dark:text-blue-400';
  if (v <= 5) return 'text-amber-600 dark:text-amber-400';
  return 'text-red-600 dark:text-red-400';
};

export default function ReturnsAnalysisSection({ metrics, projections, exitAssumptions, entryMultiple }: ReturnsAnalysisSectionProps) {
  const [view, setView] = useState<'chart' | 'table'>('chart');

  const isNoEquityDeal = metrics.entryEquity === 0;

  const irrDisplay = metrics.irr === Infinity
    ? '∞'
    : isNaN(metrics.irr) || !isFinite(metrics.irr) || metrics.irr > 10
      ? 'N/A'
      : `${(metrics.irr * 100).toFixed(1)}%`;

  const moicDisplay = metrics.moic === Infinity
    ? '∞'
    : `${metrics.moic.toFixed(2)}x`;

  const paybackDisplay = metrics.paybackPeriodYears === 0 && isNoEquityDeal
    ? 'Instant'
    : metrics.paybackPeriodYears <= 0 || metrics.paybackPeriodYears >= exitAssumptions.holdPeriodYears
      ? `>${exitAssumptions.holdPeriodYears}yrs`
      : `${metrics.paybackPeriodYears} yrs`;

  const bridgeData = useMemo(() => {
    const m = metrics;
    const items: Array<{
      name: string;
      value: number;
      isTotal: boolean;
      color: string;
    }> = [
      { name: 'Entry\nEquity', value: m.entryEquity, isTotal: true, color: 'hsl(215, 20%, 65%)' },
      { name: 'EBITDA\nGrowth', value: m.ebitdaGrowthValue, isTotal: false, color: 'hsl(142, 71%, 45%)' },
      { name: 'Multiple\nExpansion', value: m.multipleExpansionValue, isTotal: false, color: 'hsl(199, 89%, 48%)' },
      { name: 'Debt\nPaydown', value: m.debtPaydownValue, isTotal: false, color: 'hsl(262, 83%, 58%)' },
      { name: 'Cash\nDistributions', value: m.cashDistributionsValue, isTotal: false, color: 'hsl(45, 93%, 47%)' },
      { name: 'Fees &\nCosts', value: -m.feesDeducted, isTotal: false, color: 'hsl(0, 72%, 51%)' },
      { name: 'Total\nReturn', value: m.totalReturn, isTotal: true, color: 'hsl(160, 84%, 39%)' },
    ];

    let runningTotal = 0;
    return items.map(item => {
      if (item.isTotal) {
        const result = {
          ...item,
          base: 0,
          barValue: item.value,
          displayValue: item.value,
        };
        if (item.name.includes('Entry')) {
          runningTotal = item.value;
        }
        return result;
      } else {
        const base = item.value >= 0 ? runningTotal : runningTotal + item.value;
        const barValue = Math.abs(item.value);
        const result = {
          ...item,
          base,
          barValue,
          displayValue: item.value,
        };
        runningTotal += item.value;
        return result;
      }
    });
  }, [metrics]);

  const formatAxis = (v: number) => {
    if (Math.abs(v) >= 1000000) return `\u00A3${(v / 1000000).toFixed(1)}M`;
    if (Math.abs(v) >= 1000) return `\u00A3${(v / 1000).toFixed(0)}K`;
    return `\u00A3${v}`;
  };

  const formatLabel = (value: number) => {
    if (Math.abs(value) >= 1000000) return `\u00A3${(value / 1000000).toFixed(1)}M`;
    if (Math.abs(value) >= 1000) return `\u00A3${(value / 1000).toFixed(0)}K`;
    return formatCurrency(value);
  };

  const greenVal = (v: number) => <span className={v >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>{formatCurrency(v)}</span>;
  const redVal = (v: number) => <span className="text-red-600 dark:text-red-400">{formatCurrency(v)}</span>;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            Returns Analysis
          </CardTitle>
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
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-lg border p-4 text-center">
            <Percent className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
            <p className="text-xs text-muted-foreground uppercase tracking-wide">IRR</p>
            <p className={`text-2xl font-bold ${irrDisplay === 'N/A' ? 'text-muted-foreground' : irrDisplay === '∞' ? 'text-green-600 dark:text-green-400' : irrColor(metrics.irr)}`}>
              {irrDisplay}
            </p>
            <p className="text-[11px] text-muted-foreground">Internal Rate of Return</p>
          </div>
          <div className="rounded-lg border p-4 text-center">
            <Layers className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
            <p className="text-xs text-muted-foreground uppercase tracking-wide">MOIC</p>
            <p className={`text-2xl font-bold ${metrics.moic === Infinity ? 'text-green-600 dark:text-green-400' : moicColor(metrics.moic)}`}>
              {moicDisplay}
            </p>
            <p className="text-[11px] text-muted-foreground">Multiple on Invested Capital</p>
          </div>
          <div className="rounded-lg border p-4 text-center">
            <Timer className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Payback</p>
            <p className={`text-2xl font-bold ${
              paybackDisplay === 'Instant'
                ? 'text-green-600 dark:text-green-400'
                : metrics.paybackPeriodYears <= 0 || metrics.paybackPeriodYears >= exitAssumptions.holdPeriodYears
                  ? 'text-red-600 dark:text-red-400'
                  : paybackColor(metrics.paybackPeriodYears)
            }`}>
              {paybackDisplay}
            </p>
            <p className="text-[11px] text-muted-foreground">Years to recover equity</p>
          </div>
        </div>

        {isNoEquityDeal && (
          <div className="flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30 rounded-md px-3 py-1.5">
            <Info className="h-3.5 w-3.5 shrink-0" />
            No equity invested — fully debt funded. MOIC and IRR are infinite by definition.
          </div>
        )}

        {view === 'chart' ? (
          <ChartContainer config={chartConfig} className="h-[320px] w-full">
            <BarChart data={bridgeData} margin={{ top: 25, right: 10, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                interval={0}
              />
              <YAxis
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={formatAxis}
                width={70}
              />
              <ChartTooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const data = payload[0]?.payload;
                  if (!data) return null;
                  return (
                    <div className="rounded-lg border bg-background px-3 py-2 shadow-xl">
                      <p className="text-sm font-medium">{data.name?.replace('\n', ' ')}</p>
                      <p className="text-xs font-mono mt-1">
                        {data.displayValue >= 0 ? '+' : ''}{formatCurrency(data.displayValue)}
                      </p>
                    </div>
                  );
                }}
              />
              <Bar dataKey="base" stackId="bridge" fill="transparent" isAnimationActive={false} />
              <Bar dataKey="barValue" stackId="bridge" isAnimationActive={false} radius={[4, 4, 0, 0]}>
                {bridgeData.map((entry, index) => (
                  <Cell key={index} fill={entry.color} />
                ))}
                <LabelList
                  dataKey="displayValue"
                  position="top"
                  formatter={formatLabel}
                  className="text-[10px] fill-muted-foreground font-mono"
                />
              </Bar>
            </BarChart>
          </ChartContainer>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableBody>
                <TableRow>
                  <TableCell colSpan={2} className="text-xs font-semibold uppercase tracking-wide text-muted-foreground py-2">Entry</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="text-sm">Equity Invested</TableCell>
                  <TableCell className="text-right font-mono tabular-nums text-sm">{formatCurrency(metrics.entryEquity)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="text-sm">Entry Multiple</TableCell>
                  <TableCell className="text-right font-mono tabular-nums text-sm">{entryMultiple.toFixed(1)}x</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell colSpan={2} className="h-1 p-0">
                    <div className="border-t border-dashed border-muted-foreground/20" />
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell colSpan={2} className="text-xs font-semibold uppercase tracking-wide text-muted-foreground py-2">Value Creation</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="text-sm text-muted-foreground">EBITDA Growth</TableCell>
                  <TableCell className="text-right font-mono tabular-nums text-sm">{greenVal(metrics.ebitdaGrowthValue)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="text-sm text-muted-foreground">Multiple Expansion</TableCell>
                  <TableCell className="text-right font-mono tabular-nums text-sm">{greenVal(metrics.multipleExpansionValue)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="text-sm text-muted-foreground">Debt Paydown</TableCell>
                  <TableCell className="text-right font-mono tabular-nums text-sm">{greenVal(metrics.debtPaydownValue)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="text-sm text-muted-foreground">Cash Distributions</TableCell>
                  <TableCell className="text-right font-mono tabular-nums text-sm">{greenVal(metrics.cashDistributionsValue)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="text-sm text-muted-foreground">Less: Fees & Exit Costs</TableCell>
                  <TableCell className="text-right font-mono tabular-nums text-sm">{redVal(-metrics.feesDeducted)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell colSpan={2} className="h-1 p-0">
                    <div className="border-t border-dashed border-muted-foreground/20" />
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell colSpan={2} className="text-xs font-semibold uppercase tracking-wide text-muted-foreground py-2">Returns</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="text-sm font-semibold">Exit Equity Value</TableCell>
                  <TableCell className="text-right font-mono tabular-nums text-sm font-semibold">{formatCurrency(metrics.exitEquity)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="text-sm text-muted-foreground">Total Cash Distributions</TableCell>
                  <TableCell className="text-right font-mono tabular-nums text-sm">{formatCurrency(metrics.totalCashDistributions)}</TableCell>
                </TableRow>
                <TableRow className="bg-primary/5 font-semibold">
                  <TableCell className="text-sm font-semibold">Total Return</TableCell>
                  <TableCell className="text-right font-mono tabular-nums text-sm font-semibold">{formatCurrency(metrics.totalReturn)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell colSpan={2} className="h-1 p-0">
                    <div className="border-t border-dashed border-muted-foreground/20" />
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="text-sm font-semibold">IRR</TableCell>
                  <TableCell className={`text-right font-mono tabular-nums text-sm font-semibold ${irrDisplay === 'N/A' ? 'text-muted-foreground' : irrColor(metrics.irr)}`}>
                    {irrDisplay}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="text-sm font-semibold">MOIC</TableCell>
                  <TableCell className={`text-right font-mono tabular-nums text-sm font-semibold ${metrics.moic === Infinity ? 'text-green-600 dark:text-green-400' : moicColor(metrics.moic)}`}>
                    {moicDisplay}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="text-sm font-semibold">Payback Period</TableCell>
                  <TableCell className={`text-right font-mono tabular-nums text-sm font-semibold ${
                    paybackDisplay === 'Instant'
                      ? 'text-green-600 dark:text-green-400'
                      : metrics.paybackPeriodYears <= 0 || metrics.paybackPeriodYears >= exitAssumptions.holdPeriodYears
                        ? 'text-red-600 dark:text-red-400'
                        : paybackColor(metrics.paybackPeriodYears)
                  }`}>
                    {paybackDisplay}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        )}

        <div className="flex flex-wrap gap-x-6 gap-y-1 text-[11px] text-muted-foreground">
          <span>Exit Year: <span className="font-medium text-foreground/70">Y{exitAssumptions.holdPeriodYears}</span></span>
          <span>Exit Multiple: <span className="font-medium text-foreground/70">{exitAssumptions.exitMultiple}x</span></span>
          <span className="flex items-center gap-1">
            Entry <ArrowRight className="h-2.5 w-2.5" /> Exit Multiple:
            <span className="font-medium text-foreground/70">{entryMultiple.toFixed(1)}x <ArrowRight className="h-2.5 w-2.5 inline" /> {exitAssumptions.exitMultiple}x</span>
          </span>
          <span>Exit Costs: <span className="font-medium text-foreground/70">{exitAssumptions.exitCostPercent}%</span></span>
        </div>

        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Info className="h-3 w-3 shrink-0" />
          Returns calculated using Newton-Raphson IRR solver. MOIC = Total Return / Entry Equity.
          Value bridge shows sources of equity value creation over the hold period.
        </div>
      </CardContent>
    </Card>
  );
}
