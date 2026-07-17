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
