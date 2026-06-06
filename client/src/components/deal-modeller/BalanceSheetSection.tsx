import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Landmark, Info } from 'lucide-react';
import { toNum } from '@shared/calculators/deal-model.calc';
import { formatCurrency } from '@/lib/format-utils';

interface BalanceSheetSectionProps {
  financialData: any;
}

interface BSColumn {
  periodId: number;
  label: string;
  year: number | null;
  periodEnd: string;
  bs: any;
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
    const statutory = financialData.periods
      .filter((p: any) => (p.periodType === 'statutory' || p.periodType === 'historic') && p.fiscalYear)
      .sort((a: any, b: any) => new Date(a.periodEnd).getTime() - new Date(b.periodEnd).getTime());
    return statutory
      .map((p: any) => {
        const bs = financialData.balanceSheets.find((s: any) => s.financialPeriodId === p.id);
        if (!bs) return null;
        return {
          periodId: p.id,
          label: p.periodLabel || String(p.fiscalYear),
          year: p.fiscalYear,
          periodEnd: p.periodEnd,
          bs,
        };
      })
      .filter((c: BSColumn | null): c is BSColumn => c !== null);
  }, [financialData]);

  const hasValue = (field: string) => columns.some(c => c.bs?.[field] != null);

  const netCurrentAssets = (bs: any): number | null => {
    const ca = bs?.totalCurrentAssets;
    const cl = bs?.totalCurrentLiabilities;
    if (ca == null && cl == null) return null;
    return toNum(ca) - toNum(cl);
  };
  const showNetCurrent = columns.some(c => netCurrentAssets(c.bs) != null);

  const renderCell = (value: any) => {
    if (value == null) return <span className="text-muted-foreground">—</span>;
    return formatCurrency(toNum(value));
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
          {columns.map(col => (
            <TableCell key={col.periodId} className="text-right tabular-nums px-3 py-2">
              {renderCell(col.bs?.[field])}
            </TableCell>
          ))}
        </TableRow>
      );
    }

    if (group.subtotal && subtotalHasValue) {
      const [sf, sl] = group.subtotal;
      bodyRows.push(
        <TableRow key={sf} className="font-semibold bg-primary/5">
          <TableCell className="text-sm font-semibold">{sl}</TableCell>
          {columns.map(col => (
            <TableCell key={col.periodId} className="text-right tabular-nums px-3 py-2">
              {renderCell(col.bs?.[sf])}
            </TableCell>
          ))}
        </TableRow>
      );
    }

    if (group.title === 'Current Liabilities' && showNetCurrent) {
      bodyRows.push(
        <TableRow key="net-current-assets" className="font-semibold">
          <TableCell className="text-sm font-semibold">Net Current Assets</TableCell>
          {columns.map(col => {
            const v = netCurrentAssets(col.bs);
            return (
              <TableCell key={col.periodId} className="text-right tabular-nums px-3 py-2">
                {v == null ? <span className="text-muted-foreground">—</span> : formatCurrency(v)}
              </TableCell>
            );
          })}
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
              {columns.map(col => (
                <TableHead key={col.periodId} className="text-right px-3">
                  {col.label}
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
