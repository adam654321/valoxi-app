import { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
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
  AreaChart,
  Area,
} from 'recharts';
import { formatCurrency } from '@/lib/format-utils';
import type { SynergyInput, ProjectedYear } from '@shared/calculators/value-creation.calc';
import {
  Zap,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Table as TableIcon,
  Info,
} from 'lucide-react';

interface SynergiesDetailSectionProps {
  synergies: SynergyInput[];
  projections: ProjectedYear[];
}

const chartConfig: ChartConfig = {
  revenueSynergies: { label: 'Revenue Synergies', color: 'hsl(199, 89%, 48%)' },
  costSynergies: { label: 'Cost Synergies', color: 'hsl(160, 84%, 39%)' },
  implementationCosts: { label: 'Implementation Costs', color: 'hsl(0, 72%, 51%)' },
  cumulative: { label: 'Cumulative Net', color: 'hsl(142, 71%, 45%)' },
};

export default function SynergiesDetailSection({ synergies, projections }: SynergiesDetailSectionProps) {
  const [view, setView] = useState<'chart' | 'table'>('chart');

  const synergyDetails = useMemo(() => {
    return synergies.map(syn => {
      const yearValues = syn.realisationByYear.map((pct, i) => ({
        year: i + 1,
        realised: syn.targetValue * pct,
        realisationPercent: pct * 100,
        implementationCost: i === 0 ? syn.implementationCost : 0,
        net: syn.targetValue * pct - (i === 0 ? syn.implementationCost : 0),
      }));
      const totalRealised = yearValues.reduce((sum, y) => sum + y.realised, 0);
      const totalNet = yearValues.reduce((sum, y) => sum + y.net, 0);
      return {
        ...syn,
        yearValues,
        totalRealised,
        totalNet,
      };
    });
  }, [synergies]);

  const chartData = useMemo(() => {
    return projections.map((p) => ({
      name: `Y${p.year}`,
      revenueSynergies: p.synergiesRevenue,
      costSynergies: p.synergiesCost,
      implementationCosts: -p.synergiesImplementationCost,
      netSynergies: p.synergiesNet,
    }));
  }, [projections]);

  const cumulativeData = useMemo(() => {
    let cumulative = 0;
    return chartData.map(d => {
      cumulative += d.netSynergies;
      return { name: d.name, cumulative };
    });
  }, [chartData]);

  const summary = useMemo(() => {
    const totalRevSynergies = projections.reduce((s, p) => s + p.synergiesRevenue, 0);
    const totalCostSynergies = projections.reduce((s, p) => s + p.synergiesCost, 0);
    const totalImplCosts = projections.reduce((s, p) => s + p.synergiesImplementationCost, 0);
    const totalNet = projections.reduce((s, p) => s + p.synergiesNet, 0);
    const y5Net = projections.length > 0 ? projections[projections.length - 1].synergiesNet : 0;
    const revenueSynergies = synergies.filter(s => s.synergyType === 'revenue');
    const costSynergies = synergies.filter(s => s.synergyType === 'cost');
    return { totalRevSynergies, totalCostSynergies, totalImplCosts, totalNet, y5Net, revenueSynergies, costSynergies };
  }, [projections, synergies]);

  const aggregateRows = useMemo(() => {
    const yearRevenue = projections.map(p => p.synergiesRevenue);
    const yearCost = projections.map(p => p.synergiesCost);
    const yearGross = projections.map((p) => p.synergiesRevenue + p.synergiesCost);
    const yearImpl = projections.map(p => -p.synergiesImplementationCost);
    const yearNet = projections.map(p => p.synergiesNet);
    return { yearRevenue, yearCost, yearGross, yearImpl, yearNet };
  }, [projections]);

  return (
    <Card>
      <div className="px-4 py-3 border-b flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-7 h-7 rounded-full bg-blue-600 text-white text-sm font-bold">2</div>
          <h3 className="text-base font-semibold">Synergies Detail</h3>
          {summary.revenueSynergies.length > 0 && (
            <Badge variant="secondary" className="text-[10px]">
              {summary.revenueSynergies.length} Revenue
            </Badge>
          )}
          {summary.costSynergies.length > 0 && (
            <Badge variant="secondary" className="text-[10px]">
              {summary.costSynergies.length} Cost
            </Badge>
          )}
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
          <div className="rounded-lg border border-l-4 border-l-green-500 p-3">
            <p className="text-xs text-muted-foreground">5-Year Net Synergies</p>
            <p className="text-lg font-bold">{formatCurrency(summary.totalNet)}</p>
          </div>
          <div className="rounded-lg border border-l-4 border-l-blue-500 p-3">
            <p className="text-xs text-muted-foreground">Revenue Synergies</p>
            <p className="text-lg font-bold">{formatCurrency(summary.totalRevSynergies)}</p>
          </div>
          <div className="rounded-lg border border-l-4 border-l-emerald-500 p-3">
            <p className="text-xs text-muted-foreground">Cost Synergies</p>
            <p className="text-lg font-bold">{formatCurrency(summary.totalCostSynergies)}</p>
          </div>
          <div className="rounded-lg border border-l-4 border-l-red-500 p-3">
            <p className="text-xs text-muted-foreground">Implementation Costs</p>
            <p className="text-lg font-bold text-red-600 dark:text-red-400">
              ({formatCurrency(summary.totalImplCosts)})
            </p>
          </div>
        </div>

        {view === 'chart' ? (
          <div className="space-y-4">
            <ChartContainer config={chartConfig} className="h-[260px] w-full">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                <YAxis
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
                <ChartTooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    return (
                      <div className="rounded-lg border bg-background px-3 py-2 shadow-xl">
                        <p className="text-sm font-medium mb-1">{label}</p>
                        {payload.map((entry: any, i: number) => (
                          <div key={i} className="flex items-center justify-between gap-4 text-xs">
                            <span className="flex items-center gap-1.5">
                              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
                              {entry.name}
                            </span>
                            <span className="font-mono">{formatCurrency(entry.value)}</span>
                          </div>
                        ))}
                      </div>
                    );
                  }}
                />
                <Bar dataKey="revenueSynergies" name="Revenue Synergies" stackId="syn" fill="hsl(199, 89%, 48%)" radius={[0, 0, 0, 0]} />
                <Bar dataKey="costSynergies" name="Cost Synergies" stackId="syn" fill="hsl(160, 84%, 39%)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="implementationCosts" name="Implementation Costs" fill="hsl(0, 72%, 51%)" radius={[0, 0, 4, 4]} />
              </BarChart>
            </ChartContainer>

            <div>
              <p className="text-xs text-muted-foreground mb-1">Cumulative Net Synergies</p>
              <ChartContainer config={chartConfig} className="h-[100px] w-full">
                <AreaChart data={cumulativeData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis
                    tick={{ fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v: number) => {
                      if (Math.abs(v) >= 1000000) return `£${(v / 1000000).toFixed(1)}M`;
                      if (Math.abs(v) >= 1000) return `£${(v / 1000).toFixed(0)}K`;
                      return `£${v}`;
                    }}
                    width={70}
                  />
                  <ChartTooltip
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null;
                      return (
                        <div className="rounded-lg border bg-background px-3 py-2 shadow-xl">
                          <p className="text-sm font-medium mb-1">{label}</p>
                          <p className="text-xs font-mono">{formatCurrency(payload[0].value as number)}</p>
                        </div>
                      );
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="cumulative"
                    stroke="hsl(142, 71%, 45%)"
                    fill="hsl(142, 71%, 45%)"
                    fillOpacity={0.2}
                  />
                </AreaChart>
              </ChartContainer>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="sticky left-0 bg-background z-10 min-w-[160px]"></TableHead>
                    {projections.map(p => (
                      <TableHead key={p.year} className="text-right min-w-[100px]">Y{p.year}</TableHead>
                    ))}
                    <TableHead className="text-right min-w-[110px] font-semibold">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="sticky left-0 bg-background z-10 text-sm">Revenue Synergies</TableCell>
                    {aggregateRows.yearRevenue.map((v, i) => (
                      <TableCell key={i} className="text-right text-sm font-mono">{formatCurrency(v)}</TableCell>
                    ))}
                    <TableCell className="text-right text-sm font-mono font-semibold">{formatCurrency(summary.totalRevSynergies)}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="sticky left-0 bg-background z-10 text-sm">Cost Synergies</TableCell>
                    {aggregateRows.yearCost.map((v, i) => (
                      <TableCell key={i} className="text-right text-sm font-mono">{formatCurrency(v)}</TableCell>
                    ))}
                    <TableCell className="text-right text-sm font-mono font-semibold">{formatCurrency(summary.totalCostSynergies)}</TableCell>
                  </TableRow>
                  <TableRow className="font-semibold">
                    <TableCell className="sticky left-0 bg-background z-10 text-sm font-semibold">Gross Synergies</TableCell>
                    {aggregateRows.yearGross.map((v, i) => (
                      <TableCell key={i} className="text-right text-sm font-mono">{formatCurrency(v)}</TableCell>
                    ))}
                    <TableCell className="text-right text-sm font-mono font-semibold">{formatCurrency(summary.totalRevSynergies + summary.totalCostSynergies)}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="sticky left-0 bg-background z-10 text-sm text-red-600 dark:text-red-400">Implementation Costs</TableCell>
                    {aggregateRows.yearImpl.map((v, i) => (
                      <TableCell key={i} className="text-right text-sm font-mono text-red-600 dark:text-red-400">
                        {v !== 0 ? `(${formatCurrency(Math.abs(v))})` : '—'}
                      </TableCell>
                    ))}
                    <TableCell className="text-right text-sm font-mono font-semibold text-red-600 dark:text-red-400">
                      ({formatCurrency(summary.totalImplCosts)})
                    </TableCell>
                  </TableRow>
                  <TableRow className="bg-primary/5 font-semibold">
                    <TableCell className="sticky left-0 bg-primary/5 z-10 text-sm font-semibold">Net Synergies</TableCell>
                    {aggregateRows.yearNet.map((v, i) => (
                      <TableCell key={i} className="text-right text-sm font-mono font-semibold">{formatCurrency(v)}</TableCell>
                    ))}
                    <TableCell className="text-right text-sm font-mono font-semibold">{formatCurrency(summary.totalNet)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>

            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-muted-foreground">Individual Synergy Breakdown</h4>
              {synergyDetails.map((syn, idx) => (
                <div key={idx} className="rounded-lg border p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {syn.synergyType === 'revenue' ? (
                        <TrendingUp className="h-4 w-4 text-blue-500" />
                      ) : (
                        <TrendingDown className="h-4 w-4 text-emerald-500" />
                      )}
                      <span className="text-sm font-medium">{syn.name}</span>
                      <Badge variant="secondary" className="text-[10px]">
                        {syn.synergyType === 'revenue' ? 'Revenue' : 'Cost'}
                      </Badge>
                    </div>
                    <span className="text-sm font-mono font-semibold">
                      Target: {formatCurrency(syn.targetValue)}
                    </span>
                  </div>

                  <div className="grid grid-cols-5 gap-2">
                    {syn.yearValues.map(yv => (
                      <div key={yv.year} className="space-y-1">
                        <div className="flex justify-between text-[10px] text-muted-foreground">
                          <span>Y{yv.year}</span>
                          <span>{yv.realisationPercent.toFixed(0)}%</span>
                        </div>
                        <Progress
                          value={yv.realisationPercent}
                          className="h-1.5"
                        />
                        <p className="text-[10px] font-mono text-center">{formatCurrency(yv.realised)}</p>
                      </div>
                    ))}
                  </div>

                  {syn.implementationCost > 0 && (
                    <p className="text-[10px] text-red-600 dark:text-red-400">
                      Implementation cost: {formatCurrency(syn.implementationCost)} (Y1)
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mt-4">
          <Info className="h-3 w-3 shrink-0" />
          Revenue synergies add to top-line; cost synergies reduce overheads. Implementation costs are deducted in Year 1.
          Realisation percentages control how quickly each synergy reaches its target value.
        </div>
      </CardContent>
    </Card>
  );
}
