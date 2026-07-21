/**
 * Pure, deterministic span calculator.
 *
 * Priority order:
 *  a. DATE GUARD: if reportDate < periodEnd → cannot be complete → part-year.
 *  b. months_covered: if present and > 0:
 *       • Slice 21 — if months >= 11 AND a YTD/interim name signal is present,
 *         the explicit partial-period filename wins → part-year (isFullYear=false).
 *         A round month count extracted by an LLM from a document that is itself
 *         labelled "YTD" or "Interim" is less reliable than the explicit name
 *         signal; the name is the stronger authority.
 *       • Otherwise isFullYear = months >= 11.
 *  c. BS-specific snapshot rule: if documentType === 'balance_sheet' and
 *     periodEnd is present, full-year iff the as-at date is the last day of
 *     a calendar month (i.e. a fiscal year-end snapshot).
 *  d. YTD / interim text hint: if ytdHintText contains an explicit partial-period
 *     signal ("YTD", "year to date", "interim") → part-year.
 *     Only reached when paths a–c have not already resolved the span.
 *  e. Fallback: full-year.
 *
 * Category name is NOT a span authority. Pass documentType/reportDate/
 * periodEnd explicitly instead.
 *
 * No Date.now() — pass any "today" in if needed as reportDate or similar.
 */

/**
 * Matches explicit partial-period signals in a document name or title.
 *
 * Matches (case-insensitive):
 *   - "YTD" not surrounded by letters — handles both "YTD P&L.pdf" (space
 *     delimited) and "Canoports_YTD_Profit.pdf" (underscore delimited).
 *     Uses negative lookahead/lookbehind against [a-zA-Z] rather than \b so
 *     that underscores (which are \w) do NOT prevent a match.
 *   - "year to date" / "year-to-date"
 *   - "interim" as a whole word (e.g. "Interim P&L", "Interim Accounts")
 */
const YTD_PATTERN = /(?<![a-zA-Z])YTD(?![a-zA-Z])|\byear[\s\-]?to[\s\-]?date\b|\binterim\b/i;

export interface SpanInput {
  monthsCovered?: number | null;
  periodEnd?: string | null;
  reportDate?: string | null;
  documentType?: string;
  /** Filename or document title to check for partial-period keywords (YTD / interim). */
  ytdHintText?: string | null;
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
  const { monthsCovered, periodEnd, reportDate, documentType, ytdHintText } = input;

  // ── a. DATE GUARD ──────────────────────────────────────────────────────────
  // If a generation/as-of date exists AND it is before the claimed period end,
  // the document cannot cover the full period — must be part-year.
  if (reportDate && periodEnd && reportDate < periodEnd) {
    return { isFullYear: false, monthsCovered: null };
  }

  // ── b. months_covered (explicit extraction) ────────────────────────────────
  if (typeof monthsCovered === 'number' && monthsCovered > 0) {
    // Slice 21: when months >= 11 (would be full-year) but a YTD/interim name
    // signal is present, the explicit partial-period label wins.  An LLM can
    // misread a 12-month forecast column as "months_covered=12", but the
    // document author labelling it "YTD" or "Interim" is unambiguous.
    const hasYtdSignal = !!(ytdHintText && YTD_PATTERN.test(ytdHintText));
    if (monthsCovered >= 11 && hasYtdSignal) {
      return { isFullYear: false, monthsCovered: Math.round(monthsCovered) };
    }
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

  // ── d. YTD / interim text hint ─────────────────────────────────────────────
  // When no reliable content signal is available, fall back to checking the
  // document name / title for explicit partial-period keywords.
  // This catches "Canoports_YTD_Profit_and_Loss.pdf", "Manor YTD P&L.pdf",
  // "Interim Accounts Q3.pdf", etc., when Gemini did not extract months_covered
  // or report_date from the document body.
  if (ytdHintText && YTD_PATTERN.test(ytdHintText)) {
    return { isFullYear: false, monthsCovered: null };
  }

  // ── e. Fallback ────────────────────────────────────────────────────────────
  return { isFullYear: true, monthsCovered: null };
}
