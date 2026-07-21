/**
 * Acceptance tests for Slice 7 — span determined by document content/dates.
 *
 * All tests use the pure computeSpan() function directly so they run without
 * any DB or service infrastructure.
 *
 * Key invariant: varying the documentCategory slot must NOT change the result —
 * that is validated by the final test.
 */
import { describe, it, expect } from 'vitest';
import { computeSpan, isLastDayOfMonth } from '../../../shared/utils/derive-span';

describe('isLastDayOfMonth helper', () => {
  it('31 Mar 2025 → true', () => expect(isLastDayOfMonth('2025-03-31')).toBe(true));
  it('28 Feb 2025 → true (non-leap year)', () => expect(isLastDayOfMonth('2025-02-28')).toBe(true));
  it('29 Feb 2024 → true (leap year)', () => expect(isLastDayOfMonth('2024-02-29')).toBe(true));
  it('8 Sep 2025 → false', () => expect(isLastDayOfMonth('2025-09-08')).toBe(false));
  it('30 Sep 2025 → true', () => expect(isLastDayOfMonth('2025-09-30')).toBe(true));
  it('31 Dec 2024 → true', () => expect(isLastDayOfMonth('2024-12-31')).toBe(true));
});

describe('computeSpan — Slice 7 deterministic fixtures', () => {
  it('Full-year BS, as-at 31 Mar 2025, uploaded to "YTD Balance Sheet" slot → FULL-YEAR', () => {
    const result = computeSpan({
      periodEnd: '2025-03-31',
      reportDate: null,
      monthsCovered: null,
      documentType: 'balance_sheet',
    });
    expect(result.isFullYear).toBe(true);
    expect(result.monthsCovered).toBeNull();
  });

  it('Interim BS, as-at 8 Sept 2025 (mid-FY2026) → part-year', () => {
    const result = computeSpan({
      periodEnd: '2025-09-08',
      reportDate: null,
      monthsCovered: null,
      documentType: 'balance_sheet',
    });
    expect(result.isFullYear).toBe(false);
    expect(result.monthsCovered).toBeNull();
  });

  it('P&L "year ended 31 March 2026", report/footer date Sept 2025 → PART-YEAR via date guard', () => {
    // The claimed period_end is March 2026, but the document was generated in
    // September 2025 → it cannot be complete → date guard fires.
    const result = computeSpan({
      periodEnd: '2026-03-31',
      reportDate: '2025-09-15',
      monthsCovered: null,
      documentType: 'profit_and_loss',
    });
    expect(result.isFullYear).toBe(false);
    expect(result.monthsCovered).toBeNull();
  });

  it('Statutory P&L, 12 months, period-end in the past → FULL-YEAR', () => {
    const result = computeSpan({
      periodEnd: '2024-03-31',
      reportDate: null,
      monthsCovered: 12,
      documentType: 'profit_and_loss',
    });
    expect(result.isFullYear).toBe(true);
    expect(result.monthsCovered).toBe(12);
  });

  it('Genuine YTD P&L, 5 months → part-year', () => {
    const result = computeSpan({
      periodEnd: '2025-08-31',
      reportDate: null,
      monthsCovered: 5,
      documentType: 'profit_and_loss',
    });
    expect(result.isFullYear).toBe(false);
    expect(result.monthsCovered).toBe(5);
  });

  it('Same document in different category slots yields the SAME span (category is not the authority)', () => {
    // The two "slots" differ only by the documentCategory string that was
    // previously used by the old deriveSpan.  computeSpan doesn't receive
    // a category at all — both calls must produce identical output.
    const shared = {
      periodEnd: '2025-03-31',
      reportDate: null,
      monthsCovered: 12,
      documentType: 'profit_and_loss',
    };
    const resultYtdSlot = computeSpan(shared);   // "would have been" YTD slot
    const resultNormalSlot = computeSpan(shared); // normal slot

    expect(resultYtdSlot.isFullYear).toBe(resultNormalSlot.isFullYear);
    expect(resultYtdSlot.monthsCovered).toBe(resultNormalSlot.monthsCovered);
    expect(resultYtdSlot.isFullYear).toBe(true);
  });
});

describe('computeSpan — Slice 18 YTD/interim hint (path d)', () => {
  it('"YTD" in filename → part-year when no content signal overrides', () => {
    const result = computeSpan({
      periodEnd: '2026-06-30',
      reportDate: null,
      monthsCovered: null,
      documentType: 'profit_and_loss',
      ytdHintText: 'Canoports_YTD_Profit_and_Loss.pdf',
    });
    expect(result.isFullYear).toBe(false);
    expect(result.monthsCovered).toBeNull();
  });

  it('"YTD P&L" in filename → part-year', () => {
    const result = computeSpan({
      periodEnd: '2026-04-30',
      reportDate: null,
      monthsCovered: null,
      documentType: 'profit_and_loss',
      ytdHintText: 'Manor Building Solutions YTD P&L.pdf',
    });
    expect(result.isFullYear).toBe(false);
    expect(result.monthsCovered).toBeNull();
  });

  it('"year to date" in filename (spaced) → part-year', () => {
    const result = computeSpan({
      periodEnd: '2026-03-31',
      reportDate: null,
      monthsCovered: null,
      ytdHintText: 'Acme year to date accounts 2026.pdf',
    });
    expect(result.isFullYear).toBe(false);
  });

  it('"year-to-date" in filename (hyphenated) → part-year', () => {
    const result = computeSpan({
      periodEnd: '2026-03-31',
      reportDate: null,
      monthsCovered: null,
      ytdHintText: 'Acme year-to-date accounts.xlsx',
    });
    expect(result.isFullYear).toBe(false);
  });

  it('"Interim" in filename → part-year', () => {
    const result = computeSpan({
      periodEnd: '2025-09-30',
      reportDate: null,
      monthsCovered: null,
      documentType: 'profit_and_loss',
      ytdHintText: 'Interim Accounts Q2 FY2026.pdf',
    });
    expect(result.isFullYear).toBe(false);
  });

  it('Annual accounts filename (no YTD signal) → full-year (fallback)', () => {
    const result = computeSpan({
      periodEnd: '2025-03-31',
      reportDate: null,
      monthsCovered: null,
      documentType: 'profit_and_loss',
      ytdHintText: 'Annual Accounts FY2025.pdf',
    });
    expect(result.isFullYear).toBe(true);
  });

  it('Slice 21 — YTD filename wins over months_covered=12 (name signal is the stronger authority)', () => {
    // An LLM may extract months_covered=12 from a 12-month forecast column inside
    // a document the author explicitly labelled "YTD".  The name signal wins.
    const result = computeSpan({
      periodEnd: '2026-03-31',
      reportDate: null,
      monthsCovered: 12,
      documentType: 'profit_and_loss',
      ytdHintText: 'Canoports_YTD_Profit_and_Loss.pdf',
    });
    expect(result.isFullYear).toBe(false);
    expect(result.monthsCovered).toBe(12);
  });

  it('report_date guard wins over non-YTD filename (path a fires first)', () => {
    const result = computeSpan({
      periodEnd: '2026-03-31',
      reportDate: '2025-09-15',
      monthsCovered: null,
      documentType: 'profit_and_loss',
      ytdHintText: 'Statutory Accounts FY2026.pdf',
    });
    expect(result.isFullYear).toBe(false);
    expect(result.monthsCovered).toBeNull();
  });

  it('YTD hint is case-insensitive', () => {
    const lower = computeSpan({ ytdHintText: 'acme ytd p&l.pdf' });
    const upper = computeSpan({ ytdHintText: 'ACME YTD P&L.PDF' });
    const mixed = computeSpan({ ytdHintText: 'Acme Ytd P&L.pdf' });
    expect(lower.isFullYear).toBe(false);
    expect(upper.isFullYear).toBe(false);
    expect(mixed.isFullYear).toBe(false);
  });

  it('Balance sheet with YTD filename and month-end date → full-year (path c fires before hint)', () => {
    // A balance sheet dated 31 Mar 2026 is a year-end snapshot.
    // Path c (BS snapshot rule) returns before path d (YTD hint) is checked.
    const result = computeSpan({
      periodEnd: '2026-03-31',
      reportDate: null,
      monthsCovered: null,
      documentType: 'balance_sheet',
      ytdHintText: 'YTD Balance Sheet March 2026.pdf',
    });
    expect(result.isFullYear).toBe(true);
  });
});

describe('computeSpan — Slice 21 YTD/interim signal overrides months_covered=12', () => {
  it('months_covered=12 + "YTD" in filename → part-year (Canoports real case)', () => {
    // The exact Sc-1 scenario: Gemini extracted months_covered=12 from the
    // Canoports YTD P&L because the document contains a 12-month forecast column.
    // The filename unambiguously says "YTD" → part-year wins.
    const result = computeSpan({
      monthsCovered: 12,
      periodEnd: '2026-05-31',
      reportDate: null,
      documentType: 'profit_and_loss',
      ytdHintText: 'Canoports_YTD_Profit_and_Loss.pdf',
    });
    expect(result.isFullYear).toBe(false);
    expect(result.monthsCovered).toBe(12);
  });

  it('months_covered=11 + "YTD" in filename → part-year', () => {
    const result = computeSpan({
      monthsCovered: 11,
      periodEnd: '2026-03-31',
      reportDate: null,
      documentType: 'profit_and_loss',
      ytdHintText: 'Company YTD Accounts.pdf',
    });
    expect(result.isFullYear).toBe(false);
    expect(result.monthsCovered).toBe(11);
  });

  it('months_covered=12 + "Interim" in filename → part-year', () => {
    const result = computeSpan({
      monthsCovered: 12,
      periodEnd: '2025-12-31',
      reportDate: null,
      documentType: 'profit_and_loss',
      ytdHintText: 'Interim Accounts FY2025.pdf',
    });
    expect(result.isFullYear).toBe(false);
    expect(result.monthsCovered).toBe(12);
  });

  it('months_covered=12 + "year to date" in filename → part-year', () => {
    const result = computeSpan({
      monthsCovered: 12,
      periodEnd: '2025-09-30',
      reportDate: null,
      ytdHintText: 'Acme year to date report.pdf',
    });
    expect(result.isFullYear).toBe(false);
    expect(result.monthsCovered).toBe(12);
  });

  it('months_covered=12, NO YTD signal → still full-year (unchanged path b)', () => {
    // Confirming the Slice 21 guard only fires when the YTD name signal is present.
    const result = computeSpan({
      monthsCovered: 12,
      periodEnd: '2025-03-31',
      reportDate: null,
      documentType: 'profit_and_loss',
      ytdHintText: 'Annual Statutory Accounts FY2025.pdf',
    });
    expect(result.isFullYear).toBe(true);
    expect(result.monthsCovered).toBe(12);
  });

  it('months_covered=12, ytdHintText=null → still full-year', () => {
    const result = computeSpan({
      monthsCovered: 12,
      periodEnd: '2025-03-31',
      reportDate: null,
      ytdHintText: null,
    });
    expect(result.isFullYear).toBe(true);
    expect(result.monthsCovered).toBe(12);
  });

  it('months_covered=10 (already part-year) + no YTD hint → part-year (unaffected)', () => {
    const result = computeSpan({
      monthsCovered: 10,
      periodEnd: '2025-10-31',
      reportDate: null,
      documentType: 'profit_and_loss',
    });
    expect(result.isFullYear).toBe(false);
    expect(result.monthsCovered).toBe(10);
  });

  it('reportDate < periodEnd + months_covered=12 → part-year (path a still fires first)', () => {
    // Date guard (path a) still takes priority even with months_covered=12
    // and no YTD hint — Slice 21 does not change path a's behaviour.
    const result = computeSpan({
      monthsCovered: 12,
      periodEnd: '2026-03-31',
      reportDate: '2025-09-15',
      documentType: 'profit_and_loss',
      ytdHintText: null,
    });
    expect(result.isFullYear).toBe(false);
    expect(result.monthsCovered).toBeNull();
  });

  it('BS with months_covered=12 + YTD hint → part-year (Slice 21 applies to balance sheets too)', () => {
    // Path c (BS snapshot) is only reached when months_covered is absent.
    // When months_covered=12 is present, path b runs first and the YTD hint applies.
    const result = computeSpan({
      monthsCovered: 12,
      periodEnd: '2026-03-31',
      reportDate: null,
      documentType: 'balance_sheet',
      ytdHintText: 'YTD Balance Sheet FY2026.pdf',
    });
    expect(result.isFullYear).toBe(false);
    expect(result.monthsCovered).toBe(12);
  });
});
