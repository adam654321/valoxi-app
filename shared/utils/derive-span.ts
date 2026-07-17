/**
 * Pure, deterministic span calculator.
 *
 * Priority order:
 *  a. DATE GUARD: if reportDate < periodEnd → cannot be complete → part-year.
 *  b. months_covered: if present and > 0, isFullYear = months >= 11.
 *  c. BS-specific snapshot rule: if documentType === 'balance_sheet' and
 *     periodEnd is present, full-year iff the as-at date is the last day of
 *     a calendar month (i.e. a fiscal year-end snapshot).
 *  d. Fallback: full-year.
 *
 * Category name is NOT a span authority. Pass documentType/reportDate/
 * periodEnd explicitly instead.
 *
 * No Date.now() — pass any "today" in if needed as reportDate or similar.
 */

export interface SpanInput {
  monthsCovered?: number | null;
  periodEnd?: string | null;
  reportDate?: string | null;
  documentType?: string;
}

export interface SpanResult {
  monthsCovered: number | null;
  isFullYear: boolean;
}

/**
 * Returns true if `dateStr` (ISO "YYYY-MM-DD") falls on the last day of its
 * calendar month. Used to identify year-end balance sheet snapshots.
 */
export function isLastDayOfMonth(dateStr: string): boolean {
  const parts = dateStr.split('-');
  if (parts.length < 3) return false;
  const year = Number(parts[0]);
  const month = Number(parts[1]);
  const day = Number(parts[2]);
  if (!year || !month || !day) return false;
  // new Date(year, month, 1) → first day of the *next* month (month is 1-based
  // here so JS receives it as 1-based, which means month is treated as 0-based
  // by Date constructor → adds one month, which is what we want).
  const lastDayNum = new Date(year, month, 1, 0, 0, 0, 0);
  lastDayNum.setDate(lastDayNum.getDate() - 1);
  return day === lastDayNum.getDate();
}

export function computeSpan(input: SpanInput): SpanResult {
  const { monthsCovered, periodEnd, reportDate, documentType } = input;

  // ── a. DATE GUARD ──────────────────────────────────────────────────────────
  // If a generation/as-of date exists AND it is before the claimed period end,
  // the document cannot cover the full period — must be part-year.
  if (reportDate && periodEnd && reportDate < periodEnd) {
    return { isFullYear: false, monthsCovered: null };
  }

  // ── b. months_covered (explicit extraction, most reliable) ─────────────────
  if (typeof monthsCovered === 'number' && monthsCovered > 0) {
    return {
      isFullYear: monthsCovered >= 11,
      monthsCovered: Math.round(monthsCovered),
    };
  }

  // ── c. Balance Sheet snapshot rule ────────────────────────────────────────
  // A balance sheet is a snapshot at a date. If the as-at date (= periodEnd)
  // is the last day of a calendar month, it is a fiscal year-end snapshot →
  // full-year. Mid-month or mid-year dates → part-year.
  if (documentType === 'balance_sheet' && periodEnd) {
    const atYearEnd = isLastDayOfMonth(periodEnd);
    return { isFullYear: atYearEnd, monthsCovered: null };
  }

  // ── d. Fallback ────────────────────────────────────────────────────────────
  return { isFullYear: true, monthsCovered: null };
}
