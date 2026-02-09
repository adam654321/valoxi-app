export function formatCurrency(value: number | string | null | undefined): string {
  const num = typeof value === 'string' ? parseFloat(value) : (value ?? 0);
  if (isNaN(num) || num === 0) return '£0';
  const abs = Math.abs(num);
  const formatted = new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(abs);
  return num < 0 ? `(${formatted})` : formatted;
}

export function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined || isNaN(value) || !isFinite(value)) return '—';
  return `${value.toFixed(1)}%`;
}
