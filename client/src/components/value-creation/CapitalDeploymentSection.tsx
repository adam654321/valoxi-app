import { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  ChartContainer,
  ChartTooltip,
  type ChartConfig,
} from '@/components/ui/chart';
import {
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Line,
  ComposedChart,
  ReferenceLine,
} from 'recharts';
import { formatCurrency } from '@/lib/format-utils';
import type { ProjectedYear, YearAssumptions } from '@shared/calculators/value-creation.calc';
import {
  BarChart3,
  Table as TableIcon,
  Info,
  ArrowDownToLine,
  RefreshCw,
} from 'lucide-react';

interface CapitalDeploymentSectionProps {
  projections: ProjectedYear[];
  assumptions: YearAssumptions[];
  baseYearRevenue: number;
}

const chartConfig: ChartConfig = {
  capex: { label: 'Capex', color: 'hsl(262, 83%, 58%)' },
  workingCapital: { label: 'Working Capital', color: 'hsl(45, 93%, 47%)' },
  fcf: { label: 'Free Cash Flow', color: 'hsl(160, 84%, 39%)' },
};

export default function CapitalDeploymentSection({ projections, assumptions, baseYearRevenue }: CapitalDeploymentSectionProps) {
  const [view, setView] = useState<'chart' | 'table'>('chart');

  const chartData = useMemo(() => {
    let prevRevenue = baseYearRevenue;
    return projections.map((p, i) => {
      const revenueChange = p.revenue - prevRevenue;
      prevRevenue = p.revenue;
      return {
        name: `Y${p.year}`,
        capex: -p.capex,
        workingCapital: -p.workingCapitalChange,
        totalDeployment: -(p.capex + p.workingCapitalChange),
        cashAfterDebtService: p.cashAfterDebtService,
        fcf: p.freeCashFlow,
        revenueChange,
        capexAsPercent: p.revenue > 0 ? (p.capex / p.revenue) * 100 : 0,
        wcAsPercent: assumptions[i]?.workingCapitalPercent ?? 0,
      };
    });
  }, [projections, assumptions, baseYearRevenue]);

  const summary = useMemo(() => {
    const totalCapex = projections.reduce((s, p) => s + p.capex, 0);
    const totalWC = projections.reduce((s, p) => s + p.workingCapitalChange, 0);
    const totalDeployment = totalCapex + totalWC;
    const totalFCF = projections.reduce((s, p) => s + p.freeCashFlow, 0);
    const avgCapexPercent = projections.length > 0
      ? projections.reduce((s, p) => s + (p.revenue > 0 ? p.capex / p.revenue * 100 : 0), 0) / projections.length
      : 0;
    const totalEbitda = projections.reduce((s, p) => s + p.ebitda, 0);
    const conversionRate = totalEbitda > 0 ? (totalFCF / totalEbitda) * 100 : 0;
    return { totalCapex, totalWC, totalDeployment, totalFCF, avgCapexPercent, conversionRate };
  }, [projections]);

  const tableData = useMemo(() => {
    let prevRevenue = baseYearRevenue;
    let cumulativeFCF = 0;
    return projections.map((p, i) => {
      const revenueChange = p.revenue - prevRevenue;
      prevRevenue = p.revenue;
      cumulativeFCF += p.freeCashFlow;
      return {
        year: p.year,
        capex: p.capex,
        capexPercent: p.revenue > 0 ? (p.capex / p.revenue) * 100 : 0,
        revenueChange,
        wcPercent: assumptions[i]?.workingCapitalPercent ?? 0,
        wcMovement: p.workingCapitalChange,
        cashAfterDebt: p.cashAfterDebtService,
        fcf: p.freeCashFlow,
        cumulativeFCF,
      };
    });
  }, [projections, assumptions, baseYearRevenue]);

  const conversionColor = summary.conversionRate >= 70 ? 'text-green-600 dark:text-green-400'
    : summary.conversionRate >= 50 ? 'text-blue-600 dark:text-blue-400'
    : summary.conversionRate >= 30 ? 'text-amber-600 dark:text-amber-400'
    : 'text-red-600 dark:text-red-400';

  return (
    <Card>
      <div className="px-4 py-3 border-b flex items-center justify-between">
        <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
          <h3 className="text-base font-semibold">Working Capital & Capex</h3>
          <div className="flex items-center gap-1.5 flex-wrap">
            <Badge variant="secondary" className="text-[10px]">
              5yr Capex: {formatCurrency(summary.totalCapex)}
            </Badge>
            <Badge variant="secondary" className="text-[10px]">
              5yr WC: {formatCurrency(summary.totalWC)}
            </Badge>
          </div>
        </div>
        <div className="flex items-center gap-1 border rounded-md p-0.5">
          <Button
            variant={view === 'chart' ? 'secondary' : 'ghost'}
            size="sm"
            className="h-7 w-7 p-0"
            onClick={() => setView('chart')}
          >
            <BarChart3 className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant={view === 'table' ? 'secondary' : 'ghost'}
            size="sm"
            className="h-7 w-7 p-0"
            onClick={() => setView('table')}
          >
            <TableIcon className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <CardContent className="pt-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          <div className="rounded-lg border border-l-4 border-l-teal-500 p-3">
            <p className="text-xs text-muted-foreground">Total Capital Deployed</p>
            <p className="text-lg font-bold">{formatCurrency(summary.totalDeployment)}</p>
          </div>
          <div className="rounded-lg border border-l-4 border-l-purple-500 p-3">
            <div className="flex items-center gap-1.5">
              <ArrowDownToLine className="h-3 w-3 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Total Capex</p>
            </div>
            <p className="text-lg font-bold">{formatCurrency(summary.totalCapex)}</p>
          </div>
          <div className="rounded-lg border border-l-4 border-l-blue-500 p-3">
            <div className="flex items-center gap-1.5">
              <RefreshCw className="h-3 w-3 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Total WC Movement</p>
            </div>
            <p className="text-lg font-bold">{formatCurrency(summary.totalWC)}</p>
          </div>
          <div className="rounded-lg border border-l-4 border-l-green-500 p-3">
            <p className="text-xs text-muted-foreground">Cash Conversion</p>
            <p className={`text-lg font-bold ${conversionColor}`}>{summary.conversionRate.toFixed(1)}%</p>
            <p className="text-[10px] text-muted-foreground">FCF / EBITDA</p>
          </div>
        </div>

        {view === 'chart' ? (
          <div>
            <ChartContainer config={chartConfig} className="h-[280px] w-full">
              <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                <YAxis
                  yAxisId="left"
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v: number) => {
                    if (Math.abs(v) >= 1000000) return `£${(v / 1000000).toFixed(1)}M`;
                    if (Math.abs(v) >= 1000) return `£${(v / 1000).toFixed(0)}K`;
                    return `£${v}`;
                  }}
                  width={70}
                />
                <ReferenceLine yAxisId="left" y={0} stroke="hsl(var(--muted-foreground))" strokeWidth={1} />
                <ChartTooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    const d = payload[0]?.payload;
                    return (
                      <div className="rounded-lg border bg-background px-3 py-2 shadow-xl">
                        <p className="text-sm font-medium mb-1">{label}</p>
                        <div className="space-y-0.5 text-xs">
                          <div className="flex justify-between gap-4">
                            <span>Capex</span>
                            <span className="font-mono text-red-600">{formatCurrency(d?.capex ?? 0)}</span>
                          </div>
                          <div className="flex justify-between gap-4">
                            <span>Working Capital</span>
                            <span className="font-mono text-amber-600">{formatCurrency(d?.workingCapital ?? 0)}</span>
                          </div>
                          <div className="flex justify-between gap-4 border-t pt-0.5 mt-0.5">
                            <span className="font-medium">Free Cash Flow</span>
                            <span className="font-mono font-semibold">{formatCurrency(d?.fcf ?? 0)}</span>
                          </div>
                        </div>
                      </div>
                    );
                  }}
                />
                <Bar yAxisId="left" dataKey="capex" name="Capex" fill="hsl(262, 83%, 58%)" stackId="deploy" radius={[0, 0, 0, 0]} barSize={32} />
                <Bar yAxisId="left" dataKey="workingCapital" name="Working Capital" fill="hsl(45, 93%, 47%)" stackId="deploy" radius={[4, 4, 0, 0]} barSize={32} />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="fcf"
                  name="Free Cash Flow"
                  stroke="hsl(160, 84%, 39%)"
                  strokeWidth={2.5}
                  dot={{ fill: 'hsl(160, 84%, 39%)', r: 4 }}
                />
              </ComposedChart>
            </ChartContainer>
            <div className="flex items-center justify-center gap-6 mt-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: 'hsl(262, 83%, 58%)' }} />
                Capex
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: 'hsl(45, 93%, 47%)' }} />
                Working Capital
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-6 rounded-sm" style={{ backgroundColor: 'hsl(160, 84%, 39%)' }} />
                FCF
              </span>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="sticky left-0 bg-background z-10 min-w-[180px]"></TableHead>
                  {projections.map(p => (
                    <TableHead key={p.year} className="text-right min-w-[100px]">Y{p.year}</TableHead>
                  ))}
                  <TableHead className="text-right min-w-[110px] font-semibold">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow className="bg-muted/30">
                  <TableCell colSpan={projections.length + 2} className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Capital Expenditure
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="sticky left-0 bg-background z-10 text-sm">Capex</TableCell>
                  {tableData.map((d, i) => (
                    <TableCell key={i} className="text-right text-sm font-mono text-red-600 dark:text-red-400">
                      {d.capex !== 0 ? `(${formatCurrency(Math.abs(d.capex))})` : '—'}
                    </TableCell>
                  ))}
                  <TableCell className="text-right text-sm font-mono font-semibold text-red-600 dark:text-red-400">
                    {summary.totalCapex !== 0 ? `(${formatCurrency(Math.abs(summary.totalCapex))})` : '—'}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="sticky left-0 bg-background z-10 text-sm text-muted-foreground">Capex % Revenue</TableCell>
                  {tableData.map((d, i) => (
                    <TableCell key={i} className="text-right text-sm font-mono text-muted-foreground">
                      {d.capexPercent.toFixed(1)}%
                    </TableCell>
                  ))}
                  <TableCell className="text-right text-sm font-mono font-semibold text-muted-foreground">
                    {summary.avgCapexPercent.toFixed(1)}%
                  </TableCell>
                </TableRow>

                <TableRow className="h-2"><TableCell colSpan={projections.length + 2} className="p-0" /></TableRow>

                <TableRow className="bg-muted/30">
                  <TableCell colSpan={projections.length + 2} className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Working Capital
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="sticky left-0 bg-background z-10 text-sm">Revenue Change</TableCell>
                  {tableData.map((d, i) => (
                    <TableCell key={i} className="text-right text-sm font-mono">{formatCurrency(d.revenueChange)}</TableCell>
                  ))}
                  <TableCell className="text-right text-sm font-mono font-semibold">
                    {formatCurrency(tableData.reduce((s, d) => s + d.revenueChange, 0))}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="sticky left-0 bg-background z-10 text-sm text-muted-foreground">WC % of Revenue Change</TableCell>
                  {tableData.map((d, i) => (
                    <TableCell key={i} className="text-right text-sm font-mono text-muted-foreground">{d.wcPercent.toFixed(0)}%</TableCell>
                  ))}
                  <TableCell className="text-right text-sm font-mono text-muted-foreground">—</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="sticky left-0 bg-background z-10 text-sm">Working Capital Movement</TableCell>
                  {tableData.map((d, i) => (
                    <TableCell key={i} className="text-right text-sm font-mono text-red-600 dark:text-red-400">
                      {d.wcMovement !== 0 ? `(${formatCurrency(Math.abs(d.wcMovement))})` : '—'}
                    </TableCell>
                  ))}
                  <TableCell className="text-right text-sm font-mono font-semibold text-red-600 dark:text-red-400">
                    {summary.totalWC !== 0 ? `(${formatCurrency(Math.abs(summary.totalWC))})` : '—'}
                  </TableCell>
                </TableRow>

                <TableRow className="h-2"><TableCell colSpan={projections.length + 2} className="p-0" /></TableRow>

                <TableRow className="bg-muted/30">
                  <TableCell colSpan={projections.length + 2} className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Cash Impact
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="sticky left-0 bg-background z-10 text-sm">Cash After Debt Service</TableCell>
                  {tableData.map((d, i) => (
                    <TableCell key={i} className="text-right text-sm font-mono">{formatCurrency(d.cashAfterDebt)}</TableCell>
                  ))}
                  <TableCell className="text-right text-sm font-mono font-semibold">
                    {formatCurrency(tableData.reduce((s, d) => s + d.cashAfterDebt, 0))}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="sticky left-0 bg-background z-10 text-sm">Less: Capex</TableCell>
                  {tableData.map((d, i) => (
                    <TableCell key={i} className="text-right text-sm font-mono text-red-600 dark:text-red-400">
                      {d.capex !== 0 ? `(${formatCurrency(Math.abs(d.capex))})` : '—'}
                    </TableCell>
                  ))}
                  <TableCell className="text-right text-sm font-mono font-semibold text-red-600 dark:text-red-400">
                    {summary.totalCapex !== 0 ? `(${formatCurrency(Math.abs(summary.totalCapex))})` : '—'}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="sticky left-0 bg-background z-10 text-sm">Less: WC Change</TableCell>
                  {tableData.map((d, i) => (
                    <TableCell key={i} className="text-right text-sm font-mono text-red-600 dark:text-red-400">
                      {d.wcMovement !== 0 ? `(${formatCurrency(Math.abs(d.wcMovement))})` : '—'}
                    </TableCell>
                  ))}
                  <TableCell className="text-right text-sm font-mono font-semibold text-red-600 dark:text-red-400">
                    {summary.totalWC !== 0 ? `(${formatCurrency(Math.abs(summary.totalWC))})` : '—'}
                  </TableCell>
                </TableRow>
                <TableRow className="bg-primary/5 font-semibold">
                  <TableCell className="sticky left-0 bg-primary/5 z-10 text-sm font-semibold">Free Cash Flow</TableCell>
                  {tableData.map((d, i) => (
                    <TableCell key={i} className="text-right text-sm font-mono font-semibold">{formatCurrency(d.fcf)}</TableCell>
                  ))}
                  <TableCell className="text-right text-sm font-mono font-semibold">{formatCurrency(summary.totalFCF)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="sticky left-0 bg-background z-10 text-sm italic text-muted-foreground">Cumulative FCF</TableCell>
                  {tableData.map((d, i) => (
                    <TableCell key={i} className="text-right text-sm font-mono italic text-muted-foreground">{formatCurrency(d.cumulativeFCF)}</TableCell>
                  ))}
                  <TableCell className="text-right text-sm font-mono text-muted-foreground">—</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        )}

        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mt-4">
          <Info className="h-3 w-3 shrink-0" />
          Capex represents annual capital expenditure. Working capital change is calculated as a percentage of
          year-on-year revenue growth — higher growth requires more working capital. Cash conversion = FCF / EBITDA.
        </div>
      </CardContent>
    </Card>
  );
}
