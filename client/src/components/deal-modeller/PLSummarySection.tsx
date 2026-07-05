import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { TrendingUp, Info } from 'lucide-react';
import { toNum } from '@shared/calculators/deal-model.calc';
import type { CalculationResult } from '@shared/calculators/deal-model.calc';
import type { DealModelAdjustment } from '@shared/schema';
import { formatCurrency, formatPercent } from '@/lib/format-utils';
import { detectYtdPeriods, formatYtdLabel } from '@/lib/period-utils';

interface PLSummarySectionProps {
  financialData: any;
  adjustments: DealModelAdjustment[];
  calculations: CalculationResult | null;
  averagingYears: number;
  dataSource?: 'expert' | 'raw';
}

interface PeriodColumn {
  periodId: number;
  label: string;
  year: number | null;
  periodEnd: string;
  income: any;
  staff: any;
  isYtd: boolean;
  ytdMonths: number;
}

export default function PLSummarySection({ financialData, adjustments, calculations, averagingYears, dataSource }: PLSummarySectionProps) {
  const [annualisedCols, setAnnualisedCols] = useState<Set<string>>(new Set());

  const columns = useMemo<PeriodColumn[]>(() => {
    if (!financialData?.periods || !financialData?.incomeStatements) return [];

    const statutory = financialData.periods
      .filter((p: any) => (p.periodType === 'statutory' || p.periodType === 'historic' || p.periodType === 'management') && p.fiscalYear)
      .sort((a: any, b: any) => new Date(a.periodEnd).getTime() - new Date(b.periodEnd).getTime());

    const ytdMap = detectYtdPeriods(statutory.map((p: any) => ({ periodEnd: p.periodEnd })));

    return statutory.map((p: any) => {
      const income = financialData.incomeStatements.find((i: any) => i.financialPeriodId === p.id);
      const staff = financialData.staffData?.find((s: any) => s.financialPeriodId === p.id);
      const isYtd = ytdMap.get(p.periodEnd) ?? false;
      const ytdMonths = new Date(p.periodEnd).getMonth() + 1;
      return {
        periodId: p.id,
        label: p.periodLabel || String(p.fiscalYear),
        year: p.fiscalYear,
        periodEnd: p.periodEnd,
        income: income || null,
        staff: staff || null,
        isYtd,
        ytdMonths,
      };
    });
  }, [financialData]);

  const hasYtdColumn = useMemo(() => columns.some(c => c.isYtd), [columns]);

  const fullYearColumns = useMemo(() => columns.filter(c => !c.isYtd), [columns]);
  const ytdColumns = useMemo(() => columns.filter(c => c.isYtd), [columns]);

  const averagingYearSet = useMemo<Set<number | null>>(() => {
    if (columns.length === 0) return new Set();
    const fullYearCols = columns.filter(c => !c.isYtd);
    const recent = fullYearCols.slice(-averagingYears);
    return new Set(recent.map(c => c.year));
  }, [columns, averagingYears]);

  const averages = useMemo(() => {
    if (columns.length === 0) return null;
    const fullYearCols = columns.filter(c => !c.isYtd);
    const avgCols = fullYearCols.slice(-averagingYears);
    const n = avgCols.length;
    if (n === 0) return null;

    const sum = (fn: (c: PeriodColumn) => number) => avgCols.reduce((acc, c) => acc + fn(c), 0) / n;

    const revenue = sum(c => toNum(c.income?.revenue));
    const costOfSales = sum(c => toNum(c.income?.costOfSales));
    const grossProfit = sum(c => toNum(c.income?.grossProfit));
    const adminExpenses = sum(c => toNum(c.income?.administrativeExpenses));
    const operatingProfit = sum(c => toNum(c.income?.operatingProfit));
    const da = sum(c => toNum(c.income?.depreciationAmortisation));
    const ebitda = operatingProfit + da;
    const directorsRem = sum(c => toNum(c.income?.directorsRemuneration ?? c.staff?.directorRemuneration));
    const staffCosts = sum(c => toNum(c.income?.staffCosts ?? c.staff?.totalStaffCosts));

    return { revenue, costOfSales, grossProfit, adminExpenses, operatingProfit, da, ebitda, directorsRem, staffCosts };
  }, [columns, averagingYears]);

  if (columns.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <span className="flex items-center justify-center h-6 w-6 rounded-full bg-muted text-xs font-bold">1</span>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
            What Does This Business Earn?
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-8">
            No financial data available. Upload accounts documents and run expert analysis to populate this section.
          </p>
        </CardContent>
      </Card>
    );
  }

  const isAnnualised = (col: PeriodColumn) => col.isYtd && annualisedCols.has(col.periodEnd);

  const annualiseIfNeeded = (col: PeriodColumn, value: number | null): number | null => {
    if (value === null) return null;
    if (!isAnnualised(col)) return value;
    if (!col.ytdMonths) return value;
    return (value / col.ytdMonths) * 12;
  };

  const val = (income: any, staff: any, field: string, col?: PeriodColumn): number | null => {
    let raw: number | null;
    if (field === 'directorsRemuneration') {
      const v = income?.directorsRemuneration ?? staff?.directorRemuneration;
      raw = v != null ? toNum(v) : null;
    } else if (field === 'staffCosts') {
      const v = income?.staffCosts ?? staff?.totalStaffCosts;
      raw = v != null ? toNum(v) : null;
    } else {
      const v = income?.[field];
      raw = v != null ? toNum(v) : null;
    }
    return col ? annualiseIfNeeded(col, raw) : raw;
  };

  const ebitdaVal = (income: any, col?: PeriodColumn): number | null => {
    const op = val(income, null, 'operatingProfit');
    const da = val(income, null, 'depreciationAmortisation');
    if (op === null) return null;
    const raw = op + (da ?? 0);
    return col ? annualiseIfNeeded(col, raw) : raw;
  };

  const toggleAnnualised = (periodEnd: string) => {
    setAnnualisedCols(prev => {
      const next = new Set(prev);
      if (next.has(periodEnd)) {
        next.delete(periodEnd);
      } else {
        next.add(periodEnd);
      }
      return next;
    });
  };

  const cellClass = (col: PeriodColumn, isAvg?: boolean) => {
    const base = 'text-right tabular-nums px-3 py-2';
    if (isAvg) return `${base} bg-primary/5 font-semibold`;
    if (col.isYtd) return `${base} bg-amber-50/60 dark:bg-amber-950/20`;
    if (averagingYearSet.has(col.year)) return `${base} bg-blue-50/60 dark:bg-blue-950/20`;
    return `${base}`;
  };

  const renderCell = (value: number | null, negative?: boolean) => {
    if (value === null || value === undefined) return <span className="text-muted-foreground">—</span>;
    const display = negative ? -Math.abs(value) : value;
    return formatCurrency(display);
  };

  const renderMargin = (numerator: number | null, denominator: number | null) => {
    if (numerator === null || denominator === null || denominator === 0) {
      return <span className="text-muted-foreground">—</span>;
    }
    return <span className="text-muted-foreground italic text-xs">{formatPercent((numerator / denominator) * 100)}</span>;
  };

  type RowDef = {
    label: string;
    field?: string;
    negative?: boolean;
    computed?: 'gpMargin' | 'ebitMargin' | 'ebitda' | 'ebitdaMargin';
    bold?: boolean;
    highlight?: boolean;
    margin?: boolean;
    separator?: boolean;
  };

  const rows: RowDef[] = [
    { label: 'Revenue', field: 'revenue' },
    { label: 'Cost of Sales', field: 'costOfSales', negative: true },
    { label: 'Gross Profit', field: 'grossProfit', bold: true },
    { label: 'GP Margin %', computed: 'gpMargin', margin: true },
    { label: 'Administrative Expenses', field: 'administrativeExpenses', negative: true },
    { label: 'Operating Profit (EBIT)', field: 'operatingProfit', bold: true },
    { label: 'EBIT Margin %', computed: 'ebitMargin', margin: true },
    { label: 'Depreciation & Amortisation', field: 'depreciationAmortisation' },
    { label: 'EBITDA', computed: 'ebitda', bold: true, highlight: true },
    { label: 'EBITDA Margin %', computed: 'ebitdaMargin', margin: true },
    { separator: true, label: '' },
    { label: "Directors' Remuneration", field: 'directorsRemuneration' },
    { label: 'Staff Costs', field: 'staffCosts' },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <span className="flex items-center justify-center h-6 w-6 rounded-full bg-muted text-xs font-bold">1</span>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
          What Does This Business Earn?
        </CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[220px] min-w-[180px]"></TableHead>
              {fullYearColumns.map(col => (
                <TableHead
                  key={col.periodId}
                  className={`text-right px-3 w-32 min-w-[128px] ${averagingYearSet.has(col.year) ? 'bg-blue-50/60 dark:bg-blue-950/20' : ''}`}
                >
                  <div className="flex flex-col items-end gap-0.5">
                    <span>{col.label}</span>
                  </div>
                </TableHead>
              ))}
              <TableHead className="text-right px-3 bg-primary/5 font-semibold">
                <div className="flex flex-col items-end gap-0.5">
                  <span>Average</span>
                  {hasYtdColumn && (
                    <span className="text-xs font-normal text-muted-foreground">(full years only)</span>
                  )}
                </div>
              </TableHead>
              {ytdColumns.map(col => (
                <TableHead
                  key={col.periodId}
                  className="text-right px-3 w-32 min-w-[128px] bg-amber-50/60 dark:bg-amber-950/20"
                >
                  <div className="flex flex-col items-end gap-0.5">
                    <span>{formatYtdLabel(col.periodEnd)}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-auto p-0 text-xs font-normal underline text-muted-foreground hover:text-foreground"
                      onClick={() => toggleAnnualised(col.periodEnd)}
                    >
                      {isAnnualised(col) ? 'YTD' : 'Annualise'}
                    </Button>
                  </div>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, idx) => {
              if (row.separator) {
                return (
                  <TableRow key={`sep-${idx}`}>
                    <TableCell colSpan={columns.length + 2} className="h-2 p-0">
                      <div className="border-t border-dashed border-muted-foreground/30" />
                    </TableCell>
                  </TableRow>
                );
              }

              const rowCls = row.highlight ? 'bg-primary/5 font-semibold' : row.margin ? '' : '';

              const renderPeriodCell = (col: PeriodColumn) => {
                const cc = cellClass(col);

                if (row.computed === 'gpMargin') {
                  const gp = val(col.income, col.staff, 'grossProfit');
                  const rev = val(col.income, col.staff, 'revenue');
                  return <TableCell key={col.periodId} className={cc}>{renderMargin(gp, rev)}</TableCell>;
                }
                if (row.computed === 'ebitMargin') {
                  const op = val(col.income, col.staff, 'operatingProfit');
                  const rev = val(col.income, col.staff, 'revenue');
                  return <TableCell key={col.periodId} className={cc}>{renderMargin(op, rev)}</TableCell>;
                }
                if (row.computed === 'ebitda') {
                  const e = ebitdaVal(col.income, col);
                  return (
                    <TableCell key={col.periodId} className={`${cellClass(col)} ${row.highlight ? 'bg-primary/5 font-semibold' : ''}`}>
                      {renderCell(e)}
                    </TableCell>
                  );
                }
                if (row.computed === 'ebitdaMargin') {
                  const e = ebitdaVal(col.income);
                  const rev = val(col.income, col.staff, 'revenue');
                  return <TableCell key={col.periodId} className={cc}>{renderMargin(e, rev)}</TableCell>;
                }

                const v = val(col.income, col.staff, row.field!, col);
                return <TableCell key={col.periodId} className={cc}>{renderCell(v, row.negative)}</TableCell>;
              };

              return (
                <TableRow key={row.label} className={rowCls}>
                  <TableCell className={`text-sm ${row.bold ? 'font-semibold' : ''} ${row.margin ? 'text-muted-foreground italic text-xs' : ''}`}>
                    {row.label}
                  </TableCell>

                  {fullYearColumns.map(col => renderPeriodCell(col))}

                  <TableCell className={cellClass(fullYearColumns[0] ?? columns[0], true)}>
                    {!averages ? '—' : (() => {
                      if (row.computed === 'gpMargin') return renderMargin(averages.grossProfit, averages.revenue);
                      if (row.computed === 'ebitMargin') return renderMargin(averages.operatingProfit, averages.revenue);
                      if (row.computed === 'ebitda') return renderCell(averages.ebitda);
                      if (row.computed === 'ebitdaMargin') return renderMargin(averages.ebitda, averages.revenue);
                      if (row.field === 'revenue') return renderCell(averages.revenue);
                      if (row.field === 'costOfSales') return renderCell(averages.costOfSales, true);
                      if (row.field === 'grossProfit') return renderCell(averages.grossProfit);
                      if (row.field === 'administrativeExpenses') return renderCell(averages.adminExpenses, true);
                      if (row.field === 'operatingProfit') return renderCell(averages.operatingProfit);
                      if (row.field === 'depreciationAmortisation') return renderCell(averages.da);
                      if (row.field === 'directorsRemuneration') return renderCell(averages.directorsRem);
                      if (row.field === 'staffCosts') return renderCell(averages.staffCosts);
                      return '—';
                    })()}
                  </TableCell>

                  {ytdColumns.map(col => renderPeriodCell(col))}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>

        <div className="flex items-center gap-1.5 mt-4 text-xs text-muted-foreground">
          <Info className="h-3.5 w-3.5 shrink-0" />
          EBITDA averaged over {averagingYears} most recent full year{averagingYears !== 1 ? 's' : ''}. Adjustments applied in Section 2.
          {hasYtdColumn && (
            <span className="ml-2">YTD columns are excluded from the average.</span>
          )}
          {dataSource === 'expert' && (
            <span className="ml-2 text-xs text-blue-600 dark:text-blue-400 font-medium">· Sourced from Phase 2 holistic analysis</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
