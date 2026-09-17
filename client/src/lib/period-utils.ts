export { isPartYearPeriod } from '@shared/utils/period';

export function formatYtdLabel(fiscalYear: number): string {
  return `YTD ${fiscalYear}`;
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
