const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export function getYtdMonths(periodEnd: string): number {
  return new Date(periodEnd).getMonth() + 1;
}

export function detectYtdPeriods(periods: Array<{ periodEnd: string }>): Map<string, boolean> {
  const result = new Map<string, boolean>();
  if (!periods || periods.length === 0) return result;

  const frequency = new Map<number, number>();
  for (const p of periods) {
    const month = getYtdMonths(p.periodEnd);
    frequency.set(month, (frequency.get(month) ?? 0) + 1);
  }

  let fiscalYearEndMonth = 0;
  let highestFrequency = -1;
  for (const [month, count] of frequency.entries()) {
    if (count > highestFrequency || (count === highestFrequency && month > fiscalYearEndMonth)) {
      highestFrequency = count;
      fiscalYearEndMonth = month;
    }
  }

  for (const p of periods) {
    const month = getYtdMonths(p.periodEnd);
    result.set(p.periodEnd, month !== fiscalYearEndMonth);
  }

  return result;
}

export function formatYtdLabel(periodEnd: string): string {
  const date = new Date(periodEnd);
  const monthName = MONTH_NAMES[date.getMonth()];
  const year = date.getFullYear();
  return `YTD ${monthName} ${year}`;
}
