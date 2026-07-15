export function formatYtdLabel(fiscalYear: number): string {
  return `YTD ${fiscalYear}`;
}

export function isPartYearPeriod(p: {
  isFullYear?: boolean | null;
  documentCategory?: string | null;
}): boolean {
  if (p?.isFullYear === false) return true;
  return !!p?.documentCategory?.toLowerCase().includes('ytd');
}
