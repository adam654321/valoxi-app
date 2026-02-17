import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableRow } from '@/components/ui/table';
import {
  ChartContainer,
  ChartTooltip,
  type ChartConfig,
} from '@/components/ui/chart';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  ReferenceLine,
} from 'recharts';
import { formatCurrency } from '@/lib/format-utils';
import type {
  ProjectedYear,
  ReturnMetrics,
  BaseYearData,
} from '@shared/calculators/value-creation.calc';
import {
  LogOut,
  TrendingUp,
  GitCompare,
  Info,
  ArrowRight,
  Target,
} from 'lucide-react';

interface ExitAssumptions {
  exitMultiple: number;
  holdPeriodYears: number;
  exitCostPercent: number;
}

interface ExitScenarioSectionProps {
  scenarios: {
    bear: ProjectedYear[];
    base: ProjectedYear[];
    bull: ProjectedYear[];
  };
  returns: {
    bear: ReturnMetrics;
    base: ReturnMetrics;
    bull: ReturnMetrics;
  };
  exitAssumptions: ExitAssumptions;
  entryMultiple: number;
  entryEquity: number;
  baseYearData: BaseYearData;
}

const trajectoryConfig: ChartConfig = {
  bear: { label: 'Bear', color: 'hsl(0, 72%, 51%)' },
  base: { label: 'Base', color: 'hsl(221, 83%, 53%)' },
  bull: { label: 'Bull', color: 'hsl(142, 71%, 45%)' },
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

const formatIrr = (v: number) => {
  if (v === Infinity) return '∞';
  if (isNaN(v) || !isFinite(v) || v > 10) return 'N/A';
  return `${(v * 100).toFixed(1)}%`;
};

const formatMoic = (v: number) => {
  if (v === Infinity) return '∞';
  return `${v.toFixed(2)}x`;
};

const formatAxis = (v: number) => {
  if (Math.abs(v) >= 1000000) return `\u00A3${(v / 1000000).toFixed(1)}M`;
  if (Math.abs(v) >= 1000) return `\u00A3${(v / 1000).toFixed(0)}K`;
  return `\u00A3${v}`;
};

function TrajectoryTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-background px-3 py-2 shadow-xl">
      <p className="text-sm font-medium mb-1">{label}</p>
      {payload.map((entry: any, i: number) => (
        <div key={i} className="flex items-center gap-2 text-xs">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="text-muted-foreground">{entry.name}:</span>
          <span className="font-mono font-medium">{formatCurrency(entry.value)}</span>
        </div>
      ))}
    </div>
  );
}

export default function ExitScenarioSection({
  scenarios,
  returns,
  exitAssumptions,
  entryMultiple,
  entryEquity,
  baseYearData,
}: ExitScenarioSectionProps) {
  const [activeTab, setActiveTab] = useState<string>('comparison');

  const overlayChartData = useMemo(() => {
    const years = [1, 2, 3, 4, 5];
    return years.map(y => {
      const bear = scenarios.bear[y - 1];
      const base = scenarios.base[y - 1];
      const bull = scenarios.bull[y - 1];
      return {
        name: `Y${y}`,
        bearEbitda: bear?.ebitda ?? 0,
        baseEbitda: base?.ebitda ?? 0,
        bullEbitda: bull?.ebitda ?? 0,
        bearRevenue: bear?.revenue ?? 0,
        baseRevenue: base?.revenue ?? 0,
        bullRevenue: bull?.revenue ?? 0,
        bearFCF: bear?.freeCashFlow ?? 0,
        baseFCF: base?.freeCashFlow ?? 0,
        bullFCF: bull?.freeCashFlow ?? 0,
      };
    });
  }, [scenarios]);

  const exitValuations = useMemo(() => {
    const holdYears = Math.min(exitAssumptions.holdPeriodYears, 5);

    const calc = (projections: ProjectedYear[], ret: ReturnMetrics) => {
      const exitYear = projections[holdYears - 1];
      if (!exitYear) return null;
      const exitEV = exitYear.ebitda * exitAssumptions.exitMultiple;
      const exitCosts = exitEV * exitAssumptions.exitCostPercent / 100;
      return {
        exitYearEbitda: exitYear.ebitda,
        exitEV,
        exitCosts,
        remainingDebt: exitEV - ret.exitEquity - exitCosts,
        exitEquity: ret.exitEquity,
        y5Revenue: exitYear.revenue,
        y5EbitdaMargin: exitYear.revenue > 0 ? (exitYear.ebitda / exitYear.revenue) * 100 : 0,
      };
    };

    return {
      bear: calc(scenarios.bear, returns.bear),
      base: calc(scenarios.base, returns.base),
      bull: calc(scenarios.bull, returns.bull),
    };
  }, [scenarios, returns, exitAssumptions]);

  const holdYears = Math.min(exitAssumptions.holdPeriodYears, 5);

  const greenRedVal = (v: number) => (
    <span className={v >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
      {formatCurrency(v)}
    </span>
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            Exit Modelling & Scenario Comparison
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="h-9">
            <TabsTrigger value="comparison" className="text-xs px-3 gap-1.5">
              <GitCompare className="h-3.5 w-3.5" />
              Scenario Comparison
            </TabsTrigger>
            <TabsTrigger value="trajectories" className="text-xs px-3 gap-1.5">
              <TrendingUp className="h-3.5 w-3.5" />
              Trajectories
            </TabsTrigger>
            <TabsTrigger value="exit" className="text-xs px-3 gap-1.5">
              <LogOut className="h-3.5 w-3.5" />
              Exit Valuation
            </TabsTrigger>
          </TabsList>

          <TabsContent value="comparison" className="mt-4">
            <div className="overflow-x-auto">
              <Table>
                <TableBody>
                  <TableRow>
                    <TableCell className="w-[200px] min-w-[160px]" />
                    <TableCell className="text-right text-sm font-semibold text-red-600">🐻 Bear</TableCell>
                    <TableCell className="text-right text-sm font-semibold text-blue-600 bg-blue-50/50 dark:bg-blue-950/20">📊 Base</TableCell>
                    <TableCell className="text-right text-sm font-semibold text-green-600">🐂 Bull</TableCell>
                  </TableRow>

                  <TableRow className="bg-muted/30">
                    <TableCell colSpan={4} className="text-xs font-semibold uppercase tracking-wide text-muted-foreground py-2">Returns</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="text-sm font-semibold">IRR</TableCell>
                    <TableCell className={`text-right font-mono tabular-nums text-sm font-semibold ${irrColor(returns.bear.irr)}`}>{formatIrr(returns.bear.irr)}</TableCell>
                    <TableCell className={`text-right font-mono tabular-nums text-sm font-semibold bg-blue-50/50 dark:bg-blue-950/20 ${irrColor(returns.base.irr)}`}>{formatIrr(returns.base.irr)}</TableCell>
                    <TableCell className={`text-right font-mono tabular-nums text-sm font-semibold ${irrColor(returns.bull.irr)}`}>{formatIrr(returns.bull.irr)}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="text-sm font-semibold">MOIC</TableCell>
                    <TableCell className={`text-right font-mono tabular-nums text-sm font-semibold ${returns.bear.moic === Infinity ? 'text-green-600 dark:text-green-400' : moicColor(returns.bear.moic)}`}>{formatMoic(returns.bear.moic)}</TableCell>
                    <TableCell className={`text-right font-mono tabular-nums text-sm font-semibold bg-blue-50/50 dark:bg-blue-950/20 ${returns.base.moic === Infinity ? 'text-green-600 dark:text-green-400' : moicColor(returns.base.moic)}`}>{formatMoic(returns.base.moic)}</TableCell>
                    <TableCell className={`text-right font-mono tabular-nums text-sm font-semibold ${returns.bull.moic === Infinity ? 'text-green-600 dark:text-green-400' : moicColor(returns.bull.moic)}`}>{formatMoic(returns.bull.moic)}</TableCell>
                  </TableRow>
                  <TableRow className="bg-primary/5">
                    <TableCell className="text-sm font-semibold">Total Return</TableCell>
                    <TableCell className="text-right font-mono tabular-nums text-sm font-semibold">{formatCurrency(returns.bear.totalReturn)}</TableCell>
                    <TableCell className="text-right font-mono tabular-nums text-sm font-semibold bg-blue-50/50 dark:bg-blue-950/20">{formatCurrency(returns.base.totalReturn)}</TableCell>
                    <TableCell className="text-right font-mono tabular-nums text-sm font-semibold">{formatCurrency(returns.bull.totalReturn)}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="text-sm">Payback Period</TableCell>
                    <TableCell className="text-right font-mono tabular-nums text-sm">{returns.bear.paybackPeriodYears > 0 && returns.bear.paybackPeriodYears < holdYears ? `${returns.bear.paybackPeriodYears} yrs` : `>${holdYears}yrs`}</TableCell>
                    <TableCell className="text-right font-mono tabular-nums text-sm bg-blue-50/50 dark:bg-blue-950/20">{returns.base.paybackPeriodYears > 0 && returns.base.paybackPeriodYears < holdYears ? `${returns.base.paybackPeriodYears} yrs` : `>${holdYears}yrs`}</TableCell>
                    <TableCell className="text-right font-mono tabular-nums text-sm">{returns.bull.paybackPeriodYears > 0 && returns.bull.paybackPeriodYears < holdYears ? `${returns.bull.paybackPeriodYears} yrs` : `>${holdYears}yrs`}</TableCell>
                  </TableRow>

                  <TableRow>
                    <TableCell colSpan={4} className="h-1 p-0"><div className="border-t border-dashed border-muted-foreground/20" /></TableCell>
                  </TableRow>

                  <TableRow className="bg-muted/30">
                    <TableCell colSpan={4} className="text-xs font-semibold uppercase tracking-wide text-muted-foreground py-2">Exit Year Metrics (Y{holdYears})</TableCell>
                  </TableRow>
                  {exitValuations.bear && exitValuations.base && exitValuations.bull && (
                    <>
                      <TableRow>
                        <TableCell className="text-sm">Exit EBITDA</TableCell>
                        <TableCell className="text-right font-mono tabular-nums text-sm">{formatCurrency(exitValuations.bear.exitYearEbitda)}</TableCell>
                        <TableCell className="text-right font-mono tabular-nums text-sm bg-blue-50/50 dark:bg-blue-950/20">{formatCurrency(exitValuations.base.exitYearEbitda)}</TableCell>
                        <TableCell className="text-right font-mono tabular-nums text-sm">{formatCurrency(exitValuations.bull.exitYearEbitda)}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="text-sm">Exit Revenue</TableCell>
                        <TableCell className="text-right font-mono tabular-nums text-sm">{formatCurrency(exitValuations.bear.y5Revenue)}</TableCell>
                        <TableCell className="text-right font-mono tabular-nums text-sm bg-blue-50/50 dark:bg-blue-950/20">{formatCurrency(exitValuations.base.y5Revenue)}</TableCell>
                        <TableCell className="text-right font-mono tabular-nums text-sm">{formatCurrency(exitValuations.bull.y5Revenue)}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="text-sm">EBITDA Margin</TableCell>
                        <TableCell className="text-right font-mono tabular-nums text-sm">{exitValuations.bear.y5EbitdaMargin.toFixed(1)}%</TableCell>
                        <TableCell className="text-right font-mono tabular-nums text-sm bg-blue-50/50 dark:bg-blue-950/20">{exitValuations.base.y5EbitdaMargin.toFixed(1)}%</TableCell>
                        <TableCell className="text-right font-mono tabular-nums text-sm">{exitValuations.bull.y5EbitdaMargin.toFixed(1)}%</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="text-sm">Enterprise Value at Exit</TableCell>
                        <TableCell className="text-right font-mono tabular-nums text-sm">{formatCurrency(exitValuations.bear.exitEV)}</TableCell>
                        <TableCell className="text-right font-mono tabular-nums text-sm bg-blue-50/50 dark:bg-blue-950/20">{formatCurrency(exitValuations.base.exitEV)}</TableCell>
                        <TableCell className="text-right font-mono tabular-nums text-sm">{formatCurrency(exitValuations.bull.exitEV)}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="text-sm font-semibold">Exit Equity</TableCell>
                        <TableCell className="text-right font-mono tabular-nums text-sm font-semibold">{formatCurrency(exitValuations.bear.exitEquity)}</TableCell>
                        <TableCell className="text-right font-mono tabular-nums text-sm font-semibold bg-blue-50/50 dark:bg-blue-950/20">{formatCurrency(exitValuations.base.exitEquity)}</TableCell>
                        <TableCell className="text-right font-mono tabular-nums text-sm font-semibold">{formatCurrency(exitValuations.bull.exitEquity)}</TableCell>
                      </TableRow>
                    </>
                  )}

                  <TableRow>
                    <TableCell colSpan={4} className="h-1 p-0"><div className="border-t border-dashed border-muted-foreground/20" /></TableCell>
                  </TableRow>

                  <TableRow className="bg-muted/30">
                    <TableCell colSpan={4} className="text-xs font-semibold uppercase tracking-wide text-muted-foreground py-2">Value Creation Sources</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="text-sm">EBITDA Growth Value</TableCell>
                    <TableCell className="text-right font-mono tabular-nums text-sm">{greenRedVal(returns.bear.ebitdaGrowthValue)}</TableCell>
                    <TableCell className="text-right font-mono tabular-nums text-sm bg-blue-50/50 dark:bg-blue-950/20">{greenRedVal(returns.base.ebitdaGrowthValue)}</TableCell>
                    <TableCell className="text-right font-mono tabular-nums text-sm">{greenRedVal(returns.bull.ebitdaGrowthValue)}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="text-sm">Multiple Expansion</TableCell>
                    <TableCell className="text-right font-mono tabular-nums text-sm">{greenRedVal(returns.bear.multipleExpansionValue)}</TableCell>
                    <TableCell className="text-right font-mono tabular-nums text-sm bg-blue-50/50 dark:bg-blue-950/20">{greenRedVal(returns.base.multipleExpansionValue)}</TableCell>
                    <TableCell className="text-right font-mono tabular-nums text-sm">{greenRedVal(returns.bull.multipleExpansionValue)}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="text-sm">Debt Paydown</TableCell>
                    <TableCell className="text-right font-mono tabular-nums text-sm">{greenRedVal(returns.bear.debtPaydownValue)}</TableCell>
                    <TableCell className="text-right font-mono tabular-nums text-sm bg-blue-50/50 dark:bg-blue-950/20">{greenRedVal(returns.base.debtPaydownValue)}</TableCell>
                    <TableCell className="text-right font-mono tabular-nums text-sm">{greenRedVal(returns.bull.debtPaydownValue)}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="text-sm">Cash Distributions</TableCell>
                    <TableCell className="text-right font-mono tabular-nums text-sm">{greenRedVal(returns.bear.cashDistributionsValue)}</TableCell>
                    <TableCell className="text-right font-mono tabular-nums text-sm bg-blue-50/50 dark:bg-blue-950/20">{greenRedVal(returns.base.cashDistributionsValue)}</TableCell>
                    <TableCell className="text-right font-mono tabular-nums text-sm">{greenRedVal(returns.bull.cashDistributionsValue)}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="text-sm">Less: Fees & Costs</TableCell>
                    <TableCell className="text-right font-mono tabular-nums text-sm text-red-600 dark:text-red-400">{formatCurrency(-returns.bear.feesDeducted)}</TableCell>
                    <TableCell className="text-right font-mono tabular-nums text-sm text-red-600 dark:text-red-400 bg-blue-50/50 dark:bg-blue-950/20">{formatCurrency(-returns.base.feesDeducted)}</TableCell>
                    <TableCell className="text-right font-mono tabular-nums text-sm text-red-600 dark:text-red-400">{formatCurrency(-returns.bull.feesDeducted)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="trajectories" className="mt-4 space-y-6">
            <div>
              <p className="text-sm font-medium mb-2">EBITDA Trajectory</p>
              <ChartContainer config={trajectoryConfig} className="h-[220px] w-full">
                <AreaChart data={overlayChartData} margin={{ top: 10, right: 10, left: 10, bottom: 5 }}>
                  <defs>
                    <linearGradient id="bearFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(0, 72%, 51%)" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="hsl(0, 72%, 51%)" stopOpacity={0.02} />
                    </linearGradient>
                    <linearGradient id="baseFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(221, 83%, 53%)" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="hsl(221, 83%, 53%)" stopOpacity={0.02} />
                    </linearGradient>
                    <linearGradient id="bullFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(142, 71%, 45%)" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="hsl(142, 71%, 45%)" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={formatAxis} width={70} />
                  <ReferenceLine y={baseYearData.adjustedEbitda} stroke="hsl(var(--muted-foreground))" strokeDasharray="5 5" label={{ value: 'Base Year', fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                  <ChartTooltip content={<TrajectoryTooltip />} />
                  <Area type="monotone" dataKey="bearEbitda" name="Bear" stroke="hsl(0, 72%, 51%)" fill="url(#bearFill)" strokeWidth={2} dot={false} />
                  <Area type="monotone" dataKey="baseEbitda" name="Base" stroke="hsl(221, 83%, 53%)" fill="url(#baseFill)" strokeWidth={2} dot={false} />
                  <Area type="monotone" dataKey="bullEbitda" name="Bull" stroke="hsl(142, 71%, 45%)" fill="url(#bullFill)" strokeWidth={2} dot={false} />
                </AreaChart>
              </ChartContainer>
            </div>

            <div>
              <p className="text-sm font-medium mb-2">Revenue Trajectory</p>
              <ChartContainer config={trajectoryConfig} className="h-[220px] w-full">
                <AreaChart data={overlayChartData} margin={{ top: 10, right: 10, left: 10, bottom: 5 }}>
                  <defs>
                    <linearGradient id="bearFillRev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(0, 72%, 51%)" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="hsl(0, 72%, 51%)" stopOpacity={0.02} />
                    </linearGradient>
                    <linearGradient id="baseFillRev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(221, 83%, 53%)" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="hsl(221, 83%, 53%)" stopOpacity={0.02} />
                    </linearGradient>
                    <linearGradient id="bullFillRev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(142, 71%, 45%)" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="hsl(142, 71%, 45%)" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={formatAxis} width={70} />
                  <ReferenceLine y={baseYearData.revenue} stroke="hsl(var(--muted-foreground))" strokeDasharray="5 5" label={{ value: 'Base Year', fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                  <ChartTooltip content={<TrajectoryTooltip />} />
                  <Area type="monotone" dataKey="bearRevenue" name="Bear" stroke="hsl(0, 72%, 51%)" fill="url(#bearFillRev)" strokeWidth={2} dot={false} />
                  <Area type="monotone" dataKey="baseRevenue" name="Base" stroke="hsl(221, 83%, 53%)" fill="url(#baseFillRev)" strokeWidth={2} dot={false} />
                  <Area type="monotone" dataKey="bullRevenue" name="Bull" stroke="hsl(142, 71%, 45%)" fill="url(#bullFillRev)" strokeWidth={2} dot={false} />
                </AreaChart>
              </ChartContainer>
            </div>

            <div>
              <p className="text-sm font-medium mb-2">Free Cash Flow</p>
              <ChartContainer config={trajectoryConfig} className="h-[220px] w-full">
                <AreaChart data={overlayChartData} margin={{ top: 10, right: 10, left: 10, bottom: 5 }}>
                  <defs>
                    <linearGradient id="bearFillFCF" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(0, 72%, 51%)" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="hsl(0, 72%, 51%)" stopOpacity={0.02} />
                    </linearGradient>
                    <linearGradient id="baseFillFCF" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(221, 83%, 53%)" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="hsl(221, 83%, 53%)" stopOpacity={0.02} />
                    </linearGradient>
                    <linearGradient id="bullFillFCF" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(142, 71%, 45%)" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="hsl(142, 71%, 45%)" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={formatAxis} width={70} />
                  <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeWidth={1} />
                  <ChartTooltip content={<TrajectoryTooltip />} />
                  <Area type="monotone" dataKey="bearFCF" name="Bear" stroke="hsl(0, 72%, 51%)" fill="url(#bearFillFCF)" strokeWidth={2} dot={false} />
                  <Area type="monotone" dataKey="baseFCF" name="Base" stroke="hsl(221, 83%, 53%)" fill="url(#baseFillFCF)" strokeWidth={2} dot={false} />
                  <Area type="monotone" dataKey="bullFCF" name="Bull" stroke="hsl(142, 71%, 45%)" fill="url(#bullFillFCF)" strokeWidth={2} dot={false} />
                </AreaChart>
              </ChartContainer>
            </div>

            <div className="flex items-center justify-center gap-6 mt-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-6 rounded-sm bg-red-500" /> Bear
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-6 rounded-sm bg-blue-500" /> Base
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-6 rounded-sm bg-green-500" /> Bull
              </span>
            </div>
          </TabsContent>

          <TabsContent value="exit" className="mt-4">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {(['bear', 'base', 'bull'] as const).map(scenario => {
                const ret = returns[scenario];
                const ev = exitValuations[scenario];
                if (!ev) return null;
                const borderColor = scenario === 'bear' ? 'border-l-red-500' : scenario === 'base' ? 'border-l-blue-500' : 'border-l-green-500';
                const textColor = scenario === 'bear' ? 'text-red-600' : scenario === 'base' ? 'text-blue-600' : 'text-green-600';
                const emoji = scenario === 'bear' ? '🐻' : scenario === 'base' ? '📊' : '🐂';
                const label = scenario.charAt(0).toUpperCase() + scenario.slice(1);

                return (
                  <div key={scenario} className={`rounded-lg border border-l-4 ${borderColor} p-4 space-y-3`}>
                    <p className={`text-sm font-semibold ${textColor}`}>{emoji} {label} Case</p>
                    <table className="w-full text-xs">
                      <tbody>
                        <tr>
                          <td className="py-1 text-muted-foreground">Exit Year EBITDA</td>
                          <td className="py-1 text-right font-mono">{formatCurrency(ev.exitYearEbitda)}</td>
                        </tr>
                        <tr>
                          <td className="py-1 text-muted-foreground">× Exit Multiple</td>
                          <td className="py-1 text-right font-mono">{exitAssumptions.exitMultiple.toFixed(1)}x</td>
                        </tr>
                        <tr>
                          <td colSpan={2} className="py-0"><div className="border-t border-dashed border-muted-foreground/20" /></td>
                        </tr>
                        <tr>
                          <td className="py-1 font-medium">Enterprise Value</td>
                          <td className="py-1 text-right font-mono font-medium">{formatCurrency(ev.exitEV)}</td>
                        </tr>
                        <tr>
                          <td className="py-1 text-muted-foreground">Less: Remaining Debt</td>
                          <td className="py-1 text-right font-mono text-red-600">({formatCurrency(ev.remainingDebt)})</td>
                        </tr>
                        <tr>
                          <td className="py-1 text-muted-foreground">Less: Exit Costs</td>
                          <td className="py-1 text-right font-mono text-red-600">({formatCurrency(ev.exitCosts)})</td>
                        </tr>
                        <tr>
                          <td colSpan={2} className="py-0"><div className="border-t border-dashed border-muted-foreground/20" /></td>
                        </tr>
                        <tr>
                          <td className={`py-1 font-bold text-lg ${textColor}`}>EXIT EQUITY</td>
                          <td className={`py-1 text-right font-mono font-bold text-lg ${textColor}`}>{formatCurrency(ev.exitEquity)}</td>
                        </tr>
                      </tbody>
                    </table>
                    <div className="border-t pt-2 space-y-1 text-xs">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">IRR</span>
                        <span className={`font-mono font-semibold ${irrColor(ret.irr)}`}>{formatIrr(ret.irr)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">MOIC</span>
                        <span className={`font-mono font-semibold ${ret.moic === Infinity ? 'text-green-600 dark:text-green-400' : moicColor(ret.moic)}`}>{formatMoic(ret.moic)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Total Return</span>
                        <span className="font-mono font-bold">{formatCurrency(ret.totalReturn)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="rounded-lg border bg-muted/20 p-4 mt-4">
              <div className="flex flex-wrap items-center gap-x-8 gap-y-2">
                <div className="flex items-center gap-2">
                  <Target className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">
                    Entry: <span className="font-bold">{entryMultiple.toFixed(1)}x</span>
                    <ArrowRight className="h-3 w-3 inline mx-1.5 text-muted-foreground" />
                    Exit: <span className="font-bold">{exitAssumptions.exitMultiple.toFixed(1)}x</span>
                  </span>
                  {exitAssumptions.exitMultiple > entryMultiple ? (
                    <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 text-[10px]">
                      +{((exitAssumptions.exitMultiple - entryMultiple) / entryMultiple * 100).toFixed(0)}% expansion
                    </Badge>
                  ) : exitAssumptions.exitMultiple < entryMultiple ? (
                    <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 text-[10px]">
                      {((exitAssumptions.exitMultiple - entryMultiple) / entryMultiple * 100).toFixed(0)}% contraction
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="text-[10px]">Flat</Badge>
                  )}
                </div>
                <div className="text-sm text-muted-foreground">
                  Hold period: <span className="font-medium text-foreground">{exitAssumptions.holdPeriodYears} years</span>
                </div>
                <div className="text-sm text-muted-foreground">
                  Exit costs: <span className="font-medium text-foreground">{exitAssumptions.exitCostPercent}%</span>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mt-4">
          <Info className="h-3 w-3 shrink-0" />
          All scenarios use the same exit multiple and hold period. Bear/bull cases adjust revenue growth
          and cost pressure from the base assumptions. Returns include interim cash distributions.
        </div>
      </CardContent>
    </Card>
  );
}
