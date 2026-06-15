import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TrendingUp } from 'lucide-react';
import { formatCurrency } from '@/lib/format-utils';

interface WorkingCapitalSectionProps {
  operationalExpert?: any;
}

export default function WorkingCapitalSection({ operationalExpert }: WorkingCapitalSectionProps) {
  const wc = operationalExpert?.working_capital;
  const yearlyMetrics: Record<string, any> | null = wc?.yearly_metrics ?? null;

  if (!yearlyMetrics || Object.keys(yearlyMetrics).length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
            Working Capital Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-8">
            No working capital data available — run the operational expert analysis to populate this section.
          </p>
        </CardContent>
      </Card>
    );
  }

  const years = Object.keys(yearlyMetrics).sort();
  const trend: string = wc?.trend ?? '';
  const intensity: string = wc?.working_capital_intensity ?? '';
  const observations: string[] = Array.isArray(wc?.observations) ? wc.observations : [];

  const trendVariant = (t: string) => {
    if (t === 'improving') return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
    if (t === 'deteriorating') return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
    return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400';
  };

  const intensityVariant = (i: string) => {
    if (i === 'light') return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
    if (i === 'heavy') return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
    return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400';
  };

  const allStockNull = years.every(y => {
    const v = yearlyMetrics[y]?.stock_days;
    return v == null || Number(v) === 0;
  });

  const debtorCellClass = (val: number | null) => {
    if (val == null) return '';
    if (val > 90) return 'bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400 font-medium';
    if (val > 60) return 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400 font-medium';
    return '';
  };

  const cccCellClass = (val: number | null) => {
    if (val == null) return '';
    if (val > 75) return 'bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400 font-medium';
    if (val > 45) return 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400 font-medium';
    return '';
  };

  const fmtDays = (v: any) => {
    if (v == null) return <span className="text-muted-foreground">—</span>;
    return <>{Math.round(Number(v))}</>;
  };

  const fmtPct = (v: any) => {
    if (v == null) return <span className="text-muted-foreground">—</span>;
    return <>{Number(v).toFixed(1)}%</>;
  };

  const fmtNwc = (v: any) => {
    if (v == null) return <span className="text-muted-foreground">—</span>;
    return <>{formatCurrency(Number(v))}</>;
  };

  const cellClass = 'text-right tabular-nums px-3 py-2';

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
            Working Capital Analysis
          </CardTitle>
          <div className="flex items-center gap-2">
            {trend && (
              <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${trendVariant(trend)}`}>
                {trend}
              </span>
            )}
            {intensity && (
              <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${intensityVariant(intensity)}`}>
                {intensity} intensity
              </span>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[240px] min-w-[200px]"></TableHead>
              {years.map(y => (
                <TableHead key={y} className="text-right px-3">FY {y}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell className="text-sm">Debtor Days</TableCell>
              {years.map(y => {
                const val = yearlyMetrics[y]?.debtor_days != null ? Number(yearlyMetrics[y].debtor_days) : null;
                return (
                  <TableCell key={y} className={`${cellClass} ${debtorCellClass(val)}`}>
                    {fmtDays(val)}
                  </TableCell>
                );
              })}
            </TableRow>
            <TableRow>
              <TableCell className="text-sm">Creditor Days</TableCell>
              {years.map(y => (
                <TableCell key={y} className={cellClass}>
                  {fmtDays(yearlyMetrics[y]?.creditor_days)}
                </TableCell>
              ))}
            </TableRow>
            {!allStockNull && (
              <TableRow>
                <TableCell className="text-sm">Stock Days</TableCell>
                {years.map(y => (
                  <TableCell key={y} className={cellClass}>
                    {fmtDays(yearlyMetrics[y]?.stock_days)}
                  </TableCell>
                ))}
              </TableRow>
            )}
            <TableRow>
              <TableCell className="text-sm">Cash Conversion Cycle</TableCell>
              {years.map(y => {
                const val = yearlyMetrics[y]?.cash_conversion_cycle_days != null
                  ? Number(yearlyMetrics[y].cash_conversion_cycle_days)
                  : null;
                return (
                  <TableCell key={y} className={`${cellClass} ${cccCellClass(val)}`}>
                    {fmtDays(val)}
                  </TableCell>
                );
              })}
            </TableRow>
            <TableRow>
              <TableCell className="text-sm">Net Working Capital</TableCell>
              {years.map(y => (
                <TableCell key={y} className={cellClass}>
                  {fmtNwc(yearlyMetrics[y]?.net_working_capital)}
                </TableCell>
              ))}
            </TableRow>
            <TableRow>
              <TableCell className="text-sm">Working Capital % Revenue</TableCell>
              {years.map(y => (
                <TableCell key={y} className={cellClass}>
                  {fmtPct(yearlyMetrics[y]?.working_capital_percent_revenue)}
                </TableCell>
              ))}
            </TableRow>
          </TableBody>
        </Table>

        {observations.length > 0 && (
          <div className="mt-4 rounded-md bg-muted/50 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
              Expert Observations
            </p>
            <ul className="space-y-1">
              {observations.map((obs, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground" />
                  {obs}
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
