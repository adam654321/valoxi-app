import { describe, it, expect } from 'vitest';
import { hasAnyValue } from '../has-any-value';

describe('hasAnyValue — phantom P&L fix (Item A)', () => {
  it('returns FALSE when all numeric fields are null but breakdown fields are non-null empty objects', () => {
    expect(hasAnyValue({
      revenue: null,
      costOfSales: null,
      grossProfit: null,
      netProfit: null,
      revenueBreakdown: {},
      costOfSalesBreakdown: {},
      overheadsBreakdown: {},
      exceptionalItems: {},
      sourceDocumentId: 42,
    })).toBe(false);
  });

  it('returns TRUE when any numeric field has a real value', () => {
    expect(hasAnyValue({
      revenue: '100000',
      grossProfit: null,
      revenueBreakdown: {},
      sourceDocumentId: 42,
    })).toBe(true);
  });

  it('returns FALSE for an entirely null/empty object', () => {
    expect(hasAnyValue({ revenue: null, netProfit: null })).toBe(false);
  });

  it('returns FALSE when only a non-null array breakdown is present', () => {
    expect(hasAnyValue({
      revenue: null,
      exceptionalItems: [{ label: 'restructuring', amount: 5000 }],
    })).toBe(false);
  });

  it('does not count sourceDocumentId as a real value', () => {
    expect(hasAnyValue({ revenue: null, sourceDocumentId: 99 })).toBe(false);
  });
});
