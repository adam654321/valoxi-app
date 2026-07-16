export function formatYtdLabel(fiscalYear: number): string {
  return `YTD ${fiscalYear}`;
}

export function isPartYearPeriod(p: {
  monthsCovered?: number | null;
  isFullYear?: boolean | null;
  documentCategory?: string | null;
}): boolean {
  if (p?.monthsCovered != null) return p.monthsCovered < 11;
  if (p?.isFullYear === false) return true;
  return !!p?.documentCategory?.toLowerCase().includes('ytd');
}

export function hasUsableBalanceSheet(bs: any): boolean {
  if (!bs) return false;
  const fields = [
    bs.cashAtBank,
    bs.tradeDebtors,
    bs.tradeCreditors,
    bs.totalCurrentAssets,
    bs.totalCurrentLiabilities,
    bs.totalEquity,
  ];
  return fields.filter(v => v != null).length >= 2;
}
