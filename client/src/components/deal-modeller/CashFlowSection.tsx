import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertTriangle, ChevronDown, ChevronRight, TrendingUp, Info } from 'lucide-react';
import { toNum } from '@shared/calculators/deal-model.calc';
import { formatCurrency } from '@/lib/format-utils';
import { isPartYearPeriod } from '@/lib/period-utils';

interface CashFlowSectionProps {
  financialData: any;
}

interface CFCol {
  periodId: number;
  label: string;
  bs: any;
  is: any;
  priorBs: any;
}

interface CFData {
  profitBeforeTax: number;
  addDA: number;
  addInterest: number;
  wcDebtors: number;
  wcStock: number;
  wcCreditors: number;
  wcAccruals: number;
  wcPrepayments: number;
  totalWC: number;
  taxPaid: number;
  netOperating: number;
  capexLabel: string;
  capex: number;
  netInvesting: number;
  dividends: number;
  directorsAccount: number;
  netFinancing: number;
  netMovement: number;
  openingCash: number;
  closingCash: number;
  derivedClosing: number;
  variance: number;
}

function n(v: any): number {
  return toNum(v);
}

function formatCF(value: number | null | undefined): React.ReactNode {
  if (value == null || isNaN(value) || Math.abs(value) < 0.5) {
    return <span className="text-muted-foreground">—</span>;
  }
  if (value < 0) {
    return (
      <span className="text-red-600 dark:text-red-400">
        ({formatCurrency(Math.abs(value))})
      </span>
    );
  }
  return <span>{formatCurrency(value)}</span>;
}

function deriveColumns(financialData: any): CFCol[] {
  if (!financialData?.periods || !financialData?.balanceSheets) return [];

  // Full-year periods only
  const fullYear = financialData.periods.filter(
    (p: any) => (p.periodType === 'statutory' || p.periodType === 'historic') && p.fiscalYear && !isPartYearPeriod(p)
  );

  // Dedup per fiscalYear: prefer the period with a balance sheet row, then later periodEnd
  const periodMap = new Map<number, any>();
  for (const p of fullYear) {
    const existing = periodMap.get(p.fiscalYear);
    if (!existing) {
      periodMap.set(p.fiscalYear, p);
    } else {
      const hasBs = financialData.balanceSheets.some((s: any) => s.financialPeriodId === p.id);
      const existingHasBs = financialData.balanceSheets.some((s: any) => s.financialPeriodId === existing.id);
      if (hasBs && !existingHasBs) {
        periodMap.set(p.fiscalYear, p);
      } else if (hasBs === existingHasBs && new Date(p.periodEnd) > new Date(existing.periodEnd)) {
        periodMap.set(p.fiscalYear, p);
      }
    }
  }

  const statutory = Array.from(periodMap.values())
    .sort((a: any, b: any) => a.fiscalYear - b.fiscalYear);

  const cols: CFCol[] = [];
  for (let i = 1; i < statutory.length; i++) {
    const current = statutory[i];
    const prior = statutory[i - 1];
    // Only pair consecutive fiscal years — non-consecutive deltas are not meaningful cash flow years
    if (current.fiscalYear !== prior.fiscalYear + 1) continue;
    const bs = financialData.balanceSheets.find((s: any) => s.financialPeriodId === current.id);
    const priorBs = financialData.balanceSheets.find((s: any) => s.financialPeriodId === prior.id);
    if (!bs || !priorBs) continue;
    const is = (financialData.incomeStatements ?? []).find((s: any) => s.financialPeriodId === current.id) ?? {};
    cols.push({
      periodId: current.id,
      label: current.periodLabel || String(current.fiscalYear),
      bs,
      is,
      priorBs,
    });
  }
  return cols;
}

function derive(col: CFCol): CFData {
  const { bs, is, priorBs } = col;

  const profitBeforeTax = n(is.profitBeforeTax);
  const addDA = n(is.depreciationAmortisation);
  const addInterest = n(is.interestPayable);

  const wcDebtors = n(priorBs.tradeDebtors) - n(bs.tradeDebtors);
  const wcStock = n(priorBs.stockInventory) - n(bs.stockInventory);
  const wcCreditors = n(bs.tradeCreditors) - n(priorBs.tradeCreditors);
  const wcAccruals = n(bs.accruals) - n(priorBs.accruals);
  const wcPrepayments = n(priorBs.prepayments) - n(bs.prepayments);
  const totalWC = wcDebtors + wcStock + wcCreditors + wcAccruals + wcPrepayments;

  const taxPaid = -n(priorBs.corporationTaxDue);

  const netOperating = profitBeforeTax + addDA + addInterest + totalWC + taxPaid;

  const rawCapex = -(n(bs.tangibleFixedAssets) - n(priorBs.tangibleFixedAssets) + n(is.depreciationAmortisation));
  const capex = rawCapex;
  const capexLabel = capex >= 0
    ? 'Proceeds from asset disposals (approx)'
    : 'Capital expenditure (approx)';
  const netInvesting = capex;

  const dividends = -n(is.dividendsPaid);
  const directorsAccount = n(bs.directorsCurrentAccount) - n(priorBs.directorsCurrentAccount);
  const netFinancing = dividends + directorsAccount;

  const netMovement = netOperating + netInvesting + netFinancing;
  const openingCash = n(priorBs.cashAtBank);
  const closingCash = n(bs.cashAtBank);
  const derivedClosing = openingCash + netMovement;
  const variance = derivedClosing - closingCash;

  return {
    profitBeforeTax, addDA, addInterest,
    wcDebtors, wcStock, wcCreditors, wcAccruals, wcPrepayments, totalWC,
    taxPaid, netOperating,
    capexLabel, capex, netInvesting,
    dividends, directorsAccount, netFinancing,
    netMovement, openingCash, closingCash, derivedClosing, variance,
  };
}

export default function CashFlowSection({ financialData }: CashFlowSectionProps) {
  const [wcOpen, setWcOpen] = useState(true);

  const columns = useMemo(() => deriveColumns(financialData), [financialData]);
  const derived = useMemo(() => columns.map(derive), [columns]);

  const hasStatutoryPeriods = useMemo(() => {
    if (!financialData?.periods) return false;
    return financialData.periods.some(
      (p: any) => (p.periodType === 'statutory' || p.periodType === 'historic') && p.fiscalYear
    );
  }, [financialData]);

  if (!hasStatutoryPeriods || columns.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
            Cash Flow Statement
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-8">
            Insufficient data — at least two years of accounts required to derive cashflow.
          </p>
        </CardContent>
      </Card>
    );
  }

  const sectionHdrClass = "text-xs font-semibold uppercase tracking-wide text-muted-foreground py-1.5";
  const subtotalRowClass = "font-semibold bg-primary/5";
  const cellClass = "text-right tabular-nums px-3 py-2";
  const indentClass = "text-sm pl-6";
  const indentItalicClass = "text-sm pl-8 text-muted-foreground italic";
  const colCount = columns.length + 1;

  const sectionRow = (title: string) => (
    <TableRow key={`hdr-${title}`} className="bg-muted/40">
      <TableCell colSpan={colCount} className={sectionHdrClass}>
        {title}
      </TableCell>
    </TableRow>
  );

  const lineRow = (key: string, label: string, vals: number[], cls = "text-sm") => (
    <TableRow key={key}>
      <TableCell className={cls}>{label}</TableCell>
      {vals.map((v, i) => (
        <TableCell key={columns[i].periodId} className={cellClass}>
          {formatCF(v)}
        </TableCell>
      ))}
    </TableRow>
  );

  const subtotalRow = (key: string, label: string, vals: number[]) => (
    <TableRow key={key} className={subtotalRowClass}>
      <TableCell className="text-sm font-semibold border-t">{label}</TableCell>
      {vals.map((v, i) => (
        <TableCell key={columns[i].periodId} className={`${cellClass} border-t`}>
          {formatCF(v)}
        </TableCell>
      ))}
    </TableRow>
  );

  const anyVariance = derived.some(d => Math.abs(d.variance) > 1000);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
          Cash Flow Statement
        </CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[280px] min-w-[220px]"></TableHead>
              {columns.map(col => (
                <TableHead key={col.periodId} className="text-right px-3">
                  {col.label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {/* ── OPERATING ACTIVITIES ─────────────────────────── */}
            {sectionRow('Operating Activities')}
            {lineRow('pbt', 'Profit before tax', derived.map(d => d.profitBeforeTax), 'text-sm')}
            {lineRow('da', 'Add: Depreciation & amortisation', derived.map(d => d.addDA), indentClass)}
            {lineRow('int', 'Add: Interest payable', derived.map(d => d.addInterest), indentClass)}

            {/* Working Capital toggle row */}
            <TableRow
              key="wc-toggle"
              className="cursor-pointer hover:bg-muted/30"
              onClick={() => setWcOpen(o => !o)}
            >
              <TableCell className={`${indentClass} select-none`}>
                <span className="inline-flex items-center gap-1 font-medium">
                  {wcOpen
                    ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                    : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
                  Working capital movements
                </span>
              </TableCell>
              {derived.map((d, i) => (
                <TableCell key={columns[i].periodId} className={cellClass}>
                  {formatCF(d.totalWC)}
                </TableCell>
              ))}
            </TableRow>

            {wcOpen && (
              <>
                {lineRow('wc-debtors', '(Increase) / decrease in trade debtors', derived.map(d => d.wcDebtors), indentItalicClass)}
                {lineRow('wc-stock', '(Increase) / decrease in stock', derived.map(d => d.wcStock), indentItalicClass)}
                {lineRow('wc-creditors', 'Increase / (decrease) in trade creditors', derived.map(d => d.wcCreditors), indentItalicClass)}
                {lineRow('wc-accruals', 'Increase / (decrease) in accruals', derived.map(d => d.wcAccruals), indentItalicClass)}
                {lineRow('wc-prep', '(Decrease) / increase in prepayments', derived.map(d => d.wcPrepayments), indentItalicClass)}
              </>
            )}

            {lineRow('tax', 'Tax paid (approx)', derived.map(d => d.taxPaid), indentClass)}
            {subtotalRow('net-op', 'Net cash from operating activities', derived.map(d => d.netOperating))}

            {/* ── INVESTING ACTIVITIES ─────────────────────────── */}
            {sectionRow('Investing Activities')}
            <TableRow key="capex-row">
              <TableCell className={indentClass}>
                {derived.length === 1
                  ? derived[0].capexLabel
                  : 'Capital expenditure / asset disposals (approx)'}
              </TableCell>
              {derived.map((d, i) => (
                <TableCell key={columns[i].periodId} className={cellClass}>
                  {formatCF(d.capex)}
                </TableCell>
              ))}
            </TableRow>
            {subtotalRow('net-inv', 'Net cash from investing activities', derived.map(d => d.netInvesting))}

            {/* ── FINANCING ACTIVITIES ─────────────────────────── */}
            {sectionRow('Financing Activities')}
            {lineRow('div', 'Dividends paid', derived.map(d => d.dividends), indentClass)}
            {lineRow('dir', "Directors' account movement", derived.map(d => d.directorsAccount), indentClass)}
            {subtotalRow('net-fin', 'Net cash from financing activities', derived.map(d => d.netFinancing))}

            <TableRow key="fin-note">
              <TableCell colSpan={colCount} className="text-xs text-muted-foreground italic py-1 pl-6">
                Excludes debt drawdowns and repayments (not available from statutory accounts)
              </TableCell>
            </TableRow>

            {/* ── NET MOVEMENT ─────────────────────────────────── */}
            {sectionRow('Net Movement in Cash')}
            {subtotalRow('net-move', 'Net increase / (decrease) in cash', derived.map(d => d.netMovement))}
            {lineRow('open', 'Opening cash at bank', derived.map(d => d.openingCash), 'text-sm')}
            {lineRow('close', 'Closing cash at bank', derived.map(d => d.closingCash), 'text-sm font-semibold')}
          </TableBody>
        </Table>

        {/* Reconciliation warning */}
        {anyVariance && (
          <div className="mt-3 space-y-1">
            {derived.map((d, i) =>
              Math.abs(d.variance) > 1000 ? (
                <div key={columns[i].periodId} className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-400">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  <span>
                    <strong>{columns[i].label}</strong> reconciliation difference:{' '}
                    {formatCurrency(Math.abs(d.variance))} — financing activities may be incomplete
                  </span>
                </div>
              ) : null
            )}
          </div>
        )}

        <div className="flex items-center gap-1.5 mt-4 text-xs text-muted-foreground">
          <Info className="h-3.5 w-3.5 shrink-0" />
          Derived using indirect method from statutory accounts. Investing and financing activities are approximate.
        </div>
      </CardContent>
    </Card>
  );
}
