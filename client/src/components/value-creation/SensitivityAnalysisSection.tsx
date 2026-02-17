import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
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
  ReferenceLine,
} from 'recharts';
import { formatCurrency } from '@/lib/format-utils';
import type { SensitivityResult } from '@shared/calculators/value-creation.calc';
import {
  BarChart3,
  Grid3x3,
  ShieldAlert,
  Info,
  TrendingDown,
  AlertTriangle,
  Percent,
} from 'lucide-react';

interface ExitAssumptions {
  exitMultiple: number;
  holdPeriodYears: number;
  exitCostPercent: number;
}

interface YearAssumption {
  year: number;
  revenueGrowthPercent: number;
  [key: string]: any;
}

interface SensitivityAnalysisSectionProps {
  data: SensitivityResult;
  baseAssumptions: YearAssumption[];
  exitAssumptions: ExitAssumptions;
}

const chartConfig: ChartConfig = {
  lowSpread: { label: 'Downside', color: 'hsl(0, 72%, 60%)' },
  highSpread: { label: 'Upside', color: 'hsl(142, 71%, 50%)' },
};

function severityColor(value: number, thresholds: [number, number, number] = [15, 10, 5]) {
  if (value >= thresholds[0]) return { text: 'text-green-600', border: 'border-l-green-500', bg: 'bg-green-100 dark:bg-green-900/30' };
  if (value >= thresholds[1]) return { text: 'text-blue-600', border: 'border-l-blue-500', bg: 'bg-blue-100 dark:bg-blue-900/30' };
  if (value >= thresholds[2]) return { text: 'text-amber-600', border: 'border-l-amber-500', bg: 'bg-amber-100 dark:bg-amber-900/30' };
  return { text: 'text-red-600', border: 'border-l-red-500', bg: 'bg-red-100 dark:bg-red-900/30' };
}

export default function SensitivityAnalysisSection({ data, baseAssumptions, exitAssumptions }: SensitivityAnalysisSectionProps) {
  const [activeTab, setActiveTab] = useState<string>('tornado');

  const tornadoChartData = useMemo(() => {
    return data.tornadoData.map(t => ({
      variable: t.variable,
      lowSpread: t.lowOutput - t.baseValue,
      highSpread: t.highOutput - t.baseValue,
      lowOutput: t.lowOutput,
      highOutput: t.highOutput,
      baseValue: t.baseValue,
      lowInput: t.lowValue,
      highInput: t.highValue,
    }));
  }, [data.tornadoData]);

  const heatmapRange = useMemo(() => {
    const allVals = data.heatmapData.cells.flat();
    return { min: Math.min(...allVals), max: Math.max(...allVals) };
  }, [data.heatmapData]);

  function getCellColor(value: number): string {
    const { min, max } = heatmapRange;
    if (max === min) return 'hsl(210, 20%, 95%)';
    const ratio = (value - min) / (max - min);
    if (ratio <= 0.5) {
      const t = ratio / 0.5;
      const h = 0 + t * 45;
      return `hsl(${h}, 75%, ${85 - t * 10}%)`;
    } else {
      const t = (ratio - 0.5) / 0.5;
      const h = 45 + t * 97;
      return `hsl(${h}, 75%, ${75 - t * 10}%)`;
    }
  }

  const overallRisk = useMemo(() => {
    const worstRevDecline = Math.min(data.breakEvenRevDeclineDSCR, data.breakEvenRevDeclineFCF);
    const rateHeadroom = data.breakEvenInterestRateIncrease;

    if (worstRevDecline >= 15 && rateHeadroom >= 5) {
      return {
        color: 'text-green-600',
        label: 'Strong Downside Protection',
        description: 'The deal structure provides substantial margin of safety across revenue decline and interest rate scenarios.',
      };
    } else if (worstRevDecline >= 10 && rateHeadroom >= 3) {
      return {
        color: 'text-blue-600',
        label: 'Adequate Downside Protection',
        description: 'Reasonable headroom exists but a significant downturn could pressure debt covenants.',
      };
    } else if (worstRevDecline >= 5 && rateHeadroom >= 1.5) {
      return {
        color: 'text-amber-600',
        label: 'Limited Downside Protection',
        description: 'Thin margins of safety. A moderate revenue decline or rate increase could breach covenants.',
      };
    } else {
      return {
        color: 'text-red-600',
        label: 'Weak Downside Protection',
        description: 'Very limited headroom. Even a small revenue decline or rate increase could cause distress. Consider reducing leverage.',
      };
    }
  }, [data]);

  const formatAxis = (v: number) => {
    if (Math.abs(v) >= 1000000) return `\u00A3${(v / 1000000).toFixed(1)}M`;
    if (Math.abs(v) >= 1000) return `\u00A3${(v / 1000).toFixed(0)}K`;
    return `\u00A3${v}`;
  };

  const dscr = severityColor(data.breakEvenRevDeclineDSCR);
  const fcf = severityColor(data.breakEvenRevDeclineFCF);
  const rate = severityColor(data.breakEvenInterestRateIncrease, [5, 3, 1.5]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            Sensitivity Analysis
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="h-9">
            <TabsTrigger value="tornado" className="text-xs px-3 gap-1.5">
              <BarChart3 className="h-3.5 w-3.5" />
              Tornado
            </TabsTrigger>
            <TabsTrigger value="heatmap" className="text-xs px-3 gap-1.5">
              <Grid3x3 className="h-3.5 w-3.5" />
              Heatmap
            </TabsTrigger>
            <TabsTrigger value="breakeven" className="text-xs px-3 gap-1.5">
              <ShieldAlert className="h-3.5 w-3.5" />
              Break-Even
            </TabsTrigger>
          </TabsList>

          <TabsContent value="tornado" className="mt-4">
            <ChartContainer config={chartConfig} className="h-[280px] w-full">
              <BarChart
                layout="vertical"
                data={tornadoChartData}
                margin={{ top: 10, right: 40, left: 20, bottom: 5 }}
                stackOffset="sign"
              >
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={false} />
                <XAxis
                  type="number"
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={formatAxis}
                />
                <YAxis
                  type="category"
                  dataKey="variable"
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                  width={120}
                />
                <ReferenceLine x={0} stroke="hsl(var(--muted-foreground))" strokeWidth={1} />
                <ChartTooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const d = payload[0]?.payload;
                    if (!d) return null;
                    return (
                      <div className="rounded-lg border bg-background px-3 py-2 shadow-xl text-xs">
                        <p className="font-medium mb-1">{d.variable}</p>
                        <div className="space-y-0.5">
                          <p>
                            <span className="text-red-600">Low ({d.lowInput.toFixed(1)}):</span>{' '}
                            <span className="font-mono">{formatCurrency(d.lowOutput)}</span>
                          </p>
                          <p>
                            <span className="text-muted-foreground">Base:</span>{' '}
                            <span className="font-mono">{formatCurrency(d.baseValue)}</span>
                          </p>
                          <p>
                            <span className="text-green-600">High ({d.highInput.toFixed(1)}):</span>{' '}
                            <span className="font-mono">{formatCurrency(d.highOutput)}</span>
                          </p>
                        </div>
                      </div>
                    );
                  }}
                />
                <Bar dataKey="lowSpread" stackId="tornado" fill="hsl(0, 72%, 60%)" radius={[4, 0, 0, 4]} barSize={24} />
                <Bar dataKey="highSpread" stackId="tornado" fill="hsl(142, 71%, 50%)" radius={[0, 4, 4, 0]} barSize={24} />
              </BarChart>
            </ChartContainer>
            <div className="flex items-center justify-center gap-6 mt-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm bg-red-500" />
                Downside (vs base)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm bg-green-500" />
                Upside (vs base)
              </span>
            </div>
          </TabsContent>

          <TabsContent value="heatmap" className="mt-4">
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr>
                    <th className="p-2 text-left font-medium text-muted-foreground border-b">
                      {data.heatmapData.rowVariable} ↓ / {data.heatmapData.colVariable} →
                    </th>
                    {data.heatmapData.colValues.map((col, ci) => (
                      <th
                        key={ci}
                        className={`p-2 text-center font-medium border-b min-w-[80px] ${
                          ci === data.heatmapData.baseColIndex
                            ? 'bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300'
                            : 'text-muted-foreground'
                        }`}
                      >
                        {col.toFixed(1)}x
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.heatmapData.rowValues.map((row, ri) => (
                    <tr key={ri}>
                      <td
                        className={`p-2 font-medium border-b ${
                          ri === data.heatmapData.baseRowIndex
                            ? 'bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300'
                            : 'text-muted-foreground'
                        }`}
                      >
                        {row.toFixed(1)}%
                      </td>
                      {data.heatmapData.colValues.map((_, ci) => {
                        const cellValue = data.heatmapData.cells[ri]?.[ci] ?? 0;
                        const isBase = ri === data.heatmapData.baseRowIndex && ci === data.heatmapData.baseColIndex;
                        return (
                          <td
                            key={ci}
                            className={`p-2 text-center font-mono border-b transition-colors ${
                              isBase ? 'ring-2 ring-blue-500 ring-inset font-bold' : ''
                            }`}
                            style={{ backgroundColor: getCellColor(cellValue) }}
                          >
                            <TooltipProvider delayDuration={100}>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="cursor-default text-gray-800 dark:text-gray-900">
                                    {Math.abs(cellValue) >= 1000000
                                      ? `\u00A3${(cellValue / 1000000).toFixed(1)}M`
                                      : `\u00A3${(cellValue / 1000).toFixed(0)}K`}
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="text-xs">
                                    Rev Growth: {row.toFixed(1)}% / Exit Multiple: {data.heatmapData.colValues[ci].toFixed(1)}x
                                  </p>
                                  <p className="text-xs font-mono font-bold">{formatCurrency(cellValue)}</p>
                                  {isBase && <p className="text-[10px] text-blue-600">Current base case</p>}
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center gap-4 mt-3">
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <span className="h-3 w-6 rounded-sm" style={{ backgroundColor: getCellColor(heatmapRange.min) }} />
                {formatCurrency(heatmapRange.min)}
              </div>
              <div className="flex-1 h-2 rounded-full bg-gradient-to-r from-red-400 via-yellow-400 to-green-500" />
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <span className="h-3 w-6 rounded-sm" style={{ backgroundColor: getCellColor(heatmapRange.max) }} />
                {formatCurrency(heatmapRange.max)}
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              Cell with <span className="text-blue-600 font-medium">blue border</span> = current base case assumptions.
              Values show total return (exit equity + cumulative distributions).
            </p>
          </TabsContent>

          <TabsContent value="breakeven" className="mt-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className={`rounded-lg border border-l-4 ${dscr.border} p-5`}>
                <TrendingDown className={`h-6 w-6 ${dscr.text} mb-2`} />
                <p className="text-xs text-muted-foreground">Revenue Decline to Breach DSCR</p>
                <p className={`text-xl font-bold ${dscr.text}`}>
                  {data.breakEvenRevDeclineDSCR.toFixed(1)}%
                </p>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Revenue can fall {data.breakEvenRevDeclineDSCR.toFixed(1)}% before annual debt service coverage drops below 1.0x
                </p>
              </div>
              <div className={`rounded-lg border border-l-4 ${fcf.border} p-5`}>
                <AlertTriangle className={`h-6 w-6 ${fcf.text} mb-2`} />
                <p className="text-xs text-muted-foreground">Revenue Decline to Negative FCF</p>
                <p className={`text-xl font-bold ${fcf.text}`}>
                  {data.breakEvenRevDeclineFCF.toFixed(1)}%
                </p>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Revenue can fall {data.breakEvenRevDeclineFCF.toFixed(1)}% before free cash flow turns negative in any year
                </p>
              </div>
              <div className={`rounded-lg border border-l-4 ${rate.border} p-5`}>
                <Percent className={`h-6 w-6 ${rate.text} mb-2`} />
                <p className="text-xs text-muted-foreground">Interest Rate Headroom</p>
                <p className={`text-xl font-bold ${rate.text}`}>
                  +{data.breakEvenInterestRateIncrease.toFixed(1)}%
                </p>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Interest rates can increase {data.breakEvenInterestRateIncrease.toFixed(1)} percentage points before DSCR drops below 1.0x
                </p>
              </div>
            </div>

            <div className="mt-4 rounded-lg border p-4 bg-muted/20">
              <div className="flex items-start gap-3">
                <ShieldAlert className={`h-5 w-5 mt-0.5 shrink-0 ${overallRisk.color}`} />
                <div>
                  <p className="text-sm font-semibold">{overallRisk.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{overallRisk.description}</p>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mt-4">
          <Info className="h-3 w-3 shrink-0" />
          Tornado chart varies each assumption ±independently. Heatmap shows total return across revenue growth and exit multiple combinations.
          Break-even thresholds use iterative search to find failure points.
        </div>
      </CardContent>
    </Card>
  );
}
