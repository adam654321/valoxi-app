import { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
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
import { formatCurrency } from '@/lib/format-utils';
import type {
  ProjectedYear,
  ReturnMetrics,
  BaseYearData,
  ExitAssumptions,
} from '@shared/calculators/value-creation.calc';
import ImpactSummaryBar, { type ImpactMetrics } from './ImpactSummaryBar';
import { TrendingUp, BarChart3, Shield, Clock, Layers, Percent, Info } from 'lucide-react';

interface ValuationDashboardProps {
  projections: ProjectedYear[];
  baseYearData: BaseYearData;
  baseYearLabel: string;
  returnMetrics: ReturnMetrics | null;
  scenarioComparison: {
    projections: { bear: ProjectedYear[]; base: ProjectedYear[]; bull: ProjectedYear[] };
    returns: { bear: ReturnMetrics; base: ReturnMetrics; bull: ReturnMetrics };
    derivedExitMultiples?: { bear: number; base: number; bull: number } | null;
  } | null;
  exitAssumptions: ExitAssumptions;
  entryMultiple: number;
  entryEquity: number;
  previousMetrics: ImpactMetrics | null;
  currentMetrics: ImpactMetrics | null;
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

const irrBorder = (v: number) => {
  const pct = v * 100;
  if (pct >= 25) return 'border-l-green-500';
  if (pct >= 15) return 'border-l-blue-500';
  if (pct >= 10) return 'border-l-amber-500';
  return 'border-l-red-500';
};

const moicColor = (v: number) => {
  if (v >= 3) return 'text-green-600 dark:text-green-400';
  if (v >= 2) return 'text-blue-600 dark:text-blue-400';
  if (v >= 1.5) return 'text-amber-600 dark:text-amber-400';
  return 'text-red-600 dark:text-red-400';
};

const moicBorder = (v: number) => {
  if (v >= 3) return 'border-l-green-500';
  if (v >= 2) return 'border-l-blue-500';
  if (v >= 1.5) return 'border-l-amber-500';
  return 'border-l-red-500';
};

const dscrColor = (v: number) => {
  if (v >= 1.8) return 'text-green-600 dark:text-green-400';
  if (v >= 1.4) return 'text-blue-600 dark:text-blue-400';
  if (v >= 1.0) return 'text-amber-600 dark:text-amber-400';
  return 'text-red-600 dark:text-red-400';
};

const dscrBorder = (v: number) => {
  if (v >= 1.8) return 'border-l-green-500';
  if (v >= 1.4) return 'border-l-blue-500';
  if (v >= 1.0) return 'border-l-amber-500';
  return 'border-l-red-500';
};

const formatIrr = (v: number) => {
  if (v === Infinity) return '∞';
  if (isNaN(v) || !isFinite(v)) return '—';
  if (v < -1) return '< -100%';
  if (v > 10) return `>${Math.floor(v * 100)}%`;
  return `${(v * 100).toFixed(1)}%`;
};

const formatMoic = (v: number) => {
  if (v === Infinity) return '∞';
  if (isNaN(v) || !isFinite(v)) return '—';
  return `${v.toFixed(2)}x`;
};

const formatAxis = (v: number) => {
  if (Math.abs(v) >= 1000000) return `£${(v / 1000000).toFixed(1)}M`;
  if (Math.abs(v) >= 1000) return `£${(v / 1000).toFixed(0)}K`;
  return `£${v}`;
};

const formatLabel = (value: number) => {
  if (Math.abs(value) >= 1000000) return `£${(value / 1000000).toFixed(1)}M`;
  if (Math.abs(value) >= 1000) return `£${(value / 1000).toFixed(0)}K`;
  return formatCurrency(value);
};

function changePercent(base: number, projected: number): string {
  if (base === 0) return projected === 0 ? '0%' : '+∞';
  const pct = ((projected - base) / Math.abs(base)) * 100;
  return `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`;
}

function changeColor(base: number, projected: number): string {
  if (projected >= base) return 'text-green-600 dark:text-green-400';
  return 'text-red-600 dark:text-red-400';
}

export default function ValuationDashboard({
  projections,
  baseYearData,
  baseYearLabel,
  returnMetrics,
  scenarioComparison,
  exitAssumptions,
  entryMultiple,
  entryEquity,
  previousMetrics,
  currentMetrics,
}: ValuationDashboardProps) {
  const [displayYear, setDisplayYear] = useState<number>(5);

  const dy = projections[Math.min(displayYear, projections.length) - 1];
  const cumulativeFcf = projections.slice(0, displayYear).reduce((sum, p) => sum + p.freeCashFlow, 0);
  const worstDscr = Math.min(...projections.slice(0, displayYear).map(p => p.dscr));

  const hasReturns = returnMetrics !== null;
  const sc = scenarioComparison;

  const bridgeData = useMemo(() => {
    if (!returnMetrics) return null;
    const m = returnMetrics;
    const items = [
      { name: 'Entry Eq.', value: m.entryEquity, isTotal: true, color: 'hsl(215, 20%, 65%)' },
      { name: 'EBITDA', value: m.ebitdaGrowthValue, isTotal: false, color: 'hsl(142, 71%, 45%)' },
      { name: 'Multiple', value: m.multipleExpansionValue, isTotal: false, color: 'hsl(199, 89%, 48%)' },
      { name: 'Debt Pay.', value: m.debtPaydownValue, isTotal: false, color: 'hsl(262, 83%, 58%)' },
      { name: 'Cash Dist.', value: m.cashDistributionsValue, isTotal: false, color: 'hsl(45, 93%, 47%)' },
      { name: 'Fees', value: -m.feesDeducted, isTotal: false, color: 'hsl(0, 72%, 51%)' },
      { name: 'Total', value: m.totalReturn, isTotal: true, color: 'hsl(160, 84%, 39%)' },
    ];

    let runningTotal = 0;
    return items.map(item => {
      if (item.isTotal) {
        const result = { ...item, base: 0, barValue: item.value, displayValue: item.value };
        if (item.name.includes('Entry')) runningTotal = item.value;
        return result;
      }
      const base = item.value >= 0 ? runningTotal : runningTotal + item.value;
      const barValue = Math.abs(item.value);
      const result = { ...item, base, barValue, displayValue: item.value };
      runningTotal += item.value;
      return result;
    });
  }, [returnMetrics]);

  const holdYears = Math.min(exitAssumptions.holdPeriodYears, 5);

  const miniScenarios = useMemo(() => {
    if (!sc) return null;
    const yearIdx = Math.min(displayYear, 5) - 1;
    return (['bear', 'base', 'bull'] as const).map(scenario => {
      const ret = sc.returns[scenario];
      const proj = sc.projections[scenario];
      const exitYear = proj[Math.min(yearIdx, proj.length - 1)];
      if (!exitYear) return null;
      const scenarioExitMultiple = sc.derivedExitMultiples
        ? sc.derivedExitMultiples[scenario]
        : exitAssumptions.exitMultiple;
      const exitEV = exitYear.ebitda * scenarioExitMultiple;
      return {
        scenario,
        exitEbitda: exitYear.ebitda,
        exitEV,
        exitEquity: ret.exitEquity,
        exitMultiple: scenarioExitMultiple,
        irr: ret.irr,
        moic: ret.moic,
      };
    }).filter(Boolean) as Array<{
      scenario: 'bear' | 'base' | 'bull';
      exitEbitda: number;
      exitEV: number;
      exitEquity: number;
      exitMultiple: number;
      irr: number;
      moic: number;
    }>;
  }, [sc, exitAssumptions, displayYear]);

  const baseMargin = baseYearData.revenue > 0 ? (baseYearData.adjustedEbitda / baseYearData.revenue) * 100 : 0;
  const dyMargin = dy && dy.revenue > 0 ? (dy.ebitda / dy.revenue) * 100 : 0;

  if (!dy) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-sm font-semibold text-muted-foreground">Valuation Overview</h3>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Projection year</span>
          <div className="flex border rounded-md overflow-hidden">
            {[1, 2, 3, 4, 5].map(y => (
              <button
                key={y}
                onClick={() => setDisplayYear(y)}
                className={`px-2.5 py-1 text-xs font-medium transition-colors ${
                  displayYear === y
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-background hover:bg-muted'
                } ${y !== 1 ? 'border-l' : ''}`}
              >
                Y{y}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className={`grid gap-3 ${hasReturns ? 'grid-cols-2 lg:grid-cols-3' : 'grid-cols-1 sm:grid-cols-3'}`}>
        {hasReturns && (
          <>
            <Card className={`border-l-4 ${irrBorder(returnMetrics.irr)}`}>
              <CardContent className="py-3 px-4">
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Percent className="h-3 w-3" /> IRR
                </p>
                {sc ? (
                  <div className="flex flex-wrap items-baseline gap-1 mt-1">
                    <span className="text-[10px] text-red-600 font-mono">{formatIrr(sc.returns.bear.irr)}</span>
                    <span className={`text-lg font-bold font-mono ${returnMetrics.irr === Infinity ? 'text-green-600' : irrColor(returnMetrics.irr)}`}>{formatIrr(returnMetrics.irr)}</span>
                    <span className="text-[10px] text-green-600 font-mono">{formatIrr(sc.returns.bull.irr)}</span>
                  </div>
                ) : (
                  <p className={`text-lg font-bold mt-0.5 font-mono ${returnMetrics.irr === Infinity ? 'text-green-600' : irrColor(returnMetrics.irr)}`}>{formatIrr(returnMetrics.irr)}</p>
                )}
              </CardContent>
            </Card>

            <Card className={`border-l-4 ${returnMetrics.moic === Infinity ? 'border-l-green-500' : moicBorder(returnMetrics.moic)}`}>
              <CardContent className="py-3 px-4">
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Layers className="h-3 w-3" /> MOIC
                </p>
                {sc ? (
                  <div className="flex flex-wrap items-baseline gap-1 mt-1">
                    <span className="text-[10px] text-red-600 font-mono">{formatMoic(sc.returns.bear.moic)}</span>
                    <span className={`text-lg font-bold font-mono ${returnMetrics.moic === Infinity ? 'text-green-600' : moicColor(returnMetrics.moic)}`}>{formatMoic(returnMetrics.moic)}</span>
                    <span className="text-[10px] text-green-600 font-mono">{formatMoic(sc.returns.bull.moic)}</span>
                  </div>
                ) : (
                  <p className={`text-lg font-bold mt-0.5 font-mono ${returnMetrics.moic === Infinity ? 'text-green-600' : moicColor(returnMetrics.moic)}`}>{formatMoic(returnMetrics.moic)}</p>
                )}
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-purple-500">
              <CardContent className="py-3 px-4">
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" /> Payback
                </p>
                <p className="text-lg font-bold mt-0.5 font-mono">
                  {returnMetrics.paybackPeriodYears === 0
                    ? 'Instant'
                    : returnMetrics.paybackPeriodYears > holdYears
                    ? `>${holdYears}yrs`
                    : `${returnMetrics.paybackPeriodYears.toFixed(1)} yrs`}
                </p>
              </CardContent>
            </Card>
          </>
        )}

        <Card className="border-l-4 border-l-green-500">
          <CardContent className="py-3 px-4">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <BarChart3 className="h-3 w-3" /> Y{displayYear} EBITDA
            </p>
            {sc ? (
              <div className="mt-0.5">
                <p className="text-lg font-bold font-mono">{formatCurrency(dy.ebitda)}</p>
                <div className="flex gap-2 mt-0.5">
                  <span className="text-[9px] text-red-600 font-mono">{formatCurrency(sc.projections.bear[Math.min(displayYear, sc.projections.bear.length) - 1]?.ebitda ?? 0)}</span>
                  <span className="text-[9px] text-green-600 font-mono">{formatCurrency(sc.projections.bull[Math.min(displayYear, sc.projections.bull.length) - 1]?.ebitda ?? 0)}</span>
                </div>
              </div>
            ) : (
              <p className="text-lg font-bold mt-0.5 font-mono">{formatCurrency(dy.ebitda)}</p>
            )}
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-emerald-500">
          <CardContent className="py-3 px-4">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <TrendingUp className="h-3 w-3" /> Cumulative FCF (Y1–Y{displayYear})
            </p>
            <p className="text-lg font-bold mt-0.5 font-mono">{formatCurrency(cumulativeFcf)}</p>
          </CardContent>
        </Card>

        <Card className={`border-l-4 ${dscrBorder(worstDscr)}`}>
          <CardContent className="py-3 px-4">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Shield className="h-3 w-3" /> Worst DSCR (Y1–Y{displayYear})
            </p>
            <p className={`text-lg font-bold mt-0.5 font-mono ${dscrColor(worstDscr)}`}>
              {worstDscr >= 100 ? '∞' : `${worstDscr.toFixed(2)}x`}
            </p>
          </CardContent>
        </Card>
      </div>

      <ImpactSummaryBar current={currentMetrics} previous={previousMetrics} />

      {bridgeData ? (
        <Card>
          <CardContent className="py-3 px-4">
            <p className="text-xs font-medium text-muted-foreground mb-1">Value Bridge</p>
            <ChartContainer config={chartConfig} className="h-[280px] w-full">
              <BarChart data={bridgeData} margin={{ top: 25, right: 10, left: 10, bottom: 40 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 9 }} tickLine={false} axisLine={false} interval={0} angle={-35} textAnchor="end" height={55} />
                <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={formatAxis} width={60} />
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
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-8 text-center">
            <Info className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Add active funding lines in the Deal Modeller to see the value bridge chart.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        <Card>
          <CardContent className="py-3 px-4">
            <p className="text-xs font-medium text-muted-foreground mb-2">P&L Summary</p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-1.5 font-medium text-muted-foreground"></th>
                    <th className="text-right py-1.5 font-medium text-muted-foreground">{baseYearLabel}</th>
                    <th className="text-right py-1.5 font-medium text-muted-foreground">Y{displayYear} Projected</th>
                    <th className="text-right py-1.5 font-medium text-muted-foreground">Change</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { label: 'Revenue', baseVal: baseYearData.revenue, projVal: dy.revenue },
                    { label: 'Gross Profit', baseVal: baseYearData.grossProfit, projVal: dy.grossProfit },
                    { label: 'EBITDA', baseVal: baseYearData.adjustedEbitda, projVal: dy.ebitda, bold: true },
                    { label: 'EBITDA Margin', baseVal: baseMargin, projVal: dyMargin, isMargin: true },
                    { label: 'Net Profit', baseVal: baseYearData.netProfit, projVal: dy.netProfit },
                  ].map(row => (
                    <tr key={row.label} className="border-b last:border-0">
                      <td className={`py-1.5 ${row.bold ? 'font-semibold' : ''}`}>{row.label}</td>
                      <td className="text-right py-1.5 font-mono">
                        {row.isMargin ? `${row.baseVal.toFixed(1)}%` : formatCurrency(row.baseVal)}
                      </td>
                      <td className="text-right py-1.5 font-mono">
                        {row.isMargin ? `${row.projVal.toFixed(1)}%` : formatCurrency(row.projVal)}
                      </td>
                      <td className={`text-right py-1.5 font-mono ${changeColor(row.baseVal, row.projVal)}`}>
                        {row.isMargin
                          ? `${(row.projVal - row.baseVal) >= 0 ? '+' : ''}${(row.projVal - row.baseVal).toFixed(1)}pp`
                          : changePercent(row.baseVal, row.projVal)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {miniScenarios ? (
          <Card>
            <CardContent className="py-3 px-4">
              <p className="text-xs font-medium text-muted-foreground mb-2">Scenario Summary</p>
              <div className="grid grid-cols-3 gap-3">
                {miniScenarios.map(s => {
                  const borderColor = s.scenario === 'bear' ? 'border-l-red-500' : s.scenario === 'base' ? 'border-l-blue-500' : 'border-l-green-500';
                  const textColor = s.scenario === 'bear' ? 'text-red-600' : s.scenario === 'base' ? 'text-blue-600' : 'text-green-600';
                  const label = s.scenario === 'bear' ? 'Bear' : s.scenario === 'base' ? 'Base' : 'Bull';

                  return (
                    <div key={s.scenario} className={`rounded-lg border border-l-4 ${borderColor} p-3 space-y-2`}>
                      <p className={`text-[11px] font-semibold ${textColor}`}>{label}</p>
                      <div className="space-y-2">
                        <div>
                          <p className="text-[9px] text-muted-foreground">Exit EBITDA</p>
                          <p className="font-mono font-medium text-[11px] leading-tight">{formatCurrency(s.exitEbitda)}</p>
                        </div>
                        <div>
                          <p className="text-[9px] text-muted-foreground">Exit Multiple</p>
                          <p className="font-mono font-medium text-[11px] leading-tight">{s.exitMultiple.toFixed(1)}x</p>
                        </div>
                        <div>
                          <p className="text-[9px] text-muted-foreground">Exit EV</p>
                          <p className="font-mono font-medium text-[11px] leading-tight">{formatCurrency(s.exitEV)}</p>
                        </div>
                        <div>
                          <p className="text-[9px] text-muted-foreground">Exit Equity</p>
                          <p className="font-mono font-semibold text-[11px] leading-tight">{formatCurrency(s.exitEquity)}</p>
                        </div>
                        <div className="border-t pt-2 space-y-1.5">
                          <div>
                            <p className="text-[9px] text-muted-foreground">IRR</p>
                            <p className={`font-mono font-semibold text-[11px] leading-tight ${s.irr === Infinity ? 'text-green-600' : irrColor(s.irr)}`}>{formatIrr(s.irr)}</p>
                          </div>
                          <div>
                            <p className="text-[9px] text-muted-foreground">MOIC</p>
                            <p className={`font-mono font-semibold text-[11px] leading-tight ${s.moic === Infinity ? 'text-green-600' : moicColor(s.moic)}`}>{formatMoic(s.moic)}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="py-8 text-center">
              <Info className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Configure scenarios to see comparison.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
