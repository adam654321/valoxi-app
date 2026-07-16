import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Landmark, Info } from 'lucide-react';
import { toNum } from '@shared/calculators/deal-model.calc';
import { formatCurrency } from '@/lib/format-utils';
import { formatYtdLabel, isPartYearPeriod, hasUsableBalanceSheet } from '@/lib/period-utils';

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
  docName: string | null;
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
  const { tableColumns, hollowEntries } = useMemo<{ tableColumns: BSColumn[]; hollowEntries: BSColumn[] }>(() => {
    if (!financialData?.periods || !financialData?.balanceSheets) return { tableColumns: [], hollowEntries: [] };

    const sorted = financialData.periods
      .filter((p: any) => (p.periodType === 'statutory' || p.periodType === 'historic' || p.periodType === 'management') && p.fiscalYear)
      .sort((a: any, b: any) => new Date(a.periodEnd).getTime() - new Date(b.periodEnd).getTime());

    // Dedup: rank 2=usable BS, 1=hollow BS row exists, 0=no BS row
    // Within same rank, later periodEnd wins
    const dedupMap = new Map<string, { period: any; rank: number }>();
    for (const p of sorted) {
      const key = `${p.fiscalYear}:${isPartYearPeriod(p)}`;
      const bs = financialData.balanceSheets.find((s: any) => s.financialPeriodId === p.id) ?? null;
      const rank = hasUsableBalanceSheet(bs) ? 2 : bs ? 1 : 0;
      const existing = dedupMap.get(key);
      if (
        !existing ||
        rank > existing.rank ||
        (rank === existing.rank && new Date(p.periodEnd) > new Date(existing.period.periodEnd))
      ) {
        dedupMap.set(key, { period: p, rank });
      }
    }

    const tableColumns: BSColumn[] = [];
    const hollowEntries: BSColumn[] = [];

    Array.from(dedupMap.values())
      .sort((a, b) => new Date(a.period.periodEnd).getTime() - new Date(b.period.periodEnd).getTime())
      .forEach(({ period: p, rank }) => {
        const bs = financialData.balanceSheets.find((s: any) => s.financialPeriodId === p.id) ?? null;
        const isYtd = isPartYearPeriod(p);
        const col: BSColumn = {
          periodId: p.id,
          label: isYtd && p.fiscalYear ? formatYtdLabel(p.fiscalYear) : (p.periodLabel || String(p.fiscalYear)),
          year: p.fiscalYear,
          periodEnd: p.periodEnd,
          bs,
          isYtd,
          docName: p.documentName ?? null,
        };
        // Full-year columns with hollow/absent BS → info panel; YTD columns always in table
        if (!isYtd && rank < 2) {
          hollowEntries.push(col);
        } else {
          tableColumns.push(col);
        }
      });

    return { tableColumns, hollowEntries };
  }, [financialData]);

  const fullYearColumns = useMemo(() => tableColumns.filter(c => !c.isYtd), [tableColumns]);
  const ytdColumns = useMemo(() => tableColumns.filter(c => c.isYtd), [tableColumns]);

  const hasValue = (field: string) => tableColumns.some(c => c.bs?.[field] != null);

  const netCurrentAssets = (col: BSColumn): number | null => {
    const ca = col.bs?.totalCurrentAssets;
    const cl = col.bs?.totalCurrentLiabilities;
    if (ca == null && cl == null) return null;
    return toNum(ca) - toNum(cl);
  };
  const showNetCurrent = tableColumns.some(c => netCurrentAssets(c) != null);

  const cellClass = (col: BSColumn) => {
    const base = 'text-right tabular-nums px-3 py-2';
    if (col.isYtd) return `${base} bg-amber-50/60 dark:bg-amber-950/20`;
    return base;
  };

  const renderCell = (value: any) => {
    if (value == null) return <span className="text-muted-foreground">—</span>;
    const raw = toNum(value);
    return formatCurrency(raw);
  };

  const hollowPanels = hollowEntries.length > 0 ? (
    <div className="mt-3 space-y-2">
      {hollowEntries.map(col => (
        <div key={col.periodId} className="flex items-start gap-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-400">
          <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <span>
            No balance sheet values extracted for FY {col.year}
            {col.docName ? ` from ${col.docName}` : ''}. Upload statutory accounts or a balance
            sheet for this year, or re-run analysis.
          </span>
        </div>
      ))}
    </div>
  ) : null;

  if (tableColumns.length === 0) {
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
          {hollowPanels}
        </CardContent>
      </Card>
    );
  }

  const colCount = tableColumns.length + 1;

  const bodyRows: JSX.Element[] = [];
  for (const group of GROUPS) {
    const visibleItems = group.items.filter(([field]) => hasValue(field));
    const subtotalHasValue = group.subtotal ? hasValue(group.subtotal[0]) : false;
    if (visibleItems.length === 0 && !subtotalHasValue) continue;

    bodyRows.push(
      <TableRow key={`hdr-${group.title}`} className="bg-muted/40">
        <TableCell colSpan={colCount} className="text-xs font-semibold uppercase tracking-wide text-muted-foreground py-1.5">
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
              {renderCell(col.bs?.[field])}
            </TableCell>
          ))}
          {ytdColumns.map(col => (
            <TableCell key={col.periodId} className={cellClass(col)}>
              {renderCell(col.bs?.[field])}
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
      const showUndisclosed = tableColumns.some(col => {
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
              {renderCell(col.bs?.[sf])}
            </TableCell>
          ))}
          {ytdColumns.map(col => (
            <TableCell key={col.periodId} className={cellClass(col)}>
              {renderCell(col.bs?.[sf])}
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

        {hollowPanels}

        <div className="flex items-center gap-1.5 mt-4 text-xs text-muted-foreground">
          <Info className="h-3.5 w-3.5 shrink-0" />
          Empty lines are hidden. Figures as reported in the accounts.
        </div>
      </CardContent>
    </Card>
  );
}
