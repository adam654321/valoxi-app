import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Landmark, Info } from 'lucide-react';
import { toNum } from '@shared/calculators/deal-model.calc';
import { formatCurrency } from '@/lib/format-utils';
import { detectYtdPeriods, formatYtdLabel, computeYtdMonths } from '@/lib/period-utils';

interface BalanceSheetSectionProps {
  financialData: any;
}

interface BSColumn {
  periodId: number;
  label: string;
  year: number | null;
  periodEnd: string;
  bs: any;
  isYtd: boolean;
  ytdMonths: number;
}

type LineItem = [field: string, label: string];

interface GroupDef {
  title: string;
  items: LineItem[];
  subtotal: LineItem | null;
}

const GROUPS: GroupDef[] = [
  {
    title: 'Fixed Assets',
    items: [
      ['intangibleAssets', 'Intangible Assets'],
      ['tangibleFixedAssets', 'Tangible Fixed Assets'],
      ['freeholdProperty', 'Freehold Property'],
      ['leaseholdProperty', 'Leasehold Property'],
      ['plantMachinery', 'Plant & Machinery'],
      ['fixturesFittings', 'Fixtures & Fittings'],
      ['motorVehicles', 'Motor Vehicles'],
      ['computerEquipment', 'Computer Equipment'],
    ],
    subtotal: null,
  },
  {
    title: 'Current Assets',
    items: [
      ['stockInventory', 'Stock / Inventory'],
      ['tradeDebtors', 'Trade Debtors'],
      ['prepayments', 'Prepayments'],
      ['amountsOwedByDirectors', 'Owed by Directors'],
      ['amountsOwedByConnectedCompanies', 'Owed by Connected Companies'],
      ['directorsCurrentAccount', "Directors' Current Account"],
      ['otherDebtors', 'Other Debtors'],
      ['cashAtBank', 'Cash at Bank'],
    ],
    subtotal: ['totalCurrentAssets', 'Total Current Assets'],
  },
  {
    title: 'Current Liabilities',
    items: [
      ['tradeCreditors', 'Trade Creditors'],
      ['taxationSocialSecurity', 'Taxation & Social Security'],
      ['vatPayable', 'VAT Payable'],
      ['corporationTaxDue', 'Corporation Tax Due'],
      ['bankLoansOverdraftCurrent', 'Bank Loans / Overdraft'],
      ['hirePurchaseCurrent', 'Hire Purchase'],
      ['accruals', 'Accruals'],
      ['amountsOwedToDirectors', 'Owed to Directors'],
      ['otherCreditors', 'Other Creditors'],
    ],
    subtotal: ['totalCurrentLiabilities', 'Total Current Liabilities'],
  },
  {
    title: 'Long-term Liabilities',
    items: [
      ['bankLoansLongTerm', 'Bank Loans'],
      ['hirePurchaseLongTerm', 'Hire Purchase'],
      ['deferredTaxation', 'Deferred Taxation'],
      ['otherLongTermDebt', 'Other Debt'],
    ],
    subtotal: ['totalLongTermLiabilities', 'Total Long-term Liabilities'],
  },
  {
    title: 'Equity',
    items: [
      ['shareCapital', 'Share Capital'],
      ['retainedEarnings', 'Retained Earnings'],
    ],
    subtotal: ['totalEquity', 'Total Equity'],
  },
];

export default function BalanceSheetSection({ financialData }: BalanceSheetSectionProps) {
  const [annualisedCols, setAnnualisedCols] = useState<Set<string>>(new Set());

  const columns = useMemo<BSColumn[]>(() => {
    if (!financialData?.periods || !financialData?.balanceSheets) return [];
    const statutory = financialData.periods
      .filter((p: any) => (p.periodType === 'statutory' || p.periodType === 'historic' || p.periodType === 'management') && p.fiscalYear)
      .sort((a: any, b: any) => new Date(a.periodEnd).getTime() - new Date(b.periodEnd).getTime());

    const ytdMap = detectYtdPeriods(statutory.map((p: any) => ({ periodEnd: p.periodEnd })));

    // Determine the fiscal year end month (1-12) from full-year (non-YTD) periods so
    // that months-elapsed for a YTD period is computed relative to the fiscal year
    // start, not the raw calendar month of periodEnd.
    const fullYearMonths = statutory
      .filter((p: any) => !(ytdMap.get(p.periodEnd) ?? false))
      .map((p: any) => new Date(p.periodEnd).getMonth() + 1);
    const monthFrequency = new Map<number, number>();
    fullYearMonths.forEach((m: number) => monthFrequency.set(m, (monthFrequency.get(m) ?? 0) + 1));
    let fiscalYearEndMonth = fullYearMonths[0] ?? 12;
    let highestFrequency = -1;
    monthFrequency.forEach((count, month) => {
      if (count > highestFrequency) {
        highestFrequency = count;
        fiscalYearEndMonth = month;
      }
    });

    return statutory
      .map((p: any) => {
        const bs = financialData.balanceSheets.find((s: any) => s.financialPeriodId === p.id);
        if (!bs) return null;
        const isOutlier = ytdMap.get(p.periodEnd) ?? false;
        const ytdMonths = computeYtdMonths(p.periodEnd, fiscalYearEndMonth);
        const isYtd = isOutlier && p.periodType === 'management';
        return {
          periodId: p.id,
          label: p.periodLabel || String(p.fiscalYear),
          year: p.fiscalYear,
          periodEnd: p.periodEnd,
          bs,
          isYtd,
          ytdMonths,
        };
      })
      .filter((c: BSColumn | null): c is BSColumn => c !== null);
  }, [financialData]);

  const fullYearColumns = useMemo(() => columns.filter(c => !c.isYtd), [columns]);
  const ytdColumns = useMemo(() => columns.filter(c => c.isYtd), [columns]);

  const isAnnualised = (col: BSColumn) => col.isYtd && annualisedCols.has(col.periodEnd);

  const annualiseIfNeeded = (col: BSColumn, value: number | null): number | null => {
    if (value === null) return null;
    if (!isAnnualised(col)) return value;
    if (!col.ytdMonths) return value;
    return (value / col.ytdMonths) * 12;
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

  const hasValue = (field: string) => columns.some(c => c.bs?.[field] != null);

  const netCurrentAssets = (col: BSColumn): number | null => {
    const ca = col.bs?.totalCurrentAssets;
    const cl = col.bs?.totalCurrentLiabilities;
    if (ca == null && cl == null) return null;
    const raw = toNum(ca) - toNum(cl);
    return annualiseIfNeeded(col, raw);
  };
  const showNetCurrent = columns.some(c => netCurrentAssets(c) != null);

  const cellClass = (col: BSColumn) => {
    const base = 'text-right tabular-nums px-3 py-2';
    if (col.isYtd) return `${base} bg-amber-50/60 dark:bg-amber-950/20`;
    return base;
  };

  const renderCell = (value: any, col?: BSColumn) => {
    if (value == null) return <span className="text-muted-foreground">—</span>;
    const raw = toNum(value);
    const applied = col ? annualiseIfNeeded(col, raw) : raw;
    return formatCurrency(applied ?? raw);
  };

  if (columns.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Landmark className="h-4 w-4 text-muted-foreground" />
            Balance Sheet
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-8">
            No balance sheet data available. Upload accounts documents and run analysis to populate this section.
          </p>
        </CardContent>
      </Card>
    );
  }

  const bodyRows: JSX.Element[] = [];
  for (const group of GROUPS) {
    const visibleItems = group.items.filter(([field]) => hasValue(field));
    const subtotalHasValue = group.subtotal ? hasValue(group.subtotal[0]) : false;
    if (visibleItems.length === 0 && !subtotalHasValue) continue;

    bodyRows.push(
      <TableRow key={`hdr-${group.title}`} className="bg-muted/40">
        <TableCell colSpan={columns.length + 1} className="text-xs font-semibold uppercase tracking-wide text-muted-foreground py-1.5">
          {group.title}
        </TableCell>
      </TableRow>
    );

    for (const [field, label] of visibleItems) {
      bodyRows.push(
        <TableRow key={field}>
          <TableCell className="text-sm">{label}</TableCell>
          {fullYearColumns.map(col => (
            <TableCell key={col.periodId} className={cellClass(col)}>
              {renderCell(col.bs?.[field], col)}
            </TableCell>
          ))}
          {ytdColumns.map(col => (
            <TableCell key={col.periodId} className={cellClass(col)}>
              {renderCell(col.bs?.[field], col)}
            </TableCell>
          ))}
        </TableRow>
      );
    }

    if (group.subtotal && subtotalHasValue && visibleItems.length > 0) {
      const usf = group.subtotal[0];
      const undisclosedFor = (col: BSColumn): number | null => {
        const sub = col.bs?.[usf];
        if (sub == null) return null;
        const disclosed = visibleItems.reduce(
          (acc, [f]) => acc + (col.bs?.[f] != null ? toNum(col.bs[f]) : 0),
          0
        );
        return toNum(sub) - disclosed;
      };
      const showUndisclosed = columns.some(col => {
        const r = undisclosedFor(col);
        return r != null && r > 0.5;
      });
      if (showUndisclosed) {
        const renderUndisclosed = (col: BSColumn) => {
          const r = undisclosedFor(col);
          const applied = r != null ? annualiseIfNeeded(col, r) : r;
          let content: JSX.Element | string;
          if (r == null || r < -0.5) content = <span className="text-muted-foreground">—</span>;
          else content = formatCurrency(Math.abs(applied ?? r) <= 0.5 ? 0 : (applied ?? r));
          return (
            <TableCell key={col.periodId} className={`${cellClass(col)} italic text-muted-foreground`}>
              {content}
            </TableCell>
          );
        };
        bodyRows.push(
          <TableRow key={`${usf}-undisclosed`}>
            <TableCell className="text-sm italic text-muted-foreground pl-6">Undisclosed items</TableCell>
            {fullYearColumns.map(col => renderUndisclosed(col))}
            {ytdColumns.map(col => renderUndisclosed(col))}
          </TableRow>
        );
      }
    }

    if (group.subtotal && subtotalHasValue) {
      const [sf, sl] = group.subtotal;
      bodyRows.push(
        <TableRow key={sf} className="font-semibold bg-primary/5">
          <TableCell className="text-sm font-semibold">{sl}</TableCell>
          {fullYearColumns.map(col => (
            <TableCell key={col.periodId} className={cellClass(col)}>
              {renderCell(col.bs?.[sf], col)}
            </TableCell>
          ))}
          {ytdColumns.map(col => (
            <TableCell key={col.periodId} className={cellClass(col)}>
              {renderCell(col.bs?.[sf], col)}
            </TableCell>
          ))}
        </TableRow>
      );
    }

    if (group.title === 'Current Liabilities' && showNetCurrent) {
      const renderNetCurrent = (col: BSColumn) => {
        const v = netCurrentAssets(col);
        return (
          <TableCell key={col.periodId} className={cellClass(col)}>
            {v == null ? <span className="text-muted-foreground">—</span> : formatCurrency(v)}
          </TableCell>
        );
      };
      bodyRows.push(
        <TableRow key="net-current-assets" className="font-semibold">
          <TableCell className="text-sm font-semibold">Net Current Assets</TableCell>
          {fullYearColumns.map(col => renderNetCurrent(col))}
          {ytdColumns.map(col => renderNetCurrent(col))}
        </TableRow>
      );
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Landmark className="h-4 w-4 text-muted-foreground" />
          Balance Sheet
        </CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[240px] min-w-[200px]"></TableHead>
              {fullYearColumns.map(col => (
                <TableHead key={col.periodId} className="text-right px-3 w-32 min-w-[128px]">
                  {col.label}
                </TableHead>
              ))}
              {ytdColumns.map(col => (
                <TableHead key={col.periodId} className="text-right px-3 w-32 min-w-[128px] bg-amber-50/60 dark:bg-amber-950/20">
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
          <TableBody>{bodyRows}</TableBody>
        </Table>

        <div className="flex items-center gap-1.5 mt-4 text-xs text-muted-foreground">
          <Info className="h-3.5 w-3.5 shrink-0" />
          Empty lines are hidden. Figures as reported in the accounts.
        </div>
      </CardContent>
    </Card>
  );
}
