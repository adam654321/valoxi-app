export function formatYtdLabel(periodEnd: string): string {
  const year = new Date(periodEnd).getFullYear();
  return `YTD ${year}`;
}
