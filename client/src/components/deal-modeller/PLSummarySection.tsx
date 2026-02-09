import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TrendingUp, Info } from 'lucide-react';
import { toNum } from '@shared/calculators/deal-model.calc';
import type { CalculationResult } from '@shared/calculators/deal-model.calc';
import type { DealModelAdjustment } from '@shared/schema';
import { formatCurrency, formatPercent } from '@/lib/format-utils';

interface PLSummarySectionProps {
  financialData: any;
  adjustments: DealModelAdjustment[];
  calculations: CalculationResult | null;
  averagingYears: number;
}

interface PeriodColumn {
  periodId: number;
  label: string;
  year: number | null;
  periodEnd: string;
  income: any;
  staff: any;
}

export default function PLSummarySection({ financialData, adjustments, calculations, averagingYears }: PLSummarySectionProps) {
  const columns = useMemo<PeriodColumn[]>(() => {
    if (!financialData?.periods || !financialData?.incomeStatements) return [];

    const statutory = financialData.periods
      .filter((p: any) => (p.periodType === 'statutory' || p.periodType === 'historic') && p.fiscalYear)
      .sort((a: any, b: any) => new Date(a.periodEnd).getTime() - new Date(b.periodEnd).getTime());

    return statutory.map((p: any) => {
      const income = financialData.incomeStatements.find((i: any) => i.financialPeriodId === p.id);
      const staff = financialData.staffData?.find((s: any) => s.financialPeriodId === p.id);
      return {
        periodId: p.id,
        label: p.periodLabel || String(p.fiscalYear),
        year: p.fiscalYear,
        periodEnd: p.periodEnd,
        income: income || null,
        staff: staff || null,
      };
    });
  }, [financialData]);

  const averagingYearSet = useMemo<Set<number | null>>(() => {
    if (columns.length === 0) return new Set();
    const recent = columns.slice(-averagingYears);
    return new Set(recent.map(c => c.year));
  }, [columns, averagingYears]);

  const averages = useMemo(() => {
    if (columns.length === 0) return null;
    const avgCols = columns.slice(-averagingYears);
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

  const val = (income: any, staff: any, field: string): number | null => {
    if (field === 'directorsRemuneration') {
      const v = income?.directorsRemuneration ?? staff?.directorRemuneration;
      return v != null ? toNum(v) : null;
    }
    if (field === 'staffCosts') {
      const v = income?.staffCosts ?? staff?.totalStaffCosts;
      return v != null ? toNum(v) : null;
    }
    const v = income?.[field];
    return v != null ? toNum(v) : null;
  };

  const ebitdaVal = (income: any): number | null => {
    const op = val(income, null, 'operatingProfit');
    const da = val(income, null, 'depreciationAmortisation');
    if (op === null) return null;
    return op + (da ?? 0);
  };

  const cellClass = (col: PeriodColumn, isAvg?: boolean) => {
    const base = 'text-right tabular-nums px-3 py-2';
    if (isAvg) return `${base} bg-primary/5 font-semibold`;
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
              {columns.map(col => (
                <TableHead
                  key={col.periodId}
                  className={`text-right px-3 ${averagingYearSet.has(col.year) ? 'bg-blue-50/60 dark:bg-blue-950/20' : ''}`}
                >
                  {col.label}
                </TableHead>
              ))}
              <TableHead className="text-right px-3 bg-primary/5 font-semibold">Average</TableHead>
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

              return (
                <TableRow key={row.label} className={rowCls}>
                  <TableCell className={`text-sm ${row.bold ? 'font-semibold' : ''} ${row.margin ? 'text-muted-foreground italic text-xs' : ''}`}>
                    {row.label}
                  </TableCell>

                  {columns.map(col => {
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
                      const e = ebitdaVal(col.income);
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

                    const v = val(col.income, col.staff, row.field!);
                    return <TableCell key={col.periodId} className={cc}>{renderCell(v, row.negative)}</TableCell>;
                  })}

                  <TableCell className={cellClass(columns[0], true)}>
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
                </TableRow>
              );
            })}
          </TableBody>
        </Table>

        <div className="flex items-center gap-1.5 mt-4 text-xs text-muted-foreground">
          <Info className="h-3.5 w-3.5 shrink-0" />
          EBITDA averaged over {averagingYears} most recent year{averagingYears !== 1 ? 's' : ''}. Adjustments applied in Section 2.
        </div>
      </CardContent>
    </Card>
  );
}
