import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Landmark, Info } from 'lucide-react';
import { toNum } from '@shared/calculators/deal-model.calc';
import { formatCurrency } from '@/lib/format-utils';
import { formatYtdLabel, isPartYearPeriod } from '@/lib/period-utils';

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
  const columns = useMemo<BSColumn[]>(() => {
    if (!financialData?.periods || !financialData?.balanceSheets) return [];
    const sorted = financialData.periods
      .filter((p: any) => (p.periodType === 'statutory' || p.periodType === 'historic' || p.periodType === 'management') && p.fiscalYear)
      .filter((p: any) => financialData.balanceSheets.some(
        (s: any) => s.financialPeriodId === p.id
      ))
      .sort((a: any, b: any) => new Date(a.periodEnd).getTime() - new Date(b.periodEnd).getTime());

    // Dedup: at most one column per (fiscalYear, part-year flag); later periodEnd wins
    // (all survivors already have a balance sheet row from the filter above)
    const statutory = sorted.reduce((acc: any[], p: any) => {
      const key = `${p.fiscalYear}:${isPartYearPeriod(p)}`;
      const existingIdx = acc.findIndex(
        (a: any) => `${a.fiscalYear}:${isPartYearPeriod(a)}` === key
      );
      if (existingIdx === -1) {
        acc.push(p);
      } else if (new Date(p.periodEnd) > new Date(acc[existingIdx].periodEnd)) {
        acc[existingIdx] = p;
      }
      return acc;
    }, []);

    return statutory
      .map((p: any) => {
        const bs = financialData.balanceSheets.find((s: any) => s.financialPeriodId === p.id);
        if (!bs) return null;
        const isYtd = isPartYearPeriod(p);
        return {
          periodId: p.id,
          label: isYtd && p.fiscalYear ? formatYtdLabel(p.fiscalYear) : (p.periodLabel || String(p.fiscalYear)),
          year: p.fiscalYear,
          periodEnd: p.periodEnd,
          bs,
          isYtd,
        };
      })
      .filter((c: BSColumn | null): c is BSColumn => c !== null);
  }, [financialData]);

  const fullYearColumns = useMemo(() => columns.filter(c => !c.isYtd), [columns]);
  const ytdColumns = useMemo(() => columns.filter(c => c.isYtd), [columns]);

  const hasValue = (field: string) => columns.some(c => c.bs?.[field] != null);

  const netCurrentAssets = (col: BSColumn): number | null => {
    const ca = col.bs?.totalCurrentAssets;
    const cl = col.bs?.totalCurrentLiabilities;
    if (ca == null && cl == null) return null;
    return toNum(ca) - toNum(cl);
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
    return formatCurrency(raw);
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
          let content: JSX.Element | string;
          if (r == null || r < -0.5) content = <span className="text-muted-foreground">—</span>;
          else content = formatCurrency(Math.abs(r) <= 0.5 ? 0 : r);
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
                    <span>{col.label}</span>
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
