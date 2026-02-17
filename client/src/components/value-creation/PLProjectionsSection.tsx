import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  ReferenceLine,
  Bar,
  BarChart,
  ComposedChart,
  Line,
} from 'recharts';
import { formatCurrency, formatPercent } from '@/lib/format-utils';
import type { ProjectedYear, BaseYearData, SynergyInput } from '@shared/calculators/value-creation.calc';
import {
  TrendingUp,
  Table as TableIcon,
  BarChart3,
  ChevronDown,
  ChevronUp,
  Info,
} from 'lucide-react';

interface PLProjectionsSectionProps {
  projections: ProjectedYear[];
  baseYearData: BaseYearData;
  baseYearLabel: string;
  synergies: SynergyInput[];
  scenarioType: string;
}

const chartConfig: ChartConfig = {
  revenue: {
    label: 'Revenue',
    color: 'hsl(221, 83%, 53%)',
  },
  ebitda: {
    label: 'EBITDA',
    color: 'hsl(142, 71%, 45%)',
  },
  ebitdaBeforeSynergies: {
    label: 'EBITDA (pre-synergies)',
    color: 'hsl(142, 71%, 45%)',
  },
  synergies: {
    label: 'Synergies',
    color: 'hsl(262, 83%, 58%)',
  },
  grossProfit: {
    label: 'Gross Profit',
    color: 'hsl(199, 89%, 48%)',
  },
  netProfit: {
    label: 'Net Profit',
    color: 'hsl(142, 76%, 36%)',
  },
  margin: {
    label: 'EBITDA Margin',
    color: 'hsl(25, 95%, 53%)',
  },
};

function CurrencyTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-lg border bg-background px-3 py-2 shadow-xl">
      <p className="text-sm font-medium mb-1">{label}</p>
      {payload.map((entry: any, i: number) => (
        <div key={i} className="flex items-center gap-2 text-xs">
          <div
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-muted-foreground">{entry.name}:</span>
          <span className="font-mono font-medium">
            {entry.name.includes('Margin') || entry.name.includes('%')
              ? `${entry.value.toFixed(1)}%`
              : formatCurrency(entry.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function PLProjectionsSection({
  projections,
  baseYearData,
  baseYearLabel,
  synergies,
  scenarioType,
}: PLProjectionsSectionProps) {
  const [view, setView] = useState<'chart' | 'table'>('chart');
  const [expanded, setExpanded] = useState(false);

  const hasSynergies = synergies.length > 0;

  const chartData = useMemo(() => {
    const base = {
      name: baseYearLabel,
      revenue: baseYearData.revenue,
      ebitda: baseYearData.adjustedEbitda,
      ebitdaBeforeSynergies: baseYearData.adjustedEbitda,
      synergies: 0,
      grossProfit: baseYearData.grossProfit,
      netProfit: baseYearData.netProfit,
      margin: baseYearData.revenue > 0 ? (baseYearData.adjustedEbitda / baseYearData.revenue) * 100 : 0,
      isBase: true,
    };

    const years = projections.map(p => ({
      name: `Y${p.year}`,
      revenue: p.revenue,
      ebitda: p.ebitda,
      ebitdaBeforeSynergies: p.ebitdaBeforeSynergies,
      synergies: p.synergiesNet,
      grossProfit: p.grossProfit,
      netProfit: p.netProfit,
      margin: p.revenue > 0 ? (p.ebitda / p.revenue) * 100 : 0,
      isBase: false,
    }));

    return [base, ...years];
  }, [projections, baseYearData, baseYearLabel]);

  const metrics = useMemo(() => {
    if (projections.length === 0) return null;
    const y5 = projections[projections.length - 1];
    const baseRev = baseYearData.revenue;
    const revenueCAGR = baseRev > 0
      ? (Math.pow(y5.revenue / baseRev, 1 / 5) - 1) * 100
      : 0;
    const baseEbitda = baseYearData.adjustedEbitda;
    const ebitdaCAGR = baseEbitda > 0
      ? (Math.pow(y5.ebitda / baseEbitda, 1 / 5) - 1) * 100
      : 0;
    const y5Margin = y5.revenue > 0 ? (y5.ebitda / y5.revenue) * 100 : 0;
    const marginExpansion = y5Margin -
      (baseRev > 0 ? (baseEbitda / baseRev) * 100 : 0);

    return { revenueCAGR, ebitdaCAGR, marginExpansion, y5 };
  }, [projections, baseYearData]);

  type RowDef = {
    label: string;
    baseValue: number | null;
    getValue: (p: ProjectedYear) => number | null;
    negative?: boolean;
    bold?: boolean;
    highlight?: boolean;
    margin?: boolean;
    separator?: boolean;
    indent?: boolean;
    synergy?: boolean;
  };

  const allRows: RowDef[] = [
    { label: 'Revenue', baseValue: baseYearData.revenue, getValue: p => p.revenue, bold: true },
    { label: 'Cost of Sales', baseValue: baseYearData.costOfSales, getValue: p => p.costOfSales, negative: true },
    { label: 'Gross Profit', baseValue: baseYearData.grossProfit, getValue: p => p.grossProfit, bold: true },
    { label: 'GP Margin', baseValue: baseYearData.revenue > 0 ? (baseYearData.grossProfit / baseYearData.revenue) * 100 : null, getValue: p => p.revenue > 0 ? (p.grossProfit / p.revenue) * 100 : 0, margin: true },
    { label: '', baseValue: null, getValue: () => null, separator: true },
    { label: 'Administrative Expenses', baseValue: baseYearData.administrativeExpenses, getValue: p => p.adminExpenses, negative: true },
    { label: 'Staff Costs', baseValue: baseYearData.staffCosts, getValue: p => p.staffCosts, negative: true },
    { label: 'Depreciation & Amortisation', baseValue: baseYearData.depreciationAmortisation, getValue: p => p.depreciationAmortisation, negative: true },
    { label: '', baseValue: null, getValue: () => null, separator: true },
    { label: 'EBITDA (pre-synergies)', baseValue: baseYearData.adjustedEbitda, getValue: p => p.ebitdaBeforeSynergies, bold: true },
    ...(hasSynergies ? [
      { label: 'Revenue Synergies', baseValue: 0 as number, getValue: (p: ProjectedYear) => p.synergiesRevenue, indent: true, synergy: true },
      { label: 'Cost Synergies', baseValue: 0 as number, getValue: (p: ProjectedYear) => p.synergiesCost, indent: true, synergy: true },
      { label: 'Total Synergies', baseValue: 0 as number, getValue: (p: ProjectedYear) => p.synergiesNet, bold: true, synergy: true },
    ] : []),
    { label: 'EBITDA', baseValue: baseYearData.adjustedEbitda, getValue: p => p.ebitda, bold: true, highlight: true },
    { label: 'EBITDA Margin', baseValue: baseYearData.revenue > 0 ? (baseYearData.adjustedEbitda / baseYearData.revenue) * 100 : null, getValue: p => p.revenue > 0 ? (p.ebitda / p.revenue) * 100 : 0, margin: true },
  ];

  const extendedRows: RowDef[] = [
    { label: '', baseValue: null, getValue: () => null, separator: true },
    { label: 'Operating Profit', baseValue: baseYearData.operatingProfit, getValue: p => p.operatingProfit, bold: true },
    { label: 'Interest Expense', baseValue: baseYearData.interestPayable, getValue: p => p.interestPayable, negative: true },
    { label: 'Profit Before Tax', baseValue: null, getValue: p => p.profitBeforeTax, bold: true },
    { label: 'Tax', baseValue: baseYearData.corporationTax, getValue: p => p.corporationTax, negative: true },
    { label: 'Net Profit', baseValue: baseYearData.netProfit, getValue: p => p.netProfit, bold: true },
    { label: '', baseValue: null, getValue: () => null, separator: true },
    { label: 'Capex', baseValue: null, getValue: p => p.capex, negative: true },
    { label: 'Working Capital Change', baseValue: null, getValue: p => p.workingCapitalChange, negative: true },
    { label: 'Debt Service', baseValue: null, getValue: p => p.totalDebtService, negative: true },
    { label: 'DSCR', baseValue: null, getValue: p => p.dscr, margin: true },
    { label: '', baseValue: null, getValue: () => null, separator: true },
    { label: 'Free Cash Flow', baseValue: null, getValue: p => p.freeCashFlow, bold: true, highlight: true },
  ];

  const visibleRows = expanded ? [...allRows, ...extendedRows] : allRows;

  const renderCell = (value: number | null, negative?: boolean) => {
    if (value === null || value === undefined) return <span className="text-muted-foreground">&mdash;</span>;
    const display = negative ? -Math.abs(value) : value;
    return <span className={value < 0 ? 'text-red-600 dark:text-red-400' : ''}>{formatCurrency(display)}</span>;
  };

  const renderMargin = (value: number | null) => {
    if (value === null || value === undefined) return <span className="text-muted-foreground">&mdash;</span>;
    return <span className="text-muted-foreground italic text-xs">{formatPercent(value)}</span>;
  };

  const renderDscr = (value: number | null) => {
    if (value === null || value === undefined || !isFinite(value)) return <span className="text-muted-foreground">&mdash;</span>;
    if (value >= 100) return <span className="text-green-600 font-medium text-xs">&infin;</span>;
    const color = value >= 1.8 ? 'text-green-600' : value >= 1.4 ? 'text-blue-600' : value >= 1.0 ? 'text-amber-600' : 'text-red-600';
    return <span className={`${color} font-medium text-xs`}>{value.toFixed(2)}x</span>;
  };

  const growthBadge = (current: number, previous: number) => {
    if (previous === 0) return null;
    const pct = ((current - previous) / Math.abs(previous)) * 100;
    const color = pct >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400';
    return (
      <span className={`text-[10px] ${color} ml-1`}>
        {pct >= 0 ? '\u2191' : '\u2193'}{Math.abs(pct).toFixed(1)}%
      </span>
    );
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            P&L Projections
          </CardTitle>
          <div className="flex items-center gap-2">
            {metrics && (
              <div className="hidden sm:flex items-center gap-3 mr-2">
                <Badge variant="secondary" className="text-[10px] h-5 gap-1">
                  <TrendingUp className="h-3 w-3" />
                  Revenue CAGR: {metrics.revenueCAGR.toFixed(1)}%
                </Badge>
                <Badge
                  variant="secondary"
                  className={`text-[10px] h-5 gap-1 ${
                    metrics.marginExpansion >= 0
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                      : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                  }`}
                >
                  Margin: {metrics.marginExpansion >= 0 ? '+' : ''}{metrics.marginExpansion.toFixed(1)}pp
                </Badge>
              </div>
            )}
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
          <div className="space-y-4">
            <ChartContainer config={chartConfig} className="h-[300px] w-full">
              <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                <defs>
                  <linearGradient id="fillRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-revenue)" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="var(--color-revenue)" stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="fillEbitda" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-ebitda)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="var(--color-ebitda)" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  yAxisId="left"
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v: number) => {
                    if (Math.abs(v) >= 1000000) return `\u00A3${(v / 1000000).toFixed(1)}M`;
                    if (Math.abs(v) >= 1000) return `\u00A3${(v / 1000).toFixed(0)}K`;
                    return `\u00A3${v}`;
                  }}
                  width={70}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v: number) => `${v.toFixed(0)}%`}
                  width={45}
                  domain={[0, 'auto']}
                />
                <ChartTooltip content={<CurrencyTooltip />} />
                <ReferenceLine
                  x={baseYearLabel}
                  stroke="hsl(var(--muted-foreground))"
                  strokeDasharray="3 3"
                  strokeOpacity={0.5}
                  yAxisId="left"
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  name="Revenue"
                  stroke="var(--color-revenue)"
                  strokeWidth={2}
                  fill="url(#fillRevenue)"
                  yAxisId="left"
                />
                <Area
                  type="monotone"
                  dataKey="ebitda"
                  name="EBITDA"
                  stroke="var(--color-ebitda)"
                  strokeWidth={2}
                  fill="url(#fillEbitda)"
                  yAxisId="left"
                />
                {hasSynergies && (
                  <Line
                    type="monotone"
                    dataKey="ebitdaBeforeSynergies"
                    name="EBITDA (pre-synergies)"
                    stroke="var(--color-ebitda)"
                    strokeWidth={1}
                    strokeDasharray="4 4"
                    dot={false}
                    yAxisId="left"
                  />
                )}
                <Line
                  type="monotone"
                  dataKey="margin"
                  name="EBITDA Margin %"
                  stroke="var(--color-margin)"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  yAxisId="right"
                />
              </ComposedChart>
            </ChartContainer>

            {hasSynergies && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">EBITDA Build-Up (incl. synergies)</p>
                <ChartContainer config={chartConfig} className="h-[180px] w-full">
                  <BarChart
                    data={chartData.filter(d => !d.isBase)}
                    margin={{ top: 10, right: 10, left: 10, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                    <YAxis
                      tick={{ fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v: number) => {
                        if (Math.abs(v) >= 1000000) return `\u00A3${(v / 1000000).toFixed(1)}M`;
                        if (Math.abs(v) >= 1000) return `\u00A3${(v / 1000).toFixed(0)}K`;
                        return `\u00A3${v}`;
                      }}
                      width={70}
                    />
                    <ChartTooltip content={<CurrencyTooltip />} />
                    <Bar dataKey="ebitdaBeforeSynergies" name="EBITDA (pre-synergies)" stackId="a" fill="var(--color-ebitdaBeforeSynergies)" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="synergies" name="Synergies" stackId="a" fill="var(--color-synergies)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ChartContainer>
              </div>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[200px] min-w-[160px] sticky left-0 bg-background z-10"></TableHead>
                  <TableHead className="text-right px-3 bg-muted/30 font-semibold min-w-[100px]">
                    {baseYearLabel}
                  </TableHead>
                  {projections.map(p => (
                    <TableHead key={p.year} className="text-right px-3 min-w-[100px]">
                      Year {p.year}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleRows.map((row, idx) => {
                  if (row.separator) {
                    return (
                      <TableRow key={`sep-${idx}`}>
                        <TableCell colSpan={projections.length + 2} className="h-1 p-0">
                          <div className="border-t border-dashed border-muted-foreground/20" />
                        </TableCell>
                      </TableRow>
                    );
                  }

                  const rowCls = row.highlight
                    ? 'bg-primary/5 font-semibold'
                    : row.synergy
                    ? 'bg-purple-50/40 dark:bg-purple-950/10'
                    : '';

                  return (
                    <TableRow key={`${row.label}-${idx}`} className={rowCls}>
                      <TableCell
                        className={`text-xs sticky left-0 bg-background z-10 ${
                          row.bold ? 'font-semibold' : ''
                        } ${row.margin ? 'text-muted-foreground italic text-[11px]' : ''} ${
                          row.indent ? 'pl-6' : ''
                        } ${row.synergy && !row.bold ? 'text-purple-700 dark:text-purple-300' : ''}`}
                      >
                        {row.label}
                      </TableCell>

                      <TableCell className="text-right tabular-nums px-3 bg-muted/30 text-xs">
                        {row.margin
                          ? renderMargin(row.baseValue)
                          : row.label === 'DSCR'
                          ? <span className="text-muted-foreground">&mdash;</span>
                          : row.baseValue !== null
                          ? renderCell(row.baseValue, row.negative)
                          : <span className="text-muted-foreground">&mdash;</span>}
                      </TableCell>

                      {projections.map((p, pIdx) => {
                        const val = row.getValue(p);
                        const prevVal = pIdx === 0
                          ? row.baseValue
                          : row.getValue(projections[pIdx - 1]);

                        return (
                          <TableCell
                            key={p.year}
                            className="text-right tabular-nums px-3 text-xs"
                          >
                            {row.margin
                              ? renderMargin(val)
                              : row.label === 'DSCR'
                              ? renderDscr(val)
                              : (
                                <span className="inline-flex items-center">
                                  {renderCell(val, row.negative)}
                                  {row.bold && !row.margin && !row.synergy && !row.indent && val !== null && prevVal !== null && prevVal !== 0
                                    && ['Revenue', 'Gross Profit', 'EBITDA', 'Net Profit', 'Free Cash Flow'].includes(row.label) && (
                                    growthBadge(val!, prevVal!)
                                  )}
                                </span>
                              )}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>

            <div className="flex justify-center mt-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setExpanded(!expanded)}
                className="text-xs text-muted-foreground gap-1"
              >
                {expanded ? (
                  <><ChevronUp className="h-3 w-3" /> Show less</>
                ) : (
                  <><ChevronDown className="h-3 w-3" /> Show operating profit, tax, FCF</>
                )}
              </Button>
            </div>
          </div>
        )}

        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Info className="h-3 w-3 shrink-0" />
          {baseYearLabel} is the base year. Projections use {scenarioType} case assumptions.
          {hasSynergies && ` ${synergies.length} synergy lever${synergies.length !== 1 ? 's' : ''} applied.`}
        </div>
      </CardContent>
    </Card>
  );
}
